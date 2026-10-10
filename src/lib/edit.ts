/**
 * What the back of a card edits, and how Done turns it into a stored warband.
 *
 * The draft is held apart from the warband until Done writes it in one go –
 * Cancel simply lets it fall. `applyDraft` is pure, so the back can ask what the
 * warband would be with the draft applied while it is still being written: a
 * level raised on the back is spent there before anything is stored.
 */

import { itemCost } from './adapter';
import { takesNothing } from './build/equipment';
import { ITEMS } from './gamedata';
import { newId } from './id';
import { today } from './history';
import { earnedLevels, ownsName, renamed, retargeted, spend, type RenownPick } from './renown';
import type { Fighter } from './rules';
import type { BattleRecord, FighterInstance, StoredWarband } from './types/warband';

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
	pick: RenownPick | null;
	/** The name the field held before this pick wrote its own into it, for Undo. */
	nameBefore?: string;
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
	/** What the fighter has bought, as stored – what it is born with is not in here. */
	equipment: string[];
	/**
	 * What is bought on this back, kept apart from `equipment` until Done so it
	 * can be taken back. Done adds it to what the fighter carries, and that is
	 * the payment: `gold` is the whole treasury, so the value it adds comes off
	 * what is left.
	 */
	bought: string[];
	/** The warband's stash, which the fighter hands pieces to and takes them from. */
	stash: string[];
	/** Every name the faction and the other fighters answer to, their own names included. */
	reserved: string[];
}

export const MAX_XP = 3;

/**
 * Why the back cannot be kept as it stands, or null. A talent is written
 * against the fighter's name, so a talent spent here needs a name of its own
 * that no other fighter answers to.
 */
export function nameProblem(fighter: FighterDraft): string | null {
	if (!fighter.spent.some((s) => s.pick?.kind === 'talent')) return null;
	const name = fighter.name.trim();
	if (name === '') return 'A talent belongs to one fighter by name – give this one a name first.';
	if (fighter.reserved.some((r) => r.trim().toLowerCase() === name.toLowerCase())) {
		return 'Another fighter answers to this name – choose a name of its own.';
	}
	return null;
}

export interface EditDraft {
	/** On a fighter's card only. */
	fighter: FighterDraft | null;
	notes: string;
	fluff: string;
	/** The battles, on the warband card only. */
	history: BattleRecord[] | null;
	/** The deck's colour, on the warband card only; null for the green. */
	colour: string | null;
	/** Battles struck out, dropped on Done and brought back until then. */
	removed: string[];
	/** The battle being entered and not yet added. */
	pending: PendingBattle;
	/** Sums of gold added to the treasury on the warband card's back, in order; Done writes their total. */
	goldAdded: number[];
	/** Pieces of the stash sold or thrown away on the warband card's back, by their place in it. */
	stashOut: StashOut[];
}

export interface StashOut {
	/** The piece's place in the stash as stored, which nothing moves until Done. */
	index: number;
	/** Sold for `salePrice()`; otherwise thrown away for nothing. */
	sold: boolean;
}

/**
 * What a piece sells for: half its price, rounded down to a multiple of 5gc,
 * never less than 5gc – a 25gc piece brings 10gc, a 5gc one still 5gc. A piece
 * the game data has no price for brings nothing.
 */
export function salePrice(cost: number): number {
	if (cost <= 0) return 0;
	return Math.max(5, Math.floor(cost / 2 / 5) * 5);
}

/**
 * What the stash leaves the treasury with, against `gold` as the whole of it.
 * A piece leaving takes its price out of the warband's value; sold, its sale
 * price comes back, as in the builder's `SELL_FROM_STASH`. Thrown away, nothing
 * does, so the gold left over stays where it was.
 */
export function stashGold(stash: string[], out: StashOut[]): number {
	return out.reduce((sum, { index, sold }) => {
		const cost = itemCost(stash[index] ?? '');
		return sum - cost + (sold ? salePrice(cost) : 0);
	}, 0);
}

