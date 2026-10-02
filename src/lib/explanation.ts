import { pushState } from '$app/navigation';
import { page } from '$app/state';

/**
 * The one explanation the deck has open.
 *
 * It is a page state rather than a variable of its own, so that the phone's
 * back gesture closes it instead of leaving the deck. That makes the history
 * entry the record of whether it is open.
 *
 * It also lives outside the cards: a card sits in a transformed stack, and a
 * fixed overlay inside one would be placed against that transform rather than
 * against the screen.
 *
 * Closing goes back, which leaves the entry standing ahead in the history, and
 * iOS walks forward onto it with a slow drag from the right edge. Each entry
 * therefore carries a number, and only the one `explain` opened last counts:
 * an entry reached by walking forward is stale and is walked back off again.
 */
import type { CardExplanation } from './types/card';

let opened = 0;
/** The number of the entry that is open, `null` while none is. */
let live: number | null = null;

export function explanation(): CardExplanation | null {
	const { explanation: entry, explanationId } = page.state;
	return entry && explanationId === live ? entry : null;
}

export function explain(entry: CardExplanation): void {
	live = ++opened;
	pushState('', { explanation: entry, explanationId: live });
}

export function dismiss(): void {
	/* Back, so the entry this opened is gone – closing any other way would leave
	   it behind and the next back gesture would only close it again. */
	if (explanation()) history.back();
}

/**
 * Follows the history to wherever it went, called on every change of the page
 * state. Arriving without an explanation means the open one is closed, however
 * that happened; arriving on a stale one means a forward step, undone at once.
 */
export function settle(): void {
	const { explanation: entry, explanationId } = page.state;
	if (!entry) live = null;
	else if (explanationId !== live) history.back();
}
