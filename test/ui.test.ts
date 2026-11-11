import { describe, expect, it } from 'vitest';
import { toCurl } from '../public/js/curl.js';
import { describeBody, formatBytes } from '../public/js/response.js';

const encode = (text: string) => new TextEncoder().encode(text).buffer as ArrayBuffer;

describe('curl command', () => {
	it('omits -X for GET and uses -I for HEAD', () => {
		expect(toCurl({ method: 'GET', url: 'https://h.test/get', headers: [], body: null })).toBe("curl 'https://h.test/get'");
		expect(toCurl({ method: 'HEAD', url: 'https://h.test/get', headers: [], body: null })).toBe("curl -I 'https://h.test/get'");
	});

	it('adds headers and the body on continuation lines', () => {
		const command = toCurl({
			method: 'POST',
			url: 'https://h.test/post',
			headers: [['Content-Type', 'application/json']],
			body: '{"a":1}',
		});
		expect(command).toBe("curl -X POST 'https://h.test/post' \\\n  -H 'Content-Type: application/json' \\\n  --data-raw '{\"a\":1}'");
	});

	it('quotes values so pasted commands cannot run anything else', () => {
		const command = toCurl({
			method: 'POST',
			url: "https://h.test/anything/it's?x=$(id)",
			headers: [['X-Note', "'; rm -rf ~ #"]],
			body: '`whoami`',
		});
		// Single quotes stop every expansion; an embedded quote is closed, escaped and reopened.
		expect(command).toContain("'https://h.test/anything/it'\\''s?x=$(id)'");
		expect(command).toContain("-H 'X-Note: '\\''; rm -rf ~ #'");
		expect(command).toContain("--data-raw '`whoami`'");
	});
});

describe('response viewer', () => {
	it('pretty-prints JSON and leaves other text alone', () => {
		expect(describeBody(encode('{"a":[1,2]}'), 'application/json; charset=utf-8')).toEqual({
			kind: 'text',
			text: '{\n  "a": [\n    1,\n    2\n  ]\n}',
		});
		expect(describeBody(encode('<b>hi</b>'), 'text/html')).toEqual({ kind: 'text', text: '<b>hi</b>' });
	});

	it('shows binary bodies as a hex dump and empty bodies as empty', () => {
		const binary = describeBody(new Uint8Array([0xff, 0x00, 0x41]).buffer as ArrayBuffer, 'application/octet-stream');
		expect(binary.kind).toBe('binary');
		expect(binary.text).toMatch(/^00000000 {2}ff 00 41\s+\.\.A$/);
		expect(describeBody(new ArrayBuffer(0), 'text/plain').kind).toBe('empty');
	});

	it('formats sizes', () => {
		expect([formatBytes(999), formatBytes(1500), formatBytes(2_500_000)]).toEqual(['999 B', '1.5 kB', '2.5 MB']);
	});
});
