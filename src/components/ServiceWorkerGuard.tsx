'use client';

import { useEffect } from 'react';

/** Our own worker. Anything else on this origin is somebody else's. */
const OUR_WORKER_URL = '/sw.js';

/**
 * Owns the service worker on this origin: registers ours, evicts everyone
 * else's.
 *
 * The app used to ship no worker at all, and this component removed every
 * registration it found. That was right at the time — a service worker belongs
 * to the ORIGIN, not the project, so any other app previously served from the
 * same localhost port left its worker installed and in charge here. It then
 * answered this app's requests from its own cache, handing back chunks from a
 * different build: the page died with "Cannot read properties of undefined
 * (reading 'call')", the console showed a 404 for an sw.js this project never
 * had, and a hard reload appeared to fix it because that path alone bypasses
 * the worker.
 *
 * Now the app is installable, it has a worker of its own, and "unregister
 * everything" would delete it on the very next load — the tool would be
 * installable exactly once and then quietly stop being. So the sweep is
 * targeted by script URL: foreign workers go, ours stays.
 *
 * Two separate components — one registering, one evicting — would race over
 * the same registry and the outcome would depend on which effect ran first.
 * One owner, one decision.
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
