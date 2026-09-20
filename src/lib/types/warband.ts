/**
 * Spiegel des Warband-Modells aus dem Builder (`useWarband.ts` in jomblr/wyrdcry).
 * Wird beim Import gelesen und beim Export unverändert wieder geschrieben, damit
 * der Rückweg in den Builder offen bleibt.
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
	/** Freitext: Name des Kämpfers, mehrere durch Komma getrennt, oder der Fraktionsname. */
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

/** Metadaten dieser App. Der Builder ignoriert unbekannte Schlüssel und gibt sie zurück. */
export interface DeckMeta {
	format: 'wyrdcry-warband-deck';
	revision: number;
	device: string;
	exportedAt: string;
	ruleset: string;
}

export type ExportedWarband = Warband & { _deck?: DeckMeta };

/**
 * Flüchtiger Zustand eines laufenden Spiels – Wunden, Zustände.
 * Noch nicht benutzt; steht hier, damit die Trennung von der Kampagnenebene
 * von Anfang an im Modell verankert ist.
 */
export interface BattleState {
	startedAt: string;
	fighters: Record<string, { wounds: number; conditions: string[] }>;
}

/** Was in IndexedDB liegt: die Bande plus alles, was nur diese App betrifft. */
export interface StoredWarband {
	warband: Warband;
	revision: number;
	ruleset: string;
	importedAt: string;
	updatedAt: string;
	/** Aus welchem Export dieser Stand stammt. Null bei Dateien direkt aus dem Builder. */
	origin: { device: string; exportedAt: string } | null;
	battle: BattleState | null;
}
