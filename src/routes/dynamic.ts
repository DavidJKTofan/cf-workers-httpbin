import { Buffer } from 'node:buffer';
import { HttpError, html, isNullBodyStatus, json } from '../lib/http';
import { clientIp, echoRequest, requestHeaders } from '../lib/inspect';
import { LIMITS } from '../lib/limits';
import { intParam, intQuery, multiValue, numberQuery } from '../lib/params';
import { timedStream } from '../lib/stream';
import type { RouteGroup } from '../types';

const encoder = new TextEncoder();
const OCTET_STREAM = { 'Content-Type': 'application/octet-stream' };
const BASE64 = /^[A-Za-z0-9+/_-]*={0,2}$/;

/** `crypto.getRandomValues` fills at most 65,536 bytes per call. */
function randomBytes(length: number): Uint8Array {
	const bytes = new Uint8Array(length);
	for (let offset = 0; offset < length; offset += 65_536) {
		crypto.getRandomValues(bytes.subarray(offset, offset + 65_536));
	}
	return bytes;
}

/** Deterministic a-z filler, so any two ranges of the same resource agree byte for byte. */
function alphabetBytes(start: number, length: number): Uint8Array {
	const bytes = new Uint8Array(length);
	for (let i = 0; i < length; i++) bytes[i] = 97 + ((start + i) % 26);
	return bytes;
}

/** Parse a single `bytes=` range against a resource of `size` bytes. */
function parseRange(header: string, size: number): { start: number; end: number } | 'invalid' {
	const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
	if (!match || (match[1] === '' && match[2] === '')) return 'invalid';

	if (match[1] === '') {
		const suffix = Number(match[2]);
		if (suffix === 0) return 'invalid';
		return { start: Math.max(size - suffix, 0), end: size - 1 };
	}

	const start = Number(match[1]);
	const end = match[2] === '' ? size - 1 : Math.min(Number(match[2]), size - 1);
	if (start >= size || start > end) return 'invalid';
	return { start, end };
}

