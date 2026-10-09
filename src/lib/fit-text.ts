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
/**
 * How wide the span's text is, in the cell's own pixels. scrollWidth cannot tell:
 * it is a whole number that can round down, and a text a third of a pixel too wide
 * still gets cut. The range is exact but measured on screen, where a card the
 * deck is scaling down is narrower than its layout; the cell's two widths undo
 * that. Rounded up, and a pixel added for the rounding in clientWidth, so the
 * error lands on the smaller factor.
 */
function textWidth(span: HTMLElement, cell: HTMLElement): number {
	const range = document.createRange();
	range.selectNodeContents(span);
	const scale = cell.getBoundingClientRect().width / cell.offsetWidth || 1;
	return Math.ceil(range.getBoundingClientRect().width / scale) + 1;
}

/*
 * Whether the card is caught mid-turn. The deck scales a card evenly, but turning
 * it over narrows it without making it shorter – and a card edge-on measures no
 * width at all, so its cells would read as roomy. Asked of the card rather than
 * the cell, whose few pixels of height round too coarsely to tell.
 */
function turning(node: HTMLElement): boolean {
	const card = node.closest<HTMLElement>('.card') ?? node;
	if (!card.offsetWidth || !card.offsetHeight) return false;
	const rect = card.getBoundingClientRect();
	const x = rect.width / card.offsetWidth;
	const y = rect.height / card.offsetHeight;
	return Math.abs(x - y) > 0.02 * Math.max(x, y);
}

/* About two seconds of frames, longer than any turn; past that it measures anyway. */
const MAX_WAIT = 120;

export function fitText(node: HTMLElement) {
	let frame = 0;
	let waited = 0;

	/* A card that mounts while it is being turned is measured once it lies flat:
	   nothing about its size changes then, so the observer would not ask again. */
	function measure() {
		cancelAnimationFrame(frame);
		if (turning(node) && waited < MAX_WAIT) {
			waited += 1;
			frame = requestAnimationFrame(measure);
			return;
		}
		waited = 0;

		/* Measured at full size: the spans below already carry the last factor. */
		node.style.setProperty('--fit', '1');

		let fit = 1;
		for (const span of node.querySelectorAll<HTMLElement>('[data-fit]')) {
			const cell = span.parentElement;
			if (!cell) continue;

			const style = getComputedStyle(cell);
			const room = cell.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
			const needed = textWidth(span, cell);

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
	return {
		destroy: () => {
			observer.disconnect();
			cancelAnimationFrame(frame);
		}
	};
}
