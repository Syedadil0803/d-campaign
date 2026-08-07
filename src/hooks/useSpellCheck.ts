// Lints a contentEditable's text with Harper and returns the issues (with char
// offsets into textContent) for an overlay to draw — never touching the editor
// DOM itself. Debounced on input; results feed SpellCheckOverlay.

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import { proofread, preloadProofreader, type Issue } from '@/lib/spellcheck/harper';
import { proofreadLocal, preloadLocal } from '@/lib/spellcheck/localSpellcheck';

export type { Issue } from '@/lib/spellcheck/harper';

// Which engine runs the check:
//   'harper' (default) — the Harper WASM library (spelling + grammar + suggestions)
//   'local'            — our in-house Step 1 (spelling detection + underline only)
// Chosen by NEXT_PUBLIC_SPELLCHECK_ENGINE at build time, overridable at runtime
// with localStorage['campaign-spellcheck-engine'] = 'local' | 'harper' (no restart).
type Engine = 'harper' | 'local';

function resolveEngine(): Engine {
  if (typeof window !== 'undefined') {
    const ls = window.localStorage.getItem('campaign-spellcheck-engine');
    if (ls === 'local' || ls === 'harper') return ls;
  }
  return process.env.NEXT_PUBLIC_SPELLCHECK_ENGINE === 'local' ? 'local' : 'harper';
}

export function useSpellCheck(
  ref: RefObject<HTMLElement | null>,
  enabled: boolean,
): { issues: Issue[]; rescan: () => void } {
  const [issues, setIssues] = useState<Issue[]>([]);
  // Drop out-of-order async lint results.
  const runIdRef = useRef(0);
  const engineRef = useRef<Engine>('harper');

  const scan = useCallback(() => {
    const el = ref.current;
    if (!enabled || !el) {
      setIssues([]);
      return;
    }
    const text = el.textContent ?? '';
    const runId = ++runIdRef.current;
    const check = engineRef.current === 'local' ? proofreadLocal : proofread;
    check(text)
      .then((result) => {
        if (runId === runIdRef.current) setIssues(result);
      })
      .catch(() => {
        // engine failed to load — no squiggles, fail silently
      });
  }, [ref, enabled]);

  // Warm the engine on mount so it's ready before the first keystroke.
  useEffect(() => {
    if (!enabled) {
      setIssues([]);
      return;
    }
    engineRef.current = resolveEngine();
    if (engineRef.current === 'local') preloadLocal();
    else preloadProofreader();
    scan();
  }, [enabled, scan]);

  useEffect(() => {
    const el = ref.current;
    if (!enabled || !el) return;
    let t: ReturnType<typeof setTimeout>;
    const onInput = () => {
      clearTimeout(t);
      t = setTimeout(scan, 400);
    };
    el.addEventListener('input', onInput);
    return () => {
      clearTimeout(t);
      el.removeEventListener('input', onInput);
    };
  }, [ref, enabled, scan]);

  return { issues, rescan: scan };
}
