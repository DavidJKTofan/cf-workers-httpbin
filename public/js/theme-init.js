// Loaded as a blocking classic script in <head> so a saved theme applies before first paint.
// Kept separate from the module code, which runs too late to prevent a flash.
(() => {
	try {
		const saved = localStorage.getItem('theme');
		if (saved === 'light' || saved === 'dark') {
			document.documentElement.dataset.theme = saved;
		}
	} catch {
		// Storage can be unavailable (private mode, blocked cookies). Fall back to the OS setting.
	}
})();