export const dynamic: RouteGroup = {
	id: 'dynamic',
	title: 'Dynamic data',
	routes: [
		{
			methods: ['GET'],
			path: '/uuid',
			summary: 'Generate a random UUID v4',
			handler: () => json({ uuid: crypto.randomUUID() }),
		},
		{
			methods: ['GET'],
			path: '/base64/encode/:text?',
			label: '/base64/encode/:text',
			summary: 'Base64-encode UTF-8 text from the path or ?text=',
			example: { path: '/base64/encode/hello%20world' },
			handler: ({ params, url }) => {
				const text = url.searchParams.get('text') ?? params.text ?? 'httpbin on Workers';
				return json({ text, encoded: Buffer.from(text, 'utf-8').toString('base64') });
			},
		},
		{
			methods: ['GET'],
			path: '/base64/decode/:data?',
			label: '/base64/decode/:data',
			summary: 'Decode base64 from the path or ?data=',
			example: { path: '/base64/decode/aGVsbG8gd29ybGQ=' },
			handler: ({ params, url }) => {
				const encoded = url.searchParams.get('data') ?? params.data ?? 'aHR0cGJpbiBvbiBXb3JrZXJz';
				if (!BASE64.test(encoded)) throw new HttpError(400, 'Invalid base64 string');
				// Accept the URL-safe alphabet too.
				const standard = encoded.replaceAll('-', '+').replaceAll('_', '/');
				return json({ encoded, decoded: Buffer.from(standard, 'base64').toString('utf-8') });
			},
		},
		{
			methods: 'ANY',
			path: '/delay/:seconds',
			summary: `Wait up to ${LIMITS.delaySeconds} seconds, then echo the request`,
			example: { path: '/delay/2' },
			handler: async (c) => {
				const seconds = Number(c.params.seconds);
				if (c.params.seconds === '' || !Number.isFinite(seconds) || seconds < 0) {
					throw new HttpError(400, "'seconds' must be a non-negative number");
				}
				await scheduler.wait(Math.min(seconds, LIMITS.delaySeconds) * 1000);
				return json(await echoRequest(c));
			},
		},
		{
			methods: ['GET'],
			path: '/bytes/:n',
			summary: `Return n random bytes (max ${LIMITS.randomBytes.toLocaleString('en-US')})`,
			example: { path: '/bytes/256' },
			handler: ({ params }) => {
				const n = intParam(params, 'n', { max: LIMITS.randomBytes });
				return new Response(randomBytes(n), { headers: OCTET_STREAM });
			},
		},
		{
			methods: ['GET'],
			path: '/stream/:n',
			summary: `Stream n JSON lines (max ${LIMITS.streamLines})`,
			example: { path: '/stream/5' },
			handler: (c) => {
				const { params, request, url } = c;
				const n = intParam(params, 'n', { max: LIMITS.streamLines });
				const base = {
					url: request.url,
					args: multiValue(url.searchParams),
					headers: requestHeaders(c),
					origin: clientIp(request),
				};
				const body = timedStream(n, 100, (id) => encoder.encode(JSON.stringify({ id, ...base }) + '\n'));
				return new Response(body, { headers: { 'Content-Type': 'application/x-ndjson; charset=utf-8' } });
			},
		},
		{
			methods: ['GET'],
			path: '/range/:n',
			summary: 'Serve n bytes with Range request support',
			example: { path: '/range/1024', headers: { Range: 'bytes=0-99' } },
			handler: ({ params, request }) => {
				const size = intParam(params, 'n', { min: 1, max: LIMITS.rangeBytes });
				const headers = { ...OCTET_STREAM, 'Accept-Ranges': 'bytes', ETag: `"range-${size}"` };

				const rangeHeader = request.headers.get('Range');
				if (!rangeHeader) {
					return new Response(alphabetBytes(0, size), { headers });
				}

				const range = parseRange(rangeHeader, size);
				if (range === 'invalid') {
					return new Response(null, { status: 416, headers: { ...headers, 'Content-Range': `bytes */${size}` } });
				}
				return new Response(alphabetBytes(range.start, range.end - range.start + 1), {
					status: 206,
					headers: { ...headers, 'Content-Range': `bytes ${range.start}-${range.end}/${size}` },
				});
			},
		},
		{
			methods: ['GET'],
			path: '/drip',
			summary: 'Drip ?numbytes= over ?duration= seconds after an optional ?delay=',
			example: { path: '/drip?numbytes=20&duration=2' },
			handler: async ({ url }) => {
				const numbytes = intQuery(url, 'numbytes', 10, { min: 1, max: LIMITS.dripBytes });
				const duration = numberQuery(url, 'duration', 2, LIMITS.dripSeconds);
				const delay = numberQuery(url, 'delay', 0, LIMITS.delaySeconds);
				const code = intQuery(url, 'code', 200);
				if (code < 200 || code > 599 || isNullBodyStatus(code)) {
					throw new HttpError(400, "'code' must be a status between 200 and 599 that allows a body");
				}

				if (delay > 0) await scheduler.wait(delay * 1000);

				// At most 100 chunks, so a large body does not schedule thousands of timers.
				const chunkSize = Math.max(1, Math.ceil(numbytes / 100));
				const chunks = Math.ceil(numbytes / chunkSize);
				const interval = chunks > 1 ? (duration * 1000) / (chunks - 1) : 0;
				const body = timedStream(chunks, interval, (i) => new Uint8Array(Math.min(chunkSize, numbytes - i * chunkSize)).fill(42));

				return new Response(body, { status: code, headers: OCTET_STREAM });
			},
		},
		{
			methods: ['GET'],
			path: '/links/:n/:offset?',
			label: '/links/:n/:offset',
			summary: 'An HTML page with n links to itself',
			example: { path: '/links/10/0' },
			view: 'page',
			handler: ({ params }) => {
				const n = intParam(params, 'n', { min: 1, max: LIMITS.links });
				const offset = params.offset === undefined ? 0 : intParam(params, 'offset');
				const links = Array.from({ length: n }, (_, i) => (i === offset ? `${i}` : `<a href="/links/${n}/${i}">${i}</a>`));
				return html(`<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><title>Links</title></head>
<body>${links.join(' ')}</body>
</html>
`);
			},
		},
	],
};
