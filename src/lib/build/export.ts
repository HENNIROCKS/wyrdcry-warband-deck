/**
 * Turns a finished draft into the warband both tools read.
 *
 * The shape is the builder's, unchanged, so the way back stays open. What the
 * builder's model has no field for – which faction rules were picked, which
 * choice a fighter made – rides along under `_deck`, where unknown keys survive
 * its import.
 *
 * The characteristics those choices are worth do go into `statOverrides`, not
 * only into `_deck`. The field holds an absolute value and is the one place
 * either tool reads a figure that is not the profile's, so a Champion whose
 * Martial Discipline raised his Fight reads 4 in the builder as well as here. The
 * reason is kept beside it in `_deck`, because `statOverrides` cannot say one.
 */

import { newId } from '../id';
import type { Faction } from '../rules';
import type { CustomAbility, Selections, StatKey, Warband } from '../types/warband';
import { rulesInPlay } from './effects';
import { layers } from './profile';
import { budget, fighterOf, recruitmentFee } from './roster';
import type { Draft } from './types';

export function toWarband(faction: Faction, draft: Draft, id = newId()): Warband {
	const fighters = draft.fighters.map((entry) => {
		const fighter = fighterOf(faction, entry.fighterId);
		const statOverrides: Partial<Record<StatKey, number>> = {};

		if (fighter) {
			for (const layer of layers(faction, draft, entry, fighter)) {
				const base = statOverrides[layer.characteristic] ?? fighter.profile[layer.characteristic];
				statOverrides[layer.characteristic] = base + layer.bonus;
			}
		}

		const fee = recruitmentFee(faction, draft, entry.fighterId);

		return {
			instanceId: entry.key,
			fighterId: entry.fighterId,
			customName: entry.name,
			equipment: entry.equipment,
			pendingEquipment: [],
			isPending: false,
			notes: '',
			/* Only where a rule cut the price; otherwise the profile's own cost
			   stands and an override would freeze it against a later erratum. */
			costOverride: fighter && fee !== fighter.cost ? fee : null,
			xp: 0,
			renown: 0,
			statOverrides
		};
	});

	return {
		id,
		name: draft.name.trim(),
		factionId: faction.id,
		favour: draft.favour,
		/* The purse the warband started with, not what is left of it: both tools
		   subtract the warband's value from this field to show what it can still
		   spend (`WarbandInfoRow.tsx:27`, `adapter.ts:557`). Writing the remainder
		   here would have it subtracted a second time. */
		gold: budget(),
		fighters,
		stash: [],
		/* The player's own shelf – a to-do, a battle history. The rules the warband
		   plays under are not notes and belong on the fighter cards. */
		factionNotes: '',
		customWeapons: [],
		customAbilities: factionAbilities(faction, draft)
	};
}

/**
 * The rules in play, one ability each, carried by the faction's name. That name
 * is what puts them in the "Faction Rules" section of every fighter card, beside
 * the universal abilities and reactions – the rules apply to the whole warband,
 * and at the table you read them off the card in your hand. The builder has no
 * structure for them either and lists them in its Ability Reference.
 *
 * A rule that moved a characteristic says so in its own sentence. Half of what
 * State Pride offers takes hold in the aftermath or the battle and changes no
 * figure at all, so one line under the whole list would be read as covering the
 * rule it happens to stand under.
 */
function factionAbilities(faction: Faction, draft: Draft): CustomAbility[] {
	return rulesInPlay(faction, draft)
		.map(({ rule, option }) => {
			const picked = option ? rule.options.find((entry) => entry.id === option) : null;
			const carrier = picked ?? rule;
			const head = picked ? `${rule.name} – ${picked.name}` : rule.name;
			const counted =
				carrier.effect?.kind === 'stat'
					? ' The characteristics on the fighter cards already include this.'
					: '';

			/* Some faction rules are abilities a fighter spends an activation on and
			   open with their type: "[Trait] When this fighter…". The card puts the
			   type in front of the name, as it does for every other ability, so it
			   is lifted out of the sentence rather than left standing in it. */
			const marked = carrier.text.match(/^\s*\[([^\]]+)\]\s*/);
			const type = marked ? marked[1].trim() : '';
			const text = marked ? carrier.text.slice(marked[0].length) : carrier.text;
			const label = type ? `[${type}] ${head}` : head;

			/* "[Type] Name: Description" is the spelling the card reads back
			   (`adapter.ts`, `customAbilities`). */
			return { id: newId(), fighter: faction.name, type, ability: `${label}: ${text}${counted}` };
		});
}

export function selectionsOf(faction: Faction, draft: Draft, warband: Warband): Selections {
	const modifiers: Selections['modifiers'] = [];

	for (const entry of draft.fighters) {
		const fighter = fighterOf(faction, entry.fighterId);
		if (!fighter) continue;
		for (const layer of layers(faction, draft, entry, fighter)) {
			modifiers.push({
				instanceId: entry.key,
				characteristic: layer.characteristic,
				bonus: layer.bonus,
				source: layer.source
			});
		}
	}

	return {
		rules: draft.ruleChoices,
		fighters: Object.fromEntries(draft.fighters.map((entry) => [entry.key, entry.choice])),
		modifiers
	};
}
