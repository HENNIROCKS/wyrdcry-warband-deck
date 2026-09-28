/**
 * The shapes of the hand-kept ruleset in this directory.
 *
 * Separate from the loader so the assembly can be exercised outside Vite:
 * `index.ts` is the only file that reaches for `import.meta.glob`.
 */

import type { StatKey } from '../types/warband';

export interface Span {
	min: number;
	/** Null where the rules set no upper bound, as on a Warrior. */
	max: number | null;
}

export interface Weapon {
	id: string;
	name: string;
	type: 'melee' | 'ranged';
	/** Both ends in inches. A melee weapon starts at 0, a Bow at 3. */
	range: { min: number; max: number };
	attacks: number;
	hit: number;
	crit: number;
	/** Ids from `weapon-rules.json`. */
	rules: string[];
	cost: number;
}

export interface Effect {
	characteristic: StatKey;
	bonus: number;
}

export interface Item {
	id: string;
	name: string;
	type: string;
	/**
	 * Which place on the fighter a piece of armour takes. A shield needs a hand
	 * and so competes with the weapons; body armour has its own place and only
	 * competes with other body armour.
	 */
	slot?: 'hand' | 'body';
	text: string;
	/** A list, because Heavy Armour changes two characteristics at once. */
	effects: Effect[];
	cost: number;
}

/**
 * `attack` is the weapon's own attack characteristic – Fight for a melee
 * weapon, Shoot for a ranged one, never both. `applies` says when the bonus is
 * real: Mighty only while attacking, Parry only while being attacked.
 */
export interface WeaponRuleEffect {
	characteristic: StatKey | 'attack';
	bonus: number;
	applies: 'always' | 'when-attacking' | 'when-targeted';
}

export interface WeaponRule {
	id: string;
	name: string;
	text: string;
	effect: WeaponRuleEffect | null;
}

export interface Keyword {
	id: string;
	name: string;
	type: 'faction' | 'race' | 'fighter';
	/** One entry per rule the keyword carries; empty for most races. */
	rules: string[];
}

export interface Ability {
	id: string;
	name: string;
	type: string;
	text: string;
}

export interface UniversalAbility extends Ability {
	/** "any" for everyone, otherwise a keyword id from `keywords.json`. */
	keyword: string;
}

/** A choice the fighter brings along, made once while recruiting it. */
export interface FighterChoice {
	/** The ability this choice comes out of, for the sentence next to it. */
	source: string | null;
	/**
	 * The sentence above the choice where the profile asks for it itself and
	 * there is no ability to take the wording from.
	 */
	prompt?: string;
	kind: 'stat' | 'ability' | 'roll' | 'role';
	pick: number;
	/** With `kind: 'stat'`: which characteristics are on offer, and by how much. */
	characteristics?: StatKey[];
	bonus?: number;
	/** With `kind: 'ability'`: the ids on offer. */
	abilities?: string[];
	/** With `kind: 'roll'`: the id of the rule carrying the `table` to roll on. */
	table?: string;
	/** With `kind: 'role'`: the roles on offer. */
	roles?: FighterRole[];
}

/**
 * One face of a fighter that comes in several: the Goblin Shaman is hired as a
 * Brewgit or a Spiker, and the role brings a talent and the weapon that goes
 * with it. Unlike a choice of abilities, which leaves the profile's gear alone.
 */
export interface FighterRole {
	id: string;
	name: string;
	/** An ability of the fighter this role belongs to. */
	ability: string;
	/** Prefixed `weapon:` or `item:`, like a fighter's own `gear`. */
	gear: string[];
}

/** One row of a roll table, such as the Possessed's Mutation Table. */
export interface TableRow {
	/** The 2d6 result this row answers to. */
	roll: number;
	name: string;
	text: string;
}

export interface Fighter {
	id: string;
	name: string;
	cost: number;
	/** `min: 1` is a fighter the warband must have, not one it may have. */
	limit: Span;
	description: string;
	profile: Record<StatKey, number>;
	keywords: string[];
	abilities: string[];
	/**
	 * Gear the fighter cannot be without: a beast's natural weapons, a Troll
	 * Slayer's axes. It costs nothing – the fighter's own cost covers it – but it
	 * fills the slots it would fill if bought. Prefixed `weapon:` or `item:` like
	 * an `Allowance`, because both sides have a `sword`.
	 */
	gear: string[];
	choose: FighterChoice | null;
}

