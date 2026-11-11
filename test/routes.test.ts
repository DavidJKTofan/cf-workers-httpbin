import { createHash } from 'node:crypto';
import { brotliDecompressSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { LIMITS } from '../src/lib/limits';
import { basic, body, call, direct, raw } from './helpers';

const JSON_HEADERS = { 'Content-Type': 'application/json' };

describe('HTTP methods', () => {
	it('echoes a GET request with repeated query keys as arrays', async () => {
		const response = await call('/get?a=1&b=2&b=3', { headers: { 'X-Test': 'yes' } });
		expect(response.status).toBe(200);
		const data = await body(response);
		expect(data.method).toBe('GET');
		expect(data.args).toEqual({ a: '1', b: ['2', '3'] });
		expect(data.headers['x-test']).toBe('yes');
		expect(data.url).toBe('https://httpbin.test/get?a=1&b=2&b=3');
	});

	it('echoes a JSON body as both raw data and parsed json', async () => {
		const response = await call('/post', { method: 'POST', headers: JSON_HEADERS, body: '{"hello":"world"}' });
		const data = await body(response);
		expect(data.data).toBe('{"hello":"world"}');
		expect(data.json).toEqual({ hello: 'world' });
	});

	it('keeps invalid JSON as raw data', async () => {
		const data = await body(await call('/post', { method: 'POST', headers: JSON_HEADERS, body: '{nope' }));
		expect(data.data).toBe('{nope');
		expect(data.json).toBeNull();
	});

	it('parses urlencoded forms, keeping repeated fields', async () => {
		const response = await call('/post', {
			method: 'POST',
			headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
			body: 'custname=Ada&topping=bacon&topping=onion',
		});
		const data = await body(response);
		expect(data.form).toEqual({ custname: 'Ada', topping: ['bacon', 'onion'] });
		expect(data.data).toBe('');
	});

	it('summarises multipart file uploads', async () => {
		const form = new FormData();
		form.set('note', 'hi');
		form.set('upload', new File(['12345'], 'numbers.txt', { type: 'text/plain' }));
		const data = await body(await call('/post', { method: 'POST', body: form }));
		expect(data.form).toEqual({ note: 'hi' });
		expect(data.files.upload).toMatchObject({ filename: 'numbers.txt', size: 5 });
	});

	it('returns binary bodies as a base64 data URL', async () => {
		const response = await call('/post', {
			method: 'POST',
			headers: { 'Content-Type': 'application/octet-stream' },
			body: new Uint8Array([0xff, 0xfe, 0x00]),
		});
		expect((await body(response)).data).toBe('data:application/octet-stream;base64,//4A');
	});

	it('rejects bodies over the size limit', async () => {
		const response = await call('/post', { method: 'POST', body: 'x'.repeat(LIMITS.bodyBytes + 1) });
		expect(response.status).toBe(413);
		expect((await body(response)).limit_bytes).toBe(LIMITS.bodyBytes);
	});

	it('answers 405 with an Allow header for the wrong method', async () => {
		const response = await call('/get', { method: 'POST' });
		expect(response.status).toBe(405);
		expect(response.headers.get('Allow')).toBe('GET, HEAD, OPTIONS');
	});

	it('allows HEAD wherever GET is allowed', async () => {
		expect((await call('/get', { method: 'HEAD' })).status).toBe(200);
	});

	it('accepts any method and sub-path on /anything', async () => {
		for (const path of ['/anything', '/anything/a/b']) {
			const response = await call(path, { method: 'DELETE' });
			expect(response.status).toBe(200);
			expect((await body(response)).method).toBe('DELETE');
		}
	});
});

describe('status codes', () => {
	it('returns the requested status with a JSON body', async () => {
		const response = await call('/status/418');
		expect(response.status).toBe(418);
		expect(await body(response)).toEqual({ status: 418, message: "I'm a teapot" });
	});

	it('returns null-body statuses without a body', async () => {
		for (const code of [204, 304]) {
			const response = await call(`/status/${code}`);
			expect(response.status).toBe(code);
			expect(await response.text()).toBe('');
		}
	});

	it('rejects codes outside 200-599 and non-numeric codes', async () => {
		expect((await call('/status/100')).status).toBe(400);
		expect((await call('/status/600')).status).toBe(400);
		expect((await call('/status/abc')).status).toBe(400);
	});
});

describe('request inspection', () => {
	it('reports headers, IP and user agent', async () => {
		const headers = { 'User-Agent': 'vitest', 'CF-Connecting-IP': '203.0.113.7' };
		expect((await body(await call('/headers', { headers }))).headers['user-agent']).toBe('vitest');
		expect(await body(await call('/ip', { headers }))).toEqual({ origin: '203.0.113.7' });
		expect(await body(await call('/user-agent', { headers }))).toEqual({ 'user-agent': 'vitest' });
	});
});

describe('Cloudflare additions', () => {
	const fromCloudflare = {
		'CF-Connecting-IP': '203.0.113.7',
		'CF-IPCountry': 'PT',
		'CF-Ray': '230b030023ae2822-LIS',
		'CF-Visitor': '{"scheme":"https"}',
		'CDN-Loop': 'cloudflare',
		'X-Forwarded-For': '203.0.113.7',
		'X-Forwarded-Proto': 'https',
		'X-Real-IP': '203.0.113.7',
	};
	const fromClient = { 'User-Agent': 'vitest', 'X-Api-Key': 'abc' };
	const headers = { ...fromCloudflare, ...fromClient };

	it('shows the headers Cloudflare adds by default', async () => {
		const echoed = (await body(await call('/headers', { headers }))).headers;
		expect(echoed).toMatchObject({ 'cf-ray': '230b030023ae2822-LIS', 'x-forwarded-proto': 'https', 'x-api-key': 'abc' });
	});

	it('hides them with ?show_env=0, leaving only what the client sent', async () => {
		for (const path of ['/headers?show_env=0', '/get?show_env=false', '/anything?show_env=0']) {
			const echoed = (await body(await call(path, { headers }))).headers;
			expect(Object.keys(echoed).sort(), path).toEqual(['user-agent', 'x-api-key']);
		}
	});

	it('still reports the caller IP when the headers are hidden', async () => {
		expect((await body(await call('/get?show_env=0', { headers }))).origin).toBe('203.0.113.7');
	});

	it('hides Cloudflare cookies from /cookies only when asked', async () => {
		const cookie = { Cookie: '__cf_bm=abc; cf_clearance=def; _cfuvid=ghi; CF_Authorization=jwt; session=mine' };
		expect(Object.keys((await body(await call('/cookies', { headers: cookie }))).cookies)).toHaveLength(5);
		expect(await body(await call('/cookies?show_env=0', { headers: cookie }))).toEqual({ cookies: { session: 'mine' } });
	});

	it('serves a /cdn-cgi/trace fallback in the edge format', async () => {
		const response = await call('/cdn-cgi/trace', { headers });
		expect(response.headers.get('Content-Type')).toBe('text/plain; charset=utf-8');
		expect(response.headers.get('X-Trace-Source')).toBe('worker-fallback');
		const fields = Object.fromEntries((await response.text()).trim().split('\n').map((line) => line.split(/=(.*)/s).slice(0, 2)));
		expect(fields).toMatchObject({ h: 'httpbin.test', ip: '203.0.113.7', visit_scheme: 'https', uag: 'vitest' });
		expect(Number(fields.ts)).toBeGreaterThan(1_700_000_000);
	});
});

describe('response formats', () => {
	it('serves each sample with its content type', async () => {
		const expected: Record<string, string> = {
			'/json': 'application/json; charset=utf-8',
			'/html': 'text/html; charset=utf-8',
			'/xml': 'application/xml; charset=utf-8',
			'/robots.txt': 'text/plain; charset=utf-8',
			'/deny': 'text/plain; charset=utf-8',
			'/encoding/utf8': 'text/html; charset=utf-8',
		};
		for (const [path, type] of Object.entries(expected)) {
			const response = await call(path);
			expect(response.status, path).toBe(200);
			expect(response.headers.get('Content-Type'), path).toBe(type);
		}
	});

	it('keeps crawlers out of /deny and Cloudflare\'s /cdn-cgi/ in robots.txt', async () => {
		expect(await (await call('/robots.txt')).text()).toBe('User-agent: *\nDisallow: /deny\nDisallow: /cdn-cgi/\n');
	});

	it('really compresses /gzip and /deflate', async () => {
		for (const [path, encoding, flag] of [
			['/gzip', 'gzip', 'gzipped'],
			['/deflate', 'deflate', 'deflated'],
		] as const) {
			const response = await direct(path);
			expect(response.headers.get('Content-Encoding')).toBe(encoding);
			const plain = response.body!.pipeThrough(new DecompressionStream(encoding));
			expect(JSON.parse(await new Response(plain).text())[flag]).toBe(true);
		}
	});

	it('really compresses /brotli', async () => {
		const response = await direct('/brotli');
		expect(response.headers.get('Content-Encoding')).toBe('br');
		const plain = brotliDecompressSync(new Uint8Array(await response.arrayBuffer())).toString('utf-8');
		expect(JSON.parse(plain).brotli).toBe(true);
	});
});

describe('compressed responses, as a client receives them', () => {
	// The Workers fetch path decodes gzip and Brotli, the encodings Cloudflare itself
	// negotiates. deflate is left to the client, and is covered on the raw response above.
	it('decode transparently to JSON', async () => {
		for (const [path, flag] of [
			['/gzip', 'gzipped'],
			['/brotli', 'brotli'],
		] as const) {
			expect((await body(await call(path)))[flag], path).toBe(true);
		}
	});
});

describe('authentication', () => {
	it('challenges Basic auth and accepts the right credentials', async () => {
		const challenge = await call('/basic-auth/user/passwd');
		expect(challenge.status).toBe(401);
		expect(challenge.headers.get('WWW-Authenticate')).toBe('Basic realm="httpbin"');

		expect((await call('/basic-auth/user/passwd', { headers: basic('user', 'wrong') })).status).toBe(401);

		const ok = await call('/basic-auth/user/passwd', { headers: basic('user', 'passwd') });
		expect(await body(ok)).toEqual({ authenticated: true, user: 'user' });
	});

	it('supports passwords that contain colons', async () => {
		const response = await call('/basic-auth/user/a%3Ab%3Ac', { headers: basic('user', 'a:b:c') });
		expect(response.status).toBe(200);
	});

	it('treats a malformed Basic header as unauthenticated, not as a crash', async () => {
		const response = await call('/basic-auth/user/passwd', { headers: { Authorization: 'Basic !!!not-base64!!!' } });
		expect(response.status).toBe(401);
	});

	it('hides the challenge on /hidden-basic-auth', async () => {
		const denied = await call('/hidden-basic-auth/user/passwd');
		expect(denied.status).toBe(404);
		expect(denied.headers.has('WWW-Authenticate')).toBe(false);
		expect((await call('/hidden-basic-auth/user/passwd', { headers: basic('user', 'passwd') })).status).toBe(200);
	});

	it('requires a Bearer token', async () => {
		expect((await call('/bearer')).status).toBe(401);
		const ok = await call('/bearer', { headers: { Authorization: 'Bearer abc.def' } });
		expect(await body(ok)).toEqual({ authenticated: true, token: 'abc.def' });
	});

	it('verifies Digest auth responses', async () => {
		const challenge = await call('/digest-auth/auth/user/passwd');
		expect(challenge.status).toBe(401);
		const header = challenge.headers.get('WWW-Authenticate') ?? '';
		const nonce = /nonce="([^"]+)"/.exec(header)?.[1] ?? '';
		expect(nonce).not.toBe('');

		const md5 = (value: string) => createHash('md5').update(value).digest('hex');
		const uri = '/digest-auth/auth/user/passwd';
		const sign = (password: string) => {
			const ha1 = md5(`user:httpbin:${password}`);
			const ha2 = md5(`GET:${uri}`);
			const response = md5(`${ha1}:${nonce}:00000001:abcdef:auth:${ha2}`);
			return {
				Authorization: `Digest username="user", realm="httpbin", nonce="${nonce}", uri="${uri}", qop=auth, nc=00000001, cnonce="abcdef", response="${response}"`,
			};
		};

		expect((await call(uri, { headers: sign('passwd') })).status).toBe(200);
		expect((await call(uri, { headers: sign('wrong') })).status).toBe(401);
	});
});

