'use client';

import { useEffect } from 'react';

/**
 * Evicts any service worker controlling this origin.
 *
 * This app ships none — there is no sw.js and nothing registers one. But a
 * service worker belongs to the ORIGIN, not the project, so any other app
 * previously served from the same localhost port leaves its worker installed
 * and in charge here. It then answers this app's requests from its own cache,
 * handing back chunks that belong to a different build: the page dies with
 * "Cannot read properties of undefined (reading 'call')", the console shows a
 * 404 for an sw.js this project never had, and a hard reload appears to fix it
 * because that path alone bypasses the worker.
 *
 * Unregistering is safe precisely because we have none of our own to remove,
 * and a real PWA on that port re-registers its worker the next time it loads.
 * The cache entries go too — an orphaned worker's caches would otherwise sit
 * there being served by whatever registers next.
 */
export function ServiceWorkerGuard() {
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;

    navigator.serviceWorker
      .getRegistrations()
      .then(async (registrations) => {
        if (!registrations.length) return;
        await Promise.all(registrations.map((r) => r.unregister()));

        if (typeof caches !== 'undefined') {
          const keys = await caches.keys();
          await Promise.all(keys.map((k) => caches.delete(k)));
        }

        // The page loaded through the worker we just removed, so what is on
        // screen may already be a mix of two builds. One reload lands it on
        // the real files.
        console.warn(
          '[campaign-admin] Removed a service worker left on this origin by another app. Reloading once.',
        );
        window.location.reload();
      })
      .catch(() => {
        // Nothing to do — a browser that refuses to enumerate workers is not
        // one this guard can help, and failing here must not break the app.
      });
  }, []);

  return null;
}
