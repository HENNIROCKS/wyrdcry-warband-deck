/**
 * What each fighter of a warband counts for when its morale is judged.
 *
 * `battle.ts` reads no rules, so the weights are worked out here, from the
 * faction's own rules, and handed in.
 */

import type { Counted } from './battle';
import { FACTIONS } from './rules';
import type { MoraleRuleEffect } from './rules';
import type { Warband } from './types/warband';

export function countedFighters(warband: Warband): Counted[] {
	const faction = warband.factionId ? FACTIONS.get(warband.factionId) : undefined;
	const effects = (faction?.rules ?? [])
		.map((rule) => rule.effect)
		.filter((effect): effect is MoraleRuleEffect => effect?.kind === 'morale');

	return warband.fighters.map((fighter) => {
		const hit = effects.find((e) => e.fighters === 'all' || e.fighters.includes(fighter.fighterId));
		return { instanceId: fighter.instanceId, weight: hit?.weight ?? 1 };
	});
}
