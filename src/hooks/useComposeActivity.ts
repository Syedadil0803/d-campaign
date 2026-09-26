'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * "Is the user in the middle of composing?"
 *
 * The preview's marquee slides the text along, which is unreadable while you
 * are working on it — you resize a word and it has already scrolled away. So
 * every edit holds the motion still, and it resumes once the user stops.
 *
 * Deliberately a single signal rather than a hook per action. Typing, resizing,
 * bold, italic, colour, the link and the dates all end in the same place: what
 * the preview renders changes. Watching that one thing covers every editing
 * action there is, including ones added later, and there is no list of call
 * sites to keep in step.
 */
export function useComposeActivity(idleMs = 1500) {
  const [active, setActive] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const signal = useCallback(() => {
    setActive(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setActive(false), idleMs);
  }, [idleMs]);

  // A pending timer would otherwise call setActive on an unmounted component
  // when the user switches tabs mid-sentence.
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  return { active, signal };
}
