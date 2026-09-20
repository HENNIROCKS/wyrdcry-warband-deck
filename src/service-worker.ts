/**
 * Minimal service worker: it makes the app installable, nothing more.
 *
 * Being installable is not an end in itself – Safari clears the data of a site
 * that is not installed after seven days without use. Real offline caching of
 * the game data comes later.
 */

/// <reference types="@sveltejs/kit" />
/// <reference lib="webworker" />

const worker = self as unknown as ServiceWorkerGlobalScope;

worker.addEventListener('install', () => {
	worker.skipWaiting();
});

worker.addEventListener('activate', (event) => {
	event.waitUntil(worker.clients.claim());
});

worker.addEventListener('fetch', (event) => {
	event.respondWith(fetch(event.request));
});

export {};
