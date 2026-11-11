import { fetchCatalogue, renderCatalogue } from './catalogue.js';
import { showLimits } from './limits.js';
import { byId, el } from './dom.js';
import { createTester } from './tester.js';
import { initTheme } from './theme.js';

const METHODS = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD']);

/**
 * A shared link such as `/#GET:/status/418` fills in the request form. It only prefills:
 * nothing is sent until the visitor presses Send, and anything that is not a known
 * method followed by a same-origin path is ignored.
 */
function requestFromHash() {
	const hash = location.hash.slice(1);
	const separator = hash.indexOf(':');
	const method = hash.slice(0, separator);
	const path = hash.slice(separator + 1);
	return separator > 0 && METHODS.has(method) && path.startsWith('/') && !path.startsWith('//') ? { method, path } : null;
}

initTheme(/** @type {HTMLButtonElement} */ (byId('theme-toggle')));

const tester = createTester();

function loadSharedRequest() {
	const shared = requestFromHash();
	if (shared) tester.load(shared);
}
loadSharedRequest();
// Also when a shared link is opened in a tab that already shows this page.
window.addEventListener('hashchange', loadSharedRequest);

const container = byId('catalogue');
const filter = /** @type {HTMLInputElement} */ (byId('filter'));
const count = byId('endpoint-count');

try {
	const data = await fetchCatalogue();
	showLimits(data.limits);
	const catalogue = renderCatalogue(container, data, (endpoint) => {
		tester.load(endpoint.example);
		void tester.send();
	});

	const showCount = (/** @type {number} */ visible) => {
		count.textContent = visible === catalogue.total ? `${catalogue.total}` : `${visible} of ${catalogue.total}`;
	};
	showCount(catalogue.total);
	filter.addEventListener('input', () => showCount(catalogue.filter(filter.value)));
} catch (problem) {
	const reason = problem instanceof Error ? problem.message : String(problem);
	container.replaceChildren(el('p', { class: 'empty' }, `Could not load the endpoint list (${reason}). The request builder still works.`));
}
