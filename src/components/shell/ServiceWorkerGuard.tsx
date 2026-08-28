'use client';

import { useEffect } from 'react';

/** Our own worker. Anything else on this origin is somebody else's. */
const OUR_WORKER_URL = '/sw.js';

/**
 * Owns the service worker on this origin: registers ours, evicts everyone
 * else's.
 *
 * A service worker belongs to the ORIGIN, not the project. Any other app once
 * served from the same localhost port leaves its worker installed and in
 * charge here, answering our requests from its own cache with chunks from a
 * different build — the page dies on "Cannot read properties of undefined
 * (reading 'call')", and a hard reload appears to fix it only because that
 * path bypasses the worker.
 *
 * So the sweep is targeted BY SCRIPT URL. Unregistering everything would
 * delete our own worker on the next load, and the tool would be installable
 * exactly once.
 *
 * One component does both. Split in two they would race over the same
 * registry, and the winner would depend on effect order.
 */
export function ServiceWorkerGuard() {
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;

    const ours = new URL(OUR_WORKER_URL, window.location.origin).href;

    const run = async () => {
      const registrations = await navigator.serviceWorker.getRegistrations();

      const foreign = registrations.filter((registration) => {
        const script =
          registration.active?.scriptURL ??
          registration.waiting?.scriptURL ??
          registration.installing?.scriptURL;
        // A registration with no script at all is mid-teardown; leave it be.
        return Boolean(script) && script !== ours;
      });

      if (foreign.length) {
        await Promise.all(foreign.map((registration) => registration.unregister()));

        // Safe to clear everything: our own worker caches nothing by design,
        // so every cache on this origin belongs to the workers just removed.
        // An orphaned cache would otherwise be served by whatever registers next.
        if (typeof caches !== 'undefined') {
          const keys = await caches.keys();
          await Promise.all(keys.map((key) => caches.delete(key)));
        }

        // The page loaded through the worker just removed, so what is on
        // screen may already be a mix of two builds. One reload lands it on
        // the real files — and registers ours on the way back in.
        console.warn(
          '[campaign-admin] Removed a service worker left on this origin by another app. Reloading once.',
        );
        window.location.reload();
        return;
      }

      // Registering on localhost too, so installability can be tested the same
      // way it behaves in production. Safe here precisely because our worker
      // has no cache: left behind on a shared port it can still only pass
      // requests through, which is the failure the eviction above exists for.
      await navigator.serviceWorker.register(OUR_WORKER_URL);
    };

    run().catch(() => {
      // A browser that refuses to enumerate or register workers is not one
      // this guard can help. Failing here must never break the app — losing
      // the install prompt is a far smaller thing than losing the tool.
    });
  }, []);

  return null;
}
