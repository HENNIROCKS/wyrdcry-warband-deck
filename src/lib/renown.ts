/**
 * Step 2 of the aftermath, second half: what a renown level is spent on. Pure
 * warband math – the sheet that asks lives in `RenownSheet.svelte`.
 *
 * `aftermath.ts` raises the counter; this works out which levels were earned,
 * which characteristics each may raise, and what a choice writes.
 */

import type { HeroicTalent, RacialLimit, Weapon } from './rules/types';
import { newId } from './id';
import {
	type CustomAbility,
	type FighterInstance,
	type PendingRenown,
	type RenownBranch,
	type RenownChoice,
	type StatKey,
	type StoredWarband,
	type Warband
} from './types/warband';

/**
 * The characteristics renown can raise. Armour, which the app keeps under
 * `defense`, is not among them: it comes from what a fighter wears, and the
 * racial limits have no column for it.
 */
export type RaisableStat = Exclude<StatKey, 'defense'>;
export const RAISABLE: RaisableStat[] = ['move', 'fight', 'shoot', 'health', 'bravery'];

/**
 * How far one increase moves each figure. Health rises in twos; Bravery is a
 * roll to beat, so better is a lower number.
 */
export const RENOWN_STEP: Record<RaisableStat, number> = {
	move: 1,
	fight: 1,
	shoot: 1,
	health: 2,
	bravery: -1
};

/**
 * The branch a level falls under, read off the keywords the fighter carried
 * before the aftermath. A henchman's fourth level is its promotion; by the fifth
 * it already reads HERO.
 */
export function branchOf(keywords: string[], level: number): RenownBranch {
	const held = keywords.map((k) => k.toUpperCase());
	if (held.includes('HERO')) return 'hero';
	if (held.includes('HENCHMAN')) return level === 4 ? 'promotion' : 'henchman';
	return 'none';
}

/**
 * A henchman with four levels of renown is a HERO, from the moment it has them –
 * not from the moment the choice is made. Worked out every time rather than kept:
 * `renown` survives the builder and every import. The builder shows any fighter
 * with four levels as a hero; the rules promote a HENCHMAN alone, and so does the
 * card. A fighter with neither keyword stays as it is.
 */
export function promoted(keywords: string[], renown: number): string[] {
	if (renown < 4) return keywords;
	const upper = keywords.map((k) => k.toUpperCase());
	if (upper.includes('HERO') || !upper.includes('HENCHMAN')) return keywords;
	return keywords.map((k) => (k.toUpperCase() === 'HENCHMAN' ? 'HERO' : k));
}

/**
 * The levels this aftermath earned: one entry for each level a fighter's renown
 * rose past, in the order the roster lists them. `keywordsOf` is asked for the
 * keywords as they stood before the aftermath.
 */
export function earnedLevels(
	before: Warband,
	after: Warband,
	keywordsOf: (instanceId: string) => string[]
): PendingRenown[] {
	const earlier = new Map(before.fighters.map((f) => [f.instanceId, f.renown]));
	return after.fighters.flatMap((fighter) => {
		const from = earlier.get(fighter.instanceId) ?? fighter.renown;
		const keywords = keywordsOf(fighter.instanceId);
		const levels: PendingRenown[] = [];
		for (let level = from + 1; level <= fighter.renown; level++) {
			levels.push({ instanceId: fighter.instanceId, level, branch: branchOf(keywords, level) });
		}
		return levels;
	});
}

/** The limit of the first of a fighter's keywords that names a race with one. */
export function limitFor(keywords: string[], limits: Map<string, RacialLimit>): RacialLimit | null {
	for (const keyword of keywords) {
		const limit = limits.get(keyword.toLowerCase().replace(/ /g, '-'));
		if (limit?.profile) return limit;
	}
	return null;
}

export interface RenownOption {
	characteristic: StatKey;
	from: number;
	to: number;
	/** Signed, as the figure moves. */
	bonus: number;
	/** Why it cannot be picked, or null where it can. */
	blocked: 'limit' | 'repeat' | null;
}

/**
 * What each characteristic could become. The figure rises from what the warband
 * file already holds, not from the profile, so the bonus a wizard-built fighter
 * started with is kept.
 *
 * The limit tests the result, not the starting point: reaching it is allowed,
 * only going beyond is not. A henchman may not raise the same characteristic
 * twice, and that holds for its henchman levels only – a promotion starts clean.
 */
export function optionsFor(
	profile: Record<StatKey, number>,
	fighter: FighterInstance,
	branch: RenownBranch,
	history: RenownChoice[],
	limit: RacialLimit | null
): RenownOption[] {
	const taken = new Set(
		history
			.filter((c) => c.instanceId === fighter.instanceId && c.branch === 'henchman')
			.map((c) => c.characteristic)
	);
	return RAISABLE.map((characteristic) => {
		const from = fighter.statOverrides?.[characteristic] ?? profile[characteristic];
		const bonus = RENOWN_STEP[characteristic];
		const to = from + bonus;
		const cap = limit?.profile?.[characteristic];
		const beyond = cap !== undefined && (characteristic === 'bravery' ? to < cap : to > cap);
		const repeat = branch === 'henchman' && taken.has(characteristic);
		return { characteristic, from, to, bonus, blocked: beyond ? 'limit' : repeat ? 'repeat' : null };
	});
}

