/**
 * Access to the game data. The files are not in the repo; `npm run sync:data`
 * copies them from the site repo.
 */

import fighters from './data/fighters.json';
import weapons from './data/weapons.json';
import items from './data/items.json';
import abilities from './data/abilities.json';
import factions from './data/factions.json';
import weaponRules from './data/weapon-rules.json';
import universalAbilities from './data/universal-abilities.json';
import ruleset from './data/ruleset.json';
import campaignRules from './data/campaign-rules.json';
import {
	RULE_ABILITIES,
	RULE_FACTIONS,
	RULE_FIGHTERS,
	RULE_WEAPONS
} from './rules-bridge';

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
	/** Absent on 15 of the 42 profiles and empty on 12 more – only fixed gear. */
	default_equipment?: string[];
	race: string[];
	faction: string;
	keywords: string[];
}

export interface WeaponProfile {
	id: string;
	name: string;
	type: string;
	/** Melee carries a number, ranged a span such as "3-12". */
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
	/** How many fighters the faction may field. */
	warband_size: number;
	faction_ability_ids: string[];
}

export interface WeaponRule {
	id: string;
	name: string;
	description: string;
	/**
	 * `characteristic` is `fight_shoot` where the rule raises the weapon's own
	 * attack characteristic – Fight for a melee weapon, Shoot for a ranged one,
	 * never both. `conditional` is unreliable: Parry carries `false` while its
	 * own description names the situation it needs, so the card reads the
	 * description instead.
	 */
	effect?: { characteristic: string; bonus: number; conditional?: boolean };
}

/**
 * An ability or reaction every fighter carrying `keyword` has. Extracted from the
 * rules pages by `npm run sync:data`, the JSON data does not hold them.
 */
export interface UniversalAbility {
	id: string;
	name: string;
	ability_type: string;
	/** "Any" for everyone, otherwise a keyword from the fighter profile. */
	keyword: string;
	description: string;
}

/**
 * Later entries lose against earlier ones. Ids do repeat in the game data, and
 * which of the two the app ends up showing must not come down to file order, so
 * a development build names the collision instead of letting it pass.
 */
function byId<T extends { id: string }>(list: T[], what: string): Map<string, T> {
	const map = new Map<string, T>();
	const duplicates: string[] = [];

	for (const entry of list) {
		if (map.has(entry.id)) duplicates.push(entry.id);
		else map.set(entry.id, entry);
	}

	if (duplicates.length && import.meta.env.DEV) {
		console.warn(`${what}: duplicate ids in the game data, first one wins – ${duplicates.join(', ')}`);
	}
	return map;
}

/** Same reasoning as the duplicate ids: what is dropped has to be sayable. */
function withText<T extends { id: string; description: string }>(list: T[], what: string): T[] {
	const kept = list.filter((entry) => entry.description.trim() !== '');

	if (kept.length < list.length && import.meta.env.DEV) {
		const dropped = list.filter((entry) => entry.description.trim() === '').map((e) => e.id);
		console.warn(`${what}: no description in the game data, dropped – ${dropped.join(', ')}`);
	}
	return kept;
}

/**
 * Fills in what the game data does not have from this app's own ruleset, so a
 * homebrew faction resolves like any other. An id the game data knows is never
 * touched: what is printed is what a card shows, and the ruleset beside it is a
 * transcription that may differ. See `rules-bridge.ts`.
 */
function filledFrom<T extends { id: string }>(map: Map<string, T>, extra: T[]): Map<string, T> {
	for (const entry of extra) {
		if (!map.has(entry.id)) map.set(entry.id, entry);
	}
	return map;
}

export const FIGHTERS = filledFrom(byId(fighters as FighterProfile[], 'fighters'), RULE_FIGHTERS);
export const WEAPONS = filledFrom(byId(weapons as WeaponProfile[], 'weapons'), RULE_WEAPONS);
export const ITEMS = byId(items as ItemProfile[], 'items');
export const FACTIONS = filledFrom(byId(factions as FactionProfile[], 'factions'), RULE_FACTIONS);
export const WEAPON_RULES = byId(weaponRules as WeaponRule[], 'weapon rules');

/* A rule without text is nothing a card can show, and dropping those settles
   ids the data carries more than once where only one side has a description. */
/* `martial-discipline` comes across here as well, because this ruleset corrects
   an id the game data spells `martial-exemplar`. Nothing looks it up: an
   official faction's profile comes from the game data and names the game data's
   id. Measured – the Mercenaries Champion's card is the same either way. */
export const ABILITIES = filledFrom(
	byId(withText(abilities as AbilityProfile[], 'abilities'), 'abilities'),
	RULE_ABILITIES
);

export const UNIVERSAL_ABILITIES = universalAbilities as UniversalAbility[];

/**
 * The campaign level: how much favour buys which standing, what a warband starts
 * with. The builder reads the same file, so both name the same tier.
 */
export interface CampaignRules {
	default_favour: number;
	warband_budget: number;
	standing_thresholds: { min: number; max: number; label: string }[];
	favour_tiers: { min: number; max: number; label: string; default_gold: number }[];
}

export const CAMPAIGN_RULES = campaignRules as CampaignRules;

/** Version of the ruleset this app was built against. Goes into every export. */
export const RULESET_VERSION: string = (ruleset as { version: string }).version;
