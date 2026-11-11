import { Buffer } from 'node:buffer';
import { createHash } from 'node:crypto';

const encoder = new TextEncoder();

/**
 * Constant-time string comparison. Both sides are hashed first so the comparison
 * never short-circuits on, or leaks, the length of the expected value.
 */
export async function safeEqual(provided: string, expected: string): Promise<boolean> {
	const [a, b] = await Promise.all([
		crypto.subtle.digest('SHA-256', encoder.encode(provided)),
		crypto.subtle.digest('SHA-256', encoder.encode(expected)),
	]);
	return crypto.subtle.timingSafeEqual(a, b);
}

export interface BasicCredentials {
	user: string;
	password: string;
}

/** Parse `Authorization: Basic …`. Returns null for anything missing or malformed. */
export function parseBasic(header: string | null): BasicCredentials | null {
	const match = /^Basic\s+([A-Za-z0-9+/=]+)\s*$/i.exec(header ?? '');
	if (!match?.[1]) return null;
	const decoded = Buffer.from(match[1], 'base64').toString('utf-8');
	const separator = decoded.indexOf(':');
	if (separator === -1) return null;
	// Only the first colon separates the two: passwords may contain colons.
	return { user: decoded.slice(0, separator), password: decoded.slice(separator + 1) };
}

export function parseBearer(header: string | null): string | null {
	const match = /^Bearer\s+(\S+)\s*$/i.exec(header ?? '');
	return match?.[1] ?? null;
}

/** Parse the comma-separated `key=value` / `key="value"` pairs of a Digest header. */
export function parseDigest(header: string | null): Record<string, string> | null {
	const match = /^Digest\s+(.+)$/is.exec(header ?? '');
	if (!match?.[1]) return null;
	const fields: Record<string, string> = {};
	for (const [, key, quoted, bare] of match[1].matchAll(/([a-z0-9_-]+)\s*=\s*(?:"((?:[^"\\]|\\.)*)"|([^\s,]+))/gi)) {
		if (key) fields[key.toLowerCase()] = quoted !== undefined ? quoted.replace(/\\(.)/g, '$1') : (bare ?? '');
	}
	return fields;
}

// MD5 is what RFC 7616 digest authentication specifies by default. It is used here to
// interoperate with HTTP clients under test, not to protect anything.
function md5(value: string): string {
	return createHash('md5').update(value).digest('hex');
}

export interface DigestExpectation {
	method: string;
	user: string;
	password: string;
	realm: string;
}

/** The `response` value a correct client would send for these digest fields. */
export function digestResponse(fields: Record<string, string>, expected: DigestExpectation): string {
	const ha1 = md5(`${expected.user}:${expected.realm}:${expected.password}`);
	const ha2 = md5(`${expected.method}:${fields.uri ?? ''}`);
	if (fields.qop) {
		return md5(`${ha1}:${fields.nonce ?? ''}:${fields.nc ?? ''}:${fields.cnonce ?? ''}:${fields.qop}:${ha2}`);
	}
	return md5(`${ha1}:${fields.nonce ?? ''}:${ha2}`);
}
