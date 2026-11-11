import { describe, expect, it } from 'vitest';
import readme from '../README.md?raw';
import { listPaths } from '../src/catalogue';
import { LIMITS } from '../src/lib/limits';
import { catalogue } from '../src/routes';

/** Paths in the README's endpoint tables: rows shaped like "| GET | `/path` | … |". */
const documented = [...readme.matchAll(/^\| [A-Z, ]+ \| `(\/[^`]*)` \|/gm)].map((match) => match[1]);

describe('README', () => {
	it('documents every endpoint exactly as the Worker describes it', () => {
		for (const group of catalogue.groups) {
			for (const endpoint of group.endpoints) {
				const row = `| ${endpoint.methods.join(', ')} | \`${endpoint.path}\` | ${endpoint.summary} |`;
				expect(readme, `README.md is missing or out of date for ${endpoint.path}`).toContain(row);
			}
		}
	});

	it('documents no endpoint that has been removed', () => {
		expect([...documented].sort()).toEqual([...listPaths(catalogue)].sort());
	});

	it('quotes the limits the Worker enforces', () => {
		const count = (value: number) => value.toLocaleString('en-US');
		const claims = [
			`up to ${LIMITS.bodyBytes / (1024 * 1024)} MiB`,
			`\`/delay\` at ${LIMITS.delaySeconds} seconds`,
			`\`/bytes\` and \`/range\` at ${count(LIMITS.randomBytes)} bytes`,
			`\`/stream\` at ${LIMITS.streamLines} lines`,
			`\`/drip\` at ${count(LIMITS.dripBytes)} bytes over ${LIMITS.dripSeconds} seconds`,
			`\`/links\` at ${LIMITS.links} links`,
			`redirect chains at ${LIMITS.redirects} hops`,
		];
		for (const claim of claims) expect(readme).toContain(claim);
		expect(LIMITS.rangeBytes).toBe(LIMITS.randomBytes);
	});
});
