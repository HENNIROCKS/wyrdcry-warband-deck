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

/** What the wizard decided, in the words the player saw. */
export interface Selections {
	/** Faction rule id to the option ids picked under it. */
	rules: Record<string, string[]>;
	/** Fighter instanceId to what was picked for its own choice. */
	fighters: Record<string, string[]>;
	/** Every characteristic the wizard raised, and what raised it. */
	modifiers: { instanceId: string; characteristic: StatKey; bonus: number; source: string }[];
}

/** Free-text background, kept off the warband model so an app field is never mistaken for the builder's own. */
export interface Fluff {
	warband: string;
	/** Keyed by instanceId. */
	fighters: Record<string, string>;
}

/** One battle the warband fought, as the player wrote it down afterwards. */
export interface BattleRecord {
	id: string;
	/** A calendar day, YYYY-MM-DD. */
	date: string;
	result: 'win' | 'draw' | 'loss';
	/** Either name may be empty. */
	opponentWarband: string;
	opponentPlayer: string;
}

/**
 * Which rule a renown level falls under, fixed when the level is earned: it is
 * the fighter's keywords before this aftermath that decide, and by the time the
 * choice is made the card may already read differently.
 *
 * - `henchman`: a Characteristics Increase, never the same characteristic twice.
 * - `promotion`: a henchman's fourth level – an increase or a talent, and the
 *   fighter becomes a `HERO`.
 * - `hero`: an increase or a talent.
 * - `none`: no keyword to say what renown is worth; an increase, with a note.
 */
export type RenownBranch = 'henchman' | 'promotion' | 'hero' | 'none';

/** A renown level earned and not yet spent. At most one per fighter and level. */
export interface PendingRenown {
	instanceId: string;
	level: number;
	branch: RenownBranch;
}

/**
 * What a renown level was spent on. `statOverrides` holds the resulting figure
 * without its reason, so the reason is kept here and written into `_deck`.
 * `characteristic` is null where nothing could be raised.
 */
export interface RenownChoice {
	instanceId: string;
	level: number;
	branch: RenownBranch;
	characteristic: StatKey | null;
	/** Signed, as the figure moves: −1 for Bravery, which is a roll to beat. */
	bonus: number;
	source: string;
}

/** Metadata of this app. The builder ignores unknown keys and hands them back. */
export interface DeckMeta {
	format: 'wyrdcry-warband-deck';
	revision: number;
	device: string;
	exportedAt: string;
	ruleset: string;
	/** Absent on every warband that did not come out of the wizard. */
	selections?: Selections | null;
	fluff?: Fluff | null;
	history?: BattleRecord[] | null;
	renownHistory?: RenownChoice[] | null;
}

export type ExportedWarband = Warband & { _deck?: DeckMeta };

/**
 * What a fighter carries in the battle running right now.
 *
 * Two lifetimes meet here. `activated`, `waiting` and `panicked` belong to the
 * round and are cleared by the next one; `damage`, `out`, `heroic` and `cover`
 * belong to the battle and are only gone when it ends. Which is why one round
 * does not simply drop the whole map.
 *
 * `out` is stored rather than worked out from `damage` and Health: Health is a
 * figure of the card, and the deck's strokes, the count of who still has to act
 * and the warband's morale all ask for the state without having a card at hand.
 */
export interface FighterBattleState {
	activated: boolean;
	/**
	 * Waited as its first action: the activation is over, but the fighter can be
	 * activated once more this combat phase – so it still counts as one to act.
	 */
	waiting: boolean;
	/** Damage points allocated. The card shows what is left of Health instead. */
	damage: number;
	out: boolean;
	/**
	 * A `HERO` has spent its heroic reaction – the one reaction per battle that
	 * costs no action. Once per battle, not per round, so it outlives `nextRound`.
	 */
	heroic: boolean;
	/**
	 * In cover, worth +1 to the difficulty rating of a ranged attack against the
	 * fighter while it stands – shown on the card, counted by nobody. A stance
	 * rather than a round's action, so it survives `nextRound` the same way
	 * `damage` does – nobody has moved just because the round turned over.
	 */
	cover: boolean;
	/**
	 * Failed the Bravery test a wavering warband asks for, worth −1 Fight and −1
	 * Shoot. Until the end of the battle round, as the rule says – so `nextRound`
	 * clears it.
	 */
	panicked: boolean;
}

/** One round: its number, and what each fighter carries in it. */
export interface BattleRound {
	round: number;
	/**
	 * Keyed by instanceId. Ids the warband no longer has are ignored on read, and
	 * a record written before a field existed reads as that field's default.
	 */
	fighters: Record<string, Partial<FighterBattleState>>;
}

/**
 * State of a battle in progress. Lives on this device only: it never goes into
 * an export and never touches the revision counter, so playing a game does not
 * make one device look newer than another.
 */
export interface BattleState extends BattleRound {
	startedAt: string;
	/**
	 * The round the last `nextRound` left behind, so a mistaken tap can be taken
	 * back. Null once the new round has been played into – from there on there is
	 * nothing left to return to.
	 */
	undo: BattleRound | null;
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
	/**
	 * What the wizard picked while building this warband: the faction rules in
	 * play, each fighter's own choice, and which characteristic each of them
	 * raised. The builder's model has no field for any of it, and
	 * `statOverrides` holds the resulting figure without its reason, so it is
	 * kept here and written into `_deck` on export. Null for a warband that came
	 * out of the builder.
	 *
	 * Optional, because every record written before the wizard existed lacks the
	 * field altogether – a required one here would be a promise the database does
	 * not keep.
	 */
	selections?: Selections | null;
	/** Notes and fluff written here, kept off the warband model the same way `selections` is. */
	fluff?: Fluff | null;
	/** The battles fought, in the order they were entered. Kept off the warband model like `fluff`. */
	history?: BattleRecord[] | null;
	/**
	 * What every renown level was spent on, cumulative: the builder cannot
	 * regenerate it, so an import never throws it away wholesale.
	 */
	renownHistory?: RenownChoice[] | null;
	/**
	 * Levels earned and still waiting for a choice. Local to this device like
	 * `battle`, and written without raising `revision`: it is a to-do list, not
	 * progress. The choice that clears an entry is progress and raises it.
	 */
	pendingRenown?: PendingRenown[] | null;
}

/** Which part of a photo the image field shows. x and y run 0–1 (0.5 is the middle), zoom 1–2. */
export interface PhotoCrop {
	x: number;
	y: number;
	zoom: number;
}

/**
 * A fighter's photo, kept on the device only and never exported. The bytes are
 * stored as they are rather than as a Blob, which Safari often fails to write
 * to IndexedDB.
 */
export interface StoredPhoto {
	bytes: ArrayBuffer;
	type: string;
	width: number;
	height: number;
	crop: PhotoCrop;
	updatedAt: string;
}
