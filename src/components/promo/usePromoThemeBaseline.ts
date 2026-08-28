'use client';

import { useEffect, useRef, useState } from 'react';
import type { PromoCard } from '@/types/campaign';
import { lookSignature } from '@/lib/promo/lookSignature';

interface UsePromoThemeBaselineArgs {
  /** The card's current look. */
  style: PromoCard['style'];
  canvasIsEmpty: boolean;
  /** Every look the app hands out — templates, the default, the blank palettes. */
  ourLooks: string[];
  toast: (message: string, isError?: boolean, action?: { label: string; onClick: () => void }, durationMs?: number) => void;
}

/**
 * The design the user chose, kept apart from the themes they are trying on.
 *
 * The Themes strip shows their own look as its first swatch, so trying a theme
 * and coming back is one click. That only works if something remembers what
 * "their own" was, and remembers it by watching the style itself rather than
 * by being told at each of the five places a card can land — a list of call
 * sites misses the route nobody thought of, and this one did: applying an AI
 * palette was not on it, so the swatch pointed at the look from before the AI
 * and quietly undid it.
 */
export function usePromoThemeBaseline({
  style,
  canvasIsEmpty,
  ourLooks,
  toast,
}: UsePromoThemeBaselineArgs) {
  const [themeBaseline, setThemeBaseline] = useState<PromoCard['style']>(() => style);

  /**
   * Set for the one action that must NOT move the baseline: sampling a theme.
   * The revert swatch sets it too — landing back on your own design shouldn't
   * re-record it.
   */
  const samplingThemeRef = useRef(false);
  const ownSwatchWasVisibleRef = useRef<boolean | null>(null);

  useEffect(() => {
    if (samplingThemeRef.current) {
      samplingThemeRef.current = false;
      return;
    }
    setThemeBaseline(style);
  }, [style]);

  /**
   * True when the card is wearing the design you chose rather than a theme you
   * are trying. It decides which single swatch in the Themes strip is marked.
   */
  const onOwnDesign = JSON.stringify(themeBaseline) === JSON.stringify(style);

  const baselineIsATheme = ourLooks.includes(lookSignature(themeBaseline));
  const hasCurrentDesign = !canvasIsEmpty && !baselineIsATheme;

  /**
   * Say where the design went, the moment it becomes a swatch.
   *
   * The line under the themes row explains the same thing and stays put, but
   * it only helps someone already looking there. The toast is what tells a
   * user who is watching the card that their design was kept rather than
   * overwritten.
   */
  useEffect(() => {
    const wasVisible = ownSwatchWasVisibleRef.current;
    ownSwatchWasVisibleRef.current = hasCurrentDesign;
    // First render only records the state; it has not appeared, it just is.
    if (wasVisible === null) return;
    if (!wasVisible && hasCurrentDesign) {
      toast(
        'Your design is saved as the first swatch — tap it to come back',
        false,
        undefined,
        // Longer than the default: this asks the user to go and find
        // something, and three seconds is gone before the eye has left the
        // toast to look for it.
        8000,
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasCurrentDesign, toast]);

  return {
    themeBaseline,
    setThemeBaseline,
    samplingThemeRef,
    onOwnDesign,
    baselineIsATheme,
    hasCurrentDesign,
  };
}
