/**
 * Collects the hired swords out of `hired-swords/`.
 *
 * One file per hired sword, so the collector is a good deal simpler than
 * `assemble.ts`: nothing has to be bundled, only keyed and its own weapons and
 * items handed on. Takes the collected modules rather than reaching for them,
 * for the same reason – a run outside Vite can hand it a set read from disk.
 */

import type { HiredSword, Item, Weapon } from './types';

/** Keys look like "./hired-swords/ogre-bodyguard.json". */
const PART = /(?:^|\/)hired-swords\/([^/]+)\.json$/;

export interface HiredSwordPool {
	hiredSwords: Map<string, HiredSword>;
	/**
	 * What the entries bring for the shared lists. Handed back rather than merged
	 * here: the merge belongs where the homebrew factions are merged as well, and
	 * a second place doing it would decide the order between them by accident.
	 */
	weapons: Weapon[];
	items: Item[];
}

export function collectHiredSwords(parts: Record<string, { default: unknown }>): HiredSwordPool {
	const hiredSwords = new Map<string, HiredSword>();
	const weapons: Weapon[] = [];
	const items: Item[] = [];

	for (const [path, module] of Object.entries(parts)) {
		if (!PART.test(path)) continue;
		const entry = module.default as HiredSword;
		/* A file without an id has nothing to be keyed by. `npm run check:rules`
		   says so by name; here it can only be left out. */
		if (!entry?.id) continue;

		hiredSwords.set(entry.id, entry);
		weapons.push(...(entry.weapons ?? []));
		items.push(...(entry.items ?? []));
	}

	return { hiredSwords, weapons, items };
}
