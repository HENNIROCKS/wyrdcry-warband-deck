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

import { ALREADY_INCLUDED } from './build/export';
import { CURATED_ITEM_EFFECTS } from './curated';
import { RESULT_LABELS, displayDate, newestFirst, opponent, tally } from './history';
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
import { promoted } from './renown';
import { raisedBy, rolledRow } from './rules-bridge';
import type {
	CardEntry,
	CardSection,
	CardStat,
	CardValue,
	CardWeapon,
	DeckCard,
	FighterCardData,
	RosterEntry,
	StatCondition,
	StatLayer,
	WarbandCardData
} from './types/card';
import {
	STAT_KEYS,
	type BattleRecord,
	type RenownChoice,
	type CustomWeapon,
	type FighterInstance,
	type Fluff,
	type Selections,
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
export function itemCost(id: string): number {
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
 *
 * `innate` are the weapons the fighter carries without having bought them – off
 * its profile, or rolled as a mutation. Their rules count like those of bought
 * ones. Items off the profile do not come in here: their bonus is already in the
 * profile's figures.
 */
function statSources(equipment: string[], custom: CustomWeapon[], innate: string[]): StatSources {
	const sources: StatSources = { layers: new Map(), conditions: new Map() };
	const carried = [...equipment, ...innate];

	/* How many weapons of each kind the fighter carries – it decides whether a
	   rule that hangs on one of them is a condition or simply the case. A weapon
	   the warband typed in itself has no kind to read: it counts as neither, and
	   its presence alone keeps every such rule a condition. */
	const sameKind = new Map<string, number>();
	let unknownKind = 0;
	for (const id of carried) {
		const weapon = WEAPONS.get(id);
		if (weapon) sameKind.set(weapon.type, (sameKind.get(weapon.type) ?? 0) + 1);
		else if (custom.some((w) => w.id === id || w.name === id)) unknownKind++;
	}

	for (const id of carried) {
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
	note?: string;
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
			const description = match ? match[3].trim() : entry.ability;
			/* A faction rule that moved a characteristic ends on the deck's own
			   word (`build/export.ts`), which the card sets apart from the rule. */
			const counted = description.endsWith(ALREADY_INCLUDED);
			return {
				name: match ? match[2].trim() : entry.type || 'Note',
				type: match?.[1]?.trim() ?? entry.type,
				description: counted ? description.slice(0, -ALREADY_INCLUDED.length).trimEnd() : description,
				note: counted ? ALREADY_INCLUDED : undefined
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
			text: ability.description,
			note: ability.note
		}));
}

/** `notes` are the card's own word on an ability, by its id or its name. */
function abilityEntries(ids: string[], custom: Ability[], notes = new Map<string, string>()): CardEntry[] {
	const resolved: Ability[] = ids
		.map((id) => ({ id, ability: ABILITIES.get(id) }))
		.filter((a): a is { id: string; ability: NonNullable<typeof a.ability> } => a.ability !== undefined)
		.map(({ id, ability }) => ({
			name: ability.name,
			type: ability.ability_type,
			description: ability.description,
			note: notes.get(id) ?? notes.get(ability.name)
		}));

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

/**
 * `chosen` is what the wizard picked for this fighter, where it had a choice to
 * make, and `modifiers` what it raised this fighter's characteristics by. Both
 * are absent for a warband out of the builder, which records no such thing.
 */
export function toCard(
	instance: FighterInstance,
	warband: Warband,
	factionName: string,
	chosen?: string[] | null,
	fluff = '',
	renownHistory: RenownChoice[] = [],
	modifiers: Selections['modifiers'] = []
): FighterCardData {
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
			unresolved: true,
			fluff
		};
	}

	/* A Possessed mutation: a keyword or a weapon beside its text. */
	const rolled = rolledRow(profile.faction, profile.id, chosen);
	const raised = raisedBy(profile.faction, profile.id, chosen);
	/* The weapons the table below adds from the profile and the mutation, the
	   same ids in the same order. */
	const innate = [
		...(profile.default_equipment ?? [])
			.map((prefixed) => prefixed.replace(/^(weapon|item):/, ''))
			.filter((id) => WEAPONS.has(id) && !instance.equipment.includes(id)),
		...(rolled?.weapon && WEAPONS.has(rolled.weapon) ? [rolled.weapon] : [])
	];
	const sources = statSources(instance.equipment, warband.customWeapons, innate);

	const stats: CardStat[] = STAT_KEYS.map((key) => {
		const base = profile[key];
		const layers: StatLayer[] = [{ kind: 'base', source: 'Profile', amount: base }];

		/* The warband file holds a bare number, without an origin. It becomes its
		   own layer instead of replacing the profile value, so the card can say
		   that much – less what the wizard's faction rules and recruitment choice
		   and what renown put into this characteristic, each of which has a reason
		   of its own to show. What is left is the builder's stat editor. The number
		   is what counts: without one, neither list has anything to explain. */
		const override = instance.statOverrides?.[key];
		const explained =
			override === undefined
				? []
				: [
						...modifiers.filter((m) => m.characteristic === key),
						...renownHistory.filter((c) => c.instanceId === instance.instanceId && c.characteristic === key)
					];
		const unexplained = override === undefined ? 0 : override - base - explained.reduce((sum, c) => sum + c.bonus, 0);
		if (unexplained !== 0) layers.push({ kind: 'permanent', source: 'Warband file', amount: unexplained });
		for (const layer of explained) layers.push({ kind: 'permanent', source: layer.source, amount: layer.bonus });

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
				note: counted ? 'Already included.' : undefined
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
			note: inProfile ? 'Already included.' : undefined
		});
	}

	/* A mutation that is a weapon, such as the Great Claw. Like the gear above it
	   is not in the instance, and costs nothing. */
	const weaponRolled = rolled?.weapon ? WEAPONS.get(rolled.weapon) : undefined;
	if (rolled?.weapon && weaponRolled) addWeapon(rolled.weapon, weaponRolled);

	/*
	 * "A fighter that isn't equipped with any melee weapon is considered to be
	 * unarmed, and uses the Unarmed weapon profile" – the profile itself is in
	 * the game data, so the card only has to notice the case.
	 *
	 * Beasts and thralls are out of it: neither can be equipped at all, and what
	 * they fight with is on their profile above. A weapon the warband typed in
	 * itself has no kind to read, so its presence is taken as a melee weapon
	 * rather than putting Unarmed next to it. Neither does a mutation that
	 * "counts as a melee weapon" without a profile, such as Tentacles.
	 */
	const natural = profile.race.includes('BEAST') || profile.race.includes('THRALL');
	const armed =
		melee ||
		Boolean(rolled?.armed) ||
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

	/* A rolled keyword the profile already carries is not printed twice. */
	const gained = (rolled?.keywords ?? []).filter(
		(keyword) => !profile.keywords.some((held) => held.toLowerCase() === keyword.toLowerCase())
	);
	const keywords = promoted([...profile.race, ...profile.keywords, ...gained], instance.renown);
	/* The fighter's own faction, not the warband's – a hired sword recruited into
	   another faction still carries its own. Both data sources drop it from
	   `profile.keywords`, so it never reaches `universalFor` by way of this list. */
	const ownFactionName = FACTIONS.get(profile.faction)?.name ?? factionName;
	const displayKeywords = promoted(
		[...profile.race, ...(ownFactionName ? [ownFactionName] : []), ...profile.keywords, ...gained],
		instance.renown
	);

	/* What holds for this one fighter comes first, the general reference last.
	   Despite its name, the profile's list holds the fighter's own abilities –
	   two fighters of one faction carry different ones. */
	/*
	 * A preamble turns the profile's list into a menu: "you must select one of
	 * the following abilities". Once the pick is known the card carries that one
	 * and drops the sentence – the choice was made at recruitment, and a card
	 * listing all three reads as three abilities the fighter has.
	 *
	 * Without a pick the whole list stands, preamble and all. That is a warband
	 * from the builder, and the list is everything its file says.
	 */
	const offers = Boolean(profile.ability_preamble?.trim());
	const picked = offers && chosen?.length ? chosen : null;
	/* A fighter named after its own faction – the Possessed – answers to every
	   name but that one. The faction's rules are carried under the faction's
	   name, so a fighter sharing it would claim them as its own abilities, and
	   the faction section below prints them a second time. */
	const ownNames = [name, profile.name].filter(
		(target) => target.trim().toLowerCase() !== factionName.trim().toLowerCase()
	);
	push(
		'fighter',
		abilityEntries(
			picked ? profile.faction_ability_ids.filter((id) => picked.includes(id)) : profile.faction_ability_ids,
			/* The mutation is written out under the ability that rolled it, so its
			   own entry – carried by the fighter's name – would say it twice. */
			customAbilities(warband, ...ownNames).filter(
				(ability) => ability.name.toLowerCase() !== rolled?.name.toLowerCase()
			),
			/* "It must make a roll on the mutation table" reads as a task still
			   open. It has been done, and the note says what came of it. A choice
			   of characteristic is in the figures above and needs only saying so. */
			new Map([
				...(rolled?.source
					? [[rolled.source, `Already included: ${rolled.name}. ${rolled.text}`] as const]
					: []),
				...(raised ? [[raised, 'Already included.'] as const] : [])
			])
		),
		picked ? '' : profile.ability_preamble
	);
	push('equipment', equipmentEntries);
	/*
	 * A warband built here carries its faction's rules as `customAbilities`, out
	 * of this app's own ruleset. Where it does, the game data's list for the same
	 * faction is the same rules a second time and is left out: Sisters of Sigmar
	 * is the one faction whose `faction_ability_ids` is not empty, and its two
	 * versions of Sigmar's Blessing disagree – "Heart of Steel" and a panic test
	 * against the rulebook's "Hearts of Steel" and a Bravery test.
	 *
	 * Matching by name would not catch it: the two spell the apostrophe
	 * differently. A warband out of the builder brings no such rules, so for it
	 * the game data's list is still the only one there is.
	 */
	const ownFactionRules = customAbilities(warband, factionName);
	push(
		'faction',
		abilityEntries(ownFactionRules.length ? [] : (faction?.faction_ability_ids ?? []), ownFactionRules)
	);
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
		keywords: displayKeywords,
		xp: instance.xp,
		renown: instance.renown,
		cost: (instance.costOverride ?? profile.cost ?? 0) + equipmentCost,
		unresolved: false,
		fluff
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
export function toWarbandCard(
	warband: Warband,
	cards: FighterCardData[],
	fluff = '',
	history: BattleRecord[] = []
): WarbandCardData {
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

	/* Read off the card's keywords, which already carry a promotion. The leader
	   is a hero in the rules and stands first among them; a fighter with none of
	   the three stands with the henchmen rather than nowhere. */
	const roster: WarbandCardData['roster'] = { heroes: [], henchmen: [] };

	for (const card of cards) {
		const leader = hasKeyword(card, 'LEADER');
		const entry: RosterEntry = { instanceId: card.instanceId, name: card.name, type: card.subtitle, leader };
		if (leader || hasKeyword(card, 'HERO')) roster.heroes.push(entry);
		else roster.henchmen.push(entry);
	}

	roster.heroes.sort((a, b) => Number(b.leader) - Number(a.leader));

	return {
		kind: 'warband',
		instanceId: 'warband',
		name: warband.name,
		faction: faction?.name ?? 'Warband',
		tables,
		roster,
		gold: { remaining, pending },
		stash: [...stashWeapons, ...stashItems].join(', '),
		notes: warband.factionNotes.trim(),
		fluff,
		battles: newestFirst(history).map((record) => ({
			id: record.id,
			date: displayDate(record.date),
			opponent: opponent(record),
			result: RESULT_LABELS[record.result]
		})),
		tally: tally(history)
	};
}

