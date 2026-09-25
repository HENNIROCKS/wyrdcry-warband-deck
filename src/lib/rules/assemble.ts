/**
 * Puts one faction together out of the files in its directory.
 *
 * Takes the collected modules rather than reaching for them, so a run outside
 * Vite can hand it a set read from disk. `index.ts` passes the real glob.
 */

import type { Ability, Allowance, Faction, FactionRule, Fighter } from './types';

/** Keys look like "./factions/mercenaries/fighters.json". */
const PART = /(?:^|\/)factions\/([^/]+)\/([^/]+)\.json$/;

export function assembleFrom(parts: Record<string, { default: unknown }>): Map<string, Faction> {
	const folders = new Map<string, Record<string, unknown>>();

	for (const [path, module] of Object.entries(parts)) {
		const match = path.match(PART);
		if (!match) continue;
		const [, folder, file] = match;
		const bucket = folders.get(folder) ?? {};
		bucket[file] = module.default;
		folders.set(folder, bucket);
	}

	const factions = new Map<string, Faction>();

	for (const bucket of folders.values()) {
		const base = bucket['faction'] as Omit<Faction, 'rules' | 'fighters' | 'equipment' | 'abilities'>;
		/* A folder without faction.json has no id to be keyed by. `npm run
		   check:rules` says so by name; here it can only be left out. */
		if (!base?.id) continue;

		factions.set(base.id, {
			...base,
			rules: (bucket['rules'] ?? []) as FactionRule[],
			fighters: (bucket['fighters'] ?? []) as Fighter[],
			equipment: (bucket['equipment'] ?? []) as Allowance[],
			abilities: (bucket['abilities'] ?? []) as Ability[]
		});
	}

	return factions;
}
