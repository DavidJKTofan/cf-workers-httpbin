export default {
	async fetch(request: Request, env: Env): Promise<Response> {
		const url = new URL(request.url);
		const path = url.pathname;

		// Serve static assets
		if (path === '/' || path === '/index.html') {
			return env.ASSETS.fetch(request);
		}

		// CORS headers
		const corsHeaders: Record<string, string> = {
			'Access-Control-Allow-Origin': '*',
			'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS, HEAD',
			'Access-Control-Allow-Headers': '*',
			'Access-Control-Expose-Headers': '*',
		};

		if (request.method === 'OPTIONS') {
			return new Response(null, { headers: corsHeaders });
		}

		try {
			// Request inspection helper
			const getRequestData = async () => {
				const headers: Record<string, string> = {};
				request.headers.forEach((value, key) => {
					headers[key] = value;
				});

				let body: any = null;
				let files: Record<string, any> = {};
				const contentType = request.headers.get('content-type') || '';

				if (request.method !== 'GET' && request.method !== 'HEAD') {
					try {
						const clonedRequest = request.clone();
						if (contentType.includes('application/json')) {
							body = await clonedRequest.json();
						} else if (contentType.includes('application/x-www-form-urlencoded')) {
							const formData = await clonedRequest.formData();
							const form: Record<string, any> = {};
							for (const [key, value] of formData.entries()) {
								form[key] = value;
							}
							body = form;
						} else if (contentType.includes('multipart/form-data')) {
							const formData = await clonedRequest.formData();
							const form: Record<string, any> = {};
							for (const [key, value] of formData.entries()) {
								if (value instanceof File) {
									files[key] = {
										filename: value.name,
										size: value.size,
										type: value.type,
									};
								} else {
									form[key] = value;
								}
							}
							body = form;
						} else {
							const text = await clonedRequest.text();
							body = text || null;
						}
					} catch (e) {
						body = null;
					}
				}

				return {
					method: request.method,
					url: request.url,
					headers,
					origin:
						request.headers.get('cf-connecting-ip') ||
						request.headers.get('x-forwarded-for') ||
						request.headers.get('x-real-ip') ||
						'unknown',
					args: Object.fromEntries(url.searchParams),
					data: body,
					files: Object.keys(files).length > 0 ? files : undefined,
					json: typeof body === 'object' && body !== null ? body : null,
					form: contentType.includes('form') ? body : null,
				};
			};

			// Routes with pattern matching
			const routes: Array<{
				pattern: RegExp;
				handler: (matches: RegExpMatchArray) => Promise<Response>;
			}> = [
				// HTTP Methods
				{
					pattern: /^\/(get|post|put|delete|patch|head)$/i,
					handler: async (matches) => {
						const method = matches[1].toUpperCase();
						if (request.method !== method) {
							return jsonResponse({ error: `Method ${request.method} not allowed. Expected ${method}` }, 405, corsHeaders);
						}
						const data = await getRequestData();
						return jsonResponse(data, 200, corsHeaders);
					},
				},
				// Anything - accepts any method
				{
					pattern: /^\/anything(\/.*)?$/,
					handler: async () => {
						const data = await getRequestData();
						return jsonResponse(data, 200, corsHeaders);
					},
				},
				// Status codes
				{
					pattern: /^\/status\/(\d{3})$/,
					handler: async (matches) => {
						const code = parseInt(matches[1]);
						if (code < 100 || code > 599) {
							return jsonResponse({ error: 'Invalid status code. Must be between 100-599' }, 400, corsHeaders);
						}
						const statusText = getStatusText(code);
						// Always return JSON body for consistency
						return jsonResponse({ status: code, message: statusText }, code, corsHeaders);
					},
				},
				// Basic Auth
				{
					pattern: /^\/basic-auth\/([^/]+)\/([^/]+)$/,
					handler: async (matches) => {
						const expectedUser = decodeURIComponent(matches[1]);
						const expectedPass = decodeURIComponent(matches[2]);

						const auth = request.headers.get('Authorization');
						if (!auth || !auth.startsWith('Basic ')) {
							return new Response(JSON.stringify({ error: 'Unauthorized' }), {
								status: 401,
								headers: {
									...corsHeaders,
									'WWW-Authenticate': 'Basic realm="Fake Realm"',
									'Content-Type': 'application/json',
								},
							});
						}

						const credentials = atob(auth.slice(6));
						const [user, pass] = credentials.split(':');

						if (user === expectedUser && pass === expectedPass) {
							return jsonResponse({ authenticated: true, user }, 200, corsHeaders);
						}

						return new Response(JSON.stringify({ error: 'Unauthorized' }), {
							status: 401,
							headers: {
								...corsHeaders,
								'WWW-Authenticate': 'Basic realm="Fake Realm"',
								'Content-Type': 'application/json',
							},
						});
					},
				},
				// Digest Auth (simplified - returns challenge)
				{
					pattern: /^\/digest-auth\/([^/]+)\/([^/]+)\/([^/]+)$/,
					handler: async (matches) => {
						const qop = matches[1]; // auth or auth-int
						const user = decodeURIComponent(matches[2]);
						const pass = decodeURIComponent(matches[3]);

						const auth = request.headers.get('Authorization');
						if (!auth || !auth.startsWith('Digest ')) {
							const nonce = btoa(crypto.randomUUID());
							const opaque = btoa(crypto.randomUUID());
							return new Response(JSON.stringify({ error: 'Unauthorized' }), {
								status: 401,
								headers: {
									...corsHeaders,
									'WWW-Authenticate': `Digest realm="Fake Realm", qop="${qop}", nonce="${nonce}", opaque="${opaque}"`,
									'Content-Type': 'application/json',
								},
							});
						}

						return jsonResponse(
							{
								authenticated: true,
								user,
								message: 'Digest auth validation simplified in this implementation',
							},
							200,
							corsHeaders
						);
					},
				},
				// Hidden Basic Auth (doesn't send challenge on failure)
				{
					pattern: /^\/hidden-basic-auth\/([^/]+)\/([^/]+)$/,
					handler: async (matches) => {
						const expectedUser = decodeURIComponent(matches[1]);
						const expectedPass = decodeURIComponent(matches[2]);

						const auth = request.headers.get('Authorization');
						if (!auth || !auth.startsWith('Basic ')) {
							return jsonResponse({ error: 'Unauthorized' }, 404, corsHeaders);
						}

						const credentials = atob(auth.slice(6));
						const [user, pass] = credentials.split(':');

						if (user === expectedUser && pass === expectedPass) {
							return jsonResponse({ authenticated: true, user }, 200, corsHeaders);
						}

						return jsonResponse({ error: 'Unauthorized' }, 404, corsHeaders);
					},
				},
				// Redirects with count
				{
					pattern: /^\/redirect\/(\d+)$/,
					handler: async (matches) => {
						const n = parseInt(matches[1]);
						if (n <= 1) {
							return jsonResponse(
								{
									message: 'Redirect complete',
									redirects_followed: 0,
								},
								200,
								corsHeaders
							);
						}
						const headers: Record<string, string> = {
							...corsHeaders,
							Location: `/redirect/${n - 1}`,
						};
						return new Response(null, { status: 302, headers });
					},
				},
				// Absolute redirect
				{
					pattern: /^\/absolute-redirect\/(\d+)$/,
					handler: async (matches) => {
						const n = parseInt(matches[1]);
						const headers: Record<string, string> = {
							...corsHeaders,
							Location: n > 1 ? `${url.origin}/absolute-redirect/${n - 1}` : `${url.origin}/get`,
						};
						return new Response(null, { status: 302, headers });
					},
				},
				// Relative redirect
				{
					pattern: /^\/relative-redirect\/(\d+)$/,
					handler: async (matches) => {
						const n = parseInt(matches[1]);
						const headers: Record<string, string> = {
							...corsHeaders,
							Location: n > 1 ? `/relative-redirect/${n - 1}` : '/get',
						};
						return new Response(null, { status: 302, headers });
					},
				},
				// Redirect to URL
				{
					pattern: /^\/redirect-to$/,
					handler: async () => {
						const targetUrl = url.searchParams.get('url');
						const statusCode = parseInt(url.searchParams.get('status_code') || '302');

						if (!targetUrl) {
							return jsonResponse({ error: 'Missing url parameter' }, 400, corsHeaders);
						}

						if (statusCode < 300 || statusCode > 399) {
							return jsonResponse({ error: 'Invalid redirect status code' }, 400, corsHeaders);
						}

						const headers: Record<string, string> = {
							...corsHeaders,
							Location: targetUrl,
						};
						return new Response(null, { status: statusCode, headers });
					},
				},
				// Delay
				{
					pattern: /^\/delay\/(\d+)$/,
					handler: async (matches) => {
						const seconds = parseInt(matches[1]);
						const maxDelay = 10;
						const delay = Math.min(seconds, maxDelay);
						await new Promise((resolve) => setTimeout(resolve, delay * 1000));
						const data = await getRequestData();
						return jsonResponse(data, 200, corsHeaders);
					},
				},
				// Drip - returns data over a duration
				{
					pattern: /^\/drip$/,
					handler: async () => {
						const duration = Math.min(parseFloat(url.searchParams.get('duration') || '2'), 10);
						const numbytes = Math.min(parseInt(url.searchParams.get('numbytes') || '10'), 100000);
						const code = parseInt(url.searchParams.get('code') || '200');
						const delay = Math.min(parseFloat(url.searchParams.get('delay') || '0'), 10);

						await new Promise((resolve) => setTimeout(resolve, delay * 1000));

						const { readable, writable } = new TransformStream();
						const writer = writable.getWriter();
						const encoder = new TextEncoder();

						const chunkSize = 10;
						const numChunks = Math.ceil(numbytes / chunkSize);
						const intervalMs = (duration * 1000) / numChunks;

						(async () => {
							try {
								for (let i = 0; i < numChunks; i++) {
									const chunk = '*'.repeat(Math.min(chunkSize, numbytes - i * chunkSize));
									await writer.write(encoder.encode(chunk));
									if (i < numChunks - 1) {
										await new Promise((resolve) => setTimeout(resolve, intervalMs));
									}
								}
							} finally {
								await writer.close();
							}
						})();

						return new Response(readable, {
							status: code,
							headers: {
								...corsHeaders,
								'Content-Type': 'application/octet-stream',
								'Content-Length': numbytes.toString(),
							},
						});
					},
				},
				// Bytes
				{
					pattern: /^\/bytes\/(\d+)$/,
					handler: async (matches) => {
						const n = parseInt(matches[1]);
						const bytes = Math.min(n, 100000);
						const buffer = new Uint8Array(bytes);
						crypto.getRandomValues(buffer);
						return new Response(buffer, {
							headers: {
								...corsHeaders,
								'Content-Type': 'application/octet-stream',
								'Content-Length': bytes.toString(),
							},
						});
					},
				},
				// Stream
				{
					pattern: /^\/stream\/(\d+)$/,
					handler: async (matches) => {
						const n = parseInt(matches[1]);
						const lines = Math.min(n, 100);

						const { readable, writable } = new TransformStream();
						const writer = writable.getWriter();
						const encoder = new TextEncoder();

						(async () => {
							try {
								for (let i = 0; i < lines; i++) {
									const data = {
										id: i,
										url: request.url,
										headers: Object.fromEntries(request.headers),
										timestamp: new Date().toISOString(),
									};
									await writer.write(encoder.encode(JSON.stringify(data) + '\n'));
									await new Promise((resolve) => setTimeout(resolve, 100));
								}
							} finally {
								await writer.close();
							}
						})();

						return new Response(readable, {
							headers: {
								...corsHeaders,
								'Content-Type': 'application/json',
								'X-Stream-Lines': lines.toString(),
							},
						});
					},
				},
				// Range - returns data with range header support
				{
					pattern: /^\/range\/(\d+)$/,
					handler: async (matches) => {
						const n = parseInt(matches[1]);
						const totalBytes = Math.min(n, 100000);

						const rangeHeader = request.headers.get('Range');
						if (rangeHeader) {
							const match = rangeHeader.match(/bytes=(\d+)-(\d*)/);
							if (match) {
								const start = parseInt(match[1]);
								const end = match[2] ? parseInt(match[2]) : totalBytes - 1;
								const length = end - start + 1;

								if (start >= totalBytes || end >= totalBytes) {
									return new Response(null, {
										status: 416,
										headers: {
											...corsHeaders,
											'Content-Range': `bytes */${totalBytes}`,
										},
									});
								}

								const buffer = new Uint8Array(length);
								crypto.getRandomValues(buffer);

								return new Response(buffer, {
									status: 206,
									headers: {
										...corsHeaders,
										'Content-Type': 'application/octet-stream',
										'Content-Length': length.toString(),
										'Content-Range': `bytes ${start}-${end}/${totalBytes}`,
										'Accept-Ranges': 'bytes',
									},
								});
							}
						}

						const buffer = new Uint8Array(totalBytes);
						crypto.getRandomValues(buffer);
						return new Response(buffer, {
							headers: {
								...corsHeaders,
								'Content-Type': 'application/octet-stream',
								'Content-Length': totalBytes.toString(),
								'Accept-Ranges': 'bytes',
							},
						});
					},
				},
				// Links - returns page with n links
				{
					pattern: /^\/links\/(\d+)(\/(\d+))?$/,
					handler: async (matches) => {
						const n = Math.min(parseInt(matches[1]), 200);
						const offset = matches[3] ? parseInt(matches[3]) : 0;

						let html = '<!DOCTYPE html><html><head><title>Links</title></head><body><h1>Links</h1>';
						for (let i = 0; i < n; i++) {
							if (i === offset) {
								html += `<span>${i}</span> `;
							} else {
								html += `<a href="/links/${n}/${i}">${i}</a> `;
							}
						}
						html += '</body></html>';

						return new Response(html, {
							headers: { ...corsHeaders, 'Content-Type': 'text/html; charset=utf-8' },
						});
					},
				},
				// ETag
				{
					pattern: /^\/etag\/(.+)$/,
					handler: async (matches) => {
						const etag = matches[1];
						const ifNoneMatch = request.headers.get('If-None-Match');

						if (ifNoneMatch === etag || ifNoneMatch === `"${etag}"`) {
							return new Response(null, {
								status: 304,
								headers: {
									...corsHeaders,
									ETag: `"${etag}"`,
								},
							});
						}

						const data = await getRequestData();
						return jsonResponse(data, 200, {
							...corsHeaders,
							ETag: `"${etag}"`,
						});
					},
				},
			];

			// Try route patterns
			for (const route of routes) {
				const matches = path.match(route.pattern);
				if (matches) {
					return await route.handler(matches);
				}
			}

			// Static endpoints
			if (path === '/json') {
				return jsonResponse(
					{
						slideshow: {
							author: 'Yours Truly',
							date: 'date of publication',
							slides: [
								{ title: 'Wake up to WonderWidgets!', type: 'all' },
								{
									items: ['Why <em>WonderWidgets</em> are great', 'Who <em>buys</em> WonderWidgets'],
									title: 'Overview',
									type: 'all',
								},
							],
							title: 'Sample Slide Show',
						},
					},
					200,
					corsHeaders
				);
			}

			if (path === '/html') {
				return new Response(
					`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Herman Melville - Moby-Dick</title>
</head>
<body>
  <h1>Herman Melville - Moby-Dick</h1>
  <div>
    <p>
      Availing himself of the mild, summer-cool weather that now reigned in these latitudes, 
      and in preparation for the peculiarly active pursuits shortly to be anticipated, 
      Perth, the begrimed, blistered old blacksmith, had not removed his portable forge 
      to the hold again, after concluding his contributory work for Ahab's leg, 
      but still retained it on deck, fast lashed to ringbolts by the foremast.
    </p>
  </div>
</body>
</html>`,
					{
						headers: { ...corsHeaders, 'Content-Type': 'text/html; charset=utf-8' },
					}
				);
			}

			if (path === '/xml') {
				return new Response(
					`<?xml version='1.0' encoding='us-ascii'?>
<slideshow title="Sample Slide Show" date="Date of publication" author="Yours Truly">
  <slide type="all">
    <title>Wake up to WonderWidgets!</title>
  </slide>
  <slide type="all">
    <title>Overview</title>
    <item>Why WonderWidgets are great</item>
    <item>Who buys WonderWidgets</item>
  </slide>
</slideshow>`,
					{
						headers: { ...corsHeaders, 'Content-Type': 'application/xml; charset=utf-8' },
					}
				);
			}

			if (path === '/robots.txt') {
				return new Response(`User-agent: *\nDisallow: /deny\n`, {
					headers: { ...corsHeaders, 'Content-Type': 'text/plain; charset=utf-8' },
				});
			}

			if (path === '/deny') {
				return new Response(`YOU SHOULDN'T BE HERE`, {
					headers: { ...corsHeaders, 'Content-Type': 'text/plain; charset=utf-8' },
				});
			}

			if (path === '/headers') {
				const data = await getRequestData();
				return jsonResponse({ headers: data.headers }, 200, corsHeaders);
			}

			if (path === '/user-agent') {
				return jsonResponse(
					{
						'user-agent': request.headers.get('user-agent') || '',
					},
					200,
					corsHeaders
				);
			}

			if (path === '/ip') {
				const data = await getRequestData();
				return jsonResponse({ origin: data.origin }, 200, corsHeaders);
			}

			if (path === '/bearer' || path.startsWith('/bearer/')) {
				const auth = request.headers.get('Authorization');
				if (!auth || !auth.startsWith('Bearer ')) {
					return jsonResponse(
						{
							authenticated: false,
							error: 'No Bearer token provided',
						},
						401,
						corsHeaders
					);
				}

				const token = auth.slice(7);
				return jsonResponse({ authenticated: true, token }, 200, corsHeaders);
			}

			if (path === '/cookies') {
				const cookieHeader = request.headers.get('Cookie') || '';
				const cookies: Record<string, string> = {};
				cookieHeader.split(';').forEach((cookie) => {
					const [key, value] = cookie.trim().split('=');
					if (key) cookies[key] = decodeURIComponent(value || '');
				});
				return jsonResponse({ cookies }, 200, corsHeaders);
			}

			if (path.startsWith('/cookies/set')) {
				const headers: Record<string, string> = { ...corsHeaders, Location: '/cookies' };
				const setCookies: string[] = [];
				url.searchParams.forEach((value, key) => {
					setCookies.push(`${key}=${encodeURIComponent(value)}; Path=/; SameSite=Lax`);
				});
				if (setCookies.length > 0) {
					headers['Set-Cookie'] = setCookies.join(', ');
				}
				return new Response(null, { status: 302, headers });
			}

			if (path.startsWith('/cookies/delete')) {
				const headers: Record<string, string> = { ...corsHeaders, Location: '/cookies' };
				const setCookies: string[] = [];
				url.searchParams.forEach((_, key) => {
					setCookies.push(`${key}=deleted; Path=/; Max-Age=0`);
				});
				if (setCookies.length > 0) {
					headers['Set-Cookie'] = setCookies.join(', ');
				}
				return new Response(null, { status: 302, headers });
			}

			if (path === '/response-headers') {
				const customHeaders: Record<string, string> = { ...corsHeaders };
				url.searchParams.forEach((value, key) => {
					customHeaders[key] = value;
				});
				const data = await getRequestData();
				return jsonResponse(data, 200, customHeaders);
			}

			if (path === '/cache') {
				const headers: Record<string, string> = { ...corsHeaders };
				const ifModified = request.headers.get('If-Modified-Since');
				const ifNone = request.headers.get('If-None-Match');

				if (ifModified || ifNone) {
					return new Response(null, { status: 304, headers });
				}

				const now = new Date();
				headers['Last-Modified'] = now.toUTCString();
				headers['ETag'] = `"${Date.now()}"`;
				headers['Cache-Control'] = 'public, max-age=3600';
				return jsonResponse(
					{
						cached: false,
						timestamp: now.toISOString(),
					},
					200,
					headers
				);
			}

			if (path === '/cache/control' || path.startsWith('/cache/')) {
				const maxAge = parseInt(url.searchParams.get('max_age') || '3600');
				const headers: Record<string, string> = {
					...corsHeaders,
					'Cache-Control': `public, max-age=${maxAge}`,
				};
				return jsonResponse(
					{
						cache_control: headers['Cache-Control'],
						timestamp: new Date().toISOString(),
					},
					200,
					headers
				);
			}

			if (path === '/uuid') {
				return jsonResponse({ uuid: crypto.randomUUID() }, 200, corsHeaders);
			}

			if (path === '/base64/encode' || path.startsWith('/base64/encode/')) {
				const text = url.searchParams.get('text') || path.split('/base64/encode/')[1] || 'SFRUUEJJTiBpcyBhd2Vzb21l';
				try {
					const encoded = btoa(decodeURIComponent(text));
					return jsonResponse({ text, encoded }, 200, corsHeaders);
				} catch (e) {
					return jsonResponse({ error: 'Invalid text for encoding' }, 400, corsHeaders);
				}
			}

			if (path === '/base64/decode' || path.startsWith('/base64/decode/')) {
				const encoded = url.searchParams.get('data') || path.split('/base64/decode/')[1] || 'SFRUUEJJTiBpcyBhd2Vzb21l';
				try {
					const decoded = atob(encoded);
					return jsonResponse({ encoded, decoded }, 200, corsHeaders);
				} catch (e) {
					return jsonResponse({ error: 'Invalid base64 string' }, 400, corsHeaders);
				}
			}

			// Images
			if (path === '/image/png' || path === '/image/jpeg' || path === '/image/webp' || path === '/image/svg') {
				const format = path.split('/')[2];

				const svg = `<svg width="400" height="300" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#667eea;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#764ba2;stop-opacity:1" />
    </linearGradient>
  </defs>
  <rect width="400" height="300" fill="url(#grad)"/>
  <text x="200" y="140" text-anchor="middle" fill="white" font-size="32" font-family="Arial, sans-serif" font-weight="bold">HttpBin</text>
  <text x="200" y="180" text-anchor="middle" fill="rgba(255,255,255,0.8)" font-size="18" font-family="Arial, sans-serif">${format.toUpperCase()} Image</text>
</svg>`;

				return new Response(svg, {
					headers: {
						...corsHeaders,
						'Content-Type': 'image/svg+xml',
						'Cache-Control': 'public, max-age=86400',
					},
				});
			}

			// HTML Forms
			if (path === '/forms/post') {
				if (request.method === 'GET') {
					return new Response(
						`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>HTML Form Test</title>
  <style>
    body { font-family: system-ui; max-width: 600px; margin: 40px auto; padding: 20px; background: #0a0e27; color: #e1e8f0; }
    h1 { color: #00f2fe; }
    form { background: #1a1f3a; padding: 20px; border-radius: 8px; border: 1px solid #2d3748; }
    label { display: block; margin: 15px 0 5px; font-weight: 500; }
    input, textarea, select { width: 100%; padding: 8px; border: 1px solid #2d3748; border-radius: 4px; background: #0a0e27; color: #e1e8f0; }
    button { background: linear-gradient(135deg, #00f2fe, #4facfe); color: #0a0e27; border: none; padding: 12px 24px; border-radius: 6px; cursor: pointer; margin-top: 15px; font-weight: 600; }
    button:hover { opacity: 0.9; }
  </style>
</head>
<body>
  <h1>HTML Form Test</h1>
  <form method="post" action="/forms/post">
    <label>Customer name: <input name="custname" required></label>
    <label>Telephone: <input name="custtel" type="tel"></label>
    <label>E-mail: <input name="custemail" type="email"></label>
    <label>Pizza size:</label>
    <input type="radio" name="size" value="small" id="small"> <label for="small" style="display:inline">Small</label>
    <input type="radio" name="size" value="medium" id="medium"> <label for="medium" style="display:inline">Medium</label>
    <input type="radio" name="size" value="large" id="large"> <label for="large" style="display:inline">Large</label>
    <label>Toppings:</label>
    <input type="checkbox" name="topping" value="bacon" id="bacon"> <label for="bacon" style="display:inline">Bacon</label>
    <input type="checkbox" name="topping" value="cheese" id="cheese"> <label for="cheese" style="display:inline">Extra Cheese</label>
    <input type="checkbox" name="topping" value="onion" id="onion"> <label for="onion" style="display:inline">Onion</label>
    <label>Delivery time: <input name="delivery" type="time" min="11:00" max="21:00" step="900"></label>
    <label>Instructions: <textarea name="comments" rows="4"></textarea></label>
    <button type="submit">Submit Order</button>
  </form>
</body>
</html>`,
						{
							headers: { ...corsHeaders, 'Content-Type': 'text/html; charset=utf-8' },
						}
					);
				} else if (request.method === 'POST') {
					const data = await getRequestData();
					return jsonResponse(data, 200, corsHeaders);
				}
			}

			// Encoding/Decoding
			if (path.startsWith('/gzip') || path.startsWith('/deflate') || path.startsWith('/brotli')) {
				return jsonResponse(
					{
						gzipped: path.startsWith('/gzip'),
						deflated: path.startsWith('/deflate'),
						brotli: path.startsWith('/brotli'),
						method: request.method,
						origin: request.headers.get('cf-connecting-ip') || 'unknown',
						note: 'Compression handled by Cloudflare automatically',
					},
					200,
					corsHeaders
				);
			}

			// UTF-8
			if (path === '/encoding/utf8') {
				return new Response(
					`<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>UTF-8 Demo</title></head>
<body>
  <h1>UTF-8 encoded data</h1>
  <p>Hello World: Καλημέρα κόσμε, こんにちは 世界, 你好世界, مرحبا العالم, שלום עולם</p>
  <p>Emoji: 🌍🌎🌏 🚀🛸 💻📱 ☕🍕🍔</p>
</body>
</html>`,
					{
						headers: { ...corsHeaders, 'Content-Type': 'text/html; charset=utf-8' },
					}
				);
			}

			return jsonResponse(
				{
					error: 'Not found',
					path,
					available_endpoints: [
						'/get',
						'/post',
						'/put',
						'/delete',
						'/patch',
						'/anything',
						'/status/{code}',
						'/headers',
						'/ip',
						'/user-agent',
						'/json',
						'/html',
						'/xml',
						'/robots.txt',
						'/basic-auth/{user}/{pass}',
						'/digest-auth/{qop}/{user}/{pass}',
						'/bearer',
						'/hidden-basic-auth/{user}/{pass}',
						'/cookies',
						'/cookies/set',
						'/cookies/delete',
						'/redirect/{n}',
						'/redirect-to',
						'/absolute-redirect/{n}',
						'/relative-redirect/{n}',
						'/uuid',
						'/delay/{n}',
						'/drip',
						'/range/{n}',
						'/links/{n}/{offset}',
						'/image/{format}',
						'/bytes/{n}',
						'/stream/{n}',
						'/forms/post',
						'/cache',
						'/cache/control',
						'/etag/{etag}',
						'/response-headers',
						'/base64/encode',
						'/base64/decode',
						'/encoding/utf8',
						'/gzip',
						'/deflate',
						'/brotli',
					],
				},
				404,
				corsHeaders
			);
		} catch (error: any) {
			return jsonResponse(
				{
					error: 'Internal server error',
					message: error?.message || String(error),
					stack: error?.stack,
				},
				500,
				corsHeaders
			);
		}
	},
};

function jsonResponse(data: any, status: number, headers: Record<string, string> = {}): Response {
	return new Response(JSON.stringify(data, null, 2), {
		status,
		headers: {
			...headers,
			'Content-Type': 'application/json; charset=utf-8',
		},
	});
}

function getStatusText(code: number): string {
	const statusTexts: Record<number, string> = {
		100: 'Continue',
		101: 'Switching Protocols',
		200: 'OK',
		201: 'Created',
		202: 'Accepted',
		204: 'No Content',
		300: 'Multiple Choices',
		301: 'Moved Permanently',
		302: 'Found',
		304: 'Not Modified',
		400: 'Bad Request',
		401: 'Unauthorized',
		403: 'Forbidden',
		404: 'Not Found',
		405: 'Method Not Allowed',
		418: "I'm a teapot",
		500: 'Internal Server Error',
		502: 'Bad Gateway',
		503: 'Service Unavailable',
	};
	return statusTexts[code] || 'Status';
}

interface Env {
	ASSETS: Fetcher;
}
