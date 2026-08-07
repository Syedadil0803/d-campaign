// Lints a contentEditable's text with our in-house spell checker and returns the
// issues (with char offsets into textContent) for an overlay to draw — never
// touching the editor DOM itself. Debounced on input; results feed
// SpellCheckOverlay.

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import { proofreadLocal, preloadLocal } from '@/lib/spellcheck/localSpellcheck';
import type { Issue } from '@/lib/spellcheck/types';

export type { Issue } from '@/lib/spellcheck/types';

export function useSpellCheck(
  ref: RefObject<HTMLElement | null>,
  enabled: boolean,
): { issues: Issue[]; rescan: () => void } {
  const [issues, setIssues] = useState<Issue[]>([]);
  // Drop out-of-order async results.
  const runIdRef = useRef(0);

  const scan = useCallback(() => {
    const el = ref.current;
    if (!enabled || !el) {
      setIssues([]);
      return;
    }
    const text = el.textContent ?? '';
    const runId = ++runIdRef.current;
    proofreadLocal(text)
      .then((result) => {
        if (runId === runIdRef.current) setIssues(result);
      })
      .catch(() => {
        // dictionary failed to load — no squiggles, fail silently
      });
  }, [ref, enabled]);

  // Warm the dictionary on mount so it's ready before the first keystroke.
  useEffect(() => {
    if (!enabled) {
      setIssues([]);
      return;
    }
    preloadLocal();
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
