import { json } from '../lib/http';
import { echoRequest } from '../lib/inspect';
import type { Handler, RouteGroup } from '../types';

const echo: Handler = async (c) => json(await echoRequest(c));

const SAMPLE_BODY = JSON.stringify({ hello: 'world' }, null, 2);
const JSON_HEADERS = { 'Content-Type': 'application/json' };

export const methods: RouteGroup = {
	id: 'methods',
	title: 'HTTP methods',
	routes: [
		{ methods: ['GET'], path: '/get', summary: 'Echo a GET request', handler: echo, example: { path: '/get?foo=bar' } },
		{
			methods: ['POST'],
			path: '/post',
			summary: 'Echo a POST request',
			handler: echo,
			example: { path: '/post', headers: JSON_HEADERS, body: SAMPLE_BODY },
		},
		{
			methods: ['PUT'],
			path: '/put',
			summary: 'Echo a PUT request',
			handler: echo,
			example: { path: '/put', headers: JSON_HEADERS, body: SAMPLE_BODY },
		},
		{
			methods: ['PATCH'],
			path: '/patch',
			summary: 'Echo a PATCH request',
			handler: echo,
			example: { path: '/patch', headers: JSON_HEADERS, body: SAMPLE_BODY },
		},
		{ methods: ['DELETE'], path: '/delete', summary: 'Echo a DELETE request', handler: echo },
		{ methods: ['HEAD'], path: '/head', summary: 'Respond to HEAD with headers only', handler: echo },
		{
			methods: 'ANY',
			path: '/anything/*?',
			label: '/anything/*',
			summary: 'Echo any method on any sub-path',
			handler: echo,
			example: { path: '/anything/some/path?x=1', method: 'POST', headers: JSON_HEADERS, body: SAMPLE_BODY },
		},
	],
};
