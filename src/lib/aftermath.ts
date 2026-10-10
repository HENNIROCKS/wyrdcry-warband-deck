/**
 * Steps 2 and 4 of the aftermath sequence: experience and the renown it
 * crosses into, then favour and income. Pure warband math – the back of the
 * warband card that collects a player's answers is `AftermathBack.svelte`.
 *
 * Renown is a counter here. What a level is spent on – a Characteristics
 * Increase – is `renown.ts`, which the page opens for every level this step
 * earned. A henchman's fourth level promotes it to
 * Hero without any choice; the card derives that from the counter.
 */

import { isOut } from './battle';
import { newId } from './id';
import { today } from './history';
import { CAMPAIGN } from './rules';
import type { BattleRecord, BattleState } from './types/warband';
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

/**
 * The experience step while it is being answered on the back of the warband
 * card. Who is asked is read once, when the battle starts ending: the back is
 * never kept open across a change underneath it.
 */
export interface AftermathDraft {
	rows: AftermathCandidate[];
	/** Who never earns experience, named under the rows. */
	excluded: string[];
	/** Keyed by instanceId. */
	answers: Record<string, AftermathAnswer>;
	/** The one fighter given the bonus point, if any. */
	bonus: string | null;
	/** Step 4, and the battle's line in the history. */
	income: IncomeDraft;
}

export interface IncomeDraft {
	/** Wyrdstone shards delivered to the faction. */
	shards: number;
	result: BattleRecord['result'] | null;
	/** Whether Apply adds the battle to the history. */
	record: boolean;
	opponentWarband: string;
	opponentPlayer: string;
	/**
	 * A line already in the history from the day the battle started on, which
	 * is likely this battle entered by hand. Its presence starts `record` off.
	 */
	recorded: BattleRecord | null;
}

export function startAftermath(
	warband: Warband,
	cards: FighterCardData[],
	battle: BattleState | null,
	history: BattleRecord[] = []
): AftermathDraft {
	const all = candidates(warband, cards, battle);
	const rows = all.filter((c) => c.eligible);
	return {
		rows,
		excluded: all.filter((c) => !c.eligible).map((c) => c.name),
		answers: Object.fromEntries(
			rows.map((r) => [r.instanceId, { participated: r.participated, survived: r.survived, enemyOut: false }])
		),
		bonus: null,
		income: startIncome(history, battle)
	};
}

function startIncome(history: BattleRecord[], battle: BattleState | null): IncomeDraft {
	const since = today(battle ? new Date(battle.startedAt) : undefined);
	const recorded = history.filter((r) => r.date >= since).at(-1) ?? null;
	return { shards: 0, result: null, record: recorded === null, opponentWarband: '', opponentPlayer: '', recorded };
}

export type FavourTier = (typeof CAMPAIGN.favour_tiers)[number];

/** The standing a favour score is in; the last tier is open at the top. */
export function tierFor(favour: number): FavourTier {
	const tiers = CAMPAIGN.favour_tiers;
	return tiers.find((t) => favour >= t.min && favour <= t.max) ?? tiers[tiers.length - 1];
}

export interface Income {
	favour: number;
	/** The favour score once it is earned. */
	total: number;
	/** The standing the warband rises into first, which then pays the income. */
	tier: FavourTier;
	gold: number;
}

/**
 * Step 4: a favour for each shard, one more for a win (4.1); then the income
 * of the standing the warband now holds, so a rise counts at once (4.2).
 */
export function income(favour: number, draft: IncomeDraft): Income {
	const earned = draft.shards + (draft.result === 'win' ? 1 : 0);
	const tier = tierFor(favour + earned);
	return { favour: earned, total: favour + earned, tier, gold: tier.income + tier.per_shard * draft.shards };
}

/** The battle's line in the history, or null where none is to be added. */
export function battleRecord(draft: IncomeDraft): BattleRecord | null {
	if (!draft.record || !draft.result) return null;
	return {
		id: newId(),
		date: today(),
		result: draft.result,
		opponentWarband: draft.opponentWarband.trim(),
		opponentPlayer: draft.opponentPlayer.trim()
	};
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
	bonusInstanceId: string | null,
	earned: Income | null = null
): Warband {
	return {
		...warband,
		/* `gold` is the whole treasury: income adds to it as it is. */
		...(earned && { favour: earned.total, gold: warband.gold + earned.gold }),
		fighters: warband.fighters.map((fighter) => {
			const answer = answers.get(fighter.instanceId);
			if (!answer) return fighter;
			const points = xpEarned(answer, fighter.instanceId === bonusInstanceId);
			return points > 0 ? applyXp(fighter, points) : fighter;
		})
	};
}
