/**
 * The battle level: who has already activated this round.
 *
 * Kept apart from the campaign level on purpose. Everything here is thrown away
 * when a battle ends, and none of it is worth an export – see `BattleState`.
 */

import type { BattleState } from './types/warband';

export function start(): BattleState {
	return { startedAt: new Date().toISOString(), round: 1, fighters: {}, undo: null };
}

export function isActivated(battle: BattleState | null, instanceId: string): boolean {
	return battle?.fighters[instanceId]?.activated ?? false;
}

/**
 * Toggles one fighter, starting a battle if none is running. The first tap at
 * the table is the start of the game; asking for it separately would only
 * create a state one can forget to leave.
 */
export function toggle(battle: BattleState | null, instanceId: string): BattleState {
	const current = battle ?? start();
	return {
		...current,
		fighters: {
			...current.fighters,
			[instanceId]: { activated: !isActivated(current, instanceId) }
		},
		/* The new round has been played into, so the one before it is out of
		   reach – returning to it would drop this activation on the floor. */
		undo: null
	};
}

/** The next round clears the activations and nothing else. */
export function nextRound(battle: BattleState): BattleState {
	return {
		...battle,
		round: battle.round + 1,
		fighters: {},
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

/** How many of the given fighters still have to act this round. */
export function remaining(battle: BattleState | null, instanceIds: string[]): number {
	return instanceIds.filter((id) => !isActivated(battle, id)).length;
}
