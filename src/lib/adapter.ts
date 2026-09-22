/**
 * Derives card data from a fighter instance and the game data.
 *
 * None of it is stored. Change a value in the warband and the card changes with
 * it on the next render.
 *
 * The arithmetic mirrors the builder (`FighterCard.tsx` in jomblr/wyrdcry) so
 * card and builder never show different numbers.
 */

import {
	ABILITIES,
	CAMPAIGN_RULES,
	FACTIONS,
	FIGHTERS,
	ITEMS,
	UNIVERSAL_ABILITIES,
	WEAPONS,
	WEAPON_RULES
} from './gamedata';
import type {
	CardEntry,
	CardSection,
	CardStat,
	CardValue,
	CardWeapon,
	DeckCard,
	FighterCardData,
	WarbandCardData
} from './types/card';
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

/** Reactions sit under their own heading on the card, not with the abilities. */
const REACTION = 'reaction';

/* Unknown and empty types come back as -1 and sort ahead of the whole list. */
const typeRank = (type: string) => TYPE_ORDER.indexOf(type.trim().toLowerCase());

const titleCase = (type: string) =>
	type.replace(/\w\S*/g, (word) => word[0].toUpperCase() + word.slice(1).toLowerCase());

/** Cost of whatever the warband stores by this id. Anything else is free. */
function itemCost(id: string): number {
	return WEAPONS.get(id)?.cost ?? ITEMS.get(id)?.cost ?? 0;
}

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
 * Free-form abilities aimed at any of the given targets. The `fighter` field is
 * free text: one name, several separated by commas, or the faction name. Which
 * of the two was meant decides whether the ability is a faction rule or the
 * fighter's own, so the two are asked for separately.
 *
 * A fighter answers to both names: renaming one in the builder must not drop an
 * ability that was written against the profile it was recruited from.
 */
