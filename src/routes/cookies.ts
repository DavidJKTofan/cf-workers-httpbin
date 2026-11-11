import { isCloudflareCookie, showEnv } from '../lib/cloudflare';
import { HttpError, json } from '../lib/http';
import type { RouteGroup } from '../types';

// RFC 6265 cookie-name: a token with no separators or control characters.
const COOKIE_NAME = /^[\w!#$%&'*+.^`|~-]+$/;

function parseCookies(header: string | null): Record<string, string> {
	const cookies: Record<string, string> = {};
	for (const pair of (header ?? '').split(';')) {
		const separator = pair.indexOf('=');
		if (separator === -1) continue;
		const name = pair.slice(0, separator).trim();
		const raw = pair.slice(separator + 1).trim();
		if (!name) continue;
		try {
			cookies[name] = decodeURIComponent(raw);
		} catch {
			cookies[name] = raw;
		}
	}
	return cookies;
}

/** Redirect to /cookies, emitting one Set-Cookie header per cookie. */
function cookieRedirect(entries: Iterable<[string, string]>, attributes: (value: string) => string): Response {
	const headers = new Headers({ Location: '/cookies' });
	for (const [name, value] of entries) {
		if (!COOKIE_NAME.test(name)) throw new HttpError(400, `Invalid cookie name: ${name}`);
		headers.append('Set-Cookie', `${name}=${attributes(value)}`);
	}
	return new Response(null, { status: 302, headers });
}

const setAttributes = (value: string) => `${encodeURIComponent(value)}; Path=/; SameSite=Lax`;

export const cookies: RouteGroup = {
	id: 'cookies',
	title: 'Cookies',
	routes: [
		{
			methods: ['GET'],
			path: '/cookies',
			summary: 'Return the cookies sent with the request',
			handler: ({ request, url }) => {
				const cookies = parseCookies(request.headers.get('Cookie'));
				if (showEnv(url)) return json({ cookies });
				return json({ cookies: Object.fromEntries(Object.entries(cookies).filter(([name]) => !isCloudflareCookie(name))) });
			},
		},
		{
			methods: ['GET'],
			path: '/cookies/set',
			summary: 'Set cookies from the query string, then redirect to /cookies',
			example: { path: '/cookies/set?session=abc123' },
			handler: ({ url }) => cookieRedirect(url.searchParams, setAttributes),
		},
		{
			methods: ['GET'],
			path: '/cookies/set/:name/:value',
			summary: 'Set a single cookie, then redirect to /cookies',
			example: { path: '/cookies/set/theme/dark' },
			handler: ({ params }) => cookieRedirect([[params.name ?? '', params.value ?? '']], setAttributes),
		},
		{
			methods: ['GET'],
			path: '/cookies/delete',
			summary: 'Delete the cookies named in the query string',
			example: { path: '/cookies/delete?session' },
			handler: ({ url }) => cookieRedirect(url.searchParams, () => '; Path=/; Max-Age=0'),
		},
	],
};