describe('cookies', () => {
	it('parses cookies, including values that contain "="', async () => {
		const response = await call('/cookies', { headers: { Cookie: 'a=1; token=abc=def; bad=%E0%A4%A' } });
		expect(await body(response)).toEqual({ cookies: { a: '1', token: 'abc=def', bad: '%E0%A4%A' } });
	});

	it('sets one Set-Cookie header per cookie', async () => {
		const response = await call('/cookies/set?a=1&b=two%20words');
		expect(response.status).toBe(302);
		expect(response.headers.get('Location')).toBe('/cookies');
		expect(response.headers.getSetCookie()).toEqual(['a=1; Path=/; SameSite=Lax', 'b=two%20words; Path=/; SameSite=Lax']);
	});

	it('sets a cookie from the path and deletes by name', async () => {
		expect((await call('/cookies/set/theme/dark')).headers.getSetCookie()).toEqual(['theme=dark; Path=/; SameSite=Lax']);
		expect((await call('/cookies/delete?theme')).headers.getSetCookie()).toEqual(['theme=; Path=/; Max-Age=0']);
	});

	it('rejects invalid cookie names', async () => {
		expect((await call('/cookies/set?bad%20name=1')).status).toBe(400);
	});
});

describe('redirects', () => {
	it('counts down and lands on /get', async () => {
		expect((await call('/redirect/3')).headers.get('Location')).toBe('/redirect/2');
		expect((await call('/redirect/1')).headers.get('Location')).toBe('/get');
		expect((await call('/relative-redirect/2')).headers.get('Location')).toBe('/relative-redirect/1');
		expect((await call('/absolute-redirect/2')).headers.get('Location')).toBe('https://httpbin.test/absolute-redirect/1');
		expect((await call('/absolute-redirect/1')).headers.get('Location')).toBe('https://httpbin.test/get');
	});

	it('redirects to a target with a chosen status', async () => {
		const response = await call('/redirect-to?url=https%3A%2F%2Fexample.com%2F&status_code=307');
		expect(response.status).toBe(307);
		expect(response.headers.get('Location')).toBe('https://example.com/');
	});

	it('validates /redirect-to input', async () => {
		expect((await call('/redirect-to')).status).toBe(400);
		expect((await call('/redirect-to?url=/get&status_code=200')).status).toBe(400);
	});
});

