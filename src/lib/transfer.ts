/**
 * Import und Export von Banden.
 *
 * Es gibt keinen Sync. Jeder Export ist eine bewusste Handlung, und beim Import
 * muss die App sagen können, welcher Stand älter ist – sonst überschreibt ein
 * Griff zur falschen Datei eine ganze Kampagne.
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
	/** Regelstand der Datei weicht vom Regelstand der App ab. */
	rulesetMismatch: string | null;
	existing: StoredWarband | null;
}

export class ImportError extends Error {}

function isWarband(value: unknown): value is ExportedWarband {
	if (typeof value !== 'object' || value === null) return false;
	const v = value as Record<string, unknown>;
	return typeof v.id === 'string' && typeof v.name === 'string' && Array.isArray(v.fighters);
}

/** Füllt Felder, die ältere Exporte des Builders nicht kennen. */
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
	/* Dateien direkt aus dem Builder tragen keine Revision. Sie gelten als
	   Revision 1 – älter als alles, was hier schon bearbeitet wurde. */
	const incomingRevision = incoming?.revision ?? 1;

	if (incomingRevision > storedRevision) return { kind: 'newer', storedRevision, incomingRevision };
	if (incomingRevision < storedRevision) return { kind: 'older', storedRevision, incomingRevision };

	/* Gleiche Revision: entweder ist es genau die Datei, aus der dieser Stand
	   kommt – dann ändert ein Import nichts – oder zwei Geräte haben dieselbe
	   Revision unterschiedlich weitergeschrieben. */
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
		throw new ImportError('Die Datei ist kein gültiges JSON.');
	}

	if (!isWarband(parsed)) {
		throw new ImportError('Die Datei sieht nicht nach einer Bande aus.');
	}

	const meta = (parsed._deck as DeckMeta | undefined) ?? null;
	const warband = normalise(parsed);

	/* Der Builder lehnt namenlose Banden beim Import stumm ab. Wer hier eine
	   speichert, kann sie später nicht zurückspielen. */
	if (warband.name.trim() === '') {
		throw new ImportError('Die Bande hat keinen Namen. Im Builder benennen und neu exportieren.');
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
 * Teilt die Datei über das System-Share-Sheet – dort liegen „In Dateien sichern",
 * Drive, AirDrop und Mail. Wo es das nicht gibt (Desktop), fällt es auf einen
 * Download zurück.
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
			/* Share abgelehnt oder nicht verfügbar – Download ist immer noch besser als nichts. */
		}
	}

	const url = URL.createObjectURL(new Blob([payload], { type: 'application/json' }));
	const anchor = document.createElement('a');
	anchor.href = url;
	anchor.download = name;
	/* Anker muss im DOM hängen und die URL darf erst nach dem Klick weg,
	   sonst bricht der Download in Safari ab. */
	document.body.appendChild(anchor);
	anchor.click();
	anchor.remove();
	setTimeout(() => URL.revokeObjectURL(url), 10_000);
	return 'downloaded';
}
