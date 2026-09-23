/** What a card shows. Derived from instance and game data on every render. */

import type { StatKey } from './warband';

/**
 * One contribution to a characteristic. The base layer carries the profile
 * value, every other layer the signed amount it adds.
 */
export interface StatLayer {
	kind: 'base' | 'permanent' | 'equipment';
	/** Named the way the card names it: "Profile", "Heavy Armour". */
	source: string;
	amount: number;
}

/**
 * A rule that can change this characteristic without being counted into it. It
 * needs a situation the card cannot know – a melee attack, a target in cover.
 */
export interface StatCondition {
	/** Where the rule hangs: a weapon, an item. */
	source: string;
	name: string;
	text: string;
	/**
	 * What it would add, where the rule says a number. Mighty names Fight or
	 * Shoot depending on the weapon, and the weapon is known – so the card
	 * settles that much rather than leaving the player to read it off again.
	 */
	amount?: number;
}

export interface CardStat {
	key: StatKey;
	label: string;
	/** The sum of the layers. */
	value: number;
	layers: StatLayer[];
	conditions: StatCondition[];
}

/**
 * Why a value reads the way it does. A value that carries one is marked on the
 * card and opens this when tapped.
 */
export interface CardExplanation {
	title: string;
	/** What the card shows, spelled the way the card spells it: `6`, `4"`. */
	result?: string;
	/** A profile in short, as the weapon table prints it. */
	facts?: { label: string; value: string }[];
	layers?: StatLayer[];
	conditions?: StatCondition[];
	/** Rules that come with the thing, in full. */
	rules?: CardEntry[];
}

/** One column of a value table: the label above, its value below. */
export interface CardValue {
	/** Unique within its table – the label is game data and could repeat. */
	key: string;
	label: string;
	value: string;
	/** Differs from the profile value – through an override or equipment. */
	modified?: boolean;
	explanation?: CardExplanation;
}

export interface CardWeapon {
	name: string;
	range: string;
	attacks: string;
	/** Hit value and critical value, as in the wiki: "2/4". */
	damage: string;
	/** Its rules, for the overlay – they are not on the card itself. */
	explanation?: CardExplanation;
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
	/** The card's own word about the entry, not the rulebook's. */
	note?: string;
}

/**
 * A run of entries with one origin. The card separates them by a rule, without
 * naming them – the labels say where an entry comes from.
 */
export interface CardSection {
	kind:
		| 'fighter'
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
