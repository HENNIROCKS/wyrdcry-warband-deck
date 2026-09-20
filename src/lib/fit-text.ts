/*
 * The card keeps the printed proportions at every width, but its type carries a
 * floor the cells do not: below roughly 529px of card width the columns keep
 * shrinking while the type stops. Long labels and weapon names then run past
 * their cell.
 *
 * This scales such a text back, and only as far as it has to – wherever the text
 * already fits, `--fit` stays at 1 and nothing about the card changes.
 */

const FLOOR = 0.7;

/**
 * Sets `--fit` on the node, a factor the font sizes below it multiply into. Each
 * `[data-fit]` span underneath is measured against its cell; the narrowest result
 * wins, so a row of labels stays one size rather than turning ragged.
 */
export function fitText(node: HTMLElement) {
	function measure() {
		/* Measured at full size: the spans below already carry the last factor. */
		node.style.setProperty('--fit', '1');

		let fit = 1;
		for (const span of node.querySelectorAll<HTMLElement>('[data-fit]')) {
			const cell = span.parentElement;
			if (!cell) continue;

			const style = getComputedStyle(cell);
			const room = cell.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
			/* scrollWidth rounds up, which errs towards the smaller factor. */
			const needed = span.scrollWidth;

			if (room > 0 && needed > room) fit = Math.min(fit, room / needed);
		}

		node.style.setProperty('--fit', String(Math.max(FLOOR, fit)));
	}

	const observer = new ResizeObserver(measure);
	observer.observe(node);

	/* The card ships its own fonts: the first measurement can still be against a
	   fallback, whose widths are not the ones that end up on screen. */
	document.fonts?.ready.then(measure);

	/* No update hook: the action takes no argument, so Svelte would never call one.
	   A card is rebuilt from scratch when the deck moves to another fighter. */
	return { destroy: () => observer.disconnect() };
}
