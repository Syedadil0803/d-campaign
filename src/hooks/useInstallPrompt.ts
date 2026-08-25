'use client';

import { useCallback, useEffect, useState } from 'react';

/**
 * Chrome's install event. Not in TypeScript's DOM library, because no other
 * engine implements it.
 */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

declare global {
  interface Window {
    /** Set by the catcher in layout.tsx. See the comment there. */
    __installPrompt?: BeforeInstallPromptEvent | null;
  }
}

/** Fired by that catcher so a component mounting later still finds out. */
const READY_EVENT = 'installpromptready';

/**
 * Exposes "can this be installed, and install it" to the UI.
 *
 * The browser decides installability, not us: the event only fires when the
 * manifest is readable, the service worker registered, and the app is not
 * already installed. So `canInstall` doubles as a check on the whole setup —
 * if the button never appears, something upstream is broken, which is easier
 * to notice than a missing icon in the address bar.
 *
 * Chrome and Edge only. Safari has no install API at all and Firefox does not
 * implement one, so on those the button simply never appears rather than
 * appearing and failing.
 */
export function useInstallPrompt() {
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    // The event usually fires before React has hydrated, which is why it is
    // caught in layout.tsx and parked on `window`. Read whatever was already
    // caught, then listen for later ones.
    if (window.__installPrompt) setPrompt(window.__installPrompt);

    const onReady = () => setPrompt(window.__installPrompt ?? null);
    const onInstalled = () => {
      // Installed: the offer is meaningless now, and Chrome will not fire
      // another event to tell us so.
      window.__installPrompt = null;
      setPrompt(null);
    };

    window.addEventListener(READY_EVENT, onReady);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener(READY_EVENT, onReady);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const install = useCallback(async () => {
    if (!prompt) return;
    await prompt.prompt();
    await prompt.userChoice;
    // Single use, whatever the answer. Chrome issues a fresh event if the app
    // is still installable, so hiding the button here is correct either way —
    // and re-firing a spent event throws.
    window.__installPrompt = null;
    setPrompt(null);
  }, [prompt]);

  return { canInstall: prompt !== null, install };
}
