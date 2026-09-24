/**
 * Derives card data from a fighter instance and the game data.
 *
 * None of it is stored. Change a value in the warband and the card changes with
 * it on the next render.
 *
 * A characteristic is a stack of layers – the profile, what the warband file
 * carries, what the gear adds – and the card shows their sum. The warband's own
 * values mirror the builder (`useWarband.ts` in jomblr/wyrdcry).
 */

import { CURATED_ITEM_EFFECTS } from './curated';
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
import type { WeaponProfile } from './gamedata';
import type {
	CardEntry,
	CardSection,
	CardStat,
	CardValue,
	CardWeapon,
	DeckCard,
	FighterCardData,
	StatCondition,
	StatLayer,
	WarbandCardData
} from './types/card';
import {
	STAT_KEYS,
	type CustomWeapon,
	type FighterInstance,
	type StatKey,
	type Warband
} from './types/warband';

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

/**
 * Which characteristic an effect touches. `fight_shoot` is the weapon's own
 * attack characteristic – Fight for a melee weapon, Shoot for a ranged one –
 * and appears only on rules that hang on a weapon.
 */
function affected(characteristic: string, weapon?: WeaponProfile): StatKey | undefined {
	if (characteristic === 'fight_shoot') {
		if (!weapon) return undefined;
		return weapon.type === 'ranged' ? 'shoot' : 'fight';
	}
	return STAT_KEYS.includes(characteristic as StatKey) ? (characteristic as StatKey) : undefined;
}

interface StatSources {
	layers: Map<StatKey, StatLayer[]>;
	conditions: Map<StatKey, StatCondition[]>;
}

function addTo<T>(map: Map<StatKey, T[]>, key: StatKey, entry: T): void {
	const list = map.get(key);
	if (list) list.push(entry);
	else map.set(key, [entry]);
}

/**
 * What the gear does to the characteristics.
 *
 * Armour counts in: it applies whenever the fighter is on the table. A weapon
 * rule does not, even where the data says `conditional: false` – Parry and
 * Mighty both name a situation in their own description, and a number that is
 * only sometimes right is worse than one the player looks up.
 */
function statSources(equipment: string[], custom: CustomWeapon[]): StatSources {
	const sources: StatSources = { layers: new Map(), conditions: new Map() };

	/* How many weapons of each kind the fighter carries – it decides whether a
	   rule that hangs on one of them is a condition or simply the case. A weapon
	   the warband typed in itself has no kind to read: it counts as neither, and
	   its presence alone keeps every such rule a condition. */
	const sameKind = new Map<string, number>();
	let unknownKind = 0;
	for (const id of equipment) {
		const weapon = WEAPONS.get(id);
		if (weapon) sameKind.set(weapon.type, (sameKind.get(weapon.type) ?? 0) + 1);
		else if (custom.some((w) => w.id === id || w.name === id)) unknownKind++;
	}

	for (const id of equipment) {
		const weapon = WEAPONS.get(id);
		if (!weapon) {
			const item = ITEMS.get(id);
			if (!item) continue;
			const effects = [
				...(item.effect ? [item.effect] : []),
				...(CURATED_ITEM_EFFECTS.get(id) ?? [])
			];
			for (const effect of effects) {
				if (effect.bonus === 0) continue;
				const key = affected(effect.characteristic);
				if (!key) continue;
				addTo(sources.layers, key, {
					kind: 'equipment',
					source: item.name,
					amount: effect.bonus
				});
			}
			continue;
		}

		for (const ruleId of weapon.special_rules) {
			const rule = WEAPON_RULES.get(ruleId);
			if (!rule?.effect) continue;
			const key = affected(rule.effect.characteristic, weapon);
			if (!key) continue;

			/*
			 * A rule on the fighter's only weapon of its kind has nothing left to
			 * depend on: whenever Fight is rolled, it is rolled with that weapon.
			 * Carrying a second one of the same kind brings the choice back, and
			 * with it the condition.
			 */
			if (
				rule.effect.characteristic === 'fight_shoot' &&
				sameKind.get(weapon.type) === 1 &&
				unknownKind === 0
			) {
				addTo(sources.layers, key, {
					kind: 'equipment',
					source: `${rule.name} (${weapon.name})`,
					amount: rule.effect.bonus
				});
				continue;
			}

			/* Two of the same weapon carry the same rule twice, and reading it twice
			   tells the player nothing the first line did not. */
			const known = sources.conditions
				.get(key)
				?.some((c) => c.name === rule.name && c.source === weapon.name);
			if (known) continue;
			addTo(sources.conditions, key, {
				source: weapon.name,
				name: rule.name,
				text: rule.description,
				amount: rule.effect.bonus
			});
		}
	}

	return sources;
}

