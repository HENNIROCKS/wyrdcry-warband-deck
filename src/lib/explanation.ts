import { pushState } from '$app/navigation';
import { page } from '$app/state';

/**
 * The one explanation the deck has open.
 *
 * It is a page state rather than a variable of its own, so that the phone's
 * back gesture closes it instead of leaving the deck. That makes the history
 * entry the single record of whether it is open.
 *
 * It also lives outside the cards: a card sits in a transformed stack, and a
 * fixed overlay inside one would be placed against that transform rather than
 * against the screen.
 */
import type { CardExplanation } from './types/card';

export function explanation(): CardExplanation | null {
	return page.state.explanation ?? null;
}

export function explain(entry: CardExplanation): void {
	pushState('', { explanation: entry });
}

export function dismiss(): void {
	/* Back, so the entry this opened is gone – closing any other way would leave
	   it behind and the next back gesture would only close it again. */
	if (page.state.explanation) history.back();
}
