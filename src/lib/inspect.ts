import { Buffer } from 'node:buffer';
import type { RouteContext } from '../types';
import { isCloudflareHeader, showEnv } from './cloudflare';
import { HttpError } from './http';
import { LIMITS } from './limits';
import { multiValue } from './params';

export interface FileSummary {
	filename: string;
	size: number;
	type: string;
}

/** The httpbin-style echo of a request. */
export interface RequestEcho {
	args: Record<string, string | string[]>;
	data: string;
	files: Record<string, FileSummary | FileSummary[]>;
	form: Record<string, string | string[]>;
	headers: Record<string, string>;
	json: unknown;
	method: string;
	origin: string;
	url: string;
}

export function clientIp(request: Request): string {
	return request.headers.get('cf-connecting-ip') ?? request.headers.get('x-real-ip') ?? 'unknown';
}

/** The request headers to echo: everything, or only what the client sent with `?show_env=0`. */
export function requestHeaders({ request, url }: Pick<RouteContext, 'request' | 'url'>): Record<string, string> {
	const all = Object.fromEntries(request.headers);
	if (showEnv(url)) return all;
	return Object.fromEntries(Object.entries(all).filter(([name]) => !isCloudflareHeader(name)));
}

/**
 * Read a request body without trusting its size. Rejects early on Content-Length
 * and stops reading as soon as a chunked body crosses the limit.
 */
export async function readBody(request: Request, limit: number = LIMITS.bodyBytes): Promise<Uint8Array> {
	const tooLarge = () => new HttpError(413, 'Request body too large', undefined, { limit_bytes: limit });

	if (Number(request.headers.get('content-length') ?? 0) > limit) throw tooLarge();
	if (!request.body) return new Uint8Array(0);

	const reader = request.body.getReader();
	const chunks: Uint8Array[] = [];
	let total = 0;
	for (;;) {
		const { done, value } = await reader.read();
		if (done) break;
		total += value.byteLength;
		if (total > limit) {
			await reader.cancel();
			throw tooLarge();
		}
		chunks.push(value);
	}

	const body = new Uint8Array(total);
	let offset = 0;
	for (const chunk of chunks) {
		body.set(chunk, offset);
		offset += chunk.byteLength;
	}
	return body;
}

/** Text for text bodies, a base64 data URL for anything that is not valid UTF-8. */
function bodyAsData(bytes: Uint8Array, contentType: string): string {
	try {
		return new TextDecoder('utf-8', { fatal: true, ignoreBOM: false }).decode(bytes);
	} catch {
		const mime = contentType.split(';')[0]?.trim() || 'application/octet-stream';
		return `data:${mime};base64,${Buffer.from(bytes).toString('base64')}`;
	}
}

async function parseMultipart(bytes: Uint8Array, contentType: string): Promise<Pick<RequestEcho, 'form' | 'files'> | null> {
	let formData: FormData;
	try {
		formData = await new Response(bytes, { headers: { 'Content-Type': contentType } }).formData();
	} catch {
		return null;
	}

	const fields: [string, string][] = [];
	const files: RequestEcho['files'] = {};
	for (const [key, value] of formData.entries()) {
		if (typeof value === 'string') {
			fields.push([key, value]);
			continue;
		}
		const summary: FileSummary = { filename: value.name, size: value.size, type: value.type };
		const existing = files[key];
		if (existing === undefined) files[key] = summary;
		else if (Array.isArray(existing)) existing.push(summary);
		else files[key] = [existing, summary];
	}
	return { form: multiValue(fields), files };
}

export async function echoRequest(c: RouteContext): Promise<RequestEcho> {
	const { request, url } = c;
	const echo: RequestEcho = {
		args: multiValue(url.searchParams),
		data: '',
		files: {},
		form: {},
		headers: requestHeaders(c),
		json: null,
		method: request.method,
		origin: clientIp(request),
		url: request.url,
	};

	if (request.method === 'GET' || request.method === 'HEAD') return echo;

	const bytes = await readBody(request);
	if (bytes.byteLength === 0) return echo;

	const contentType = request.headers.get('content-type') ?? '';
	const mime = contentType.split(';')[0]?.trim().toLowerCase() ?? '';

	if (mime === 'application/x-www-form-urlencoded') {
		echo.form = multiValue(new URLSearchParams(new TextDecoder().decode(bytes)));
		return echo;
	}

	if (mime === 'multipart/form-data') {
		const parsed = await parseMultipart(bytes, contentType);
		if (parsed) return { ...echo, ...parsed };
	}

	echo.data = bodyAsData(bytes, contentType);
	if (mime === 'application/json' || mime.endsWith('+json')) {
		try {
			echo.json = JSON.parse(echo.data);
		} catch {
			// Not valid JSON: leave `json` null and keep the raw text in `data`.
		}
	}
	return echo;
}
