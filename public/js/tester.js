import { toCurl } from './curl.js';
import { byId, copyWithFeedback, el } from './dom.js';
import { describeBody, formatBytes, renderHeaders } from './response.js';

const BODYLESS_METHODS = new Set(['GET', 'HEAD']);

/** Parse the headers textarea: one `Name: value` per line, blank lines ignored. */
function parseHeaders(/** @type {string} */ text) {
	/** @type {[string, string][]} */
	const headers = [];
	for (const line of text.split('\n')) {
		if (!line.trim()) continue;
		const separator = line.indexOf(':');
		if (separator < 1) throw new Error(`Header line needs a "Name: value" pair: ${line.trim()}`);
		headers.push([line.slice(0, separator).trim(), line.slice(separator + 1).trim()]);
	}
	return headers;
}

/** Wire up the request form and response panel. Returns the handles other modules need. */
export function createTester() {
	const form = /** @type {HTMLFormElement} */ (byId('request'));
	const method = /** @type {HTMLSelectElement} */ (byId('method'));
	const path = /** @type {HTMLInputElement} */ (byId('path'));
	const headers = /** @type {HTMLTextAreaElement} */ (byId('headers'));
	const body = /** @type {HTMLTextAreaElement} */ (byId('body'));
	const headersField = /** @type {HTMLDetailsElement} */ (byId('headers-field'));
	const bodyField = /** @type {HTMLDetailsElement} */ (byId('body-field'));
	const sendButton = /** @type {HTMLButtonElement} */ (byId('send'));
	const error = byId('request-error');
	const curl = byId('curl');

	const responsePanel = byId('response');
	const meta = byId('response-meta');
	const empty = byId('response-empty');
	const content = byId('response-content');
	const responseBody = byId('response-body');
	const responseImage = /** @type {HTMLImageElement} */ (byId('response-image'));
	const responseHeaders = byId('response-headers');
	const tabs = { body: byId('tab-body'), headers: byId('tab-headers') };
	const panes = { body: byId('pane-body'), headers: byId('pane-headers') };

	/** @type {AbortController | null} */
	let inFlight = null;
	/** @type {string | null} */
	let imageUrl = null;

	/** Read the form. Throws with a message for the visitor when a field is invalid. */
	function readRequest() {
		const target = path.value.trim();
		if (!target.startsWith('/') || target.startsWith('//')) throw new Error('The path must start with a single "/".');
		const sendsBody = !BODYLESS_METHODS.has(method.value) && body.value !== '';
		return {
			method: method.value,
			path: target,
			headers: parseHeaders(headers.value),
			body: sendsBody ? body.value : null,
		};
	}

	function showError(/** @type {string} */ message) {
		error.textContent = message;
		error.hidden = message === '';
	}

	/** Keep the curl preview and the body field in step with the form. */
	function refresh() {
		bodyField.hidden = BODYLESS_METHODS.has(method.value);
		try {
			const request = readRequest();
			curl.textContent = toCurl({ ...request, url: location.origin + request.path });
			showError('');
		} catch (problem) {
			curl.textContent = '';
			showError(problem instanceof Error ? problem.message : String(problem));
		}
	}

	function selectTab(/** @type {'body' | 'headers'} */ name) {
		for (const key of /** @type {const} */ (['body', 'headers'])) {
			const selected = key === name;
			tabs[key].setAttribute('aria-selected', String(selected));
			tabs[key].tabIndex = selected ? 0 : -1;
			panes[key].hidden = !selected;
		}
	}

	function setMeta(/** @type {(Node | string)[]} */ ...parts) {
		meta.replaceChildren(...parts);
	}

	function showImage(/** @type {Blob | null} */ blob) {
		if (imageUrl) URL.revokeObjectURL(imageUrl);
		imageUrl = blob ? URL.createObjectURL(blob) : null;
		responseImage.hidden = !imageUrl;
		if (imageUrl) responseImage.src = imageUrl;
		else responseImage.removeAttribute('src');
	}

	/** Show the response and bring it into view when it sits below the request. */
	function reveal() {
		empty.hidden = true;
		content.hidden = false;
		selectTab('body');
		responsePanel.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
	}

	async function send() {
		let request;
		try {
			request = readRequest();
		} catch (problem) {
			showError(problem instanceof Error ? problem.message : String(problem));
			return;
		}

		// A newer request replaces one that is still running (a long /delay, say).
		inFlight?.abort();
		const controller = new AbortController();
		inFlight = controller;

		sendButton.disabled = true;
		sendButton.textContent = 'Sending…';
		setMeta('Waiting for response…');
		// Keeps the address bar shareable. The fragment stays in the browser: it is never sent to a server.
		history.replaceState(null, '', `#${request.method}:${request.path}`);

		const started = performance.now();
		try {
			const response = await fetch(request.path, {
				method: request.method,
				headers: request.headers,
				body: request.body,
				cache: 'no-store',
				signal: controller.signal,
			});
			const buffer = await response.arrayBuffer();
			const elapsed = Math.round(performance.now() - started);

			const described = describeBody(buffer, response.headers.get('Content-Type') ?? '');
			responseBody.textContent = described.text;
			showImage(described.kind === 'image' ? described.blob : null);
			const headerCount = renderHeaders(responseHeaders, response.headers);
			tabs.headers.textContent = `Headers (${headerCount})`;

			const status = el('span', { class: 'status', 'data-class': String(response.status)[0] }, `${response.status} ${response.statusText}`.trim());
			const details = [`${elapsed} ms`, formatBytes(buffer.byteLength)];
			if (response.redirected) details.push(`redirected to ${new URL(response.url).pathname}`);
			setMeta(status, ...details.map((detail) => el('span', {}, detail)));

			reveal();
		} catch (problem) {
			if (controller.signal.aborted) return;
			const message = problem instanceof Error ? problem.message : String(problem);
			setMeta(el('span', { class: 'status', 'data-class': 'error' }, 'Request failed'));
			responseBody.textContent = `${message}\n\nThe browser could not complete the request. Check the path and headers, or try the curl command.`;
			showImage(null);
			responseHeaders.replaceChildren();
			tabs.headers.textContent = 'Headers';
			reveal();
		} finally {
			if (inFlight === controller) {
				inFlight = null;
				sendButton.disabled = false;
				sendButton.textContent = 'Send';
			}
		}
	}

	/**
	 * Fill the form from an example.
	 *
	 * @param {{ method: string, path: string, headers?: Record<string, string>, body?: string }} example
	 */
	function load(example) {
		method.value = example.method;
		path.value = example.path;
		headers.value = Object.entries(example.headers ?? {})
			.map(([name, value]) => `${name}: ${value}`)
			.join('\n');
		body.value = example.body ?? '';
		headersField.open = headers.value !== '';
		bodyField.open = body.value !== '';
		refresh();
	}

	form.addEventListener('submit', (event) => {
		event.preventDefault();
		void send();
	});
	form.addEventListener('input', refresh);
	form.addEventListener('keydown', (event) => {
		if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
			event.preventDefault();
			void send();
		}
	});

	tabs.body.addEventListener('click', () => selectTab('body'));
	tabs.headers.addEventListener('click', () => selectTab('headers'));
	for (const tab of Object.values(tabs)) {
		tab.addEventListener('keydown', (event) => {
			if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
			const next = tab === tabs.body ? 'headers' : 'body';
			selectTab(next);
			tabs[next].focus();
		});
	}

	byId('copy-curl').addEventListener('click', (event) => {
		void copyWithFeedback(/** @type {HTMLButtonElement} */ (event.currentTarget), curl.textContent ?? '');
	});
	byId('copy-body').addEventListener('click', (event) => {
		const visible = panes.headers.hidden ? responseBody : responseHeaders;
		void copyWithFeedback(/** @type {HTMLButtonElement} */ (event.currentTarget), visible.innerText);
	});

	refresh();
	return { load, send };
}
