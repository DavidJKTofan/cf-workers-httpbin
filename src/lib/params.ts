import { HttpError } from './http';

interface IntOptions {
	min?: number;
	/** Values above `max` are clamped rather than rejected. */
	max?: number;
}

function parseInteger(name: string, raw: string, { min = 0, max }: IntOptions): number {
	if (!/^\d+$/.test(raw)) {
		throw new HttpError(400, `'${name}' must be a non-negative integer`);
	}
	const value = Number(raw);
	if (value < min) {
		throw new HttpError(400, `'${name}' must be at least ${min}`);
	}
	return max === undefined ? value : Math.min(value, max);
}

export function intParam(params: Record<string, string>, name: string, options: IntOptions = {}): number {
	return parseInteger(name, params[name] ?? '', options);
}

export function intQuery(url: URL, name: string, fallback: number, options: IntOptions = {}): number {
	const raw = url.searchParams.get(name);
	return raw === null ? fallback : parseInteger(name, raw, options);
}

/** Non-negative decimal from the query string, clamped to `max`. */
export function numberQuery(url: URL, name: string, fallback: number, max: number): number {
	const raw = url.searchParams.get(name);
	if (raw === null) return fallback;
	const value = Number(raw);
	if (raw.trim() === '' || !Number.isFinite(value) || value < 0) {
		throw new HttpError(400, `'${name}' must be a non-negative number`);
	}
	return Math.min(value, max);
}

/** Collapse repeated keys into arrays, the way httpbin reports `args` and `form`. */
export function multiValue(entries: Iterable<[string, string]>): Record<string, string | string[]> {
	const out: Record<string, string | string[]> = {};
	for (const [key, value] of entries) {
		const existing = out[key];
		if (existing === undefined) out[key] = value;
		else if (Array.isArray(existing)) existing.push(value);
		else out[key] = [existing, value];
	}
	return out;
}
