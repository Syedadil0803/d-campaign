/**
 * Which browser this is, and what to call it.
 *
 * Unsaved work lives in the browser that made it, so when the account is
 * opened somewhere else the only useful thing we can say is *where* the work
 * is. That needs two things: an id stable enough to recognise this browser on
 * its next visit, and a label a person can act on — "Chrome on macOS" tells
 * someone which machine to go back to in a way a random id never could.
 *
 * The id is generated here rather than derived from the user agent because
 * fingerprinting would collapse two identical browsers on two machines into
 * one device, which is exactly the case this exists to tell apart.
 */

const DEVICE_ID_KEY = 'campaign-admin:device-id';

export function getDeviceId(): string {
  if (typeof window === 'undefined') return '';
  try {
    const existing = localStorage.getItem(DEVICE_ID_KEY);
    if (existing) return existing;
    const id =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `d-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    localStorage.setItem(DEVICE_ID_KEY, id);
    return id;
  } catch {
    // Private mode: no stable id, so this browser will look new each visit.
    // That errs toward showing the cross-device notice rather than hiding
    // work, which is the safer of the two mistakes.
    return '';
  }
}

/** Something like "Chrome on macOS" — for reading, never for matching. */
export function getDeviceLabel(): string {
  if (typeof navigator === 'undefined') return 'an unrecognized browser';
  const ua = navigator.userAgent;

  // Order matters: Edge and Opera both carry "Chrome", and Chrome carries
  // "Safari", so the more specific names have to be tested first.
  const browser =
    /Edg\//.test(ua) ? 'Edge'
    : /OPR\//.test(ua) ? 'Opera'
    : /Firefox\//.test(ua) ? 'Firefox'
    : /Chrome\//.test(ua) ? 'Chrome'
    : /Safari\//.test(ua) ? 'Safari'
    : 'a browser';

  const os =
    /iPhone|iPad|iPod/.test(ua) ? 'iOS'
    : /Android/.test(ua) ? 'Android'
    : /Mac OS X|Macintosh/.test(ua) ? 'macOS'
    : /Windows/.test(ua) ? 'Windows'
    : /Linux/.test(ua) ? 'Linux'
    : null;

  return os ? `${browser} on ${os}` : browser;
}
