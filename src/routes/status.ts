import { HttpError, isNullBodyStatus, json, STATUS_TEXT } from '../lib/http';
import { intParam } from '../lib/params';
import type { RouteGroup } from '../types';

export const status: RouteGroup = {
	id: 'status',
	title: 'Status codes',
	routes: [
		{
			methods: 'ANY',
			path: '/status/:code',
			summary: 'Respond with the given status code (200-599)',
			example: { path: '/status/418' },
			handler: ({ params }) => {
				const code = intParam(params, 'code');
				// A Worker cannot send a 1xx as its final response, so the usable range starts at 200.
				if (code < 200 || code > 599) {
					throw new HttpError(400, 'Status code must be between 200 and 599');
				}
				if (isNullBodyStatus(code)) {
					return new Response(null, { status: code });
				}
				return json({ status: code, message: STATUS_TEXT[code] ?? 'Unknown status' }, code);
			},
		},
	],
};
