/**
 * Effects the game data describes but does not carry.
 *
 * An item's `effect` holds a single characteristic, so Heavy Armour's `+2
 * Defense` fits and the `-1 Move` in the same sentence does not. The card needs
 * both, and reading it out of the prose would be a parser aimed at one English
 * sentence.
 *
 * So it is kept here by hand. `expect` is the wording the entry was taken from:
 * a development build compares it against the item's current description and
 * says so when the two have come apart, which is the moment this file is
 * either wrong or no longer needed.
 */

import extra from './curated/item-effects.json';
import { ITEMS } from './gamedata';
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