/** The most heroic talents a fighter can have. */
export const MAX_TALENTS = 5;
/** The specializations a fighter's talents may come from. */
export const MAX_SPECIALIZATIONS = 2;

export interface WeaponOption {
	id: string;
	name: string;
}

export interface TalentOption {
	talent: HeroicTalent;
	/** Why it cannot be picked, or null where it can. */
	blocked: 'specialization' | 'limit' | 'repeat' | null;
	/** The weapons to select a type from, for a talent that asks for one; null for the rest. */
	weapons: WeaponOption[] | null;
}

/** A magical ability a fighter may learn instead of a talent. */
export interface AbilityOption {
	id: string;
	name: string;
	text: string;
	/** Why it cannot be learned, or null where it can. */
	blocked: 'limit' | null;
}

/**
 * The abilities left to learn: those on offer at recruitment that the fighter
 * did not pick then. `learned` are the ones it has learned since, `allowed` how
 * many the rules let it learn in all.
 */
export function abilitiesFor(
	offered: string[],
	picked: string[],
	learned: string[],
	allowed: number,
	describe: (id: string) => { name: string; text: string } | undefined
): AbilityOption[] {
	return offered.flatMap((id) => {
		const ability = describe(id);
		if (!ability || picked.includes(id) || learned.includes(id)) return [];
		return [{ id, ...ability, blocked: learned.length >= allowed ? ('limit' as const) : null }];
	});
}

/** What a level is spent on: a characteristic, a heroic talent, or a magical ability. */
export type RenownPick =
	| { kind: 'stat'; option: RenownOption }
	| { kind: 'ability'; ability: Pick<AbilityOption, 'id' | 'name'> }
	| {
			kind: 'talent';
			talent: HeroicTalent;
			/** The weapon a talent was taken for. */
			weapon: WeaponOption | null;
			/** The name the fighter carries from now on, where the talent has to be written against one. */
			name: string | null;
	  };

/** "Name: text" with the type in front, the spelling `adapter.ts` reads back. */
function talentLine(talent: HeroicTalent, weapon: WeaponOption | null): string {
	const type = talent.type[0].toUpperCase() + talent.type.slice(1);
	const name = weapon ? `${talent.name} (${weapon.name})` : talent.name;
	return `[${type}] ${name}: ${talent.text}`;
}

const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/**
 * The talents a fighter has: those taken at a level of renown, and those the
 * builder wrote against its name by hand. Told apart from other abilities by
 * the talent's own name, with or without the weapon after it.
 */
export function heldTalents(
	talents: HeroicTalent[],
	instanceId: string,
	names: string[],
	history: RenownChoice[],
	customAbilities: CustomAbility[]
): Set<string> {
	/* An ability learned instead of a talent (`kind` 'ability') does not count: whether
	   it counts towards the five is not settled in the rules (DEVIATIONS.md, Open upstream). */
	const held = new Set(
		history.filter((c) => c.instanceId === instanceId && c.kind === 'talent' && c.talent).map((c) => c.talent as string)
	);
	for (const entry of customAbilities) {
		if (!entry.fighter.split(',').some((t) => names.some((n) => sameName(n, t)))) continue;
		const written = entry.ability.match(/^\s*(?:\[[^\]]+\]\s*)?([^:(]+?)\s*(?:\([^)]*\))?\s*:/)?.[1];
		const talent = talents.find((t) => written && sameName(t.name, written));
		if (talent) held.add(talent.id);
	}
	return held;
}

/**
 * Every talent with the reason it cannot be taken, if there is one: a third
 * specialization, a sixth talent, one the fighter has already. Weapon-bound
 * talents come with the weapons to select from.
 */
export function talentsFor(
	talents: HeroicTalent[],
	held: Set<string>,
	weaponsOf: (kind: 'melee' | 'ranged') => WeaponOption[]
): TalentOption[] {
	const specializations = new Set(talents.filter((t) => held.has(t.id)).map((t) => t.specialization));
	return talents.map((talent) => ({
		talent,
		blocked: held.has(talent.id)
			? 'repeat'
			: held.size >= MAX_TALENTS
				? 'limit'
				: !specializations.has(talent.specialization) && specializations.size >= MAX_SPECIALIZATIONS
					? 'specialization'
					: null,
		weapons: talent.weapon ? weaponsOf(talent.weapon) : null
	}));
}

/**
 * The weapons of one kind a talent can be selected for: what the fighter
 * carries first, then what its faction sells it. The rule binds to the kind of
 * weapon, so one bought later counts.
 */
export function weaponsOffered(
	kind: 'melee' | 'ranged',
	carried: string[],
	sold: string[],
	weapons: Map<string, Weapon>
): WeaponOption[] {
	const seen = new Set<string>();
	return [...carried, ...sold].flatMap((id) => {
		const weapon = weapons.get(id);
		if (!weapon || weapon.type !== kind || seen.has(id)) return [];
		seen.add(id);
		return [{ id, name: weapon.name }];
	});
}

