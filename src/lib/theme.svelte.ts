/*
 * Light or dark for the interface around the cards. The system's setting holds
 * until the about page's button picks one; that choice is kept on this device
 * and outlives a change of the system's setting.
 *
 * The inline script in src/app.html applies the same before the first render,
 * so the page never shows the other mode first. Both write `data-theme` on the
 * root, which app.css reads, and the browser bar's colour.
 */

export type Theme = 'light' | 'dark';

const KEY = 'theme';

/* --ui-header-bg in either mode, for the browser bar. Also in src/app.html. */
const BAR: Record<Theme, string> = { dark: '#18181b', light: '#d8d0c5' };

function stored(): Theme | null {
	try {
		const value = localStorage.getItem(KEY);
		return value === 'light' || value === 'dark' ? value : null;
	} catch {
		return null;
	}
}

function apply(theme: Theme) {
	document.documentElement.dataset.theme = theme;
	document.querySelector('meta[name="theme-color"]')?.setAttribute('content', BAR[theme]);
}

class ThemeState {
	current = $state<Theme>('dark');

	/* Called once from the layout. Follows the system while nothing is chosen. */
	init() {
		const system = matchMedia('(prefers-color-scheme: light)');
		this.current = stored() ?? (system.matches ? 'light' : 'dark');
		apply(this.current);
		system.addEventListener('change', (event) => {
			if (stored()) return;
			this.current = event.matches ? 'light' : 'dark';
			apply(this.current);
		});
	}

	toggle() {
		this.current = this.current === 'dark' ? 'light' : 'dark';
		apply(this.current);
		try {
			localStorage.setItem(KEY, this.current);
		} catch {
			/* Storage blocked: the choice holds until the next reload. */
		}
	}
}

export const theme = new ThemeState();
