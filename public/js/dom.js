/** @param {string} id */
export function byId(id) {
	const element = document.getElementById(id);
	if (!element) throw new Error(`Missing element #${id}`);
	return element;
}

/**
 * Create an element. Text always goes through textContent, never innerHTML, so
 * nothing returned by an endpoint can be interpreted as markup.
 *
 * @param {string} tag
 * @param {Record<string, string>} [attributes]
 * @param {...(Node | string)} children
 */
export function el(tag, attributes = {}, ...children) {
	const element = document.createElement(tag);
	for (const [name, value] of Object.entries(attributes)) {
		element.setAttribute(name, value);
	}
	element.append(...children);
	return element;
}

/**
 * Copy text and briefly confirm on the button that triggered it.
 *
 * @param {HTMLButtonElement} button
 * @param {string} text
 */
export async function copyWithFeedback(button, text) {
	const label = button.textContent;
	try {
		await navigator.clipboard.writeText(text);
		button.textContent = 'Copied';
	} catch {
		button.textContent = 'Copy failed';
	}
	setTimeout(() => {
		button.textContent = label;
	}, 1500);
}
