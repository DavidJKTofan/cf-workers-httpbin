import { HttpError } from '../lib/http';
import type { Handler, RouteContext, RouteGroup } from '../types';

/** Sample images live in `public/images/` and are served through the static assets binding. */
const SAMPLES = {
	png: { file: '/images/sample.png', type: 'image/png' },
	jpeg: { file: '/images/sample.jpg', type: 'image/jpeg' },
	webp: { file: '/images/sample.webp', type: 'image/webp' },
	svg: { file: '/images/sample.svg', type: 'image/svg+xml' },
} as const;

type Format = keyof typeof SAMPLES;

async function serve({ env, url }: RouteContext, format: Format): Promise<Response> {
	const sample = SAMPLES[format];
	const asset = await env.ASSETS.fetch(new URL(sample.file, url));
	if (!asset.ok) throw new HttpError(404, `Sample ${format} image is not deployed`);
	return new Response(asset.body, {
		headers: { 'Content-Type': sample.type, 'Cache-Control': 'public, max-age=86400' },
	});
}

const image = (format: Format): Handler => (c) => serve(c, format);

/** Pick a format from the Accept header, preferring the most compact one the client lists. */
const negotiate: Handler = async (c) => {
	const accept = c.request.headers.get('Accept') ?? '*/*';
	const order: Format[] = ['webp', 'svg', 'jpeg', 'png'];
	const format = order.find((candidate) => accept.includes(SAMPLES[candidate].type)) ?? (/image\/\*|\*\/\*/.test(accept) ? 'png' : null);
	if (!format) {
		throw new HttpError(406, 'Client did not request a supported media type', undefined, {
			accept: Object.values(SAMPLES).map((sample) => sample.type),
		});
	}
	const response = await serve(c, format);
	response.headers.set('Vary', 'Accept');
	return response;
};

export const images: RouteGroup = {
	id: 'images',
	title: 'Images',
	routes: [
		{
			methods: ['GET'],
			path: '/image',
			summary: 'An image in the format the Accept header asks for',
			example: { path: '/image', headers: { Accept: 'image/webp' } },
			handler: negotiate,
		},
		{ methods: ['GET'], path: '/image/png', summary: 'A PNG image', handler: image('png') },
		{ methods: ['GET'], path: '/image/jpeg', summary: 'A JPEG image', handler: image('jpeg') },
		{ methods: ['GET'], path: '/image/webp', summary: 'A WebP image', handler: image('webp') },
		{ methods: ['GET'], path: '/image/svg', summary: 'An SVG image', handler: image('svg') },
	],
};
