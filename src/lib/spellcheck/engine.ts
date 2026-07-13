// Personal dictionary — words the user marks as correct (brand names, etc.),
// persisted in localStorage and used to suppress Harper's spelling lints.

const PERSONAL_KEY = 'campaign-spellcheck-dictionary';

function loadPersonal(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = localStorage.getItem(PERSONAL_KEY);
    if (!raw) return new Set();
    return new Set((JSON.parse(raw) as string[]).map((w) => w.toLowerCase()));
  } catch {
    return new Set();
  }
}

function savePersonal(words: Set<string>): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(PERSONAL_KEY, JSON.stringify([...words]));
  } catch {
    // storage full/disabled — checking still works for this session
  }
}

let personal = loadPersonal();

export function isInPersonalDictionary(word: string): boolean {
  return personal.has(word.trim().toLowerCase());
}

export function addToPersonalDictionary(word: string): void {
  const w = word.trim();
  if (!w) return;
  personal = new Set(personal).add(w.toLowerCase());
  savePersonal(personal);
}

export function removeFromPersonalDictionary(word: string): void {
  const w = word.trim().toLowerCase();
  if (!personal.has(w)) return;
  personal = new Set(personal);
  personal.delete(w);
  savePersonal(personal);
}

export function getPersonalDictionary(): string[] {
  return [...personal].sort();
}