/**
 * The whole deck: the warband itself first, then its fighters. `selections` is
 * what the wizard here decided; a warband imported from the builder has none.
 */
export function toCards(
	warband: Warband,
	selections?: Selections | null,
	fluff?: Fluff | null,
	history?: BattleRecord[] | null,
	renownHistory?: RenownChoice[] | null
): DeckCard[] {
	/* The builder writes the faction's display name into `customAbilities.fighter`,
	   while the warband stores its id. */
	const faction = warband.factionId ? FACTIONS.get(warband.factionId) : undefined;

	/* `fighters.json` knows factions `factions.json` does not. Without the entry
	   the faction rules come out empty on a card that looks complete. */
	if (warband.factionId && !faction && import.meta.env.DEV) {
		console.warn(`adapter: no faction "${warband.factionId}" in the game data, its rules stay off the card`);
	}

	const fighters = warband.fighters.map((f) =>
		toCard(
			f,
			warband,
			faction?.name ?? '',
			selections?.fighters[f.instanceId],
			fluff?.fighters[f.instanceId] ?? '',
			renownHistory ?? [],
			selections?.modifiers?.filter((m) => m.instanceId === f.instanceId)
		)
	);

	return [toWarbandCard(warband, fighters, fluff?.warband ?? '', history ?? []), ...fighters];
}

/**
 * The Health the card shows. The battle counts its damage points against this
 * one, not against the profile: a fighter with Heavy Armour endures what its own
 * card says it endures.
 */
export function healthOf(card: FighterCardData): number {
	return card.stats.find((stat) => stat.key === 'health')?.value ?? 0;
}

/**
 * Whether a card carries a keyword. Compared without regard to case: the game
 * data spells them as it likes – `DAEMON` beside `Possessed` – and the card
 * shows them in capitals through CSS, not through the value.
 */
export function hasKeyword(card: FighterCardData, keyword: string): boolean {
	return card.keywords.some((held) => held.toLowerCase() === keyword.toLowerCase());
}
