const MEBIBYTE = 1024 * 1024;

/** @param {string} name @param {number} value */
function format(name, value) {
	if (name === 'bodyBytes' && value % MEBIBYTE === 0) return `${value / MEBIBYTE} MiB`;
	return value.toLocaleString('en-US');
}

/**
 * Fill the "Usage limits" text with the limits the Worker actually enforces
 * (GET /endpoints). The HTML carries the defaults, so the page reads correctly
 * even before this runs.
 *
 * @param {Record<string, number> | undefined} limits
 */
export function showLimits(limits) {
	if (!limits) return;
	for (const element of document.querySelectorAll('[data-limit]')) {
		const name = /** @type {HTMLElement} */ (element).dataset.limit ?? '';
		const value = limits[name];
		if (typeof value === 'number') element.textContent = format(name, value);
	}
}
