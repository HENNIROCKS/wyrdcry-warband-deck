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
	rules: string[];
}

export interface CardItem {
	name: string;
	description: string;
}

export interface CardAbility {
	name: string;
	type: string;
	description: string;
	/** From the warband's customAbilities, not from the game data. */
	custom: boolean;
}

export interface FighterCardData {
	instanceId: string;
	name: string;
	subtitle: string;
	stats: CardStat[];
	weapons: CardWeapon[];
	items: CardItem[];
	abilities: CardAbility[];
	keywords: string[];
	notes: string;
	xp: number;
	renown: number;
	cost: number;
	isHero: boolean;
	/** The profile id is unknown – the game data does not know this fighter. */
	unresolved: boolean;
}
