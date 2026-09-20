/**
 * Mirror of the warband model from the builder (`useWarband.ts` in jomblr/wyrdcry).
 * Read on import and written back unchanged on export, so the way back into the
 * builder stays open.
 */

export type StatKey = 'move' | 'fight' | 'shoot' | 'defense' | 'health' | 'bravery';

export const STAT_KEYS: StatKey[] = ['move', 'fight', 'shoot', 'defense', 'health', 'bravery'];

export interface FighterInstance {
	instanceId: string;
	fighterId: string;
	customName: string;
	equipment: string[];
	pendingEquipment: string[];
	isPending: boolean;
	notes: string;
	costOverride: number | null;
	xp: number;
	renown: number;
	statOverrides: Partial<Record<StatKey, number>>;
}

export interface CustomAbility {
	id: string;
	/** Free text: a fighter name, several separated by commas, or the faction name. */
	fighter: string;
	type: string;
	ability: string;
}

export interface CustomWeapon {
	id: string;
	name: string;
	range: string;
	attacks: string;
	hit: string;
	crit: string;
	special: string;
}

export interface Warband {
	id: string;
	name: string;
	factionId: string | null;
	favour: number;
	gold: number;
	fighters: FighterInstance[];
	stash: string[];
	factionNotes: string;
	customWeapons: CustomWeapon[];
	customAbilities: CustomAbility[];
}

/** Metadata of this app. The builder ignores unknown keys and hands them back. */
export interface DeckMeta {
	format: 'wyrdcry-warband-deck';
	revision: number;
	device: string;
	exportedAt: string;
	ruleset: string;
}

export type ExportedWarband = Warband & { _deck?: DeckMeta };

/**
 * Transient state of a game in progress – wounds, conditions.
 * Not used yet; it is here so the split from the campaign level is anchored in
 * the model from the start.
 */
export interface BattleState {
	startedAt: string;
	fighters: Record<string, { wounds: number; conditions: string[] }>;
}

/** What lives in IndexedDB: the warband plus everything only this app cares about. */
export interface StoredWarband {
	warband: Warband;
	revision: number;
	ruleset: string;
	importedAt: string;
	updatedAt: string;
	/** Which export this state came from. Null for files straight out of the builder. */
	origin: { device: string; exportedAt: string } | null;
	battle: BattleState | null;
}
