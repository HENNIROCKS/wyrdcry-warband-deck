/**
 * Import and export of warbands.
 *
 * There is no sync. Every export is a deliberate act, and on import the app has
 * to be able to say which state is older – otherwise reaching for the wrong file
 * overwrites a whole campaign.
 */

import { readColour } from './colour';
import { RULESET_VERSION } from './gamedata';
import { deviceId, getWarband } from './storage';
import {
	STAT_KEYS,
	type BattleRecord,
	type DeckMeta,
	type ExportedWarband,
	type Fluff,
	type RenownBranch,
	type RenownChoice,
	type StatKey,
	type StoredWarband,
	type Warband
} from './types/warband';

export const FORMAT = 'wyrdcry-warband-deck';

export type ImportVerdict =
	| { kind: 'new' }
	| { kind: 'newer'; storedRevision: number; incomingRevision: number }
	| { kind: 'same' }
	| { kind: 'older'; storedRevision: number; incomingRevision: number }
	| { kind: 'diverged'; storedRevision: number; incomingRevision: number; otherDevice: string };

export interface ImportCandidate {
	warband: Warband;
	meta: DeckMeta | null;
	verdict: ImportVerdict;
	/** The file's ruleset differs from the app's ruleset. */
	rulesetMismatch: string | null;
	existing: StoredWarband | null;
}

export class ImportError extends Error {}

function isWarband(value: unknown): value is ExportedWarband {
	if (typeof value !== 'object' || value === null) return false;
	const v = value as Record<string, unknown>;
	return typeof v.id === 'string' && typeof v.name === 'string' && Array.isArray(v.fighters);
}

/** Fills in fields that older builder exports do not know about. */
function normalise(raw: ExportedWarband): Warband {
	return {
		id: raw.id,
		name: raw.name,
		factionId: raw.factionId ?? null,
		favour: raw.favour ?? 0,
		gold: raw.gold ?? 0,
		stash: raw.stash ?? [],
		factionNotes: raw.factionNotes ?? '',
		customWeapons: raw.customWeapons ?? [],
		customAbilities: raw.customAbilities ?? [],
		fighters: (raw.fighters ?? []).map((f) => ({
			instanceId: f.instanceId,
			fighterId: f.fighterId,
			customName: f.customName ?? '',
			equipment: f.equipment ?? [],
			pendingEquipment: f.pendingEquipment ?? [],
			isPending: f.isPending ?? false,
			notes: f.notes ?? '',
			costOverride: f.costOverride ?? null,
			xp: f.xp ?? 0,
			renown: f.renown ?? 0,
			statOverrides: f.statOverrides ?? {}
		}))
	};
}

function judge(incoming: DeckMeta | null, existing: StoredWarband | null): ImportVerdict {
	if (!existing) return { kind: 'new' };

	const storedRevision = existing.revision;
	/* Files straight out of the builder carry no revision. They count as
	   revision 1 – older than anything already edited here. */
	const incomingRevision = incoming?.revision ?? 1;

	if (incomingRevision > storedRevision) return { kind: 'newer', storedRevision, incomingRevision };
	if (incomingRevision < storedRevision) return { kind: 'older', storedRevision, incomingRevision };

	/* Same revision: either it is exactly the file this state came from – then an
	   import changes nothing – or two devices carried the same revision forward in
	   different directions. */
	if (!incoming) return { kind: 'same' };
	const origin = existing.origin;
	if (origin && origin.device === incoming.device && origin.exportedAt === incoming.exportedAt) {
		return { kind: 'same' };
	}
	return { kind: 'diverged', storedRevision, incomingRevision, otherDevice: incoming.device };
}

export async function readFile(file: File): Promise<ImportCandidate> {
	let parsed: unknown;
	try {
		parsed = JSON.parse(await file.text());
	} catch {
		throw new ImportError('That file is not valid JSON.');
	}

	if (!isWarband(parsed)) {
		throw new ImportError('That file does not look like a warband.');
	}

	const meta = (parsed._deck as DeckMeta | undefined) ?? null;
	const warband = normalise(parsed);

	/* The builder silently rejects unnamed warbands on import. Storing one here
	   would mean not being able to play it back later. */
	if (warband.name.trim() === '') {
		throw new ImportError('This warband has no name. Name it in the builder and export again.');
	}

	const existing = (await getWarband(warband.id)) ?? null;

	return {
		warband,
		meta,
		verdict: judge(meta, existing),
		rulesetMismatch: meta && meta.ruleset !== RULESET_VERSION ? meta.ruleset : null,
		existing
	};
}

