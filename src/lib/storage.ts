/**
 * Storage in IndexedDB. The data is bound to the origin: move the app to a
 * different address and it is gone.
 *
 * Fighter photos live in a store of their own and never go into an export.
 */

import { browser } from '$app/environment';
import { newId } from './id';
import type { BattleState, StoredPhoto, StoredWarband } from './types/warband';

const DB_NAME = 'wyrdcry-warband-deck';
const DB_VERSION = 2;
const STORE = 'warbands';
const META = 'meta';
const PHOTOS = 'photos';

let dbPromise: Promise<IDBDatabase> | null = null;

function open(): Promise<IDBDatabase> {
	if (dbPromise) return dbPromise;
	dbPromise = new Promise((resolve, reject) => {
		const request = indexedDB.open(DB_NAME, DB_VERSION);
		request.onupgradeneeded = () => {
			const db = request.result;
			if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
			if (!db.objectStoreNames.contains(META)) db.createObjectStore(META);
			if (!db.objectStoreNames.contains(PHOTOS)) db.createObjectStore(PHOTOS);
		};
		request.onsuccess = () => {
			/* A window still on an older version would block the upgrade in another one. */
			request.result.onversionchange = () => {
				request.result.close();
				dbPromise = null;
			};
			resolve(request.result);
		};
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
	return list.sort((a, b) => a.warband.name.localeCompare(b.warband.name, 'en'));
}

export async function getWarband(id: string): Promise<StoredWarband | undefined> {
	if (!browser) return undefined;
	return run<StoredWarband | undefined>(STORE, 'readonly', (s) => s.get(id));
}

export async function putWarband(entry: StoredWarband): Promise<void> {
	await run(STORE, 'readwrite', (s) => s.put(entry, entry.warband.id));
}

/**
 * Removes a warband, the battle it was in the middle of and its fighters' photos.
 *
 * Nothing about it survives this: the campaign lives on the device and in
 * whatever was exported, and there is no copy anywhere else. Whoever calls this
 * asks first.
 */
export async function deleteWarband(id: string): Promise<void> {
	const db = await open();
	await new Promise<void>((resolve, reject) => {
		const tx = db.transaction([STORE, PHOTOS], 'readwrite');
		tx.objectStore(STORE).delete(id);
		tx.objectStore(PHOTOS).delete(IDBKeyRange.bound([id], [id, []]));
		tx.oncomplete = () => resolve();
		tx.onerror = () => reject(tx.error);
		tx.onabort = () => reject(tx.error);
	});
}

/** The photos of one warband's fighters, by instanceId. */
export async function photosOf(warbandId: string): Promise<Map<string, StoredPhoto>> {
	const photos = new Map<string, StoredPhoto>();
	if (!browser) return photos;
	const db = await open();
	return new Promise((resolve, reject) => {
		const request = db
			.transaction(PHOTOS, 'readonly')
			.objectStore(PHOTOS)
			.openCursor(IDBKeyRange.bound([warbandId], [warbandId, []]));
		request.onsuccess = () => {
			const cursor = request.result;
			if (!cursor) return resolve(photos);
			photos.set((cursor.key as [string, string])[1], cursor.value as StoredPhoto);
			cursor.continue();
		};
		request.onerror = () => reject(request.error);
	});
}

export async function putPhoto(warbandId: string, instanceId: string, photo: StoredPhoto): Promise<void> {
	await run(PHOTOS, 'readwrite', (s) => s.put(photo, [warbandId, instanceId]));
}

export async function deletePhoto(warbandId: string, instanceId: string): Promise<void> {
	await run(PHOTOS, 'readwrite', (s) => s.delete([warbandId, instanceId]));
}

/** Drops every photo of the warband whose fighter is not in `keep`. */
export async function prunePhotos(warbandId: string, keep: string[]): Promise<void> {
	const stored = await photosOf(warbandId);
	for (const instanceId of stored.keys()) {
		if (!keep.includes(instanceId)) await deletePhoto(warbandId, instanceId);
	}
}

/**
 * Writes the battle state and nothing else.
 *
 * Separate from `putWarband` because a battle must not raise `revision` or
 * `updatedAt`: those say how far the campaign has been carried, and a tap on
 * "activate" carries it nowhere. Were they to move, every game would make this
 * device look newer than the other one on the next import.
 */
export async function putBattle(id: string, battle: BattleState | null): Promise<void> {
	const entry = await getWarband(id);
	if (!entry) return;
	await run(STORE, 'readwrite', (s) => s.put({ ...entry, battle }, id));
}

/**
 * The warband the deck last showed, so coming back to it – from another page or
 * after the app was closed – does not fall back to the first one by name.
 */
export async function chosenWarband(): Promise<string | null> {
	if (!browser) return null;
	return (await run<string | undefined>(META, 'readonly', (s) => s.get('chosen'))) ?? null;
}

export async function chooseWarband(id: string | null): Promise<void> {
	if (!browser) return;
	await run(META, 'readwrite', (s) => (id ? s.put(id, 'chosen') : s.delete('chosen')));
}

/**
 * Identifier of this device. Goes into every export so an import can tell
 * whether two states have diverged.
 */
export async function deviceId(): Promise<string> {
	const stored = await run<string | undefined>(META, 'readonly', (s) => s.get('device'));
	if (stored) return stored;
	const fresh = newId().slice(0, 8);
	await run(META, 'readwrite', (s) => s.put(fresh, 'device'));
	return fresh;
}

/**
 * Asks the browser not to discard the data when storage runs low.
 * Safari essentially grants this to installed PWAs only.
 */
export async function requestPersistence(): Promise<boolean> {
	if (!browser || !navigator.storage?.persist) return false;
	if (await navigator.storage.persisted()) return true;
	return navigator.storage.persist();
}
