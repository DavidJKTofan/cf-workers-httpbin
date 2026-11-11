import { env } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';
import { LIMITS } from '../src/lib/limits';

const asset = (path: string) => env.ASSETS.fetch(new URL(path, 'https://httpbin.test'));

/** Every same-origin file a document loads or a module imports. Links to endpoints are not assets. */
function localReferences(source: string): string[] {
	const attributes = [...source.matchAll(/<(?:link|script|img)\s[^>]*?(?:href|src)="(\/[^"#?]+)"/g)].map((match) => match[1] ?? '');
	const imports = [...source.matchAll(/from '\.\/([\w.-]+\.js)'/g)].map((match) => `/js/${match[1]}`);
	return [...attributes, ...imports];
}

describe('web UI assets', () => {
	it('serves the page with its security headers', async () => {
		const response = await asset('/');
		expect(response.status).toBe(200);
		expect(response.headers.get('Content-Type')).toContain('text/html');
		expect(response.headers.get('Content-Security-Policy')).toContain("script-src 'self'");
		expect(response.headers.get('X-Frame-Options')).toBe('DENY');
	});

	it('has no broken references between the page, its styles and its modules', async () => {
		const queue = ['/'];
		const seen = new Set<string>();
		while (queue.length > 0) {
			const path = queue.pop() ?? '';
			if (seen.has(path)) continue;
			seen.add(path);

			const response = await asset(path);
			expect(response.status, path).toBe(200);
			if (path === '/' || path.endsWith('.js')) {
				queue.push(...localReferences(await response.text()));
			} else {
				await response.body?.cancel();
			}
		}
		// The page, two stylesheets, the favicons and every script module.
		expect(seen.size).toBeGreaterThanOrEqual(12);
	});

	it('opens every external link in a new tab without leaking the opener', async () => {
		const page = await (await asset('/')).text();
		const external = [...page.matchAll(/<a\s[^>]*href="https?:\/\/[^"]+"[^>]*>/g)].map((match) => match[0]);
		expect(external.length).toBeGreaterThan(0);
		for (const link of external) {
			expect(link, link).toContain('target="_blank"');
			expect(link, link).toContain('rel="noopener noreferrer"');
		}
	});

	it('prints the same usage limits the Worker enforces, even before scripts run', async () => {
		const page = await (await asset('/')).text();
		const printed = Object.fromEntries([...page.matchAll(/data-limit="(\w+)">([^<]+)</g)].map((match) => [match[1], match[2]]));
		const expected = Object.fromEntries(
			Object.keys(printed).map((name) => {
				const value = LIMITS[name as keyof typeof LIMITS];
				return [name, name === 'bodyBytes' ? `${value / (1024 * 1024)} MiB` : value.toLocaleString('en-US')];
			}),
		);
		expect(Object.keys(printed).length).toBeGreaterThanOrEqual(6);
		expect(printed).toEqual(expected);
	});

	it('keeps inline scripts and styles out of the page, as its CSP requires', async () => {
		const page = await (await asset('/')).text();
		expect(page).not.toMatch(/<script(?![^>]*\ssrc=)[^>]*>/);
		expect(page).not.toMatch(/<style[\s>]/);
		expect(page).not.toMatch(/\sstyle="/);
		expect(page).not.toMatch(/\son\w+="/);
	});
});
