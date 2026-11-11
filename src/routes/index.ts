import { buildCatalogue } from '../catalogue';
import { json } from '../lib/http';
import { LIMITS } from '../lib/limits';
import type { RouteGroup } from '../types';
import { auth } from './auth';
import { cache } from './cache';
import { cloudflare } from './cloudflare';
import { cookies } from './cookies';
import { dynamic } from './dynamic';
import { formats } from './formats';
import { forms } from './forms';
import { images } from './images';
import { inspect } from './inspect';
import { methods } from './methods';
import { redirects } from './redirects';
import { status } from './status';

const service: RouteGroup = {
	id: 'service',
	title: 'Service',
	routes: [
		{
			methods: ['GET'],
			path: '/endpoints',
			summary: 'This catalogue of endpoints and limits as JSON',
			handler: () => json(catalogue),
		},
	],
};

/**
 * The route table. To add an endpoint, add a route to one of these groups (or add a
 * new group file and list it here). Order matters only where two patterns overlap.
 */
export const groups: readonly RouteGroup[] = [
	methods,
	status,
	inspect,
	formats,
	auth,
	cookies,
	redirects,
	dynamic,
	cache,
	images,
	forms,
	cloudflare,
	service,
];

export const catalogue = buildCatalogue(groups, LIMITS);
