export type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD';

/** Everything a handler needs. Built per request and passed down; never stored globally. */
export interface RouteContext {
	/** The incoming request, with Cloudflare's `cf` properties typed. */
	request: Request<unknown, IncomingRequestCfProperties>;
	url: URL;
	/** Decoded path parameters from the route pattern. */
	params: Record<string, string>;
	env: Env;
	ctx: ExecutionContext;
}

export type Handler = (c: RouteContext) => Response | Promise<Response>;

/** How the web UI should try an endpoint. */
export interface Example {
	path: string;
	method?: Method;
	headers?: Record<string, string>;
	body?: string;
}

export interface RouteDef {
	/** Allowed methods, or 'ANY'. HEAD is implied wherever GET is allowed. */
	methods: readonly Method[] | 'ANY';
	/** URLPattern pathname, e.g. `/status/:code`. */
	path: string;
	/** Path shown in the catalogue when the pattern itself is not readable. */
	label?: string;
	summary: string;
	handler: Handler;
	example?: Example;
	/** 'page' endpoints return a document the UI opens in a new tab instead of fetching. */
	view?: 'page';
}

export interface RouteGroup {
	id: string;
	title: string;
	routes: RouteDef[];
}
