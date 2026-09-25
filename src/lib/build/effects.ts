/**
 * The faction rules in play, and what they are worth.
 *
 * A rule reaches the draft in one of two ways: it holds for the faction outright,
 * or the player picked it out of a group – State Pride is two of eight. Only what
 * takes hold during recruitment carries an effect; the rest is shown on the card
 * and applied at the table.
 */

import type { Faction, FactionRule, RecruitRuleEffect, RuleEffect, StatRuleEffect } from '../rules';
import type { Draft } from './types';

/** Every rule in play, picked or unconditional, in the order the faction lists them. */
export function rulesInPlay(faction: Faction, draft: Draft): { rule: FactionRule; option: string | null }[] {
	const out: { rule: FactionRule; option: string | null }[] = [];

	for (const rule of faction.rules) {
		if (rule.pick === null) {
			out.push({ rule, option: null });
			continue;
		}
		for (const id of draft.ruleChoices[rule.id] ?? []) {
			if (rule.options.some((option) => option.id === id)) out.push({ rule, option: id });
		}
	}

	return out;
}

export function effectsInPlay(faction: Faction, draft: Draft): RuleEffect[] {
	const effects: RuleEffect[] = [];

	for (const { rule, option } of rulesInPlay(faction, draft)) {
		const carrier = option ? rule.options.find((entry) => entry.id === option) : rule;
		if (carrier?.effect) effects.push(carrier.effect);
	}

	return effects;
}

export function statEffects(faction: Faction, draft: Draft): StatRuleEffect[] {
	return effectsInPlay(faction, draft).filter((effect): effect is StatRuleEffect => effect.kind === 'stat');
}

export function recruitEffects(faction: Faction, draft: Draft): RecruitRuleEffect[] {
	return effectsInPlay(faction, draft).filter(
		(effect): effect is RecruitRuleEffect => effect.kind === 'recruit'
	);
}

/** Whether a stat effect reaches this fighter. */
export function hits(effect: StatRuleEffect, fighterId: string): boolean {
	return effect.fighters === 'all' || effect.fighters.includes(fighterId);
}
