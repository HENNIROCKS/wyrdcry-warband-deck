/**
 * Effects the game data describes but does not carry, or carries wrongly.
 *
 * An item's `effect` holds a single characteristic, so Heavy Armour's `+3
 * Armour` fits and the `-1 Move` in the same sentence does not. The card needs
 * both, and reading it out of the prose would be a parser aimed at one English
 * sentence.
 *
 * So it is kept here by hand. `expect` is the wording the entry was taken from:
 * a development build compares it against the item's current description and
 * says so when the two have come apart, which is the moment this file is
 * either wrong or no longer needed.
 */

import conditions from './curated/conditions.json';
import extra from './curated/item-effects.json';
import { ITEMS, WEAPON_RULES } from './gamedata';
import { STAT_KEYS, type StatKey } from './types/warband';

interface CuratedEffect {
	item: string;
	characteristic: string;
	bonus: number;
	expect: string;
}

function build(): Map<string, { characteristic: StatKey; bonus: number }[]> {
	const map = new Map<string, { characteristic: StatKey; bonus: number }[]>();

	for (const entry of extra as CuratedEffect[]) {
		const item = ITEMS.get(entry.item);
		const key = entry.characteristic as StatKey;

		if (import.meta.env.DEV) {
			if (!item) console.warn(`curated effects: no item "${entry.item}" in the game data`);
			else if (!item.description.includes(entry.expect)) {
				console.warn(
					`curated effects: "${entry.item}" no longer reads "${entry.expect}" – check whether the game data carries it now`
				);
			}
			if (!STAT_KEYS.includes(key)) {
				console.warn(`curated effects: "${entry.characteristic}" is not a characteristic`);
			}
		}

		if (!item || !STAT_KEYS.includes(key)) continue;
		const list = map.get(entry.item);
		const effect = { characteristic: key, bonus: entry.bonus };
		if (list) list.push(effect);
		else map.set(entry.item, [effect]);
	}

	return map;
}

export const CURATED_ITEM_EFFECTS = build();

interface CuratedCondition {
	weaponRule?: string;
	item?: string;
	characteristic: string;
	/** Null where the situation changes the attacker's numbers, not this one. */
	bonus: number | null;
	expect: string;
}

export interface Condition {
	characteristic: StatKey;
	bonus?: number;
}

/**
 * What a weapon rule or an item adds in one situation only, where the game data
 * says it wrongly or not at all. Parry's data effect names Defense while its
 * description, and the attack rules beside it, raise the defender's Fight; the
 * Shield carries no effect, though it does the same – and against a ranged
 * attack raises the attacker's difficulty rating instead, which goes under
 * Defense without a number, since a +1 there would read as Armour. Keyed
 * `rule:<id>` and `item:<id>`, because a rule and an item may share an id.
 * Checked against the description like the effects above.
 */
function buildConditions(): Map<string, Condition[]> {
	const map = new Map<string, Condition[]>();

	for (const entry of conditions as CuratedCondition[]) {
		const source = entry.weaponRule
			? WEAPON_RULES.get(entry.weaponRule)
			: entry.item
				? ITEMS.get(entry.item)
				: undefined;
		const key = entry.characteristic as StatKey;
		const name = entry.weaponRule ? `rule:${entry.weaponRule}` : `item:${entry.item}`;

		if (import.meta.env.DEV) {
			if (!source) console.warn(`curated conditions: no "${name}" in the game data`);
			else if (!source.description.includes(entry.expect)) {
				console.warn(`curated conditions: "${name}" no longer reads "${entry.expect}"`);
			}
			if (!STAT_KEYS.includes(key)) {
				console.warn(`curated conditions: "${entry.characteristic}" is not a characteristic`);
			}
		}

		if (!source || !STAT_KEYS.includes(key)) continue;
		const condition = { characteristic: key, bonus: entry.bonus ?? undefined };
		const list = map.get(name);
		if (list) list.push(condition);
		else map.set(name, [condition]);
	}

	return map;
}

export const CURATED_CONDITIONS = buildConditions();