describe('dynamic data', () => {
	it('generates a UUID', async () => {
		expect((await body(await call('/uuid'))).uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
	});

	it('round-trips UTF-8 through base64', async () => {
		const encoded = await body(await call(`/base64/encode/${encodeURIComponent('héllo wörld ✓')}`));
		expect(encoded.encoded).toBe('aMOpbGxvIHfDtnJsZCDinJM=');
		const decoded = await body(await call(`/base64/decode/${encoded.encoded}`));
		expect(decoded.decoded).toBe('héllo wörld ✓');
		expect((await body(await call('/base64/encode?text=hello'))).encoded).toBe('aGVsbG8=');
		expect((await call('/base64/decode/not*base64')).status).toBe(400);
	});

	it('returns the requested number of random bytes, past the 64 KiB getRandomValues quota', async () => {
		expect((await (await call('/bytes/16')).arrayBuffer()).byteLength).toBe(16);
		expect((await (await call('/bytes/70000')).arrayBuffer()).byteLength).toBe(70000);
		expect((await (await call('/bytes/999999999')).arrayBuffer()).byteLength).toBe(LIMITS.randomBytes);
	});

	it('streams newline-delimited JSON', async () => {
		const lines = (await raw(await call('/stream/3'))).trim().split('\n');
		expect(lines.map((line) => JSON.parse(line).id)).toEqual([0, 1, 2]);
	});

	it('drips the requested number of bytes', async () => {
		const response = await call('/drip?numbytes=25&duration=0.1&code=201');
		expect(response.status).toBe(201);
		expect(await raw(response)).toBe('*'.repeat(25));
	});

	it('delays, then echoes', async () => {
		const started = Date.now();
		const response = await call('/delay/0.2');
		expect(response.status).toBe(200);
		expect(Date.now() - started).toBeGreaterThanOrEqual(150);
		expect((await call('/delay/soon')).status).toBe(400);
	});

	it('serves byte ranges consistently', async () => {
		const full = await call('/range/26');
		expect(full.headers.get('Accept-Ranges')).toBe('bytes');
		expect(await raw(full)).toBe('abcdefghijklmnopqrstuvwxyz');

		const part = await call('/range/26', { headers: { Range: 'bytes=5-9' } });
		expect(part.status).toBe(206);
		expect(part.headers.get('Content-Range')).toBe('bytes 5-9/26');
		expect(await raw(part)).toBe('fghij');

		const suffix = await call('/range/26', { headers: { Range: 'bytes=-3' } });
		expect(await raw(suffix)).toBe('xyz');

		const invalid = await call('/range/26', { headers: { Range: 'bytes=40-50' } });
		expect(invalid.status).toBe(416);
		expect(invalid.headers.get('Content-Range')).toBe('bytes */26');
	});

	it('renders a page of links', async () => {
		const page = await (await call('/links/3/1')).text();
		expect(page).toContain('<a href="/links/3/0">0</a> 1 <a href="/links/3/2">2</a>');
		expect((await call('/links/3')).status).toBe(200);
	});
});

describe('caching and response headers', () => {
	it('answers conditional requests on /cache with 304', async () => {
		const fresh = await call('/cache');
		expect(fresh.status).toBe(200);
		expect(fresh.headers.has('ETag')).toBe(true);
		expect(fresh.headers.has('Last-Modified')).toBe(true);
		expect((await call('/cache', { headers: { 'If-None-Match': '"x"' } })).status).toBe(304);
	});

	it('sets Cache-Control on /cache/:seconds', async () => {
		expect((await call('/cache/60')).headers.get('Cache-Control')).toBe('public, max-age=60');
	});

	it('honours If-None-Match and If-Match on /etag', async () => {
		expect((await call('/etag/abc')).headers.get('ETag')).toBe('"abc"');
		expect((await call('/etag/abc', { headers: { 'If-None-Match': 'W/"zzz", "abc"' } })).status).toBe(304);
		expect((await call('/etag/abc', { headers: { 'If-None-Match': '"other"' } })).status).toBe(200);
		expect((await call('/etag/abc', { headers: { 'If-Match': '"other"' } })).status).toBe(412);
	});

	it('reflects query parameters as response headers', async () => {
		const response = await call('/response-headers?X-Custom=value&X-Multi=a&X-Multi=b');
		expect(response.headers.get('X-Custom')).toBe('value');
		expect(response.headers.get('X-Multi')).toBe('a, b');
		expect(await body(response)).toEqual({ 'X-Custom': 'value', 'X-Multi': ['a', 'b'] });
	});

	it('refuses to override the content type or send invalid headers', async () => {
		expect((await call('/response-headers?Content-Type=text/html')).status).toBe(400);
		expect((await call('/response-headers?bad%20name=1')).status).toBe(400);
	});
});

describe('images', () => {
	it('serves each format with its real content type and signature', async () => {
		const signatures: Record<string, [string, number[]]> = {
			'/image/png': ['image/png', [0x89, 0x50, 0x4e, 0x47]],
			'/image/jpeg': ['image/jpeg', [0xff, 0xd8, 0xff]],
			'/image/webp': ['image/webp', [0x52, 0x49, 0x46, 0x46]],
			'/image/svg': ['image/svg+xml', [0x3c]],
		};
		for (const [path, [type, magic]] of Object.entries(signatures)) {
			const response = await call(path);
			expect(response.status, path).toBe(200);
			expect(response.headers.get('Content-Type'), path).toBe(type);
			const bytes = new Uint8Array(await response.arrayBuffer());
			expect([...bytes.subarray(0, magic.length)], path).toEqual(magic);
		}
	});

	it('negotiates /image by Accept header', async () => {
		const webp = await call('/image', { headers: { Accept: 'image/webp,image/*' } });
		expect(webp.headers.get('Content-Type')).toBe('image/webp');
		expect(webp.headers.get('Vary')).toBe('Accept');
		expect((await call('/image', { headers: { Accept: '*/*' } })).headers.get('Content-Type')).toBe('image/png');
		expect((await call('/image', { headers: { Accept: 'text/plain' } })).status).toBe(406);
	});
});

describe('forms', () => {
	it('serves the form on GET and echoes it on POST', async () => {
		const page = await call('/forms/post');
		expect(page.headers.get('Content-Type')).toBe('text/html; charset=utf-8');
		const posted = await call('/forms/post', {
			method: 'POST',
			headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
			body: 'custname=Ada&size=large',
		});
		expect((await body(posted)).form).toEqual({ custname: 'Ada', size: 'large' });
		expect((await call('/forms/post', { method: 'PUT' })).status).toBe(405);
	});
});
