// Offline spelling + grammar checking via harper.js (WASM). The ~17MB binary
// loads lazily on first use and runs entirely on-device.

import { isInPersonalDictionary } from './engine';

export interface Suggestion {
  text: string; // '' for a Remove suggestion
  kind: string; // 'Replace' | 'Remove' | 'InsertAfter'
}

export interface Issue {
  start: number;
  end: number;
  message: string;
  kind: string; // LintKind, e.g. 'Spelling' | 'Grammar' | 'WordChoice'
  problem: string; // flagged substring; used to detect stale offsets on replace
  suggestions: Suggestion[];
}

interface HarperLinter {
  setup(): Promise<void>;
  lint(text: string): Promise<HarperLint[]>;
  setLintConfig(config: Record<string, boolean | null>): Promise<void>;
}
interface HarperLint {
  span(): { start: number; end: number };
  message(): string;
  lint_kind(): string;
  get_problem_text(): string;
  suggestions(): HarperSuggestion[];
}
interface HarperSuggestion {
  get_replacement_text(): string;
  kind(): string;
}

const SPELLING_KINDS = new Set(['Spelling', 'Typo']);

// Marketing copy is headlines and fragments, so sentence-case and run-on rules
// are noise. Everything else stays on.
const DISABLED_RULES: Record<string, boolean> = {
  SentenceCapitalization: false,
  LongSentences: false,
};

let linterPromise: Promise<HarperLinter> | null = null;

async function getLinter(): Promise<HarperLinter> {
  if (!linterPromise) {
    linterPromise = (async () => {
      const [{ LocalLinter }, { binaryInlined }] = await Promise.all([
        import('harper.js'),
        import('harper.js/binaryInlined'),
      ]);
      const linter = new LocalLinter({ binary: binaryInlined }) as unknown as HarperLinter;
      await linter.setup();
      await linter.setLintConfig(DISABLED_RULES);
      return linter;
    })();
  }
  return linterPromise;
}

/** Warm the engine before the first lint (e.g. on editor mount). */
export function preloadProofreader(): void {
  void getLinter();
}

export async function proofread(text: string): Promise<Issue[]> {
  if (!text.trim()) return [];
  const linter = await getLinter();
  const lints = await linter.lint(text);
  const issues: Issue[] = [];
  for (const lint of lints) {
    const kind = lint.lint_kind();
    const problem = lint.get_problem_text();
    if (SPELLING_KINDS.has(kind) && isInPersonalDictionary(problem)) continue;
    const span = lint.span();
    issues.push({
      start: span.start,
      end: span.end,
      message: lint.message(),
      kind,
      problem,
      suggestions: lint.suggestions().map((s) => ({
        text: s.get_replacement_text(),
        kind: s.kind(),
      })),
    });
  }
  return issues;
}

export function isSpellingKind(kind: string): boolean {
  return SPELLING_KINDS.has(kind);
}
