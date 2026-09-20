/**
 * Derives card data from a fighter instance and the game data.
 *
 * None of it is stored. Change a value in the warband and the card changes with
 * it on the next render.
 *
 * The arithmetic mirrors the builder (`FighterCard.tsx` in jomblr/wyrdcry) so
 * card and builder never show different numbers.
 */

import { ABILITIES, FACTIONS, FIGHTERS, ITEMS, WEAPONS, WEAPON_RULES } from './gamedata';
import type { CardAbility, CardItem, CardStat, CardWeapon, FighterCardData } from './types/card';
import { STAT_KEYS, type FighterInstance, type StatKey, type Warband } from './types/warband';

const STAT_LABELS: Record<StatKey, string> = {
	move: 'M',
	fight: 'F',
	shoot: 'S',
	defense: 'D',
	health: 'H',
	bravery: 'B'
};

/** Only armour affects characteristics, and only Defense – same as the builder. */
function defenseBonus(equipment: string[]): number {
	return equipment.reduce((sum, id) => {
		const item = ITEMS.get(id);
		return item?.effect?.characteristic === 'defense' ? sum + (item.effect.bonus ?? 0) : sum;
	}, 0);
}

function weaponRuleNames(ids: string[]): string[] {
	return ids.map((id) => WEAPON_RULES.get(id)?.name ?? id);
}

/**
 * Assigns a free-form ability to a fighter. The `fighter` field is free text:
 * one name, several separated by commas, or the faction name for everyone.
 */
function customAbilitiesFor(warband: Warband, fighterName: string, factionName: string): CardAbility[] {
	const wanted = fighterName.trim().toLowerCase();
	const faction = factionName.trim().toLowerCase();

	return warband.customAbilities
		.filter((entry) => {
			const targets = entry.fighter.split(',').map((t) => t.trim().toLowerCase());
			return targets.includes(wanted) || (faction !== '' && targets.includes(faction));
		})
		.map((entry) => {
			/* Common spelling in the builder: "[Trait] Name: Description". */
			const match = entry.ability.match(/^\s*(?:\[([^\]]+)\]\s*)?([^:]{1,60}):\s*([\s\S]+)$/);
			return {
				name: match ? match[2].trim() : entry.type || 'Note',
				type: match?.[1]?.trim() ?? entry.type,
				description: match ? match[3].trim() : entry.ability,
				custom: true
			};
		});
}

export function toCard(instance: FighterInstance, warband: Warband, factionName: string): FighterCardData {
	const profile = FIGHTERS.get(instance.fighterId);
	const name = instance.customName.trim();

	if (!profile) {
		return {
			instanceId: instance.instanceId,
			name: name || instance.fighterId,
			subtitle: 'Unknown profile',
			stats: [],
			weapons: [],
			items: [],
			abilities: [],
			keywords: [],
			notes: instance.notes,
			xp: instance.xp,
			renown: instance.renown,
			cost: instance.costOverride ?? 0,
			isHero: false,
			unresolved: true
		};
	}

	const bonus = defenseBonus(instance.equipment);

	const stats: CardStat[] = STAT_KEYS.map((key) => {
		const base = profile[key];
		const override = instance.statOverrides?.[key];
		const applied = key === 'defense' ? bonus : 0;
		return {
			key,
			label: STAT_LABELS[key],
			value: (override ?? base) + applied,
			modified: (override !== undefined && override !== base) || applied > 0
		};
	});

	const weapons: CardWeapon[] = [];
	const items: CardItem[] = [];
	let equipmentCost = 0;

	for (const id of instance.equipment) {
		const weapon = WEAPONS.get(id);
		if (weapon) {
			equipmentCost += weapon.cost;
			weapons.push({
				name: weapon.name,
				range: `${weapon.range}"`,
				attacks: String(weapon.attacks),
				damage: `${weapon.hit}/${weapon.crit}`,
				rules: weaponRuleNames(weapon.special_rules)
			});
			continue;
		}
		const item = ITEMS.get(id);
		if (item) {
			equipmentCost += item.cost;
			items.push({ name: item.name, description: item.description });
			continue;
		}
		const custom = warband.customWeapons.find((w) => w.id === id || w.name === id);
		if (custom) {
			weapons.push({
				name: custom.name,
				range: custom.range,
				attacks: custom.attacks,
				damage: `${custom.hit}/${custom.crit}`,
				rules: custom.special ? [custom.special] : []
			});
			continue;
		}
		items.push({ name: id, description: 'Not found in the game data.' });
	}

	const abilities: CardAbility[] = profile.faction_ability_ids
		.map((id) => ABILITIES.get(id))
		.filter((a): a is NonNullable<typeof a> => a !== undefined)
		.map((a) => ({ name: a.name, type: a.ability_type, description: a.description, custom: false }));

	abilities.push(...customAbilitiesFor(warband, name || profile.name, factionName));

	return {
		instanceId: instance.instanceId,
		name: name || profile.name,
		subtitle: name ? profile.name : '',
		stats,
		weapons,
		items,
		abilities,
		keywords: [...profile.race, ...profile.keywords],
		notes: instance.notes,
		xp: instance.xp,
		renown: instance.renown,
		cost: (instance.costOverride ?? profile.cost ?? 0) + equipmentCost,
		isHero: profile.keywords.includes('HERO'),
		unresolved: false
	};
}

export function toCards(warband: Warband): FighterCardData[] {
	/* The builder writes the faction's display name into `customAbilities.fighter`,
	   while the warband stores its id. */
	const factionName = warband.factionId ? (FACTIONS.get(warband.factionId)?.name ?? '') : '';
	return warband.fighters.map((f) => toCard(f, warband, factionName));
}
