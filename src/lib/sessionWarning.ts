/**
 * The desktop notification that warns about an idle sign-out.
 *
 * Strictly an addition. The warning itself is a dialog in the page, which
 * always works; this only reaches someone who has switched to another window
 * and would otherwise come back to a login screen with no idea why. Everything
 * here fails soft — an unsupported browser, a denied permission, or a blocked
 * notification changes nothing about the countdown or the sign-out.
 */

const TAG = 'campaign-admin-idle';

/**
 * "30 seconds" / "1 minute" / "5 minutes" — whichever it actually is.
 *
 * Lives here rather than beside the dialog so both wordings come from one
 * place. They did not, and the notification rounded thirty seconds up to
 * "1 minutes" — wrong number, broken plural, in the one message that reaches
 * people outside the app.
 */
export function describeDuration(ms: number): string {
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds} seconds`;
  const minutes = Math.round(seconds / 60);
  return minutes === 1 ? '1 minute' : `${minutes} minutes`;
}

let current: Notification | null = null;

export function notificationsSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

/** 'default' means never answered — the only state worth asking in. */
export function notificationPermission(): NotificationPermission | null {
  if (!notificationsSupported()) return null;
  return Notification.permission;
}

/**
 * Ask the browser, which must happen inside a click.
 *
 * Chrome ignores (or auto-denies) a request that is not tied to a gesture, so
 * this is only ever called from the Allow button — never on load.
 */
export async function askNotificationPermission(): Promise<NotificationPermission | null> {
  if (!notificationsSupported()) return null;
  try {
    return await Notification.requestPermission();
  } catch {
    return null;
  }
}

/**
 * Show the warning outside the page, if that is any use.
 *
 * Skipped when the tab is visible: the dialog is already on screen, and firing
 * a desktop notification at someone looking straight at it is noise. `tag`
 * means a second call replaces the first rather than stacking.
 */
export function showIdleNotification(idleFor: string, onClick: () => void): void {
  // Every reason for not showing one is logged. Silence was the worst possible
  // behaviour here: a blocked permission, an unsupported browser and a working
  // notification that the OS chose to hide all looked identical from the page,
  // and the only way to tell them apart was to guess.
  if (!notificationsSupported()) {
    console.warn('[idle] no Notification API in this browser');
    return;
  }
  if (Notification.permission !== 'granted') {
    console.warn(`[idle] notification permission is "${Notification.permission}", not "granted"`);
    return;
  }
  if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
    console.info('[idle] tab is visible — the dialog covers this, so no desktop notification');
    return;
  }

  try {
    current?.close();
    current = new Notification('Are you still there?', {
      body: `No activity for ${idleFor}. You'll be signed out shortly — your work is saved.`,
      // No icon. macOS hands these to its own notification system, which
      // always leads with the browser's icon and demotes ours to a thumbnail
      // beside it — two marks for one message, saying nothing the title does
      // not. (public/notification-icon.png is still there if this ever wants
      // reinstating for Windows or Linux, where the browser draws its own.)
      // `tag` keeps these from stacking: a second warning replaces the first
      // rather than adding to a pile. But a replacement is silent by default —
      // it updates the existing entry with no banner and no sound — so the
      // first warning alerted and every one after it appeared to do nothing.
      // `renotify` says to announce the replacement too, which is the whole
      // point of showing it again.
      tag: TAG,
      renotify: true,
      requireInteraction: true,
    } as NotificationOptions & { renotify: boolean });
    console.info('[idle] desktop notification shown');
    current.onclick = () => {
      // Bring them back to the tab that is asking, then treat it as the click
      // the dialog was waiting for.
      window.focus();
      current?.close();
      current = null;
      onClick();
    };
  } catch (error) {
    // Android Chrome throws here: it requires notifications to come from a
    // service worker registration rather than the constructor. Nothing to do —
    // the in-page dialog still stands.
    console.warn('[idle] could not construct the notification:', error);
  }
}

export function closeIdleNotification(): void {
  try {
    current?.close();
  } catch {
    /* already gone */
  }
  current = null;
}

/**
 * Where the switch actually is, in this browser.
 *
 * "Your browser's site settings" is true everywhere and useful nowhere — it
 * names no control the reader can look for. These are the real paths, and they
 * differ enough that one line would be wrong for most people: Chrome, Edge and
 * Firefox all put it behind the icon beside the address, while Safari keeps it
 * in the application menu entirely.
 *
 * The icon browsers get a drawing rather than a description. Naming it does
 * not help — Chrome showed a padlock until 117 and a sliders icon after, so
 * any word for it is wrong somewhere, and "padlock or sliders" asks someone to
 * decode a sentence while looking at a toolbar.
 */
export type UnblockHint =
  | { kind: 'menu'; text: string }
  | { kind: 'icon'; before: string; after: string };

export function unblockSteps(): UnblockHint {
  if (typeof navigator === 'undefined') {
    return { kind: 'menu', text: 'Allow notifications for this site.' };
  }
  const ua = navigator.userAgent;

  // Order matters: Safari's token appears in Chrome's user agent too.
  const isSafari = /Safari\//.test(ua) && !/Chrome\/|Chromium\/|Edg\/|OPR\//.test(ua);
  if (isSafari) {
    return { kind: 'menu', text: 'Safari → Settings → Websites → Notifications → Allow.' };
  }

  return {
    kind: 'icon',
    before: 'Click',
    after: 'left of the web address → Notifications → Allow.',
  };
}

/**
 * Where the operating system's own switch lives.
 *
 * The third gate, and the only one nothing can read. `Notification.permission`
 * covers the site; whether the OS lets the browser post at all is invisible to
 * a page — by design, since a site that could read your notification settings
 * could fingerprint you with them. `onshow` is no help either: it fires when
 * the browser posts the notification, not when the OS decides to display it,
 * so a muted browser still reports success.
 *
 * Undetectable is not unmentionable. Someone who granted both gates and sees
 * nothing has no way to know a third exists, so it gets named once, at the
 * moment it becomes the only thing left that could be wrong.
 */
export function osNotificationHint(): string | null {
  if (typeof navigator === 'undefined') return null;
  const ua = navigator.userAgent;
  if (/Mac OS X|Macintosh/.test(ua)) {
    return 'System Settings → Notifications → your browser.';
  }
  if (/Windows/.test(ua)) {
    return 'Settings → System → Notifications → your browser.';
  }
  return null;
}
