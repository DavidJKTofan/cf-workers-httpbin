import { listPaths } from './catalogue';
import { applyCommonHeaders, preflight } from './lib/cors';
import { errorResponse, HttpError, json } from './lib/http';
import { Router } from './router';
import { catalogue, groups } from './routes';
import type { RouteContext } from './types';

// Compiled once per isolate. Holds only the static route table, never request state.
const router = new Router(groups);

async function handle(request: RouteContext['request'], env: Env, ctx: ExecutionContext): Promise<Response> {
	if (request.method === 'OPTIONS') return preflight(request);

	const url = new URL(request.url);
	const match = router.match(request.method, url.pathname);
	if (!match) {
		throw new HttpError(404, 'Not found', undefined, {
			path: url.pathname,
			catalogue: '/endpoints',
			available_endpoints: listPaths(catalogue),
		});
	}
	return match.handler({ request, url, params: match.params, env, ctx });
}

export default {
	async fetch(request, env, ctx): Promise<Response> {
		try {
			return applyCommonHeaders(await handle(request, env, ctx));
		} catch (error) {
			if (error instanceof HttpError) {
				return applyCommonHeaders(errorResponse(error));
			}

			// Structured, so it is searchable in Workers Logs. Details stay in the log:
			// the client only ever sees a generic message.
			console.error(
				JSON.stringify({
					message: 'unhandled error',
					error: error instanceof Error ? error.message : String(error),
					stack: error instanceof Error ? error.stack : undefined,
					method: request.method,
					path: new URL(request.url).pathname,
					ray: request.headers.get('cf-ray'),
				}),
			);
			return applyCommonHeaders(json({ error: 'Internal server error', status: 500 }, 500));
		}
	},
} satisfies ExportedHandler<Env>;
