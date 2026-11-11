import { createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import { env, exports } from 'cloudflare:workers';
import worker from '../src/index';

const BASE = 'https://httpbin.test';

/**
 * Send a request through the Worker's default export, the same entry point Cloudflare
 * invokes in production, running inside the Workers runtime.
 */
export function call(path: string, init?: RequestInit): Promise<Response> {
	// 'manual' returns redirects as the Worker sent them instead of following them.
	return exports.default.fetch(new Request(BASE + path, { redirect: 'manual', ...init }));
}

/**
 * Call the handler directly and return the Response object exactly as the Worker built it.
 * Only needed where the fetch path would hide what is being tested: it transparently
 * decodes compressed bodies, as any HTTP client does.
 */
export async function direct(path: string, init?: RequestInit): Promise<Response> {
	const ctx = createExecutionContext();
	const response = await worker.fetch(new Request(BASE + path, init) as Parameters<typeof worker.fetch>[0], env, ctx);
	await waitOnExecutionContext(ctx);
	return response;
}

/** Parsed JSON body. Typed loosely because tests assert on it field by field. */
export async function body(response: Response): Promise<any> {
	return response.json();
}

/** Decode a body as UTF-8 whatever its Content-Type says (binary and NDJSON responses). */
export async function raw(response: Response): Promise<string> {
	return new TextDecoder().decode(await response.arrayBuffer());
}

export function basic(user: string, password: string): Record<string, string> {
	return { Authorization: `Basic ${btoa(`${user}:${password}`)}` };
}
