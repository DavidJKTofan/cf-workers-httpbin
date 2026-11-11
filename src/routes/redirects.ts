import { HttpError, redirect } from '../lib/http';
import { LIMITS } from '../lib/limits';
import { intParam, intQuery } from '../lib/params';
import type { Handler, RouteGroup } from '../types';

/** Redirect `n` times through `base`, then land on /get. */
function chain(base: string, absolute: boolean): Handler {
	return ({ params, url }) => {
		const n = intParam(params, 'n', { min: 1, max: LIMITS.redirects });
		const next = n > 1 ? `${base}/${n - 1}` : '/get';
		return redirect(absolute ? url.origin + next : next);
	};
}

export const redirects: RouteGroup = {
	id: 'redirects',
	title: 'Redirects',
	routes: [
		{
			methods: ['GET'],
			path: '/redirect/:n',
			summary: 'Redirect n times, then land on /get',
			example: { path: '/redirect/3' },
			handler: chain('/redirect', false),
		},
		{
			methods: ['GET'],
			path: '/relative-redirect/:n',
			summary: 'Redirect n times using relative Location headers',
			example: { path: '/relative-redirect/2' },
			handler: chain('/relative-redirect', false),
		},
		{
			methods: ['GET'],
			path: '/absolute-redirect/:n',
			summary: 'Redirect n times using absolute Location headers',
			example: { path: '/absolute-redirect/2' },
			handler: chain('/absolute-redirect', true),
		},
		{
			methods: 'ANY',
			path: '/redirect-to',
			summary: 'Redirect to ?url= with an optional ?status_code=',
			example: { path: '/redirect-to?url=/get&status_code=307' },
			handler: ({ url }) => {
				const target = url.searchParams.get('url');
				if (!target) throw new HttpError(400, "Missing 'url' query parameter");

				const status = intQuery(url, 'status_code', 302);
				if (status < 300 || status > 399) {
					throw new HttpError(400, "'status_code' must be between 300 and 399");
				}

				try {
					return redirect(target, status);
				} catch {
					throw new HttpError(400, "'url' is not a valid Location header value");
				}
			},
		},
	],
};
