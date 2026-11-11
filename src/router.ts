import { HttpError } from './lib/http';
import type { Handler, RouteDef, RouteGroup } from './types';

interface CompiledRoute {
	pattern: URLPattern;
	/** null means any method. */
	methods: ReadonlySet<string> | null;
	handler: Handler;
}

export interface RouteMatch {
	handler: Handler;
	params: Record<string, string>;
}

function allowedMethods(def: RouteDef): ReadonlySet<string> | null {
	if (def.methods === 'ANY') return null;
	const methods = new Set<string>(def.methods);
	// HEAD is GET without the body, so it is valid wherever GET is.
	if (methods.has('GET')) methods.add('HEAD');
	return methods;
}

function decodeParams(groups: Record<string, string | undefined>): Record<string, string> {
	const params: Record<string, string> = {};
	for (const [name, value] of Object.entries(groups)) {
		if (value === undefined) continue;
		try {
			params[name] = decodeURIComponent(value);
		} catch {
			throw new HttpError(400, `Malformed percent-encoding in path segment '${name}'`);
		}
	}
	return params;
}

/**
 * Matches a request against the route table. Patterns are compiled once per isolate;
 * nothing request-specific is kept on the instance.
 */
export class Router {
	private readonly routes: CompiledRoute[];

	constructor(groups: readonly RouteGroup[]) {
		this.routes = groups.flatMap((group) =>
			group.routes.map((def) => ({
				pattern: new URLPattern({ pathname: def.path }),
				methods: allowedMethods(def),
				handler: def.handler,
			})),
		);
	}

	/** Returns null when no path matches. Throws 405 when a path matches but the method does not. */
	match(method: string, pathname: string): RouteMatch | null {
		const allowed = new Set<string>();

		for (const route of this.routes) {
			const result = route.pattern.exec({ pathname });
			if (!result) continue;
			if (route.methods === null || route.methods.has(method)) {
				return { handler: route.handler, params: decodeParams(result.pathname.groups) };
			}
			for (const candidate of route.methods) allowed.add(candidate);
		}

		if (allowed.size > 0) {
			const allow = [...allowed, 'OPTIONS'].join(', ');
			throw new HttpError(405, `Method ${method} not allowed`, { Allow: allow }, { allowed: [...allowed] });
		}
		return null;
	}
}