/**
 * Notes and fluff are written content, not a figure the builder can regenerate –
 * unlike `selections`, they must not vanish just because a file lacks them.
 * Per key the incoming file wins where it has one, the stored copy fills the
 * rest, and an instanceId the incoming roster no longer has is dropped.
 */
function mergeFluff(incoming: Fluff | null | undefined, existing: Fluff | null | undefined, warband: Warband): Fluff | null {
	if (!incoming && !existing) return null;
	const fighters: Record<string, string> = {};
	for (const { instanceId } of warband.fighters) {
		const value = incoming?.fighters?.[instanceId] ?? existing?.fighters?.[instanceId];
		if (value) fighters[instanceId] = value;
	}
	return { warband: incoming?.warband ?? existing?.warband ?? '', fighters };
}

const RESULTS: readonly string[] = ['win', 'draw', 'loss'];

/**
 * The entries of a file's history that the card can show. Sorting reads the
 * date of every one, so a single entry without it would take the whole deck
 * down with it rather than only its own line. Missing names read as empty.
 */
function readHistory(incoming: unknown): BattleRecord[] | null {
	if (!Array.isArray(incoming)) return null;
	return incoming.flatMap((entry): BattleRecord[] => {
		if (typeof entry !== 'object' || entry === null) return [];
		const { id, date, result, opponentWarband, opponentPlayer } = entry as Record<string, unknown>;
		if (typeof id !== 'string' || typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return [];
		if (typeof result !== 'string' || !RESULTS.includes(result)) return [];
		return [
			{
				id,
				date,
				result: result as BattleRecord['result'],
				opponentWarband: typeof opponentWarband === 'string' ? opponentWarband : '',
				opponentPlayer: typeof opponentPlayer === 'string' ? opponentPlayer : ''
			}
		];
	});
}

const BRANCHES: readonly string[] = ['henchman', 'promotion', 'hero', 'none'];
const STATS: readonly string[] = STAT_KEYS;

/** The entries of a file's renown history that the card can use; a damaged one is left out, not guessed at. */
function readRenownHistory(incoming: unknown): RenownChoice[] | null {
	if (!Array.isArray(incoming)) return null;
	return incoming.flatMap((entry): RenownChoice[] => {
		if (typeof entry !== 'object' || entry === null) return [];
		const { instanceId, level, branch, characteristic, bonus, source } = entry as Record<string, unknown>;
		if (typeof instanceId !== 'string' || typeof level !== 'number' || !Number.isInteger(level)) return [];
		if (typeof branch !== 'string' || !BRANCHES.includes(branch)) return [];
		if (characteristic !== null && (typeof characteristic !== 'string' || !STATS.includes(characteristic))) return [];
		return [
			{
				instanceId,
				level,
				branch: branch as RenownBranch,
				characteristic: characteristic as StatKey | null,
				bonus: typeof bonus === 'number' ? bonus : 0,
				source: typeof source === 'string' ? source : `Renown ${level}`
			}
		];
	});
}

/**
 * Renown history is cumulative and cannot be rebuilt from the file, so unlike
 * `selections` it is not thrown away when a file lacks it. By (instanceId, level)
 * the file wins where both have an entry, and stored entries fill the rest. An
 * entry whose level the incoming roster has not reached describes a choice that
 * roster never made, and goes.
 *
 * A deck file that is older than, or has diverged from, what is stored carries a
 * roster without the figures the stored choices raised: only the file's own
 * entries fit it, and the stored pending levels belong to a state it never had.
 */
function mergeRenown(candidate: ImportCandidate): Pick<StoredWarband, 'renownHistory' | 'pendingRenown'> {
	const reached = new Map(candidate.warband.fighters.map((f) => [f.instanceId, f.renown]));
	const earned = (e: { instanceId: string; level: number }) => (reached.get(e.instanceId) ?? -1) >= e.level;
	const key = (e: { instanceId: string; level: number }) => `${e.instanceId}:${e.level}`;

	const fileBehind =
		candidate.meta !== null && (candidate.verdict.kind === 'older' || candidate.verdict.kind === 'diverged');
	const fromFile = (readRenownHistory(candidate.meta?.renownHistory) ?? []).filter(earned);
	const known = new Set(fromFile.map(key));
	const fromStored = fileBehind
		? []
		: (candidate.existing?.renownHistory ?? []).filter((e) => earned(e) && !known.has(key(e)));
	const history = [...fromFile, ...fromStored];
	const spent = new Set(history.map(key));

	const pending = fileBehind
		? []
		: (candidate.existing?.pendingRenown ?? []).filter((e) => earned(e) && !spent.has(key(e)));

	return { renownHistory: history.length ? history : null, pendingRenown: pending.length ? pending : null };
}

export function toStored(candidate: ImportCandidate): StoredWarband {
	const now = new Date().toISOString();
	return {
		warband: candidate.warband,
		revision: Math.max(candidate.meta?.revision ?? 1, candidate.existing?.revision ?? 0),
		ruleset: candidate.meta?.ruleset ?? RULESET_VERSION,
		importedAt: candidate.existing?.importedAt ?? now,
		updatedAt: now,
		origin: candidate.meta ? { device: candidate.meta.device, exportedAt: candidate.meta.exportedAt } : null,
		battle: candidate.existing?.battle ?? null,
		/* Whatever the file carries, and nothing else. Keeping the stored ones would
		   describe a warband that is being replaced: the modifiers hang on
		   instanceIds the incoming roster need not have. */
		selections: candidate.meta?.selections ?? null,
		fluff: mergeFluff(candidate.meta?.fluff, candidate.existing?.fluff, candidate.warband),
		/* Whole, not merged: an entry removed here would come back with every older
		   export. A file without the field – one from the builder – keeps what is
		   stored. */
		history: readHistory(candidate.meta?.history) ?? candidate.existing?.history ?? null,
		/* A file out of this app says the colour, the green included; one from
		   the builder says nothing and keeps the stored one. */
		colour: candidate.meta && 'colour' in candidate.meta ? readColour(candidate.meta.colour) : (candidate.existing?.colour ?? null),
		...mergeRenown(candidate)
	};
}

/** The warband's name with what a file system refuses replaced. */
export function safeName(name: string): string {
	return name.replace(/[/\\:*?"<>|]/g, '-').trim();
}

function fileName(entry: StoredWarband, snapshot: boolean): string {
	const safe = safeName(entry.warband.name);
	if (!snapshot) return `${safe}.json`;
	const date = new Date().toISOString().slice(0, 10);
	return `${safe} – ${date} – Rev ${entry.revision}.json`;
}

export async function buildExport(entry: StoredWarband): Promise<ExportedWarband> {
	return {
		...entry.warband,
		_deck: {
			format: FORMAT,
			revision: entry.revision,
			device: await deviceId(),
			exportedAt: new Date().toISOString(),
			ruleset: entry.ruleset || RULESET_VERSION,
			selections: entry.selections,
			fluff: entry.fluff,
			history: entry.history,
			renownHistory: entry.renownHistory,
			colour: entry.colour ?? null
		}
	};
}

export type ExportResult = 'shared' | 'downloaded' | 'cancelled';

/** The warband as a JSON file, shared or downloaded. */
export async function exportWarband(entry: StoredWarband, snapshot: boolean): Promise<ExportResult> {
	const payload = JSON.stringify(await buildExport(entry), null, 2);
	const file = new File([payload], fileName(entry, snapshot), { type: 'application/json' });
	return shareFile(file);
}

/**
 * The system share sheet – where "Save to Files", Drive, AirDrop and Mail live –
 * or, where there is none (desktop), a download. The file goes alone: iOS shares a title as a text of its own, and AirDrop delivers it
 * as a second file beside the first.
 */
export async function shareFile(file: File): Promise<ExportResult> {
	if (navigator.canShare?.({ files: [file] })) {
		try {
			await navigator.share({ files: [file] });
			return 'shared';
		} catch (error) {
			if (error instanceof DOMException && error.name === 'AbortError') return 'cancelled';
			/* Share declined or unavailable – a download still beats nothing. */
		}
	}

	const url = URL.createObjectURL(file);
	const anchor = document.createElement('a');
	anchor.href = url;
	anchor.download = file.name;
	/* The anchor has to be in the DOM and the URL may only go after the click,
	   otherwise the download breaks in Safari. */
	document.body.appendChild(anchor);
	anchor.click();
	anchor.remove();
	setTimeout(() => URL.revokeObjectURL(url), 10_000);
	return 'downloaded';
}
