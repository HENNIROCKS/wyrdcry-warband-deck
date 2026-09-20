/**
 * Import and export of warbands.
 *
 * There is no sync. Every export is a deliberate act, and on import the app has
 * to be able to say which state is older – otherwise reaching for the wrong file
 * overwrites a whole campaign.
 */

import { RULESET_VERSION } from './gamedata';
import { deviceId, getWarband } from './storage';
import type { DeckMeta, ExportedWarband, StoredWarband, Warband } from './types/warband';

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

export function toStored(candidate: ImportCandidate): StoredWarband {
	const now = new Date().toISOString();
	return {
		warband: candidate.warband,
		revision: Math.max(candidate.meta?.revision ?? 1, candidate.existing?.revision ?? 0),
		ruleset: candidate.meta?.ruleset ?? RULESET_VERSION,
		importedAt: candidate.existing?.importedAt ?? now,
		updatedAt: now,
		origin: candidate.meta ? { device: candidate.meta.device, exportedAt: candidate.meta.exportedAt } : null,
		battle: candidate.existing?.battle ?? null
	};
}

function fileName(entry: StoredWarband, snapshot: boolean): string {
	const safe = entry.warband.name.replace(/[/\\:*?"<>|]/g, '-').trim();
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
			ruleset: entry.ruleset || RULESET_VERSION
		}
	};
}

export type ExportResult = 'shared' | 'downloaded' | 'cancelled';

/**
 * Shares the file through the system share sheet – that is where "Save to Files",
 * Drive, AirDrop and Mail live. Where there is none (desktop), it falls back to a
 * download.
 */
export async function exportWarband(entry: StoredWarband, snapshot: boolean): Promise<ExportResult> {
	const payload = JSON.stringify(await buildExport(entry), null, 2);
	const name = fileName(entry, snapshot);
	const file = new File([payload], name, { type: 'application/json' });

	if (navigator.canShare?.({ files: [file] })) {
		try {
			await navigator.share({ files: [file], title: entry.warband.name });
			return 'shared';
		} catch (error) {
			if (error instanceof DOMException && error.name === 'AbortError') return 'cancelled';
			/* Share declined or unavailable – a download still beats nothing. */
		}
	}

	const url = URL.createObjectURL(new Blob([payload], { type: 'application/json' }));
	const anchor = document.createElement('a');
	anchor.href = url;
	anchor.download = name;
	/* The anchor has to be in the DOM and the URL may only go after the click,
	   otherwise the download breaks in Safari. */
	document.body.appendChild(anchor);
	anchor.click();
	anchor.remove();
	setTimeout(() => URL.revokeObjectURL(url), 10_000);
	return 'downloaded';
}
