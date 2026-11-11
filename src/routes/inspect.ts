import { json } from '../lib/http';
import { clientIp, requestHeaders } from '../lib/inspect';
import type { RouteGroup } from '../types';

export const inspect: RouteGroup = {
	id: 'inspect',
	title: 'Request inspection',
	routes: [
		{
			methods: ['GET'],
			path: '/headers',
			summary: 'Return the request headers (?show_env=0 hides those Cloudflare adds)',
			handler: (c) => json({ headers: requestHeaders(c) }),
		},
		{
			methods: ['GET'],
			path: '/ip',
			summary: "Return the caller's IP address",
			handler: ({ request }) => json({ origin: clientIp(request) }),
		},
		{
			methods: ['GET'],
			path: '/user-agent',
			summary: 'Return the User-Agent header',
			handler: ({ request }) => json({ 'user-agent': request.headers.get('user-agent') ?? '' }),
		},
	],
};