/**
 * Dual wielding stands in the equipment chapter rather than among the weapon
 * rules, so the game data carries no entry for it and the text is kept here.
 */
const DUAL_WIELDING = {
	label: 'Dual Wielding',
	text: 'If a fighter is equipped with two melee weapons of the same type (for example, two swords), they are considered to be dual wielding. While a fighter is dual wielding, improve the Attack characteristic of the weapon they are using by 1.'
};

/**
 * A weapon as the table prints it, `count` of them carried. Its rules go behind
 * the name instead of into the card's text: five of them account for every rule
 * the fixtures carry, and printing each one again under every weapon that has it
 * fills the card with the same paragraphs over and over.
 *
 * Several of the same weapon share one row: two identical rows say nothing the
 * count does not.
 */
function weaponRow(weapon: WeaponProfile, count = 1): CardWeapon {
	const range = `${weapon.range}"`;
	/* The extra attack belongs to the weapon in hand, so it is the row's own
	   number rather than a bonus on the fighter. */
	const dual = count > 1 && weapon.type === 'melee';
	const attacks = String(weapon.attacks + (dual ? 1 : 0));
	const damage = `${weapon.hit}/${weapon.crit}`;
	const name = count > 1 ? `${weapon.name} ×${count}` : weapon.name;
	const rules = weapon.special_rules
		.map((ruleId) => WEAPON_RULES.get(ruleId))
		.filter((rule): rule is NonNullable<typeof rule> => rule !== undefined)
		.map((rule) => ({ label: rule.name, text: rule.description }))
		.concat(dual ? [DUAL_WIELDING] : [])
		.sort((a, b) => a.label.localeCompare(b.label));

	return {
		name,
		range,
		attacks,
		damage,
		explanation: rules.length
			? {
					title: name,
					facts: [
						{ label: 'Range', value: range },
						{ label: 'Attacks', value: attacks },
						{ label: 'Damage', value: damage }
					],
					rules
				}
			: undefined
	};
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

	const sources = statSources(instance.equipment, warband.customWeapons);

	const stats: CardStat[] = STAT_KEYS.map((key) => {
		const base = profile[key];
		const layers: StatLayer[] = [{ kind: 'base', source: 'Profile', amount: base }];

		/* The warband file holds a bare number the builder's stat editor wrote,
		   without an origin. It becomes its own layer instead of replacing the
		   profile value, so the card can say that much. */
		const override = instance.statOverrides?.[key];
		if (override !== undefined && override !== base) {
			layers.push({ kind: 'permanent', source: 'Warband file', amount: override - base });
		}

		layers.push(...(sources.layers.get(key) ?? []));

		return {
			key,
			label: STAT_LABELS[key],
			value: layers.reduce((sum, layer) => sum + layer.amount, 0),
			layers,
			conditions: sources.conditions.get(key) ?? []
		};
	});

	const weapons: CardWeapon[] = [];
	/* Whether anything in the table can be swung – what decides Unarmed below. */
	let melee = false;
	/*
	 * The table reads melee first, then ranged, whatever order the equipment is
	 * stored in. A weapon the warband typed in itself has no kind to read and
	 * goes with the melee ones, the same assumption Unarmed is decided on.
	 */
	const ranged = new Set<CardWeapon>();
	/* The row each weapon already has, so a second copy raises its count instead
	   of printing the same line again. */
	const carried = new Map<string, { row: CardWeapon; count: number }>();
	const addWeapon = (id: string, weapon: WeaponProfile) => {
		const seen = carried.get(id);
		if (seen) {
			seen.count++;
			Object.assign(seen.row, weaponRow(weapon, seen.count));
			return;
		}
		const row = weaponRow(weapon);
		carried.set(id, { row, count: 1 });
		weapons.push(row);
		if (weapon.type === 'melee') melee = true;
		else ranged.add(row);
	};
	const equipmentEntries: CardEntry[] = [];
	/* Whatever the game data cannot account for, plus the fighter's own notes. */
	const otherEntries: CardEntry[] = [];
	let equipmentCost = 0;

	for (const id of instance.equipment) {
		equipmentCost += itemCost(id);

		const weapon = WEAPONS.get(id);
		if (weapon) {
			addWeapon(id, weapon);
			continue;
		}
		const item = ITEMS.get(id);
		if (item) {
			/* Armour reads as a bonus waiting to be applied. It has been – the
			   characteristics above already carry it, and without the note a player
			   adds it a second time. */
			const counted = item.effect !== undefined || CURATED_ITEM_EFFECTS.has(id);
			equipmentEntries.push({
				label: item.name,
				text: item.description,
				note: counted ? 'Already in the characteristics above.' : undefined
			});
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

	/*
	 * Gear the fighter cannot be without: a beast's natural weapons, a Troll
	 * Slayer's axes, the Freelance Knight's armour. It sits on the profile as
	 * `default_equipment` and never in the instance – the builder reads it from
	 * the profile each time it draws a row, so the card has to as well.
	 *
	 * It carries a `weapon:` or `item:` prefix there, which nothing else in the
	 * data does.
	 */
	for (const prefixed of profile.default_equipment ?? []) {
		const id = prefixed.replace(/^(weapon|item):/, '');
		if (instance.equipment.includes(id)) continue;

		const weapon = WEAPONS.get(id);
		if (weapon) {
			addWeapon(id, weapon);
			continue;
		}
		const item = ITEMS.get(id);
		if (!item) continue;
		/* No cost: the profile's own cost covers what it cannot take off. And no
		   layer either – the Freelance Knight's Defense 6 is the value with his
		   armour on, where 32 of 42 profiles stand at 3. Counting it again would
		   put him at 9, which is also why the note below still holds: the bonus is
		   in the figure, it just arrived there with the profile. */
		const inProfile = item.effect !== undefined || CURATED_ITEM_EFFECTS.has(id);
		equipmentEntries.push({
			label: item.name,
			text: item.description,
			note: inProfile ? 'Already in the characteristics above.' : undefined
		});
	}

	/*
	 * "A fighter that isn't equipped with any melee weapon is considered to be
	 * unarmed, and uses the Unarmed weapon profile" – the profile itself is in
	 * the game data, so the card only has to notice the case.
	 *
	 * Beasts and thralls are out of it: neither can be equipped at all, and what
	 * they fight with is on their profile above. A weapon the warband typed in
	 * itself has no kind to read, so its presence is taken as a melee weapon
	 * rather than putting Unarmed next to it.
	 */
	const natural = profile.race.includes('BEAST') || profile.race.includes('THRALL');
	const armed =
		melee ||
		warband.customWeapons.some(
			(w) => instance.equipment.includes(w.id) || instance.equipment.includes(w.name)
		);
	const unarmed = WEAPONS.get('unarmed');
	if (!armed && !natural && unarmed) {
		weapons.push(weaponRow(unarmed));
	}

	/* Stable, so the order within each half is still the order they are carried. */
	weapons.sort((a, b) => Number(ranged.has(a)) - Number(ranged.has(b)));

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