/** The gold the back adds to the treasury. */
export function goldAdded(draft: EditDraft): number {
	return draft.goldAdded.reduce((sum, amount) => sum + amount, 0);
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

/** A piece the fighter carries goes to the stash. No gold moves, in the builder neither. */
export function sendToStash(fighter: FighterDraft, index: number): void {
	const id = fighter.equipment[index];
	if (id === undefined) return;
	fighter.equipment = fighter.equipment.filter((_, i) => i !== index);
	fighter.stash = [...fighter.stash, id];
}

/** A piece from the stash goes to the fighter; whether it may is `refuse()`'s to say. */
export function takeFromStash(fighter: FighterDraft, index: number): void {
	const id = fighter.stash[index];
	if (id === undefined) return;
	fighter.stash = fighter.stash.filter((_, i) => i !== index);
	fighter.equipment = [...fighter.equipment, id];
}

export interface TradingOffer {
	id: string;
	name: string;
	cost: number;
	/** Bought only after a Rarity roll of 6+, which is made at the table. */
	rare: boolean;
	/** Null where it can be bought; otherwise why not. */
	refused: string | null;
}

/**
 * The Trading Post, open to every faction and every fighter who takes
 * equipment at all – one of each item per fighter. Read off the game data,
 * which the warband's value prices from. The Master-Wrought Weapon is left
 * out: it raises a weapon's cost rather than being a piece of its own.
 *
 * `held` is everything the fighter carries, bought or ordered.
 */
export function tradingPost(fighter: Fighter, held: string[]): { miscellaneous: TradingOffer[]; singleUse: TradingOffer[] } {
	const none = takesNothing(fighter);
	const rows = [...ITEMS.values()]
		.filter((item) => item.id !== 'master-wrought-weapon')
		.map((item) => ({
			type: item.type,
			offer: {
				id: item.id,
				name: item.name,
				cost: item.cost,
				rare: item.rare === true,
				refused: none ?? (held.includes(item.id) ? 'One of each per fighter' : null)
			}
		}));
	const of = (type: string) => rows.filter((row) => row.type === type).map((row) => row.offer);
	return { miscellaneous: of('miscellaneous'), singleUse: of('single-use') };
}

/** Whether the piece comes from the Trading Post rather than a faction's list. */
export function fromTradingPost(id: string): boolean {
	const type = ITEMS.get(id)?.type;
	return type === 'miscellaneous' || type === 'single-use';
}

/**
 * Buys a piece for the fighter. Whether it may is for the offer to say:
 * `refuse()` for what the faction sells, `tradingPost()` for the rest.
 */
export function buy(fighter: FighterDraft, id: string): void {
	fighter.bought = [...fighter.bought, id];
}

/** Takes back a piece bought on this back, before Done pays for it. */
export function unbuy(fighter: FighterDraft, index: number): void {
	fighter.bought = fighter.bought.filter((_, i) => i !== index);
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
	const before = stored.warband.fighters.find((f) => f.instanceId === targetId);
	/* The stash is the draft's copy from when the card was turned: written only
	   when something moved, so a back that moved nothing leaves it as it is. */
	const moved = fighter && before && fighter.equipment.join() !== before.equipment.join();
	const base = isWarband
		? {
				...stored.warband,
				factionNotes: draft.notes,
				gold: stored.warband.gold + goldAdded(draft) + stashGold(stored.warband.stash, draft.stashOut),
				stash: stored.warband.stash.filter((_, i) => !draft.stashOut.some((out) => out.index === i))
			}
		: {
				...stored.warband,
				...(moved && { stash: fighter.stash }),
				fighters: stored.warband.fighters.map((f) =>
					f.instanceId === targetId
						? {
								...f,
								notes: draft.notes,
								...(fighter && {
									xp: fighter.xp,
									renown: fighter.renown,
									equipment: [...fighter.equipment, ...fighter.bought]
								})
							}
						: f
				)
			};
	/* What is written against the fighter's name moves with it. */
	const warband =
		fighter && before
			? renamed(base, targetId, before.customName, fighter.name.trim(), fighter.reserved)
			: base;
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
		colour: isWarband ? draft.colour : (stored.colour ?? null),
		pendingRenown: pending.length ? pending : null
	};
	for (const { level, pick } of fighter?.spent ?? []) {
		const entry = next.pendingRenown?.find((e) => e.instanceId === targetId && e.level === level);
		if (entry) next = spend(next, entry, pick, fighter?.reserved);
	}
	if (!next.pendingRenown?.length) next = { ...next, pendingRenown: null };
	return { ...next, revision: stored.revision + 1, updatedAt: new Date().toISOString() };
}

