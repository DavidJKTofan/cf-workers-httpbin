import { clientIp } from '../lib/inspect';
import type { RouteGroup } from '../types';

export const cloudflare: RouteGroup = {
	id: 'cloudflare',
	title: 'Cloudflare',
	routes: [
		{
			methods: ['GET'],
			path: '/cdn-cgi/trace',
			summary: "Cloudflare's own trace of your connection: data center, protocol, TLS",
			/**
			 * On Cloudflare this path never reaches the Worker: the edge answers every
			 * /cdn-cgi/ request itself. This handler only runs in local development and
			 * tests, where it returns the same `key=value` format from what the runtime
			 * knows, so the endpoint behaves the same everywhere.
			 * https://developers.cloudflare.com/fundamentals/reference/cdn-cgi-endpoint/
			 */
			handler: ({ request, url }) => {
				const { cf } = request;
				const fields: Record<string, string | undefined> = {
					h: url.host,
					ip: clientIp(request),
					ts: (Date.now() / 1000).toFixed(3),
					visit_scheme: url.protocol.replace(':', ''),
					uag: request.headers.get('user-agent') ?? '',
					colo: cf?.colo,
					http: cf?.httpProtocol?.toLowerCase(),
					loc: cf?.country,
					tls: cf?.tlsVersion,
				};
				const body = Object.entries(fields)
					.filter(([, value]) => value !== undefined)
					.map(([key, value]) => `${key}=${value}\n`)
					.join('');
				return new Response(body, {
					headers: { 'Content-Type': 'text/plain; charset=utf-8', 'X-Trace-Source': 'worker-fallback' },
				});
			},
		},
	],
};
