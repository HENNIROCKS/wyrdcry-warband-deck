/**
 * The warband while it is being put together.
 *
 * Not a `Warband` yet: a draft has no instance ids, carries the choices the
 * builder's model has no field for, and is allowed to be incomplete – the whole
 * point of the wizard is to walk through a state that does not hold up yet.
 * `toWarband()` turns it into the shape the deck and the builder both read.
 */

import type { StatKey } from '../types/warband';

export interface DraftFighter {
	/** Local while drafting; the export mints an instanceId from it. */
	key: string;
	fighterId: string;
	/** The player's own name for this fighter, empty until they type one. */
	name: string;
	/** Bare ids, the way the builder stores equipment – no `weapon:` prefix. */
	equipment: string[];
	/**
	 * What was picked for the fighter's own `choose`: characteristic keys for a
	 * stat choice, ability ids for an ability choice. Empty until it is made.
	 */
	choice: string[];
}

export interface Draft {
	name: string;
	factionId: string;
	/** Faction rule id to the option ids picked under it. */
	ruleChoices: Record<string, string[]>;
	fighters: DraftFighter[];
	favour: number;
}

/** Why something cannot be done, in a sentence the wizard can show as it is. */
export interface Problem {
	/** What the message is about, so a step can show only its own problems. */
	step: 'faction' | 'rules' | 'roster' | 'fighter' | 'budget';
	/** The draft fighter it belongs to, where it belongs to one. */
	key?: string;
	text: string;
}

export type Slots = { melee: number; ranged: number };

export type Profile = Record<StatKey, number>;