/**
 * What dismissing a fighter takes off the gold: what it brought into the
 * warband's value, less the pieces it hands to the stash, which stay in the
 * value there. The gold left over is the same before and after – a dismissed
 * fighter refunds nothing. An unconfirmed fighter was never in the value, so
 * nothing comes off; neither does equipment still waiting to be bought.
 *
 * `cost` is the card's: the profile's or the override, plus all equipment.
 */
export function dismissCost(instance: FighterInstance, cost: number, toStash: number[]): number {
	if (instance.isPending) return 0;
	return cost - toStash.reduce((sum, i) => sum + itemCost(instance.equipment[i] ?? ''), 0);
}

/**
 * The warband without the fighter, as the builder's `REMOVE_FIGHTER` leaves it
 * after `SEND_TO_STASH` for each piece in `toStash`. What only this app keeps
 * about the fighter goes with it, as do the abilities written against its own
 * name – unless another fighter answers to the same name (`reserved` lists the
 * names the others answer to besides their own). A fighter with no name of its
 * own has none: what is carried by a profile's name belongs to every fighter of
 * that profile.
 */
export function dismiss(
	stored: StoredWarband,
	instanceId: string,
	cost: number,
	toStash: number[],
	reserved: string[] = []
): StoredWarband {
	const instance = stored.warband.fighters.find((f) => f.instanceId === instanceId);
	if (!instance) return stored;
	const others = <T extends { instanceId: string }>(list: T[] | null | undefined) =>
		list ? list.filter((e) => e.instanceId !== instanceId) : list;
	const without = <T>(record: Record<string, T>) =>
		Object.fromEntries(Object.entries(record).filter(([id]) => id !== instanceId));
	const pendingRenown = others(stored.pendingRenown);
	const own = ownsName(stored.warband, instanceId, instance.customName, reserved);

	return {
		...stored,
		warband: {
			...stored.warband,
			gold: stored.warband.gold - dismissCost(instance, cost, toStash),
			stash: [...stored.warband.stash, ...toStash.map((i) => instance.equipment[i]).filter(Boolean)],
			fighters: stored.warband.fighters.filter((f) => f.instanceId !== instanceId),
			customAbilities: own
				? retargeted(stored.warband.customAbilities, instance.customName, null)
				: stored.warband.customAbilities
		},
		selections: stored.selections && {
			...stored.selections,
			fighters: without(stored.selections.fighters),
			modifiers: stored.selections.modifiers.filter((m) => m.instanceId !== instanceId)
		},
		fluff: stored.fluff && { ...stored.fluff, fighters: without(stored.fluff.fighters) },
		renownHistory: others(stored.renownHistory),
		pendingRenown: pendingRenown?.length ? pendingRenown : null,
		revision: stored.revision + 1,
		updatedAt: new Date().toISOString()
	};
}

/**
 * Pays for everything a warband from the builder still has waiting, as the
 * builder's `PURCHASE_PENDING` does: what was ordered joins what each fighter
 * carries, and a fighter not yet bought becomes one. `gold` stays – it is the
 * whole treasury, and the value the purchase adds is what now comes off it.
 */
export function purchase(stored: StoredWarband): StoredWarband {
	return {
		...stored,
		warband: {
			...stored.warband,
			fighters: stored.warband.fighters.map((f) => ({
				...f,
				isPending: false,
				equipment: f.isPending ? f.equipment : [...f.equipment, ...f.pendingEquipment],
				pendingEquipment: []
			}))
		},
		revision: stored.revision + 1,
		updatedAt: new Date().toISOString()
	};
}
