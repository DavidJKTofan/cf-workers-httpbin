import { HttpError, json } from '../lib/http';
import { echoRequest } from '../lib/inspect';
import { intParam, multiValue } from '../lib/params';
import type { RouteGroup } from '../types';

/** Headers that would change how the JSON body is framed or interpreted by the client. */
const LOCKED_HEADERS = new Set(['content-type', 'content-length', 'content-encoding', 'transfer-encoding', 'connection']);

/** Does an If-Match / If-None-Match header list this entity tag? Weak comparison. */
function listsEtag(header: string, etag: string): boolean {
	if (header.trim() === '*') return true;
	return header
		.split(',')
		.map((candidate) => candidate.trim().replace(/^W\//, '').replace(/^"(.*)"$/, '$1'))
		.includes(etag);
}

export const cache: RouteGroup = {
	id: 'cache',
	title: 'Caching and response headers',
	routes: [
		{
			methods: ['GET'],
			path: '/cache',
			summary: '304 when sent a conditional header, otherwise 200 with validators',
			handler: async (c) => {
				const { headers } = c.request;
				if (headers.has('If-Modified-Since') || headers.has('If-None-Match')) {
					return new Response(null, { status: 304 });
				}
				return json(await echoRequest(c), {
					headers: {
						'Last-Modified': new Date().toUTCString(),
						ETag: `"${crypto.randomUUID().replaceAll('-', '')}"`,
					},
				});
			},
		},
		{
			methods: ['GET'],
			path: '/cache/:seconds',
			summary: 'Set Cache-Control: public, max-age=seconds',
			example: { path: '/cache/60' },
			handler: async (c) => {
				const seconds = intParam(c.params, 'seconds');
				return json(await echoRequest(c), { headers: { 'Cache-Control': `public, max-age=${seconds}` } });
			},
		},
		{
			methods: ['GET'],
			path: '/etag/:etag',
			summary: 'Honour If-None-Match (304) and If-Match (412) for the given ETag',
			example: { path: '/etag/abc123', headers: { 'If-None-Match': '"abc123"' } },
			handler: async (c) => {
				const etag = c.params.etag ?? '';
				let headers: Headers;
				try {
					headers = new Headers({ ETag: `"${etag}"` });
				} catch {
					throw new HttpError(400, 'ETag contains characters that are not valid in a header');
				}

				const ifNoneMatch = c.request.headers.get('If-None-Match');
				if (ifNoneMatch !== null && listsEtag(ifNoneMatch, etag)) {
					return new Response(null, { status: 304, headers });
				}
				const ifMatch = c.request.headers.get('If-Match');
				if (ifMatch !== null && !listsEtag(ifMatch, etag)) {
					return new Response(null, { status: 412, headers });
				}
				return json(await echoRequest(c), { headers });
			},
		},
		{
			methods: ['GET', 'POST'],
			path: '/response-headers',
			summary: 'Return the query string as response headers',
			example: { path: '/response-headers?X-Custom=value&Cache-Control=no-store' },
			handler: ({ url }) => {
				const headers = new Headers();
				for (const [name, value] of url.searchParams) {
					if (LOCKED_HEADERS.has(name.toLowerCase())) {
						throw new HttpError(400, `'${name}' cannot be overridden`);
					}
					try {
						headers.append(name, value);
					} catch {
						throw new HttpError(400, `Invalid header name or value: ${name}`);
					}
				}
				return json(multiValue(url.searchParams), { headers });
			},
		},
	],
};
