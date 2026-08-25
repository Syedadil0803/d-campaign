/**
 * A service worker that deliberately does nothing.
 *
 * Chrome will not offer to install a site without a service worker that has a
 * fetch handler. Nothing says that handler has to cache, and here it must not:
 * this app already keeps a recovery slot in localStorage, a draft in the
 * database, and per-device presence rows, and a cache would add a fourth copy
 * of the truth — one that survives a refresh and answers requests before the
 * app's own logic ever runs. Every stale-state bug in this tool would have
 * become harder to explain.
 *
 * So the fetch handler is empty. Calling nothing means the browser handles the
 * request exactly as it would with no worker installed. The worker exists to
 * satisfy the install criteria and for no other reason.
 */

// Take over immediately rather than waiting for every tab to close. A worker
// stuck in "waiting" is how an old one keeps serving a new build.
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Present on purpose, empty on purpose. Do not add caching here without
// reading the note above first.
self.addEventListener('fetch', () => {
  // No respondWith: the request goes to the network untouched.
});
