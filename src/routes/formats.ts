import { brotliCompressSync } from 'node:zlib';
import { html, json, text } from '../lib/http';
import { clientIp, requestHeaders } from '../lib/inspect';
import type { Handler, RouteGroup } from '../types';

const SAMPLE_JSON = {
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
};

const SAMPLE_HTML = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Herman Melville - Moby-Dick</title>
</head>
<body>
  <h1>Herman Melville - Moby-Dick</h1>
  <p>
    Availing himself of the mild, summer-cool weather that now reigned in these latitudes,
    and in preparation for the peculiarly active pursuits shortly to be anticipated,
    Perth, the begrimed, blistered old blacksmith, had not removed his portable forge
    to the hold again, after concluding his contributory work for Ahab's leg,
    but still retained it on deck, fast lashed to ringbolts by the foremast.
  </p>
</body>
</html>
`;

const SAMPLE_XML = `<?xml version="1.0" encoding="utf-8"?>
<slideshow title="Sample Slide Show" date="Date of publication" author="Yours Truly">
  <slide type="all">
    <title>Wake up to WonderWidgets!</title>
  </slide>
  <slide type="all">
    <title>Overview</title>
    <item>Why WonderWidgets are great</item>
    <item>Who buys WonderWidgets</item>
  </slide>
</slideshow>
`;

const SAMPLE_UTF8 = `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><title>UTF-8 demo</title></head>
<body>
  <h1>UTF-8 encoded data</h1>
  <p>Hello World: Καλημέρα κόσμε, こんにちは 世界, 你好世界, مرحبا بالعالم, שלום עולם</p>
  <p>Symbols: € £ ¥ © ® ™ ± ≠ ≤ ≥ ∞ √ ∑ → ←</p>
  <p>Emoji: 🌍 🚀 💻 ☕</p>
</body>
</html>
`;

type Encoding = 'gzip' | 'deflate' | 'br';

/**
 * Serve a body that really is compressed with the named encoding.
 * `encodeBody: 'manual'` tells the runtime the bytes are already encoded.
 */
function compressed(encoding: Encoding, flag: string): Handler {
	return (c) => {
		const { request } = c;
		const payload = new TextEncoder().encode(
			JSON.stringify({ [flag]: true, method: request.method, origin: clientIp(request), headers: requestHeaders(c) }, null, 2) + '\n',
		);

		const body =
			encoding === 'br'
				? brotliCompressSync(payload)
				: new Blob([payload]).stream().pipeThrough(new CompressionStream(encoding));

		return new Response(body, {
			encodeBody: 'manual',
			headers: {
				'Content-Type': 'application/json; charset=utf-8',
				'Content-Encoding': encoding,
				Vary: 'Accept-Encoding',
			},
		});
	};
}

export const formats: RouteGroup = {
	id: 'formats',
	title: 'Response formats',
	routes: [
		{ methods: ['GET'], path: '/json', summary: 'A sample JSON document', handler: () => json(SAMPLE_JSON) },
		{ methods: ['GET'], path: '/html', summary: 'A sample HTML document', handler: () => html(SAMPLE_HTML) },
		{
			methods: ['GET'],
			path: '/xml',
			summary: 'A sample XML document',
			handler: () => new Response(SAMPLE_XML, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } }),
		},
		{
			methods: ['GET'],
			path: '/robots.txt',
			summary: 'A robots.txt that disallows /deny',
			// /cdn-cgi/ is Cloudflare's own endpoint; keeping crawlers out of it is their recommendation.
			handler: () => text('User-agent: *\nDisallow: /deny\nDisallow: /cdn-cgi/\n'),
		},
		{
			methods: ['GET'],
			path: '/deny',
			summary: 'The page robots.txt asks crawlers to skip',
			handler: () => text("YOU SHOULDN'T BE HERE\n"),
		},
		{ methods: ['GET'], path: '/encoding/utf8', summary: 'A UTF-8 encoded HTML page', handler: () => html(SAMPLE_UTF8) },
		{ methods: ['GET'], path: '/gzip', summary: 'A gzip-encoded JSON response', handler: compressed('gzip', 'gzipped') },
		{ methods: ['GET'], path: '/deflate', summary: 'A deflate-encoded JSON response', handler: compressed('deflate', 'deflated') },
		{ methods: ['GET'], path: '/brotli', summary: 'A Brotli-encoded JSON response', handler: compressed('br', 'brotli') },
	],
};
