/**
 * Zugriff auf die Stammdaten. Die Dateien liegen nicht im Repo, sie werden von
 * `npm run sync:data` aus dem Site-Repo kopiert.
 */

import fighters from './data/fighters.json';
import weapons from './data/weapons.json';
import items from './data/items.json';
import abilities from './data/abilities.json';
import factions from './data/factions.json';
import weaponRules from './data/weapon-rules.json';
import ruleset from './data/ruleset.json';

export interface FighterProfile {
	id: string;
	name: string;
	description: string;
	move: number;
	fight: number;
	shoot: number;
	defense: number;
	health: number;
	bravery: number;
	cost: number;
	ability_preamble: string;
	faction_ability_ids: string[];
	default_equipment: string[];
	race: string[];
	faction: string;
	keywords: string[];
}

export interface WeaponProfile {
	id: string;
	name: string;
	type: string;
	/** Nahkampf trägt eine Zahl, Fernkampf eine Spanne wie "3-12". */
	range: number | string;
	attacks: number;
	hit: number;
	crit: number;
	special_rules: string[];
	cost: number;
}

export interface ItemProfile {
	id: string;
	name: string;
	type: string;
	description: string;
	effect?: { characteristic: string; bonus: number };
	cost: number;
}

export interface AbilityProfile {
	id: string;
	name: string;
	category: string;
	ability_type: string;
	description: string;
}

export interface FactionProfile {
	id: string;
	name: string;
	description: string;
	faction_ability_ids: string[];
}

export interface WeaponRule {
	id: string;
	name: string;
	description: string;
}

const byId = <T extends { id: string }>(list: T[]) => new Map(list.map((x) => [x.id, x]));

export const FIGHTERS = byId(fighters as FighterProfile[]);
export const WEAPONS = byId(weapons as WeaponProfile[]);
export const ITEMS = byId(items as ItemProfile[]);
export const ABILITIES = byId(abilities as AbilityProfile[]);
export const FACTIONS = byId(factions as FactionProfile[]);
export const WEAPON_RULES = byId(weaponRules as WeaponRule[]);

/** Version des Regelstands, mit dem diese App gebaut wurde. Steht in jedem Export. */
export const RULESET_VERSION: string = (ruleset as { version: string }).version;
