/**
 * Ablage in IndexedDB. Die Daten hängen an der Origin: zieht die App auf eine
 * andere Adresse um, sind sie weg.
 */

import { browser } from '$app/environment';
import type { StoredWarband } from './types/warband';

const DB_NAME = 'wyrdcry-warband-deck';
const DB_VERSION = 1;
const STORE = 'warbands';
const META = 'meta';

let dbPromise: Promise<IDBDatabase> | null = null;

function open(): Promise<IDBDatabase> {
	if (dbPromise) return dbPromise;
	dbPromise = new Promise((resolve, reject) => {
		const request = indexedDB.open(DB_NAME, DB_VERSION);
		request.onupgradeneeded = () => {
			const db = request.result;
			if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
			if (!db.objectStoreNames.contains(META)) db.createObjectStore(META);
		};
		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error);
	});
	return dbPromise;
}

function run<T>(store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest): Promise<T> {
	return open().then(
		(db) =>
			new Promise<T>((resolve, reject) => {
				const tx = db.transaction(store, mode);
				const request = fn(tx.objectStore(store));
				request.onsuccess = () => resolve(request.result as T);
				request.onerror = () => reject(request.error);
			})
	);
}

export async function allWarbands(): Promise<StoredWarband[]> {
	if (!browser) return [];
	const list = await run<StoredWarband[]>(STORE, 'readonly', (s) => s.getAll());
	return list.sort((a, b) => a.warband.name.localeCompare(b.warband.name, 'de'));
}

export async function getWarband(id: string): Promise<StoredWarband | undefined> {
	if (!browser) return undefined;
	return run<StoredWarband | undefined>(STORE, 'readonly', (s) => s.get(id));
}

export async function putWarband(entry: StoredWarband): Promise<void> {
	await run(STORE, 'readwrite', (s) => s.put(entry, entry.warband.id));
}

export async function deleteWarband(id: string): Promise<void> {
	await run(STORE, 'readwrite', (s) => s.delete(id));
}

/**
 * Kennung dieses Geräts. Steht in jedem Export, damit beim Import erkennbar ist,
 * ob zwei Stände auseinandergelaufen sind.
 */
export async function deviceId(): Promise<string> {
	const stored = await run<string | undefined>(META, 'readonly', (s) => s.get('device'));
	if (stored) return stored;
	const fresh = crypto.randomUUID().slice(0, 8);
	await run(META, 'readwrite', (s) => s.put(fresh, 'device'));
	return fresh;
}

/**
 * Bittet den Browser, die Daten nicht bei Platzmangel zu verwerfen.
 * Safari gewährt das im Wesentlichen nur installierten PWAs.
 */
export async function requestPersistence(): Promise<boolean> {
	if (!browser || !navigator.storage?.persist) return false;
	if (await navigator.storage.persisted()) return true;
	return navigator.storage.persist();
}
