/**
 * Step 2 of the aftermath sequence: experience, and the renown it crosses
 * into. Pure warband math – the sheet that collects a player's answers lives
 * in `AftermathSheet.svelte`.
 *
 * Renown is a counter here. What a level is spent on – a Characteristics
 * Increase – is `renown.ts`, which the page opens for every level this step
 * earned. A henchman's fourth level promotes it to
 * Hero without any choice; the card derives that from the counter.
 */

import { isOut } from './battle';
import type { BattleState } from './types/warband';
import type { FighterCardData } from './types/card';
import type { FighterInstance, Warband } from './types/warband';

/**
 * `keywords.json`: BEAST and THRALL both read "Never earn experience or gain
 * renown" – the same two the card already treats as unequippable
 * (`adapter.ts` `natural`).
 */
const NO_XP_KEYWORDS = ['BEAST', 'THRALL'];

export interface AftermathCandidate {
	instanceId: string;
	name: string;
	eligible: boolean;
	participated: boolean;
	survived: boolean;
}

/**
 * Who is even asked. A pending fighter was not on the table, and BEAST/THRALL
 * never earn the point regardless of what happened in the battle.
 */
export function candidates(warband: Warband, cards: FighterCardData[], battle: BattleState | null): AftermathCandidate[] {
	const byId = new Map(cards.map((c) => [c.instanceId, c]));
	return warband.fighters
		.filter((f) => !f.isPending)
		.map((f) => {
			const card = byId.get(f.instanceId);
			const eligible = !card?.keywords.some((k) => NO_XP_KEYWORDS.includes(k));
			return {
				instanceId: f.instanceId,
				name: card?.name ?? f.customName,
				eligible,
				/* Whether a fighter fought at all is not something a battle's state
				   can prove – nothing is written for one that never got tapped. So
				   the whole roster starts checked, and the player unchecks who sat
				   this one out, rather than the app guessing from silence. */
				participated: eligible,
				survived: eligible && !isOut(battle, f.instanceId)
			};
		});
}

export interface AftermathAnswer {
	participated: boolean;
	survived: boolean;
	enemyOut: boolean;
}

export function xpEarned(answer: AftermathAnswer, bonus: boolean): number {
	return Number(answer.participated) + Number(answer.survived) + Number(answer.enemyOut) + Number(bonus);
}

/**
 * Mirrors the Warband Builder's own reducer (`useWarband.ts`, `SET_FIGHTER_XP`):
 * on the point that would make a fourth, xp resets to 0 and renown rises by
 * one – not a cumulative count divided by four. Applied one point at a time so
 * a multi-point gain crosses the threshold exactly as that many single taps
 * would, including more than one renown level in the same battle.
 */
export function applyXp(fighter: FighterInstance, points: number): FighterInstance {
	let xp = fighter.xp;
	let renown = fighter.renown;
	for (let i = 0; i < points; i++) {
		xp += 1;
		if (xp > 3) {
			xp = 0;
			renown += 1;
		}
	}
	return xp === fighter.xp && renown === fighter.renown ? fighter : { ...fighter, xp, renown };
}

export function applyAftermath(
	warband: Warband,
	answers: Map<string, AftermathAnswer>,
	bonusInstanceId: string | null
): Warband {
	return {
		...warband,
		fighters: warband.fighters.map((fighter) => {
			const answer = answers.get(fighter.instanceId);
			if (!answer) return fighter;
			const points = xpEarned(answer, fighter.instanceId === bonusInstanceId);
			return points > 0 ? applyXp(fighter, points) : fighter;
		})
	};
}
