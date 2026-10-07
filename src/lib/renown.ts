/**
 * Step 2 of the aftermath, second half: what a renown level is spent on. Pure
 * warband math – the sheet that asks lives in `RenownSheet.svelte`.
 *
 * `aftermath.ts` raises the counter; this works out which levels were earned,
 * which characteristics each may raise, and what a choice writes.
 */

import type { RacialLimit } from './rules/types';
import {
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

/**
 * Spends one level and writes everything it changes in one go: the figure, the
 * reason beside it, the pending entry it clears, and a revision – it is
 * campaign progress. One value, so a single `putWarband` stores all of it and a
 * phone that goes to sleep mid-way cannot leave a level both spent and open.
 *
 * `option` is null where nothing could be raised and the rules offer nothing
 * else – a henchman level, or one without a keyword. The level is then spent on
 * nothing, so the entry does not stay open for ever. A hero's level stays open
 * instead: a Heroic Talent is still a choice it has.
 */
export function spend(
	stored: StoredWarband,
	pending: PendingRenown,
	option: RenownOption | null
): StoredWarband {
	const choice: RenownChoice = {
		instanceId: pending.instanceId,
		level: pending.level,
		branch: pending.branch,
		characteristic: option?.characteristic ?? null,
		bonus: option?.bonus ?? 0,
		source: `Renown ${pending.level}`
	};
	const same = (e: { instanceId: string; level: number }) =>
		e.instanceId === pending.instanceId && e.level === pending.level;

	return {
		...stored,
		warband: option
			? {
					...stored.warband,
					fighters: stored.warband.fighters.map((f) =>
						f.instanceId === pending.instanceId
							? { ...f, statOverrides: { ...f.statOverrides, [option.characteristic]: option.to } }
							: f
					)
				}
			: stored.warband,
		renownHistory: [...(stored.renownHistory ?? []).filter((e) => !same(e)), choice],
		pendingRenown: (stored.pendingRenown ?? []).filter((e) => !same(e)),
		revision: stored.revision + 1,
		updatedAt: new Date().toISOString()
	};
}
