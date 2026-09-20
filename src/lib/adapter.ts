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
import type { CardEntry, CardStat, CardWeapon, FighterCardData } from './types/card';
import { STAT_KEYS, type FighterInstance, type StatKey, type Warband } from './types/warband';

/* Spelled out as on the printed card, "Defense" included. */
const STAT_LABELS: Record<StatKey, string> = {
	move: 'Move',
	fight: 'Fight',
	shoot: 'Shoot',
	defense: 'Defense',
	health: 'Health',
	bravery: 'Bravery'
};

/**
 * Order the ability entries appear in, each group sorted by name. Everything the
 * list does not know – a faction rule, a universal ability, a type the builder
 * invented – sorts into the first group.
 */
const TYPE_ORDER = ['trait', 'double', 'triple', 'quad', 'reaction'];

/* Unknown and empty types come back as -1 and sort ahead of the whole list. */
const typeRank = (type: string) => TYPE_ORDER.indexOf(type.trim().toLowerCase());

const titleCase = (type: string) =>
	type.replace(/\w\S*/g, (word) => word[0].toUpperCase() + word.slice(1).toLowerCase());

/** Only armour affects characteristics, and only Defense – same as the builder. */
function defenseBonus(equipment: string[]): number {
	return equipment.reduce((sum, id) => {
		const item = ITEMS.get(id);
		return item?.effect?.characteristic === 'defense' ? sum + (item.effect.bonus ?? 0) : sum;
	}, 0);
}

interface Ability {
	name: string;
	type: string;
	description: string;
}

/**
 * Assigns a free-form ability to a fighter. The `fighter` field is free text:
 * one name, several separated by commas, or the faction name for everyone.
 */
function customAbilitiesFor(warband: Warband, fighterName: string, factionName: string): Ability[] {
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
				description: match ? match[3].trim() : entry.ability
			};
		});
}

/** Abilities first, grouped by type; within a group by name. */
function abilityEntries(abilities: Ability[]): CardEntry[] {
	return abilities
		.slice()
		.sort((a, b) => typeRank(a.type) - typeRank(b.type) || a.name.localeCompare(b.name))
		.map((ability) => ({
			label: ability.type ? `[${titleCase(ability.type)}] ${ability.name}` : ability.name,
			text: ability.description
		}));
}

export function toCard(instance: FighterInstance, warband: Warband, factionName: string): FighterCardData {
	const profile = FIGHTERS.get(instance.fighterId);
	const name = instance.customName.trim();
	const notes: CardEntry[] = instance.notes ? [{ label: 'Notes', text: instance.notes }] : [];

	if (!profile) {
		return {
			instanceId: instance.instanceId,
			name: name || instance.fighterId,
			subtitle: 'Unknown profile',
			stats: [],
			weapons: [],
			entries: notes,
			keywords: [],
			xp: instance.xp,
			renown: instance.renown,
			cost: instance.costOverride ?? 0,
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
	/* Weapon rules follow the weapons in table order, within a weapon by name. */
	const weaponEntries: CardEntry[] = [];
	const equipmentEntries: CardEntry[] = [];
	let equipmentCost = 0;

	for (const id of instance.equipment) {
		const weapon = WEAPONS.get(id);
		if (weapon) {
			equipmentCost += weapon.cost;
			weapons.push({
				name: weapon.name,
				range: `${weapon.range}"`,
				attacks: String(weapon.attacks),
				damage: `${weapon.hit}/${weapon.crit}`
			});
			weaponEntries.push(
				...weapon.special_rules
					.map((ruleId) => WEAPON_RULES.get(ruleId))
					.filter((rule): rule is NonNullable<typeof rule> => rule !== undefined)
					.sort((a, b) => a.name.localeCompare(b.name))
					.map((rule) => ({ label: `(${weapon.name}) ${rule.name}`, text: rule.description }))
			);
			continue;
		}
		const item = ITEMS.get(id);
		if (item) {
			equipmentCost += item.cost;
			equipmentEntries.push({ label: item.name, text: item.description });
			continue;
		}
		const custom = warband.customWeapons.find((w) => w.id === id || w.name === id);
		if (custom) {
			weapons.push({
				name: custom.name,
				range: custom.range,
				attacks: custom.attacks,
				damage: `${custom.hit}/${custom.crit}`
			});
			/* Free text in the builder, so there is no rule to look up and split. */
			if (custom.special) weaponEntries.push({ label: `(${custom.name})`, text: custom.special });
			continue;
		}
		equipmentEntries.push({ label: id, text: 'Not found in the game data.' });
	}

	const abilities: Ability[] = profile.faction_ability_ids
		.map((id) => ABILITIES.get(id))
		.filter((a): a is NonNullable<typeof a> => a !== undefined)
		.map((a) => ({ name: a.name, type: a.ability_type, description: a.description }));

	abilities.push(...customAbilitiesFor(warband, name || profile.name, factionName));

	return {
		instanceId: instance.instanceId,
		name: name || profile.name,
		subtitle: name ? profile.name : '',
		stats,
		weapons,
		entries: [...abilityEntries(abilities), ...weaponEntries, ...equipmentEntries, ...notes],
		keywords: [...profile.race, ...profile.keywords],
		xp: instance.xp,
		renown: instance.renown,
		cost: (instance.costOverride ?? profile.cost ?? 0) + equipmentCost,
		unresolved: false
	};
}

export function toCards(warband: Warband): FighterCardData[] {
	/* The builder writes the faction's display name into `customAbilities.fighter`,
	   while the warband stores its id. */
	const factionName = warband.factionId ? (FACTIONS.get(warband.factionId)?.name ?? '') : '';
	return warband.fighters.map((f) => toCard(f, warband, factionName));
}
