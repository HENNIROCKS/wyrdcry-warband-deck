/**
 * Turns this app's own ruleset into the shapes the game data uses.
 *
 * The cards read `src/lib/data/`, the wizard reads `src/lib/rules/`. For the
 * printed factions that is no problem – every profile the wizard offers is in
 * the game data too. A homebrew faction has no entry there at all, so its cards
 * came out as "not in the game data" and its faction rules never reached them.
 *
 * Rather than teaching the adapter to ask twice in each of its twenty lookups,
 * the gap is closed where the maps are built: `gamedata.ts` fills what the game
 * data does not have from here. **The game data always wins.** What is printed
 * is what a card shows; this ruleset is a transcription beside it and may
 * differ. Only ids the game data has never heard of come from here.
 *
 * Items are deliberately not bridged. No homebrew item exists yet, and
 * `ItemProfile` carries a single effect where a rule item carries a list –
 * Heavy Armour's second value would go missing without anything saying so. The
 * day one exists, that is a decision to take rather than a side effect.
 */

import type { AbilityProfile, FactionProfile, FighterProfile, WeaponProfile } from './gamedata';
import { FACTIONS, KEYWORDS, WEAPONS, type Ability, type Faction, type Fighter, type Weapon } from './rules';

/**
 * The game data splits a profile's keywords in two and writes them in capitals;
 * this ruleset keeps one lowercase list. The faction's own keyword is dropped,
 * because the game data's profiles do not carry it either – it would otherwise
 * appear on homebrew cards and nowhere else.
 */
function splitKeywords(fighter: Fighter): { race: string[]; keywords: string[] } {
	const race: string[] = [];
	const keywords: string[] = [];

	for (const id of fighter.keywords) {
		const keyword = KEYWORDS.get(id);
		if (keyword?.type === 'faction') continue;
		const name = keyword?.name ?? id.toUpperCase();
		if (keyword?.type === 'race') race.push(name);
		else keywords.push(name);
	}

	return { race, keywords };
}

function toFighterProfile(fighter: Fighter, faction: Faction): FighterProfile {
	/*
	 * A choice of abilities is the profile's own list plus the sentence that
	 * turns it into a menu; the card drops the sentence once a pick is known.
	 * `prompt` carries it where the profile asks for the choice itself, and
	 * otherwise it is the text of the ability the choice comes out of.
	 */
	const choice = fighter.choose;
	const menu = choice?.kind === 'ability' ? (choice.abilities ?? []) : [];
	const source = faction.abilities.find((entry) => entry.id === choice?.source);

	return {
		id: fighter.id,
		name: fighter.name,
		description: fighter.description,
		move: fighter.profile.move,
		fight: fighter.profile.fight,
		shoot: fighter.profile.shoot,
		defense: fighter.profile.defense,
		health: fighter.profile.health,
		bravery: fighter.profile.bravery,
		cost: fighter.cost,
		ability_preamble: menu.length ? (choice?.prompt ?? source?.text ?? '') : '',
		faction_ability_ids: [...fighter.abilities, ...menu],
		/* Already prefixed `weapon:`/`item:` on both sides. */
		default_equipment: fighter.gear,
		...splitKeywords(fighter),
		faction: faction.id
	};
}

/** Melee reach is a bare number in the game data, a ranged span a string. */
function toWeaponProfile(weapon: Weapon): WeaponProfile {
	return {
		id: weapon.id,
		name: weapon.name,
		type: weapon.type,
		range: weapon.type === 'ranged' ? `${weapon.range.min}-${weapon.range.max}` : weapon.range.max,
		attacks: weapon.attacks,
		hit: weapon.hit,
		crit: weapon.crit,
		special_rules: weapon.rules,
		cost: weapon.cost
	};
}

function toAbilityProfile(ability: Ability, faction: Faction): AbilityProfile {
	return {
		id: ability.id,
		name: ability.name,
		category: faction.id,
		ability_type: ability.type,
		description: ability.text
	};
}

function toFactionProfile(faction: Faction): FactionProfile {
	return {
		id: faction.id,
		name: faction.name,
		description: '',
		warband_size: faction.warband_size.max ?? 0,
		/* The faction's rules travel as `customAbilities` on the warband, written
		   there by the wizard. Naming them here as well would print each twice. */
		faction_ability_ids: []
	};
}

const factions = [...FACTIONS.values()];

export const RULE_FIGHTERS: FighterProfile[] = factions.flatMap((faction) =>
	faction.fighters.map((fighter) => toFighterProfile(fighter, faction))
);

export const RULE_ABILITIES: AbilityProfile[] = factions.flatMap((faction) =>
	faction.abilities.map((ability) => toAbilityProfile(ability, faction))
);

export const RULE_FACTIONS: FactionProfile[] = factions.map(toFactionProfile);

/* Already carries what a homebrew faction added: `rules/index.ts` folds each
   `homebrew.json` into this map before it is built. */
export const RULE_WEAPONS: WeaponProfile[] = [...WEAPONS.values()].map(toWeaponProfile);

/** A rolled table row, as the fighter's card needs it. */
export interface RolledRow {
	name: string;
	text: string;
	/** The ability that asks for the roll, such as Ascended. */
	source: string | null;
	/** Written as the game data writes them, in capitals. */
	keywords: string[];
	/** A weapon id, to look up like any other the card carries. */
	weapon: string | null;
	armed: boolean;
}

/**
 * The row a fighter's recruitment roll landed on, such as a Possessed mutation.
 * `chosen` is the roll the wizard kept for this fighter, as a string. Null for a
 * fighter without a roll and for a warband out of the builder, which keeps none.
 *
 * Read from this ruleset even for a printed faction: the game data has the
 * mutation table only as prose, so there is nothing there for it to win against.
 */
export function rolledRow(factionId: string, fighterId: string, chosen?: string[] | null): RolledRow | null {
	const faction = FACTIONS.get(factionId);
	const choice = faction?.fighters.find((fighter) => fighter.id === fighterId)?.choose;
	if (!faction || choice?.kind !== 'roll' || !chosen?.length) return null;

	const row = faction.rules
		.find((rule) => rule.id === choice.table)
		?.table?.find((entry) => String(entry.roll) === chosen[0]);
	if (!row) return null;

	return {
		name: row.name,
		text: row.text,
		source: choice.source,
		keywords: (row.keywords ?? []).map((id) => KEYWORDS.get(id)?.name ?? id.toUpperCase()),
		weapon: row.weapon ?? null,
		armed: row.armed ?? false
	};
}

/**
 * The name of the ability whose recruitment choice raised a characteristic, such
 * as Martial Discipline. Null without such a choice, and for a warband out of
 * the builder, which keeps none.
 *
 * A name rather than an id: the game data spells this ruleset's
 * `martial-discipline` as `martial-exemplar`, and a card from a printed faction
 * carries the game data's.
 */
export function raisedBy(factionId: string, fighterId: string, chosen?: string[] | null): string | null {
	const faction = FACTIONS.get(factionId);
	const choice = faction?.fighters.find((fighter) => fighter.id === fighterId)?.choose;
	if (!faction || choice?.kind !== 'stat' || !choice.source || !chosen?.length) return null;
	return faction.abilities.find((ability) => ability.id === choice.source)?.name ?? null;
}
