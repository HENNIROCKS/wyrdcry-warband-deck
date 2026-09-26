/**
 * What a fighter may carry.
 *
 * The rules are the builder's, read off `EquipmentCell.tsx` rather than worked
 * out again: two melee slots, one ranged, a shield in a melee slot, a two-handed
 * weapon in both, a BRACE pair in one. The same melee weapon may be taken twice
 * – that is what makes a fighter dual wielding – a ranged one may not, unless it
 * braces, where the pair is the point.
 */

import { ITEMS, KEYWORDS, WEAPONS, type Faction, type Fighter, type Item, type Weapon } from '../rules';
import type { Slots } from './types';

const MELEE_SLOTS = 2;
const RANGED_SLOTS = 1;

export function isHero(fighter: Fighter): boolean {
	return fighter.keywords.includes('hero');
}

function isWizard(fighter: Fighter): boolean {
	return fighter.keywords.includes('wizard');
}

/**
 * A fighter with the Penitent trait, e.g. the Flagellant: a vow rather than a
 * keyword, so it is read off the ability list instead of `keywords`.
 */
function isPenitent(fighter: Fighter): boolean {
	return fighter.abilities.includes('penitent');
}

/**
 * A BEAST buys nothing at all, which is a fact about the fighter rather than
 * about any one row. The sheet asks first and leaves the lists out entirely;
 * `refuse` still answers for it, so nothing can be taken by another route.
 */
export function isBeast(fighter: Fighter): boolean {
	return fighter.keywords.includes('beast');
}

/**
 * A THRALL cannot be given anything either, for a different reason: it is
 * bound to the VAMPIRE leading the warband rather than fighting bare-handed.
 * Same treatment as `isBeast` – the sheet asks first, `refuse` backs it up.
 */
export function isThrall(fighter: Fighter): boolean {
	return fighter.keywords.includes('thrall');
}

export function slotsUsed(equipment: string[]): Slots {
	let melee = 0;
	let ranged = 0;
	const braced = new Set<string>();

	for (const id of equipment) {
		/* A shield needs a hand, so it is counted with the weapons rather than the
		   armour. Which armour does is in the item, not in a list of ids here. */
		if (ITEMS.get(id)?.slot === 'hand') {
			melee += 1;
			continue;
		}
		const weapon = WEAPONS.get(id);
		if (!weapon) continue;

		if (weapon.type === 'melee') {
			melee += weapon.rules.includes('two-handed') ? 2 : 1;
		} else if (weapon.rules.includes('brace')) {
			/* Both copies of a braced pair share the one slot, so only the first
			   of them pays for it. */
			if (!braced.has(id)) {
				ranged += 1;
				braced.add(id);
			}
		} else {
			ranged += 1;
		}
	}

	return { melee, ranged };
}

export function slotsFree(equipment: string[]): Slots {
	const used = slotsUsed(equipment);
	return { melee: MELEE_SLOTS - used.melee, ranged: RANGED_SLOTS - used.ranged };
}

/**
 * What the fighter brings without buying it, as bare ids. The ruleset writes
 * them prefixed, the way an allowance is written; everything downstream works
 * in bare ids.
 */
export function gearOf(fighter: Fighter): string[] {
	return fighter.gear.map((prefixed) => prefixed.replace(/^(weapon|item):/, ''));
}

/** Whether the faction sells this at all, and whether to this fighter. */
export function allows(faction: Faction, fighter: Fighter, id: string): boolean {
	const allowance =
		faction.equipment.find((entry) => entry.id === `weapon:${id}`) ??
		faction.equipment.find((entry) => entry.id === `item:${id}`);

	if (!allowance) return false;
	if (allowance.restrict && !fighter.keywords.includes(allowance.restrict)) return false;
	return allowance.allow === 'all' || isHero(fighter);
}

/**
 * Why this fighter cannot take that piece of equipment, or null when they can.
 * A sentence rather than a flag: the wizard shows it beside the greyed-out row,
 * where "no" alone reads as a fault in the app.
 */
