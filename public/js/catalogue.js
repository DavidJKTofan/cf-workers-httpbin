import { el } from './dom.js';

/**
 * @typedef {{ path: string, method: string, headers?: Record<string, string>, body?: string }} Example
 * @typedef {{ methods: string[], path: string, summary: string, example: Example, view?: 'page' }} Endpoint
 * @typedef {{ limits: Record<string, number>, groups: { id: string, title: string, endpoints: Endpoint[] }[] }} Catalogue
 */

/**
 * The endpoint list comes from the Worker's own route table (GET /endpoints),
 * so this page never needs editing when a route is added.
 *
 * @returns {Promise<Catalogue>}
 */
export async function fetchCatalogue() {
	const response = await fetch('/endpoints', { headers: { Accept: 'application/json' } });
	if (!response.ok) throw new Error(`GET /endpoints returned ${response.status}`);
	return response.json();
}

/**
 * @param {Endpoint} endpoint
 * @param {(endpoint: Endpoint) => void} onSelect
 */
function renderEndpoint(endpoint, onSelect) {
	const method = endpoint.methods[0] ?? 'GET';
	const badge = el('span', { class: 'method', 'data-method': method, title: endpoint.methods.join(', ') }, method);
	const path = el('span', { class: 'endpoint-path' }, endpoint.path);
	const summary = el('span', { class: 'endpoint-summary' }, endpoint.summary);

	// Endpoints that return a page for people (a form, a list of links) open in a new tab.
	if (endpoint.view === 'page') {
		path.append(el('span', { class: 'endpoint-opens' }, ' ↗'));
		return el('a', { class: 'endpoint', href: endpoint.example.path, target: '_blank', rel: 'noopener' }, badge, path, summary);
	}

	const button = el('button', { class: 'endpoint', type: 'button' }, badge, path, summary);
	button.addEventListener('click', () => onSelect(endpoint));
	return button;
}

/**
 * Render the catalogue and return controls for filtering and highlighting it.
 *
 * @param {HTMLElement} container
 * @param {Catalogue} catalogue
 * @param {(endpoint: Endpoint) => void} onSelect
 */
export function renderCatalogue(container, catalogue, onSelect) {
	/** @type {{ item: HTMLElement, row: HTMLElement, endpoint: Endpoint, haystack: string }[]} */
	const rows = [];
	const sections = [];

	for (const group of catalogue.groups) {
		const list = el('ul');
		for (const endpoint of group.endpoints) {
			const row = renderEndpoint(endpoint, (selected) => {
				setCurrent(selected);
				onSelect(selected);
			});
			const item = el('li', {}, row);
			list.append(item);
			rows.push({ item, row, endpoint, haystack: `${endpoint.methods.join(' ')} ${endpoint.path} ${endpoint.summary}`.toLowerCase() });
		}
		const title = el('h3', { class: 'group-title', id: `group-${group.id}` }, group.title);
		sections.push(el('section', { class: 'group', 'aria-labelledby': title.id }, title, list));
	}

	const noMatches = el('p', { class: 'empty' }, 'No endpoints match.');
	noMatches.hidden = true;
	container.replaceChildren(...sections, noMatches);

	/** @param {Endpoint | null} endpoint */
	function setCurrent(endpoint) {
		for (const entry of rows) {
			if (entry.endpoint === endpoint) entry.row.setAttribute('aria-current', 'true');
			else entry.row.removeAttribute('aria-current');
		}
	}

	return {
		total: rows.length,
		setCurrent,

		/** Show only endpoints whose method, path or summary contains every word typed. */
		filter(/** @type {string} */ query) {
			const words = query.toLowerCase().split(/\s+/).filter(Boolean);
			let visible = 0;
			for (const entry of rows) {
				const matches = words.every((word) => entry.haystack.includes(word));
				entry.item.hidden = !matches;
				if (matches) visible += 1;
			}
			for (const section of sections) {
				section.hidden = !section.querySelector('li:not([hidden])');
			}
			noMatches.hidden = visible > 0;
			return visible;
		},
	};
}
