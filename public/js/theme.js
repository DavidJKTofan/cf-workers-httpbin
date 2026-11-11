const THEME_COLORS = { light: '#f5f6f7', dark: '#0e1012' };
const systemDark = window.matchMedia('(prefers-color-scheme: dark)');

/** The theme in effect: the visitor's saved choice, otherwise the operating system's. */
function activeTheme() {
	const chosen = document.documentElement.dataset.theme;
	if (chosen === 'light' || chosen === 'dark') return chosen;
	return systemDark.matches ? 'dark' : 'light';
}

/** @param {HTMLButtonElement} toggle */
function reflect(toggle) {
	const theme = activeTheme();
	toggle.dataset.active = theme;
	toggle.setAttribute('aria-label', `Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`);
	document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLORS[theme]);
}

/** @param {HTMLButtonElement} toggle */
export function initTheme(toggle) {
	reflect(toggle);

	toggle.addEventListener('click', () => {
		const next = activeTheme() === 'dark' ? 'light' : 'dark';
		document.documentElement.dataset.theme = next;
		try {
			localStorage.setItem('theme', next);
		} catch {
			// The choice still applies for this page view.
		}
		reflect(toggle);
	});

	// Until the visitor picks a theme, keep following the operating system live.
	systemDark.addEventListener('change', () => reflect(toggle));
}
