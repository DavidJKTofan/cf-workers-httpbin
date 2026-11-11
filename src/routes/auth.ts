import { digestResponse, parseBasic, parseBearer, parseDigest, safeEqual } from '../lib/auth';
import { HttpError, json } from '../lib/http';
import type { RouteContext, RouteGroup } from '../types';

const REALM = 'httpbin';
const BASIC_EXAMPLE = { Authorization: `Basic ${btoa('user:passwd')}` };

async function basicMatches({ request, params }: RouteContext): Promise<boolean> {
	const credentials = parseBasic(request.headers.get('Authorization'));
	if (!credentials) return false;
	// Evaluate both comparisons so a wrong user and a wrong password take the same time.
	const [userOk, passwordOk] = await Promise.all([
		safeEqual(credentials.user, params.user ?? ''),
		safeEqual(credentials.password, params.passwd ?? ''),
	]);
	return userOk && passwordOk;
}

function digestChallenge(qop: string): HttpError {
	const nonce = crypto.randomUUID().replaceAll('-', '');
	const opaque = crypto.randomUUID().replaceAll('-', '');
	return new HttpError(401, 'Unauthorized', {
		'WWW-Authenticate': `Digest realm="${REALM}", qop="${qop}", nonce="${nonce}", opaque="${opaque}", algorithm=MD5`,
	});
}

export const auth: RouteGroup = {
	id: 'auth',
	title: 'Authentication',
	routes: [
		{
			methods: ['GET'],
			path: '/basic-auth/:user/:passwd',
			summary: 'Challenge with HTTP Basic auth (401 on failure)',
			example: { path: '/basic-auth/user/passwd', headers: BASIC_EXAMPLE },
			handler: async (c) => {
				if (!(await basicMatches(c))) {
					throw new HttpError(401, 'Unauthorized', { 'WWW-Authenticate': `Basic realm="${REALM}"` });
				}
				return json({ authenticated: true, user: c.params.user });
			},
		},
		{
			methods: ['GET'],
			path: '/hidden-basic-auth/:user/:passwd',
			summary: 'Basic auth that answers 404 instead of challenging',
			example: { path: '/hidden-basic-auth/user/passwd', headers: BASIC_EXAMPLE },
			handler: async (c) => {
				if (!(await basicMatches(c))) throw new HttpError(404, 'Not found');
				return json({ authenticated: true, user: c.params.user });
			},
		},
		{
			methods: ['GET'],
			path: '/bearer',
			summary: 'Require an Authorization: Bearer token',
			example: { path: '/bearer', headers: { Authorization: 'Bearer example-token' } },
			handler: ({ request }) => {
				const token = parseBearer(request.headers.get('Authorization'));
				if (!token) throw new HttpError(401, 'No Bearer token provided', { 'WWW-Authenticate': 'Bearer' });
				return json({ authenticated: true, token });
			},
		},
		{
			methods: ['GET'],
			path: '/digest-auth/:qop/:user/:passwd',
			summary: 'Challenge with HTTP Digest auth (MD5)',
			example: { path: '/digest-auth/auth/user/passwd' },
			handler: async ({ request, params }) => {
				const qop = params.qop === 'auth-int' ? 'auth-int' : 'auth';
				const fields = parseDigest(request.headers.get('Authorization'));
				if (!fields?.response) throw digestChallenge(qop);

				const expected = digestResponse(fields, {
					method: request.method,
					user: params.user ?? '',
					password: params.passwd ?? '',
					realm: REALM,
				});
				const [userOk, responseOk] = await Promise.all([
					safeEqual(fields.username ?? '', params.user ?? ''),
					safeEqual(fields.response.toLowerCase(), expected),
				]);
				if (!userOk || !responseOk) throw digestChallenge(qop);

				return json({ authenticated: true, user: params.user });
			},
		},
	],
};
