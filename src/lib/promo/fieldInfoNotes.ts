/**
 * Which field hints the user has told us to stop showing.
 *
 * Three fields each offer a short note about how long their text should be,
 * with a "Don't show again" that has to survive a reload. The storage key and
 * the reading and writing of it were written inline four times — once to load
 * and once inside each of the three buttons — so the key existed as a bare
 * string in four places, and adding a fourth field meant copying five
 * statements again.
 *
 * Per browser rather than per account, deliberately: this is a preference
 * about what the editor shows you, not part of the campaign.
 */

const STORAGE_KEY = 'hidden-field-infos';

/** Reads the set, tolerating a missing or unparseable value. */
export function readHiddenFieldInfos(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? new Set(JSON.parse(stored) as string[]) : new Set();
  } catch {
    // A corrupted value should cost the user a hint, not the editor.
    return new Set();
  }
}

/** Adds one field and writes the result back, returning the new set. */
export function hideFieldInfo(current: Set<string>, field: string): Set<string> {
  const next = new Set(current);
  next.add(field);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...next]));
  } catch {
    // Private browsing, or storage full. The note stays hidden for this
    // session either way; only the memory of it is lost.
  }
  return next;
}
