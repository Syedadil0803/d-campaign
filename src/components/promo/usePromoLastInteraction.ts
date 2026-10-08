'use client';

import { useEffect, useRef } from 'react';

/**
 * When the user last did something — a pointer press or a key.
 *
 * Focus alone does not mean intent. The browser restores focus to whatever
 * held it when a native dialog closes, so dismissing the "Leave site?" prompt
 * put the cursor back in the title and opened its style panel, as though the
 * user had clicked into it. A real click or Tab always has an interaction
 * immediately before the focus; a restored one has none.
 *
 * Moved out of PromoSection whole; called at the spot the effect was declared
 * so the editor's effects still run in the same order.
 */
export function usePromoLastInteraction() {
  const lastInteractionAtRef = useRef(0);

  useEffect(() => {
    const mark = () => {
      lastInteractionAtRef.current = Date.now();
    };
    document.addEventListener('pointerdown', mark, true);
    document.addEventListener('keydown', mark, true);
    return () => {
      document.removeEventListener('pointerdown', mark, true);
      document.removeEventListener('keydown', mark, true);
    };
  }, []);

  return lastInteractionAtRef;
}