/**
 * The abilities with those written against `from` moved to `to`, or dropped
 * where `to` is null. A fighter field can name several fighters, separated by
 * commas, and only the one name is touched; an entry left with no name goes.
 */
export function retargeted(abilities: CustomAbility[], from: string, to: string | null): CustomAbility[] {
	return abilities.flatMap((ability) => {
		const names = ability.fighter.split(',').map((n) => n.trim());
		if (!names.some((n) => sameName(n, from))) return [ability];
		const kept = names.flatMap((n) => (sameName(n, from) ? (to === null ? [] : [to]) : [n]));
		return kept.length ? [{ ...ability, fighter: kept.join(', ') }] : [];
	});
}

/**
 * Whether abilities written against `name` belong to this fighter alone: it has
 * a name of its own, and no other fighter answers to it – by name of its own,
 * by profile, or as the faction. `reserved` lists the names the others answer
 * to besides their own.
 */
export function ownsName(warband: Warband, instanceId: string, name: string, reserved: string[]): boolean {
	if (name.trim() === '') return false;
	return (
		!reserved.some((r) => sameName(r, name)) &&
		!warband.fighters.some((f) => f.instanceId !== instanceId && sameName(f.customName, name))
	);
}

/**
 * The warband with a fighter's name changed, and the abilities written against
 * its old name moved along. Nothing moves from a name the fighter does not own
 * (see `ownsName`) or to one it could not own: an empty name, or one another
 * fighter answers to. The abilities then stay under the old name.
 */
export function renamed(
	warband: Warband,
	instanceId: string,
	from: string,
	to: string,
	reserved: string[] = []
): Warband {
	const moves =
		!sameName(from, to) &&
		ownsName(warband, instanceId, from, reserved) &&
		ownsName(warband, instanceId, to, reserved);
	return {
		...warband,
		fighters: warband.fighters.map((f) => (f.instanceId === instanceId ? { ...f, customName: to } : f)),
		customAbilities: moves ? retargeted(warband.customAbilities, from, to) : warband.customAbilities
	};
}

/**
 * Spends one level and writes everything it changes in one go: the figure, the
 * reason beside it, the pending entry it clears, and a revision – it is
 * campaign progress. One value, so a single `putWarband` stores all of it and a
 * phone that goes to sleep mid-way cannot leave a level both spent and open.
 *
 * `pick` is null where nothing could be raised and the rules offer nothing
 * else – a henchman level, or one without a keyword. The level is then spent on
 * nothing, so the entry does not stay open for ever. A hero's level stays open
 * instead unless every characteristic and talent is out of reach.
 *
 * A talent is written as an ability against the fighter's own name, which is
 * how the builder keeps one as well; the pick brings the name where the fighter
 * has none or shares it. `reserved` is as in `ownsName`.
 */
export function spend(
	stored: StoredWarband,
	pending: PendingRenown,
	pick: RenownPick | null,
	reserved: string[] = []
): StoredWarband {
	const option = pick?.kind === 'stat' ? pick.option : null;
	const talent = pick?.kind === 'talent' ? pick : null;
	const ability = pick?.kind === 'ability' ? pick.ability : null;
	const choice: RenownChoice = {
		instanceId: pending.instanceId,
		level: pending.level,
		branch: pending.branch,
		characteristic: option?.characteristic ?? null,
		bonus: option?.bonus ?? 0,
		source: `Renown ${pending.level}`,
		...(talent && { talent: talent.talent.id, kind: 'talent' as const, choice: talent.weapon?.id ?? null }),
		...(ability && { talent: ability.id, kind: 'ability' as const, choice: null })
	};
	const same = (e: { instanceId: string; level: number }) =>
		e.instanceId === pending.instanceId && e.level === pending.level;

	let warband = stored.warband;
	if (option) {
		warband = {
			...warband,
			fighters: warband.fighters.map((f) =>
				f.instanceId === pending.instanceId
					? { ...f, statOverrides: { ...f.statOverrides, [option.characteristic]: option.to } }
					: f
			)
		};
	}
	if (talent) {
		const current = warband.fighters.find((f) => f.instanceId === pending.instanceId)?.customName ?? '';
		const name = (talent.name ?? current).trim();
		warband = renamed(warband, pending.instanceId, current, name, reserved);
		const ability: CustomAbility = {
			id: newId(),
			fighter: name,
			type: talent.talent.type,
			ability: talentLine(talent.talent, talent.weapon)
		};
		warband = { ...warband, customAbilities: [...warband.customAbilities, ability] };
	}

	return {
		...stored,
		warband,
		renownHistory: [...(stored.renownHistory ?? []).filter((e) => !same(e)), choice],
		pendingRenown: (stored.pendingRenown ?? []).filter((e) => !same(e)),
		revision: stored.revision + 1,
		updatedAt: new Date().toISOString()
	};
}
