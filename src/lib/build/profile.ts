/**
 * The characteristics of a fighter as recruited.
 *
 * Base profile, what the faction rules in play add, and what the player picked
 * out of the fighter's own choice. Equipment is not in it: a shield's Defense and
 * heavy armour's Move belong to the card, which derives them from the gear the
 * fighter carries, and counting them here would put them in twice.
 */

import { STAT_KEYS, type StatKey } from '../types/warband';
import type { Faction, Fighter } from '../rules';
import { hits, statEffects } from './effects';
import type { Draft, DraftFighter, Profile } from './types';

export interface Layer {
	/** What the bonus comes from, for the sentence beside the number. */
	source: string;
	characteristic: StatKey;
	bonus: number;
}

/** Every bonus on top of the base profile, in the order it is applied. */
export function layers(faction: Faction, draft: Draft, entry: DraftFighter, fighter: Fighter): Layer[] {
	const out: Layer[] = [];

	for (const effect of statEffects(faction, draft)) {
		if (!hits(effect, fighter.id)) continue;
		/* The name the player picked is the one they recognise. A rule without a
		   choice group carries its effect itself, so both are searched. */
		const carrier =
			faction.rules.flatMap((rule) => rule.options).find((option) => option.effect === effect) ??
			faction.rules.find((rule) => rule.effect === effect);
		out.push({
			source: carrier?.name ?? 'Faction rule',
			characteristic: effect.characteristic,
			bonus: effect.bonus
		});
	}

	const choice = fighter.choose;
	if (choice?.kind === 'stat' && choice.bonus) {
		const ability = faction.abilities.find((entry) => entry.id === choice.source);
		for (const key of entry.choice) {
			if (!STAT_KEYS.includes(key as StatKey)) continue;
			out.push({
				source: ability?.name ?? 'Recruitment choice',
				characteristic: key as StatKey,
				bonus: choice.bonus
			});
		}
	}

	return out;
}

export function profileOf(faction: Faction, draft: Draft, entry: DraftFighter, fighter: Fighter): Profile {
	const profile = { ...fighter.profile };
	for (const layer of layers(faction, draft, entry, fighter)) {
		profile[layer.characteristic] += layer.bonus;
	}
	return profile;
}
