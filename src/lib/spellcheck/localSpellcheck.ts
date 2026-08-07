// In-house spelling detection — "Step 1: detect + underline" — with NO third
// party and NO browser-native checker. It flags words that aren't in our bundled
// English dictionary (or the user's personal dictionary) and returns them as the
// same `Issue` shape Harper produces, so SpellCheckOverlay can underline them
// unchanged. It intentionally returns NO suggestions — that is "Step 2".
//
// This is the backup path discussed in docs/spellcheck-and-autocorrect-research.md.

import { isInPersonalDictionary } from './engine';
import type { Issue } from './types';

const DICT_URL = '/dictionaries/en.txt';

let dictPromise: Promise<Set<string>> | null = null;

async function getDictionary(): Promise<Set<string>> {
  if (!dictPromise) {
    dictPromise = (async () => {
      const res = await fetch(DICT_URL);
      if (!res.ok) throw new Error(`dictionary load failed: ${res.status}`);
      const text = await res.text();
      const set = new Set<string>();
      for (const line of text.split('\n')) {
        const w = line.trim();
        if (w) set.add(w);
      }
      return set;
    })();
  }
  return dictPromise;
}

/** Warm the dictionary before the first check (e.g. on editor mount). */
export function preloadLocal(): void {
  void getDictionary().catch(() => {
    // load failed — proofreadLocal will surface it; nothing to do here
  });
}

// Word tokens: letters with optional internal apostrophes / hyphens
// (so "don't", "o'clock", "e-commerce" stay whole). Curly quotes included.
const WORD_RE = /[A-Za-z]+(?:['’-][A-Za-z]+)*/g;

function normalize(raw: string): string {
  return raw.toLowerCase().replace(/’/g, "'");
}

function isKnown(dict: Set<string>, raw: string): boolean {
  const w = normalize(raw);
  if (dict.has(w)) return true;
  // possessive: "john's" -> "john"
  if (w.endsWith("'s") && dict.has(w.slice(0, -2))) return true;
  // hyphenated compound: known if every part is known ("gift-wrap")
  if (w.includes('-')) {
    const parts = w.split('-').filter(Boolean);
    if (parts.length > 1 && parts.every((p) => dict.has(p))) return true;
  }
  return false;
}

// Short all-caps tokens are almost always acronyms/initialisms (FAQ, USD, CTA),
// not misspellings — skip them to avoid noise.
function isLikelyAcronym(raw: string): boolean {
  return raw.length <= 4 && raw === raw.toUpperCase();
}

export async function proofreadLocal(text: string): Promise<Issue[]> {
  if (!text.trim()) return [];
  const dict = await getDictionary();
  const issues: Issue[] = [];
  for (const m of text.matchAll(WORD_RE)) {
    const raw = m[0];
    const start = m.index ?? 0;
    if (raw.length < 3) continue; // skip 1–2 letter tokens
    if (isLikelyAcronym(raw)) continue;
    if (isKnown(dict, raw)) continue;
    if (isInPersonalDictionary(raw)) continue;
    issues.push({
      start,
      end: start + raw.length,
      message: `“${raw}” may be misspelled`,
      kind: 'Spelling',
      problem: raw,
      suggestions: [], // Step 1 is detection only — no suggestions yet
    });
  }
  return issues;
}
