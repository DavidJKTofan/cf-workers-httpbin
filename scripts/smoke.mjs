// @ts-check
/**
 * Smoke test against a running server, over real HTTP.
 *
 *   npm run dev            # in one terminal
 *   npm run smoke          # in another; defaults to http://localhost:8787
 *   HTTPBIN=https://httpbin.example.com npm run smoke
 *
 * It reads GET /endpoints and sends every endpoint's example request, the same one the
 * web UI sends, so a new route is covered without editing this file. It fails on a
 * network error, a timeout or any 5xx. It also checks that the static UI is served with
 * its security headers and that an unknown path gets the JSON 404.
 *
 * The Vitest suite covers behaviour in depth, but inside the test harness. This script
 * checks the real server: that `wrangler dev` (or a deployment) starts and answers every
 * route over HTTP, that streamed bodies finish, and that `public/_headers` is applied.
 */

const base = (process.env.HTTPBIN ?? 'http://localhost:8787').replace(/\/+$/, '');
const readyTimeoutMs = Number(process.env.SMOKE_READY_TIMEOUT_MS ?? 60_000);
const requestTimeoutMs = 30_000;
const inGitHubActions = process.env.GITHUB_ACTIONS === 'true';

/** @type {string[]} */
const failures = [];

/** @param {string} label @param {string} reason */
function fail(label, reason) {
	failures.push(`${label}: ${reason}`);
	console.log(`✗ ${label}: ${reason}`);
	if (inGitHubActions) console.log(`::error title=Smoke test failed::${label}: ${reason}`);
}

/** @param {string} label @param {Response} response @param {number} started */
function pass(label, response, started) {
	console.log(`✓ ${response.status} ${label} (${Math.round(performance.now() - started)} ms)`);
}

/**
 * Send one request and read the whole body, so streamed and dripped responses are
 * checked to the end. Redirects are returned as sent, not followed.
 *
 * @param {string} path
 * @param {RequestInit} [init]
 */
async function send(path, init = {}) {
	const response = await fetch(base + path, { redirect: 'manual', signal: AbortSignal.timeout(requestTimeoutMs), ...init });
	const text = await response.text();
	return { response, text };
}

/** Poll /endpoints until the server answers, so CI can start it in the background. */
async function waitForServer() {
	const deadline = Date.now() + readyTimeoutMs;
	let lastError = 'no response';
	while (Date.now() < deadline) {
		try {
			const response = await fetch(`${base}/endpoints`, { signal: AbortSignal.timeout(5_000) });
			if (response.ok) return /** @type {Catalogue} */ (await response.json());
			lastError = `HTTP ${response.status}`;
		} catch (error) {
			lastError = error instanceof Error ? error.message : String(error);
		}
		await new Promise((resolve) => setTimeout(resolve, 500));
	}
	throw new Error(`${base} did not answer GET /endpoints within ${readyTimeoutMs} ms (${lastError})`);
}

/**
 * @typedef {{ path: string, method: string, headers?: Record<string, string>, body?: string }} Example
 * @typedef {{ methods: string[], path: string, example: Example }} Endpoint
 * @typedef {{ groups: { endpoints: Endpoint[] }[] }} Catalogue
 */

async function checkStaticUi() {
	const label = 'GET / (static UI)';
	const started = performance.now();
	try {
		const { response, text } = await send('/');
		const type = response.headers.get('content-type') ?? '';
		if (response.status !== 200) return fail(label, `expected 200, got ${response.status}`);
		if (!type.startsWith('text/html')) return fail(label, `expected text/html, got "${type}"`);
		if (!text.includes('<html')) return fail(label, 'body is not an HTML document');
		for (const header of ['content-security-policy', 'x-content-type-options']) {
			if (!response.headers.has(header)) return fail(label, `missing ${header} (is public/_headers applied?)`);
		}
		pass(label, response, started);
	} catch (error) {
		fail(label, error instanceof Error ? error.message : String(error));
	}
}

async function checkNotFound() {
	const path = '/smoke-test/no-such-route';
	const label = `GET ${path} (404)`;
	const started = performance.now();
	try {
		const { response, text } = await send(path);
		if (response.status !== 404) return fail(label, `expected 404, got ${response.status}`);
		const parsed = JSON.parse(text);
		if (parsed.status !== 404 || typeof parsed.error !== 'string') return fail(label, 'expected a JSON error body');
		pass(label, response, started);
	} catch (error) {
		fail(label, error instanceof Error ? error.message : String(error));
	}
}

/** @param {Endpoint} endpoint */
async function checkExample(endpoint) {
	const { path, method, headers, body } = endpoint.example;
	const label = `${method} ${path}`;
	const started = performance.now();
	try {
		const { response } = await send(path, { method, headers, body });
		if (response.status >= 500) return fail(label, `server error ${response.status}`);
		pass(label, response, started);
	} catch (error) {
		fail(label, error instanceof Error ? error.message : String(error));
	}
}

console.log(`Smoke testing ${base}`);
/** @type {Catalogue} */
let catalogue;
try {
	catalogue = await waitForServer();
} catch (error) {
	fail('GET /endpoints', error instanceof Error ? error.message : String(error));
	process.exit(1);
}
const endpoints = catalogue.groups.flatMap((group) => group.endpoints);
if (endpoints.length === 0) fail('GET /endpoints', 'the catalogue lists no endpoints');

await checkStaticUi();
await checkNotFound();
for (const endpoint of endpoints) await checkExample(endpoint);

const total = endpoints.length + 2;
if (failures.length > 0) {
	console.log(`\n${failures.length} of ${total} checks failed.`);
	process.exit(1);
}
console.log(`\nAll ${total} checks passed.`);
