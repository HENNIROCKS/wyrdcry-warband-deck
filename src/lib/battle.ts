/**
 * The battle level: who has already acted this round, and what everyone has
 * taken.
 *
 * Kept apart from the campaign level on purpose. Everything here is thrown away
 * when a battle ends, and none of it is worth an export – see `BattleState`.
 *
 * Health is not known here. Whoever allocates damage hands the figure in, so
 * this module stays free of game data and of the card that works the figure out.
 */

import type { BattleState, FighterBattleState } from './types/warband';

/** What a fighter carries before anything has happened to it. */
export const FRESH: FighterBattleState = {
	activated: false,
	waiting: false,
	damage: 0,
	out: false
};

export function start(): BattleState {
	return { startedAt: new Date().toISOString(), round: 1, fighters: {}, undo: null };
}

/** Everything about one fighter, with every field the record lacks defaulted. */
export function stateOf(battle: BattleState | null, instanceId: string): FighterBattleState {
	const stored = battle?.fighters[instanceId];
	return stored ? { ...FRESH, ...stored } : FRESH;
}

export function isActivated(battle: BattleState | null, instanceId: string): boolean {
	return stateOf(battle, instanceId).activated;
}

export function isWaiting(battle: BattleState | null, instanceId: string): boolean {
	return stateOf(battle, instanceId).waiting;
}

export function isOut(battle: BattleState | null, instanceId: string): boolean {
	return stateOf(battle, instanceId).out;
}

export function damageOf(battle: BattleState | null, instanceId: string): number {
	return stateOf(battle, instanceId).damage;
}

/**
 * Writes one fighter's state, starting a battle if none is running. The first
 * tap at the table is the start of the game; asking for it separately would only
 * create a state one can forget to leave.
 */
function write(
	battle: BattleState | null,
	instanceId: string,
	patch: Partial<FighterBattleState>
): BattleState {
	const current = battle ?? start();
	return {
		...current,
		fighters: {
			...current.fighters,
			[instanceId]: { ...stateOf(current, instanceId), ...patch }
		},
		/* The new round has been played into, so the one before it is out of
		   reach – returning to it would drop this tap on the floor. */
		undo: null
	};
}

/** Activated: the fighter is done for this round, so it is no longer waiting. */
export function toggle(battle: BattleState | null, instanceId: string): BattleState {
	return write(battle, instanceId, { activated: !isActivated(battle, instanceId), waiting: false });
}

/**
 * Waiting: the activation is over and the fighter is not done with the round.
 * The two states are exclusive – a fighter that comes back to act is marked
 * activated instead.
 */
export function toggleWaiting(battle: BattleState | null, instanceId: string): BattleState {
	return write(battle, instanceId, { waiting: !isWaiting(battle, instanceId), activated: false });
}

/**
 * Allocates or takes back damage points. A fighter holding damage equal to its
 * Health is out of action, and anything past that is discarded – so a fighter
 * whose Health drops afterwards is out at the next tap, not retroactively.
 */
export function allocate(
	battle: BattleState | null,
	instanceId: string,
	delta: number,
	health: number
): BattleState {
	const ceiling = Math.max(0, health);
	const damage = Math.min(ceiling, Math.max(0, damageOf(battle, instanceId) + delta));
	return write(battle, instanceId, { damage, out: health > 0 && damage >= health });
}

/**
 * The next round clears what belongs to a round and keeps what belongs to the
 * battle: the wounds and whoever is out of action carry over.
 */
export function nextRound(battle: BattleState): BattleState {
	const fighters: Record<string, FighterBattleState> = {};
	for (const [id, state] of Object.entries(battle.fighters)) {
		fighters[id] = { ...FRESH, ...state, activated: false, waiting: false };
	}
	return {
		...battle,
		round: battle.round + 1,
		fighters,
		undo: { round: battle.round, fighters: battle.fighters }
	};
}

/**
 * One step back. There is deliberately no chain of them: what this undoes is a
 * mistap, and a mistap is noticed at once.
 */
export function undoRound(battle: BattleState): BattleState {
	if (!battle.undo) return battle;
	return { ...battle, round: battle.undo.round, fighters: battle.undo.fighters, undo: null };
}

/**
 * How many of the given fighters still have to act this round. A fighter that is
 * waiting counts – it is coming back – and one that is out of action does not.
 */
export function remaining(battle: BattleState | null, instanceIds: string[]): number {
	return instanceIds.filter((id) => {
		const state = stateOf(battle, id);
		return !state.activated && !state.out;
	}).length;
}

/** How many of the given fighters have been taken out of action. */
export function outOfAction(battle: BattleState | null, instanceIds: string[]): number {
	return instanceIds.filter((id) => isOut(battle, id)).length;
}

/**
 * Whether the warband's morale is wavering: half its fighters, rounding up, are
 * out of action. Worked out rather than latched, so taking back a mistaken wound
 * takes the warband back out of it as well.
 */
export function isWavering(battle: BattleState | null, instanceIds: string[]): boolean {
	if (!instanceIds.length) return false;
	return outOfAction(battle, instanceIds) >= Math.ceil(instanceIds.length / 2);
}
