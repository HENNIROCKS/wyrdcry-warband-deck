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
