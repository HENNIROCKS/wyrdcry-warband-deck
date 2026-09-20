/**
 * Minimaler Service Worker: er macht die App installierbar, mehr nicht.
 *
 * Installierbar zu sein ist kein Selbstzweck – Safari löscht die Daten einer
 * nicht installierten Seite nach sieben Tagen ohne Nutzung. Echtes
 * Offline-Caching der Stammdaten kommt später.
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
