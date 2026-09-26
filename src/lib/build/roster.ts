/**
 * Who may join the warband, at what price, and what still stands in the way of
 * a warband that holds up.
 *
 * The budget and the value are the builder's numbers – `calcValue` counts a
 * fighter's own cost plus everything they carry – so they are worked out the same
 * way here. Where a faction rule cuts a price, the cut is written onto the
 * fighter as a cost override rather than kept beside it, which is the one field
 * the builder's model already has for a fighter that cost something else.
 */

import { CAMPAIGN, type Faction, type Fighter } from '../rules';
import { equipmentCost } from './equipment';
import { recruitEffects } from './effects';
import type { Draft, DraftFighter, Problem } from './types';

export function fighterOf(faction: Faction, fighterId: string): Fighter | undefined {
	return faction.fighters.find((entry) => entry.id === fighterId);
}

/** How many of this profile the draft already holds. */
export function countOf(draft: Draft, fighterId: string): number {
	return draft.fighters.filter((entry) => entry.fighterId === fighterId).length;
}

/**
 * What recruiting this fighter costs now. A rule may cut it – Desperate sells
 * Youngbloods at half – and the cut is rounded, because half of an odd fee is
 * not a price the game has coins for.
 */
export function recruitmentFee(faction: Faction, draft: Draft, fighterId: string): number {
	const fighter = fighterOf(faction, fighterId);
	if (!fighter) return 0;

	let fee = fighter.cost;
	for (const effect of recruitEffects(faction, draft)) {
		const discount = effect.discount.find((entry) => entry.fighter === fighterId);
		if (discount) fee = Math.round(fee * discount.factor);
	}
	return fee;
}

/** Whether a rule in play bars this profile outright. */
export function barred(faction: Faction, draft: Draft, fighterId: string): boolean {
	return recruitEffects(faction, draft).some((effect) => effect.forbid.includes(fighterId));
}

export function fighterValue(faction: Faction, draft: Draft, entry: DraftFighter): number {
	return recruitmentFee(faction, draft, entry.fighterId) + equipmentCost(entry.equipment);
}

/** Everything the warband has spent: the builder's `calcValue` over the draft. */
export function value(faction: Faction, draft: Draft): number {
	return draft.fighters.reduce((sum, entry) => sum + fighterValue(faction, draft, entry), 0);
}

export function budget(): number {
	return CAMPAIGN.warband_budget;
}

export function goldLeft(faction: Faction, draft: Draft): number {
	return budget() - value(faction, draft);
}

export interface Recruitable {
	fighter: Fighter;
	fee: number;
	held: number;
	/** Null where one more may be recruited; otherwise why not. */
	refused: string | null;
}

/**
 * The roster with each profile's price and whether one more may join. Refused
 * rows stay in: that a Champion is at three of three is the answer to why they
 * cannot be picked, and hiding the row does not give it.
 *
 * The leader stands first whatever order the ruleset lists the fighters in. It
 * is the one profile a warband cannot go without, and it is the first tap of
 * every roster; the rest keep the order they are written in.
 */
export function recruitable(faction: Faction, draft: Draft): Recruitable[] {
	const left = goldLeft(faction, draft);
	const full = draft.fighters.length >= (faction.warband_size.max ?? Infinity);
	const leads = (fighter: Fighter) => (fighter.keywords.includes('leader') ? 0 : 1);
	const ordered = [...faction.fighters].sort((a, b) => leads(a) - leads(b));

	return ordered.map((fighter) => {
		const held = countOf(draft, fighter.id);
		const fee = recruitmentFee(faction, draft, fighter.id);
		const max = fighter.limit.max;

		let refused: string | null = null;
		if (barred(faction, draft, fighter.id)) refused = 'A faction rule in play bars this fighter';
		else if (max !== null && held >= max) refused = `${held} of ${max} already`;
		else if (full) refused = `The warband holds ${faction.warband_size.max}`;
		else if (fee > left) refused = `${fee} gc, ${left} left`;

		return { fighter, fee, held, refused };
	});
}

/**
 * What keeps the draft from being a warband. Empty means it can be exported.
 * Ordered by step, so a wizard screen can show the ones it is responsible for.
 */
export function problems(faction: Faction, draft: Draft): Problem[] {
	const found: Problem[] = [];

	if (!draft.name.trim()) {
		/* The builder's import drops a warband without a name without a word, so
		   this one is not cosmetic. */
		found.push({ step: 'rules', text: 'The warband needs a name' });
	}

	for (const rule of faction.rules) {
		if (rule.pick === null) continue;
		const picked = draft.ruleChoices[rule.id] ?? [];
		if (picked.length !== rule.pick) {
			found.push({
				step: 'rules',
				text: `${rule.name}: ${picked.length} of ${rule.pick} chosen`
			});
		}
	}

	const { min, max } = faction.warband_size;
	const size = draft.fighters.length;
	if (size < min) found.push({ step: 'roster', text: `${size} fighters, ${faction.name} field at least ${min}` });
	if (max !== null && size > max) {
		found.push({ step: 'roster', text: `${size} fighters, ${faction.name} field at most ${max}` });
	}

	for (const fighter of faction.fighters) {
		const held = countOf(draft, fighter.id);
		if (held < fighter.limit.min) {
			found.push({
				step: 'roster',
				text: `Every warband needs ${fighter.limit.min} ${fighter.name}${fighter.limit.min > 1 ? 's' : ''}`
			});
		}
		if (fighter.limit.max !== null && held > fighter.limit.max) {
			found.push({ step: 'roster', text: `${held} ${fighter.name}s, at most ${fighter.limit.max}` });
		}
		if (held && barred(faction, draft, fighter.id)) {
			found.push({ step: 'roster', text: `A faction rule in play bars the ${fighter.name}` });
		}
	}

	for (const entry of draft.fighters) {
		const fighter = fighterOf(faction, entry.fighterId);
		if (!fighter) {
			found.push({ step: 'fighter', key: entry.key, text: 'This fighter is not in the roster' });
			continue;
		}
		const choice = fighter.choose;
		if (choice && entry.choice.length !== choice.pick) {
			found.push({
				step: 'fighter',
				key: entry.key,
				text: `${fighter.name}: ${entry.choice.length} of ${choice.pick} chosen`
			});
		}
	}

	const left = goldLeft(faction, draft);
	if (left < 0) found.push({ step: 'budget', text: `${-left} gc over the ${budget()} the warband starts with` });

	return found;
}
