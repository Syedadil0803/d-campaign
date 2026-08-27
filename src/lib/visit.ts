/**
 * Has the tool just been opened, as opposed to re-rendered?
 *
 * Module-level rather than React state on purpose: it has to survive every
 * remount within the visit, and it is asked from more than one place — the
 * page and the config loader both need the same answer.
 */
let arrivalChecked: boolean | null = null;

export function isFirstLoadOfVisit(): boolean {
  if (arrivalChecked !== null) return arrivalChecked;
  try {
    const KEY = 'campaign-admin:arrival-shown';
    arrivalChecked = !sessionStorage.getItem(KEY);
    sessionStorage.setItem(KEY, '1');
  } catch {
    // Private mode: better to say it than to swallow it.
    arrivalChecked = true;
  }
  return arrivalChecked;
}

