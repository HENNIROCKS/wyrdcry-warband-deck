/**
 * Service worker: it makes the app installable and lets it start without a
 * network.
 *
 * Being installable is not an end in itself – Safari clears the data of a site
 * that is not installed after seven days without use. Starting offline is what
 * the table needs: the game data is bundled into the app's own scripts, so
 * caching the build is caching the data.
 *
 * Every file of a build is cached on install, under a name that carries the
 * build's version. Those files never change within a version, so they are
 * answered from the cache first; a new deploy is a new cache, picked up in the
 * background and shown from the next start on.
 */

/// <reference types="@sveltejs/kit" />
/// <reference lib="webworker" />

import { build, files, prerendered, version } from '$service-worker';

const worker = self as unknown as ServiceWorkerGlobalScope;

/* Cache Storage belongs to the whole origin, and on GitHub Pages that origin
   is shared with every other project of the account. Only caches under this
   prefix are ours to delete. */
const PREFIX = 'wyrdcry-warband-deck-';
const CACHE = `${PREFIX}${version}`;
/* `files` includes `.nojekyll`, an instruction to GitHub Pages rather than part
   of the app. Not every server hands out a dotfile, and one failed file fails
   the whole install. */
const served = files.filter((path) => !path.split('/').pop()?.startsWith('.'));
const ASSETS = new Set([...build, ...served, ...prerendered]);

worker.addEventListener('install', (event) => {
	event.waitUntil(
		caches
			.open(CACHE)
			.then((cache) => cache.addAll([...ASSETS]))
			.then(() => worker.skipWaiting())
	);
});

worker.addEventListener('activate', (event) => {
	event.waitUntil(
		caches
			.keys()
			.then((keys) =>
				Promise.all(keys.filter((key) => key.startsWith(PREFIX) && key !== CACHE).map((key) => caches.delete(key)))
			)
			.then(() => worker.clients.claim())
	);
});

worker.addEventListener('fetch', (event) => {
	const url = new URL(event.request.url);
	if (event.request.method !== 'GET' || url.origin !== location.origin) return;

	event.respondWith(
		(async () => {
			const cache = await caches.open(CACHE);

			if (ASSETS.has(url.pathname)) {
				const cached = await cache.match(url.pathname);
				if (cached) return cached;
			}

			/* Anything else – a page under another spelling, a file the build does
			   not list – goes to the network, and to the cache only without one. */
			try {
				return await fetch(event.request);
			} catch (error) {
				const cached = await cache.match(event.request);
				if (cached) return cached;
				throw error;
			}
		})()
	);
});

export {};
