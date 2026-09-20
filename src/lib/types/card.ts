/** What a card shows. Derived from instance and game data on every render. */

import type { StatKey } from './warband';

export interface CardStat {
	key: StatKey;
	label: string;
	value: number;
	/** Differs from the profile value – through an override or equipment. */
	modified: boolean;
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
	kind: 'fighter' | 'weapon' | 'equipment' | 'faction' | 'universal' | 'other';
	/** Leading line above the entries, from the profile's ability preamble. */
	preamble: string;
	entries: CardEntry[];
}

export interface FighterCardData {
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
