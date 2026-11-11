import { describe, expect, it } from 'vitest';
import { LIMITS } from '../src/lib/limits';
import { groups } from '../src/routes';
import { body, call } from './helpers';

describe('cross-cutting behaviour', () => {
	it('adds CORS and nosniff headers to every response, including errors', async () => {
		for (const path of ['/get', '/status/500', '/nope']) {
			const response = await call(path);
			expect(response.headers.get('Access-Control-Allow-Origin'), path).toBe('*');
			expect(response.headers.get('X-Content-Type-Options'), path).toBe('nosniff');
		}
	});

	it('answers CORS preflights', async () => {
		const response = await call('/post', {
			method: 'OPTIONS',
			headers: { Origin: 'https://example.com', 'Access-Control-Request-Headers': 'x-custom, content-type' },
		});
		expect(response.status).toBe(204);
		expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
		expect(response.headers.get('Access-Control-Allow-Headers')).toBe('x-custom, content-type');
		expect(response.headers.get('Access-Control-Allow-Methods')).toContain('PATCH');
	});

	it('returns a helpful 404 for unknown paths', async () => {
		const response = await call('/nope');
		expect(response.status).toBe(404);
		const data = await body(response);
		expect(data).toMatchObject({ error: 'Not found', status: 404, path: '/nope', catalogue: '/endpoints' });
		expect(data.available_endpoints).toContain('/status/:code');
	});

	it('rejects malformed percent-encoding in the path', async () => {
		expect((await call('/etag/%E0%A4%A')).status).toBe(400);
	});
});

describe('endpoint catalogue', () => {
	it('lists every registered route', async () => {
		const response = await call('/endpoints');
		expect(response.status).toBe(200);
		const catalogue = await body(response);
		const listed = catalogue.groups.flatMap((group: { endpoints: unknown[] }) => group.endpoints).length;
		expect(listed).toBe(groups.reduce((total, group) => total + group.routes.length, 0));
	});

	it('publishes the limits the Worker enforces', async () => {
		expect((await body(await call('/endpoints'))).limits).toEqual(LIMITS);
	});

	it('gives every endpoint an example the Worker accepts', async () => {
		// Two examples answer 4xx on purpose: /status/418, and /digest-auth, whose first
		// response is always a 401 challenge. No example should be rejected as malformed.
		const refusals = [400, 404, 405, 406, 413, 416, 500];
		const catalogue = await body(await call('/endpoints'));
		for (const group of catalogue.groups) {
			for (const endpoint of group.endpoints) {
				const { path, method, headers, body: payload } = endpoint.example;
				const response = await call(path, { method, headers, body: payload });
				expect(refusals, `${method} ${path}`).not.toContain(response.status);
				await response.body?.cancel();
			}
		}
	});
});