function customAbilities(warband: Warband, ...targets: string[]): Ability[] {
	const wanted = targets.map((t) => t.trim().toLowerCase()).filter((t) => t !== '');
	if (!wanted.length) return [];

	return warband.customAbilities
		.filter((entry) =>
			entry.fighter
				.split(',')
				.some((t) => wanted.includes(t.trim().toLowerCase()))
		)
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

/** Grouped by type, within a group by name. */
function sortAbilities(abilities: Ability[]): CardEntry[] {
	return abilities
		.slice()
		.sort((a, b) => typeRank(a.type) - typeRank(b.type) || a.name.localeCompare(b.name))
		.map((ability) => ({
			label: ability.type ? `[${titleCase(ability.type)}] ${ability.name}` : ability.name,
			text: ability.description
		}));
}

function abilityEntries(ids: string[], custom: Ability[]): CardEntry[] {
	const resolved: Ability[] = ids
		.map((id) => ABILITIES.get(id))
		.filter((a): a is NonNullable<typeof a> => a !== undefined)
		.map((a) => ({ name: a.name, type: a.ability_type, description: a.description }));

	return sortAbilities([...resolved, ...custom]);
}

/**
 * The rules pages name the keyword a fighter needs, "Any" for everyone. Race and
 * archetype keywords live in different fields of the profile, both count.
 */
function universalFor(keywords: string[]): Ability[] {
	const carried = keywords.map((k) => k.toLowerCase());

	return UNIVERSAL_ABILITIES.filter(
		(rule) => rule.keyword.toLowerCase() === 'any' || carried.includes(rule.keyword.toLowerCase())
	).map((rule) => ({ name: rule.name, type: rule.ability_type, description: rule.description }));
}

export function toCard(instance: FighterInstance, warband: Warband, factionName: string): FighterCardData {
	const profile = FIGHTERS.get(instance.fighterId);
	const name = instance.customName.trim();
	const notes: CardEntry[] = instance.notes ? [{ label: 'Notes', text: instance.notes }] : [];

	if (!profile) {
		return {
			kind: 'fighter',
			instanceId: instance.instanceId,
			name: name || instance.fighterId,
			subtitle: 'Unknown profile',
			stats: [],
			weapons: [],
			sections: notes.length ? [{ kind: 'notes', preamble: '', entries: notes }] : [],
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
	/* Whatever the game data cannot account for, plus the fighter's own notes. */
	const otherEntries: CardEntry[] = [];
	let equipmentCost = 0;

	for (const id of instance.equipment) {
		equipmentCost += itemCost(id);

		const weapon = WEAPONS.get(id);
		if (weapon) {
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
			if (custom.special) otherEntries.push({ label: `(${custom.name})`, text: custom.special });
			continue;
		}
		otherEntries.push({ label: id, text: 'Not found in the game data.' });
	}

	const faction = warband.factionId ? FACTIONS.get(warband.factionId) : undefined;

	const sections: CardSection[] = [];
	const push = (kind: CardSection['kind'], entries: CardEntry[], preamble = '') => {
		if (entries.length) sections.push({ kind, preamble, entries });
	};

	const keywords = [...profile.race, ...profile.keywords];

	/* What holds for this one fighter comes first, the general reference last.
	   Despite its name, the profile's list holds the fighter's own abilities –
	   two fighters of one faction carry different ones. */
	push(
		'fighter',
		abilityEntries(profile.faction_ability_ids, customAbilities(warband, name, profile.name)),
		profile.ability_preamble
	);
	push('weapon', weaponEntries);
	push('equipment', equipmentEntries);
	push('faction', abilityEntries(faction?.faction_ability_ids ?? [], customAbilities(warband, factionName)));
	/* Two headings out of one list: an ability is spent on your own activation, a
	   reaction during the enemy's, and at the table you look for one or the other. */
	const universal = universalFor(keywords);
	push('universal', sortAbilities(universal.filter((rule) => rule.type !== REACTION)));
	push('universal-reaction', sortAbilities(universal.filter((rule) => rule.type === REACTION)));
	push('other', otherEntries);
	/* The player's own text, not the game's – the card gives it its own ground. */
	push('notes', notes);

	return {
		kind: 'fighter',
		instanceId: instance.instanceId,
		name: name || profile.name,
		subtitle: name ? profile.name : '',
		stats,
		weapons,
		sections,
		keywords,
		xp: instance.xp,
		renown: instance.renown,
		cost: (instance.costOverride ?? profile.cost ?? 0) + equipmentCost,
		unresolved: false
	};
}

/**
 * Which tier the warband's favour puts it in – the standing, the way the
 * builder's info row reads it. The thresholds are open at the top in the data
 * as well, so anything past the last one keeps its label.
 */
function standingFor(favour: number): string {
	const tiers = CAMPAIGN_RULES.favour_tiers;
	const tier = tiers.find((t) => favour >= t.min && favour <= t.max);
	return tier?.label ?? tiers[tiers.length - 1]?.label ?? '';
}

/**
 * The warband as a card. Takes the fighter cards rather than the instances: the
 * value of the warband is the sum of what those cards already cost out, and
 * computing it twice is how the two numbers start to differ.
 *
 * The arithmetic mirrors the builder (`useWarband.ts` in jomblr/wyrdcry).
 */
export function toWarbandCard(warband: Warband, cards: FighterCardData[]): WarbandCardData {
	const faction = warband.factionId ? FACTIONS.get(warband.factionId) : undefined;

	/* A fighter is pending until the purchase is confirmed in the builder – it
	   counts against the gold, but not yet as part of the warband's value. */
	let value = warband.stash.reduce((sum, id) => sum + itemCost(id), 0);
	let pending = 0;

	warband.fighters.forEach((instance, i) => {
		const cost = cards[i]?.cost ?? 0;
		if (instance.isPending) pending += cost;
		else {
			value += cost;
			pending += instance.pendingEquipment.reduce((sum, id) => sum + itemCost(id), 0);
		}
	});

	const reputation = warband.fighters.reduce((sum, f) => sum + f.renown, 0) + warband.favour;
	const remaining = warband.gold - value;

	const size = faction?.warband_size;
	const fighters = size ? `${warband.fighters.length} / ${size}` : String(warband.fighters.length);

	/* Weapons ahead of the gear, each group in the order the warband stores it.
	   An id the game data does not know stands there as itself. */
	const stashWeapons: string[] = [];
	const stashItems: string[] = [];

	for (const id of warband.stash) {
		const weapon = WEAPONS.get(id);
		if (weapon) stashWeapons.push(weapon.name);
		else stashItems.push(ITEMS.get(id)?.name ?? id);
	}

	const tables: CardValue[][] = [
		[
			{ key: 'fighters', label: 'Fighters', value: fighters },
			{ key: 'favour', label: 'Favour', value: String(warband.favour) },
			/* Between the two it is read as what the favour buys, which is what it is. */
			{ key: 'standing', label: 'Standing', value: standingFor(warband.favour) },
			{ key: 'reputation', label: 'Reputation', value: String(reputation) }
		],
		[
			/* As in the builder: what is left to spend, and ahead of it what the
			   unconfirmed purchases will take once they are. */
			{
				key: 'gold',
				label: 'Gold Coins',
				value: pending > 0 ? `${pending}/${remaining}` : String(remaining),
				modified: pending > 0
			},
			{ key: 'value', label: 'Value', value: String(value) },
			{ key: 'stash', label: 'Stash', value: String(warband.stash.length) }
		]
	];

	return {
		kind: 'warband',
		instanceId: 'warband',
		name: warband.name,
		faction: faction?.name ?? 'Warband',
		tables,
		stash: [...stashWeapons, ...stashItems].join(', '),
		notes: warband.factionNotes.trim()
	};
}

/** The whole deck: the warband itself first, then its fighters. */
export function toCards(warband: Warband): DeckCard[] {
	/* The builder writes the faction's display name into `customAbilities.fighter`,
	   while the warband stores its id. */
	const faction = warband.factionId ? FACTIONS.get(warband.factionId) : undefined;

	/* `fighters.json` knows factions `factions.json` does not. Without the entry
	   the faction rules come out empty on a card that looks complete. */
	if (warband.factionId && !faction && import.meta.env.DEV) {
		console.warn(`adapter: no faction "${warband.factionId}" in the game data, its rules stay off the card`);
	}

	const fighters = warband.fighters.map((f) => toCard(f, warband, faction?.name ?? ''));

	return [toWarbandCard(warband, fighters), ...fighters];
}
