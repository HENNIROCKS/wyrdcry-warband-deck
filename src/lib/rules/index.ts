/**
 * The ruleset this app maintains itself.
 *
 * Unlike `src/lib/data/`, which `make sync` copies out of the site repo, these
 * files are written and kept by hand and are part of this repo. They carry what
 * the builder's data cannot express: faction rules with the choices a player
 * makes, a lower bound on the warband size, and the choice a fighter brings to
 * its own recruitment.
 *
 * One directory per faction, one file per question asked while maintaining it –
 * what may this faction buy is a different file from what a Sword does. The
 * price is that ids cross file boundaries; `npm run check:rules` resolves every
 * one of them and names the file a broken one sits in.
 *
 * `hired-swords/` is cut the other way: a hired sword belongs to no faction and
 * raises one question, so it is one file that holds the whole entry.
 */

import { assembleFrom } from './assemble';
import { collectHiredSwords } from './hired-swords';
import type {
	Campaign,
	Homebrew,
	Item,
	Keyword,
	RacialLimit,
	UniversalAbility,
	Weapon,
	WeaponRule
} from './types';
import campaign from './campaign.json';
import keywords from './keywords.json';
import racialLimits from './racial-limits.json';
import weapons from './weapons.json';
import items from './items.json';
import weaponRules from './weapon-rules.json';
import universalAbilities from './universal-abilities.json';

export type * from './types';

function byId<T extends { id: string }>(list: T[]): Map<string, T> {
	return new Map(list.map((entry) => [entry.id, entry]));
}

/**
 * A homebrew faction brings its own weapons and the keyword under which it
 * fights, and they go into the same lists as the printed ones – everything
 * downstream resolves an id against one map, and a second one for the homebrew
 * would have to be threaded through all of it.
 *
 * Its own directory is where they live, so the shared lists stay what the game
 * prints. `npm run check:rules` refuses an id that is already taken, which is
 * what keeps the merge from redefining a Sword for every faction at once.
 */
const homebrew = Object.values(
	import.meta.glob<{ default: Homebrew }>('./factions/*/homebrew.json', { eager: true })
).map((module) => module.default);

/**
 * The hired swords are collected before the shared lists are built, because
 * each of them carries the weapons only it uses and they go into the same
 * lists. Same reasoning as for the homebrew factions, and the same collision
 * check in `npm run check:rules` guards it.
 */
const hired = collectHiredSwords(
	import.meta.glob<{ default: unknown }>('./hired-swords/*.json', { eager: true })
);

function pooled<T extends { id: string }>(
	shared: unknown,
	key: keyof Homebrew,
	carried: T[] = []
): Map<string, T> {
	const added = homebrew.flatMap((entry) => (entry[key] ?? []) as unknown as T[]);
	return byId([...(shared as T[]), ...added, ...carried]);
}

export const CAMPAIGN = campaign as Campaign;
export const KEYWORDS = pooled<Keyword>(keywords, 'keywords');
export const RACIAL_LIMITS = pooled<RacialLimit>(racialLimits, 'racial-limits');
export const WEAPONS = pooled<Weapon>(weapons, 'weapons', hired.weapons);
export const ITEMS = pooled<Item>(items, 'items', hired.items);
export const WEAPON_RULES = pooled<WeaponRule>(weaponRules, 'weapon-rules');
export const UNIVERSAL_ABILITIES = universalAbilities as UniversalAbility[];

/**
 * The factions are collected from the directory, so a new one is a folder and no
 * change to this file. Eager, because the wizard needs the roster on its first
 * step and the whole set is a few kilobytes.
 */
export const FACTIONS = assembleFrom(
	import.meta.glob<{ default: unknown }>('./factions/*/*.json', { eager: true })
);

/**
 * The hired swords, keyed by id. A warband hires them when a battle is set up
 * rather than while it is built, so they stand beside the factions rather than
 * in one: `may_hire` says who may take which.
 */
export const HIRED_SWORDS = hired.hiredSwords;