export interface StatRuleEffect {
	kind: 'stat';
	characteristic: StatKey;
	/**
	 * Added to the characteristic as it stands. The rules say "increase" for an
	 * improvement, and for Bravery an improvement is a smaller number: it is a
	 * roll target, passed on a roll at or above it. A rule that improves Bravery
	 * therefore carries a negative bonus.
	 */
	bonus: number;
	/** Fighter ids, or "all" for the whole warband. */
	fighters: string[] | 'all';
}

export interface RecruitRuleEffect {
	kind: 'recruit';
	forbid: string[];
	discount: { fighter: string; factor: number }[];
}

export type RuleEffect = StatRuleEffect | RecruitRuleEffect;

export interface RuleOption {
	id: string;
	name: string;
	text: string;
	phase: Phase;
	effect: RuleEffect | null;
}

/**
 * Where a rule takes hold. Only `recruitment` can change a number while the
 * warband is being put together; the others are shown and left alone.
 */
export type Phase = 'recruitment' | 'battle' | 'aftermath';

export interface FactionRule {
	id: string;
	name: string;
	text: string;
	phase: Phase;
	/** How many of `options` the player picks. Null where there is no choice. */
	pick: number | null;
	options: RuleOption[];
	effect?: RuleEffect | null;
	/**
	 * A roll table this rule carries, such as the Possessed's eleven mutations. Held
	 * here rather than spelled out a second time in `text`, so a fighter's `choose`
	 * of `kind: 'roll'` and the rule's own display text read the same eleven rows.
	 */
	table?: TableRow[];
}

export interface Allowance {
	/** Prefixed `weapon:` or `item:`, because both sides have a `sword`. */
	id: string;
	allow: 'all' | 'hero';
	/** A keyword id the fighter must carry, for a row a faction sells to some of its own but not all. */
	restrict?: string;
}

export interface Faction {
	id: string;
	name: string;
	keyword: string;
	warband_size: Span;
	/**
	 * Whether the faction comes out of the game's own rules or is written here.
	 * A homebrew faction may bring `homebrew.json`, an official one may not:
	 * what an official faction needs belongs in the shared lists beside this
	 * directory, where every faction can reach it.
	 */
	origin: 'official' | 'homebrew';
	/**
	 * Which version of this entry the deck holds, `major.minor.patch`. It is the
	 * transcription's, not the game's: the deck versions no ruleset, and what a
	 * player compares at the table is this faction against the sheet or the PDF
	 * in front of them. Raised by hand whenever a value here changes.
	 */
	version: string;
	rules: FactionRule[];
	fighters: Fighter[];
	equipment: Allowance[];
	abilities: Ability[];
}

/**
 * What a homebrew faction adds to the shared lists: a weapon nobody else
 * carries, the rule that weapon names, the faction's own keyword. Kept in the
 * faction's directory rather than in `weapons.json` beside it, so the shared
 * lists stay what the game prints and a homebrew faction can be deleted by
 * deleting its folder.
 *
 * The pools are merged into the shared ones, not held apart per faction: a
 * faction can only sell what its own `equipment.json` lists, and the checker
 * refuses an id that already exists, which is the collision that would matter.
 */
export interface Homebrew {
	keywords?: Keyword[];
	weapons?: Weapon[];
	items?: Item[];
	'weapon-rules'?: WeaponRule[];
}

/**
 * A fighter hired for one battle, from `hired-swords/`.
 *
 * Not a `Fighter`: it belongs to no faction, names the factions that may take
 * it, and its `cost` is a fee paid per battle rather than a share of the
 * warband's budget. One file per hired sword, and the file is the whole entry –
 * its talents and the weapons only it carries are written into it rather than
 * into the shared lists, because nothing else can reach them. What the shared
 * lists already hold is named by id instead, which is what lets the Freelance
 * Knight carry his own sword and an ordinary shield.
 */
export interface HiredSword {
	id: string;
	name: string;
	/** As on a faction: whether the game prints this one or the deck writes it. */
	origin: 'official' | 'homebrew';
	/** The transcription's version, `major.minor.patch`. */
	version: string;
	/** The hiring fee, paid for one battle. */
	cost: number;
	/** How many of this one a warband may take along. */
	limit: Span;
	/** The faction ids that may hire this one. */
	may_hire: string[];
	description: string;
	profile: Record<StatKey, number>;
	keywords: string[];
	/** Prefixed `weapon:` or `item:`, resolved against the shared lists. */
	gear: string[];
	choose: FighterChoice | null;
	abilities: Ability[];
	/** Weapons only this hired sword carries; folded into the shared list on load. */
	weapons: Weapon[];
	items: Item[];
}

export interface Campaign {
	warband_budget: number;
	standing_thresholds: { min: number; max: number; label: string }[];
	favour_tiers: { min: number; max: number; label: string; income: number }[];
}
