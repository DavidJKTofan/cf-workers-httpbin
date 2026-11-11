import { el } from './dom.js';

const MAX_TEXT_CHARS = 200_000;
const HEX_PREVIEW_BYTES = 256;

/** @param {number} bytes */
export function formatBytes(bytes) {
	if (bytes < 1000) return `${bytes} B`;
	if (bytes < 1_000_000) return `${(bytes / 1000).toFixed(1)} kB`;
	return `${(bytes / 1_000_000).toFixed(1)} MB`;
}

/** Classic offset / hex / ASCII dump of the first bytes of a binary body. */
function hexDump(/** @type {Uint8Array} */ bytes) {
	const shown = bytes.subarray(0, HEX_PREVIEW_BYTES);
	const lines = [];
	for (let offset = 0; offset < shown.length; offset += 16) {
		const row = shown.subarray(offset, offset + 16);
		const hex = [...row].map((byte) => byte.toString(16).padStart(2, '0')).join(' ');
		const ascii = [...row].map((byte) => (byte >= 0x20 && byte < 0x7f ? String.fromCharCode(byte) : '.')).join('');
		lines.push(`${offset.toString(16).padStart(8, '0')}  ${hex.padEnd(47)}  ${ascii}`);
	}
	if (bytes.length > shown.length) {
		lines.push(`… ${formatBytes(bytes.length - shown.length)} more not shown`);
	}
	return lines.join('\n');
}

/**
 * Turn a response body into something displayable.
 *
 * @param {ArrayBuffer} buffer
 * @param {string} contentType
 * @returns {{ kind: 'empty' | 'text' | 'binary', text: string } | { kind: 'image', text: string, blob: Blob }}
 */
export function describeBody(buffer, contentType) {
	const bytes = new Uint8Array(buffer);
	if (bytes.length === 0) return { kind: 'empty', text: '(empty body)' };

	const type = contentType.split(';')[0].trim().toLowerCase();
	if (type.startsWith('image/')) {
		const text = type === 'image/svg+xml' ? new TextDecoder().decode(bytes) : `${type}, ${formatBytes(bytes.length)}`;
		return { kind: 'image', text, blob: new Blob([bytes], { type }) };
	}

	let text;
	try {
		text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
	} catch {
		return { kind: 'binary', text: hexDump(bytes) };
	}

	if (type === 'application/json' || type.endsWith('+json')) {
		try {
			text = JSON.stringify(JSON.parse(text), null, 2);
		} catch {
			// Not valid JSON after all: show it as received.
		}
	}
	if (text.length > MAX_TEXT_CHARS) {
		text = `${text.slice(0, MAX_TEXT_CHARS)}\n… truncated, ${formatBytes(bytes.length)} in total`;
	}
	return { kind: 'text', text };
}

/**
 * @param {HTMLElement} tbody
 * @param {Headers} headers
 */
export function renderHeaders(tbody, headers) {
	const rows = [...headers].sort(([a], [b]) => a.localeCompare(b)).map(([name, value]) => el('tr', {}, el('th', { scope: 'row' }, name), el('td', {}, value)));
	tbody.replaceChildren(...rows);
	return rows.length;
}
