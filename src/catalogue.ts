import type { LIMITS } from './lib/limits';
import type { Example, RouteGroup } from './types';

export interface CatalogueEndpoint {
	methods: string[];
	path: string;
	summary: string;
	example: Required<Pick<Example, 'path' | 'method'>> & Pick<Example, 'headers' | 'body'>;
	view?: 'page';
}

export interface Catalogue {
	limits: typeof LIMITS;
	groups: { id: string; title: string; endpoints: CatalogueEndpoint[] }[];
}

/**
 * The public description of every route and limit. It is derived from the route table
 * and LIMITS, so the web UI, the 404 response and the Worker can never disagree.
 */
export function buildCatalogue(groups: readonly RouteGroup[], limits: typeof LIMITS): Catalogue {
	return {
		limits,
		groups: groups.map(({ id, title, routes }) => ({
			id,
			title,
			endpoints: routes.map((route) => {
				const methods = route.methods === 'ANY' ? ['ANY'] : [...route.methods];
				const path = route.label ?? route.path;
				const fallbackMethod = route.methods === 'ANY' ? 'GET' : (route.methods[0] ?? 'GET');
				return {
					methods,
					path,
					summary: route.summary,
					example: { path, method: fallbackMethod, ...route.example },
					...(route.view ? { view: route.view } : {}),
				};
			}),
		})),
	};
}

export function listPaths(catalogue: Catalogue): string[] {
	return catalogue.groups.flatMap((group) => group.endpoints.map((endpoint) => endpoint.path));
}
