/**
 * What Cloudflare adds to a request before the Worker sees it.
 * https://developers.cloudflare.com/fundamentals/reference/http-headers/
 * https://developers.cloudflare.com/fundamentals/reference/policies-compliances/cloudflare-cookies/
 */

/** Added request headers that do not start with `cf-`. */
const ADDED_HEADERS = new Set(['cdn-loop', 'true-client-ip', 'x-forwarded-for', 'x-forwarded-proto', 'x-real-ip']);

/**
 * Bot Management signals that the "Add bot protection headers" Managed Transform can add
 * to requests. They are never echoed, whatever `show_env` says: publishing a bot score or
 * TLS fingerprint tells a client exactly how the zone's bot detection sees it.
 * https://developers.cloudflare.com/rules/transform/managed-transforms/reference/
 */
const NEVER_ECHOED = new Set(['cf-bot-score', 'cf-ja3-hash', 'cf-ja4', 'cf-threat-score', 'cf-verified-bot']);

export function isNeverEchoed(name: string): boolean {
	return NEVER_ECHOED.has(name.toLowerCase());
}

/** Covers __cf_bm, __cflb, __cfruid, _cfuvid, cf_clearance, cf_chl_*, CF_Authorization and similar. */
const COOKIE_PREFIX = /^(?:__cf|_cf|cf_)/i;

export function isCloudflareHeader(name: string): boolean {
	const lower = name.toLowerCase();
	return lower.startsWith('cf-') || ADDED_HEADERS.has(lower);
}

export function isCloudflareCookie(name: string): boolean {
	return COOKIE_PREFIX.test(name);
}

/**
 * Whether to include Cloudflare's additions in an echo. They are shown by default,
 * because seeing them is often the point; `?show_env=0` (or `false`) hides them so
 * the echo contains only what the client sent.
 */
export function showEnv(url: URL): boolean {
	const value = url.searchParams.get('show_env')?.toLowerCase();
	return value !== '0' && value !== 'false';
}
