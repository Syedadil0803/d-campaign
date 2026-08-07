// Shared types + helper for the spell-check pipeline, kept engine-agnostic so the
// hook and overlay don't depend on any particular checker implementation.

export interface Suggestion {
  text: string; // '' for a Remove suggestion
  kind: string; // 'Replace' | 'Remove' | 'InsertAfter'
}

export interface Issue {
  start: number;
  end: number;
  message: string;
  kind: string; // e.g. 'Spelling' | 'Grammar' | 'WordChoice'
  problem: string; // flagged substring; used to detect stale offsets on replace
  suggestions: Suggestion[];
}

const SPELLING_KINDS = new Set(['Spelling', 'Typo']);

export function isSpellingKind(kind: string): boolean {
  return SPELLING_KINDS.has(kind);
}
