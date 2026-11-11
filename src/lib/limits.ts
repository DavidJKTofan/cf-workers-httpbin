/** Upper bounds for anything a caller can scale. Values above a limit are clamped, not rejected. */
export const LIMITS = {
	/** Largest request body the echo endpoints will read into memory. */
	bodyBytes: 1024 * 1024,
	delaySeconds: 10,
	randomBytes: 100_000,
	rangeBytes: 100_000,
	streamLines: 100,
	dripBytes: 100_000,
	dripSeconds: 10,
	links: 200,
	redirects: 20,
} as const;
