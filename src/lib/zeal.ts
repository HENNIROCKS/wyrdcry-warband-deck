/**
 * The stages of Zeal a faction counts through a battle.
 *
 * `battle.ts` reads no rules, so the stages are worked out here, from the
 * faction's own rules, and handed in. A faction without any does not count Zeal.
 */

import { FACTIONS } from './rules';
import { keywordName } from './rules-bridge';
import type { ZealRuleEffect } from './rules';
import type { Warband } from './types/warband';

/** The faction's stages, lowest threshold first. Empty where Zeal is not counted. */
export function zealStages(warband: Warband): ZealRuleEffect[] {
	const faction = warband.factionId ? FACTIONS.get(warband.factionId) : undefined;
	return (faction?.rules ?? [])
		.map((rule) => rule.effect)
		.filter((effect): effect is ZealRuleEffect => effect?.kind === 'zeal')
		.sort((a, b) => a.at - b.at);
}

/** The stages the given Zeal has reached; the stages arrive sorted. */
export function reached(stages: ZealRuleEffect[], zeal: number): ZealRuleEffect[] {
	return stages.filter((stage) => stage.at <= zeal);
}

/**
 * The reached stages that hold for a fighter with the given keywords, as the
 * card prints them: a stage leaves out the carriers of its `except` keyword.
 */
export function holdingFor(stages: ZealRuleEffect[], zeal: number, keywords: string[]): ZealRuleEffect[] {
	const held = keywords.map((keyword) => keyword.toLowerCase());
	return reached(stages, zeal).filter((stage) => {
		if (!stage.except) return true;
		return !held.includes(keywordName(stage.except).toLowerCase());
	});
}