export function refuse(faction: Faction, fighter: Fighter, equipment: string[], id: string): string | null {
	if (isBeast(fighter)) return 'A BEAST fights with what is on its profile and cannot be given equipment';
	if (isThrall(fighter)) return 'A THRALL cannot be equipped with any weapons, armour or equipment';
	if (!allows(faction, fighter, id)) {
		const allowance =
			faction.equipment.find((entry) => entry.id === `weapon:${id}`) ??
			faction.equipment.find((entry) => entry.id === `item:${id}`);
		if (allowance?.restrict && !fighter.keywords.includes(allowance.restrict)) {
			return `${KEYWORDS.get(allowance.restrict)?.name ?? allowance.restrict} only`;
		}
		const sold = faction.equipment.some((entry) => entry.id.endsWith(`:${id}`));
		return sold ? 'HERO only' : `The ${faction.name} do not sell this`;
	}

	const weapon = WEAPONS.get(id);
	const item = ITEMS.get(id);
	/* Fixed gear fills its hands like anything else – an Elf Ranger holds a bow
	   and a sword before a single coin is spent. */
	const held = [...gearOf(fighter), ...equipment];
	const free = slotsFree(held);
	const carried = held.filter((entry) => entry === id).length;

	if (item && item.type === 'armour') {
		if (isWizard(fighter)) return 'A WIZARD cannot wear armour';
		if (isPenitent(fighter)) return 'A PENITENT fighter cannot wear armour';
		if (carried) return 'Already worn';
		/* One piece of body armour at a time – light or heavy, not both. */
		if (item.slot === 'body' && held.some((worn) => ITEMS.get(worn)?.slot === 'body')) {
			return 'Already wearing armour';
		}
		if (item.slot === 'hand' && free.melee < 1) return 'No hand free';
		return null;
	}

	if (!weapon) return 'Unknown';

	if (weapon.type === 'ranged' && isPenitent(fighter)) {
		return 'A PENITENT fighter cannot be equipped with ranged weapons';
	}

	if (weapon.type === 'melee') {
		const cost = weapon.rules.includes('two-handed') ? 2 : 1;
		if (cost === 2 && carried) return 'A two handed weapon fills both hands';
		if (free.melee < cost) return cost === 2 ? 'Needs both hands' : 'No hand free';
		return null;
	}

	if (weapon.rules.includes('brace')) {
		if (carried >= 2) return 'A braced pair is two';
		/* The second of a pair rides along in the slot the first one took. */
		if (carried === 1) return null;
		return free.ranged < 1 ? 'No ranged slot free' : null;
	}

	if (carried) return 'Already carried';
	return free.ranged < 1 ? 'No ranged slot free' : null;
}

export interface Offer {
	id: string;
	name: string;
	cost: number;
	/** Null where it can be taken; otherwise why not. */
	refused: string | null;
}

function offer(faction: Faction, fighter: Fighter, equipment: string[], entry: Weapon | Item): Offer {
	return {
		id: entry.id,
		name: entry.name,
		cost: entry.cost,
		refused: refuse(faction, fighter, equipment, entry.id)
	};
}

/**
 * Everything the faction sells this fighter, in the three groups the card and
 * the rulebook both use, each row carrying why it cannot be taken right now.
 * Refused rows stay in the list: a player looking for a Handgun needs to read
 * that it is for HEROes, not to find it missing.
 */
export function offers(
	faction: Faction,
	fighter: Fighter,
	equipment: string[]
): { melee: Offer[]; ranged: Offer[]; armour: Offer[] } {
	const sold = faction.equipment
		.map((entry) => {
			const [kind, id] = entry.id.split(':');
			return kind === 'weapon' ? WEAPONS.get(id) : ITEMS.get(id);
		})
		.filter((entry): entry is Weapon | Item => Boolean(entry));

	const rows = sold.map((entry) => ({ entry, offer: offer(faction, fighter, equipment, entry) }));
	const of = (kind: string) =>
		rows
			.filter(({ entry }) => entry.type === kind)
			.map(({ offer }) => offer);

	return { melee: of('melee'), ranged: of('ranged'), armour: of('armour') };
}

export function equipmentCost(equipment: string[]): number {
	return equipment.reduce((sum, id) => sum + (WEAPONS.get(id)?.cost ?? ITEMS.get(id)?.cost ?? 0), 0);
}
