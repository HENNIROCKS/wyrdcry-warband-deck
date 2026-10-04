/**
 * What the back of a card edits, and how Done turns it into a stored warband.
 *
 * The draft is held apart from the warband until Done writes it in one go –
 * Cancel simply lets it fall. `applyDraft` is pure, so the back can ask what the
 * warband would be with the draft applied while it is still being written: a
 * level raised on the back is spent there before anything is stored.
 */

import { newId } from './id';
import { today } from './history';
import { earnedLevels, spend, type RenownOption } from './renown';
import type { BattleRecord, StoredWarband } from './types/warband';

export interface PendingBattle {
	date: string;
	result: BattleRecord['result'] | null;
	opponentWarband: string;
	opponentPlayer: string;
}

/** A level spent on the back, in the order it was spent. */
export interface SpentLevel {
	level: number;
	/** Null where nothing could be raised and the level is used up. */
	option: RenownOption | null;
}

/** What only a fighter's back corrects: its name and its campaign figures. */
export interface FighterDraft {
	name: string;
	/** The profile's name, which the card falls back on while `name` is empty. */
	placeholder: string;
	/** 0 to 3: the fourth point is a level of renown, in the deck as in the builder. */
	xp: number;
	renown: number;
	/**
	 * The highest level already spent or waiting to be when the card was turned:
	 * renown is not lowered past it, or a choice would stand on a level the
	 * fighter no longer has. It leaves out the levels spent on the back –
	 * `renownFloor()` adds them, so read the floor there, not here.
	 */
	renownFloor: number;
	spent: SpentLevel[];
}

export const MAX_XP = 3;

export interface EditDraft {
	/** On a fighter's card only. */
	fighter: FighterDraft | null;
	notes: string;
	fluff: string;
	/** The battles, on the warband card only. */
	history: BattleRecord[] | null;
	/** Battles struck out, dropped on Done and brought back until then. */
	removed: string[];
	/** The battle being entered and not yet added. */
	pending: PendingBattle;
}

export function emptyPending(): PendingBattle {
	return { date: today(), result: null, opponentWarband: '', opponentPlayer: '' };
}

export function toRecord(pending: PendingBattle): BattleRecord | null {
	if (!pending.result || !pending.date) return null;
	return {
		id: newId(),
		date: pending.date,
		result: pending.result,
		opponentWarband: pending.opponentWarband.trim(),
		opponentPlayer: pending.opponentPlayer.trim()
	};
}

/**
 * The history Done writes: the struck-out battles gone, and a battle left
 * filled in but not added taken in as well – its result is picked, so it was
 * meant, and Done is not the place to lose it.
 */
export function finalHistory(draft: EditDraft): BattleRecord[] {
	const kept = (draft.history ?? []).filter((r) => !draft.removed.includes(r.id));
	const pending = toRecord(draft.pending);
	return pending ? [...kept, pending] : kept;
}

/** The lowest renown the back may set: no level spent or waiting is taken away. */
export function renownFloor(fighter: FighterDraft): number {
	return Math.max(fighter.renownFloor, ...fighter.spent.map((s) => s.level));
}

/**
 * The warband as Done would store it. Renown raised on the back is a level to
 * spend like one from the aftermath, and the levels spent on the back are then
 * spent in order, each on the state the one before it left. One revision up for
 * the whole of it: it is one edit, however many levels it spends.
 *
 * `keywordsOf` is asked for a fighter's keywords before the edit, which decide
 * the rule a new level falls under, as they do in the aftermath.
 */
export function applyDraft(
	stored: StoredWarband,
	targetId: string,
	draft: EditDraft,
	keywordsOf: (instanceId: string) => string[]
): StoredWarband {
	const isWarband = targetId === 'warband';
	const fighter = draft.fighter;
	const warband = isWarband
		? { ...stored.warband, factionNotes: draft.notes }
		: {
				...stored.warband,
				fighters: stored.warband.fighters.map((f) =>
					f.instanceId === targetId
						? {
								...f,
								notes: draft.notes,
								...(fighter && { customName: fighter.name.trim(), xp: fighter.xp, renown: fighter.renown })
							}
						: f
				)
			};
	const fluff = {
		warband: isWarband ? draft.fluff : (stored.fluff?.warband ?? ''),
		fighters: isWarband
			? (stored.fluff?.fighters ?? {})
			: { ...(stored.fluff?.fighters ?? {}), [targetId]: draft.fluff }
	};
	const pending = [...(stored.pendingRenown ?? []), ...earnedLevels(stored.warband, warband, keywordsOf)];
	let next: StoredWarband = {
		...stored,
		warband,
		fluff,
		history: isWarband ? finalHistory(draft) : stored.history,
		pendingRenown: pending.length ? pending : null
	};
	for (const { level, option } of fighter?.spent ?? []) {
		const entry = next.pendingRenown?.find((e) => e.instanceId === targetId && e.level === level);
		if (entry) next = spend(next, entry, option);
	}
	if (!next.pendingRenown?.length) next = { ...next, pendingRenown: null };
	return { ...next, revision: stored.revision + 1, updatedAt: new Date().toISOString() };
}
