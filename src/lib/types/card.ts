/** What a card shows. Derived from instance and game data on every render. */

import type { StatKey } from './warband';

export interface CardStat {
	key: StatKey;
	label: string;
	value: number;
	/** Differs from the profile value – through an override or equipment. */
	modified: boolean;
}

/** One column of a value table: the label above, its value below. */
export interface CardValue {
	/** Unique within its table – the label is game data and could repeat. */
	key: string;
	label: string;
	value: string;
	/** Differs from the profile value – through an override or equipment. */
	modified?: boolean;
}

export interface CardWeapon {
	name: string;
	range: string;
	attacks: string;
	/** Hit value and critical value, as in the wiki: "2/4". */
	damage: string;
}

/**
 * One paragraph of the block below the tables: a bold label, then the text.
 * Abilities, weapon rules, equipment and notes all end up here, the way the
 * Card Creator writes them by hand.
 */
export interface CardEntry {
	/** "[Triple] Murder-Stab", "(Weeping Blades) Parry", "Shield". */
	label: string;
	text: string;
}

/**
 * A run of entries with one origin. The card separates them by a rule, without
 * naming them – the labels say where an entry comes from.
 */
export interface CardSection {
	kind:
		| 'fighter'
		| 'weapon'
		| 'equipment'
		| 'faction'
		| 'universal'
		| 'universal-reaction'
		| 'other'
		| 'notes';
	/** Leading line above the entries, from the profile's ability preamble. */
	preamble: string;
	entries: CardEntry[];
}

export interface FighterCardData {
	kind: 'fighter';
	instanceId: string;
	name: string;
	subtitle: string;
	stats: CardStat[];
	weapons: CardWeapon[];
	sections: CardSection[];
	keywords: string[];
	xp: number;
	renown: number;
	cost: number;
	/** The profile id is unknown – the game data does not know this fighter. */
	unresolved: boolean;
}

/**
 * The warband itself as a card: what the builder's info row carries, plus the
 * stash and the warband notes. Everything on it is derived from the warband and
 * the game data, the same way a fighter card is.
 */
export interface WarbandCardData {
	kind: 'warband';
	/** The deck addresses every card by this, warband card included. */
	instanceId: string;
	name: string;
	/** Runs in the banderole under the name, where a text card names its category. */
	faction: string;
	tables: CardValue[][];
	/** The names alone: whoever picks a thing up has its rules on their own card. */
	stash: string;
	notes: string;
}

export type DeckCard = WarbandCardData | FighterCardData;
