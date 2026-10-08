'use client';

import { useMemo, type RefObject } from 'react';
import {
  buildTimerDisplayHtml,
  calculateTimeRemaining as calcTimerRemaining,
} from '@/lib/editor/timerUtils';
import type { LexicalTimerFieldHandle } from '@/components/timer-lexical/LexicalTimerField';
import { getRequiredCardWidth } from '@/lib/promo/promoMeasure';
import {
  TIMER_MIN_CONTENT_WIDTH,
  TIMER_MAX_CONTENT_WIDTH,
} from '@/components/timer-lexical/lineMeasure';
import type { PromoSectionProps } from '@/components/promo/promoSectionProps';

interface UsePromoTimerFitArgs {
  config: PromoSectionProps['config'];
  lexicalTimerRef: RefObject<LexicalTimerFieldHandle | null>;
}

/**
 * How wide the card has to be, and whether the timer still fits on one line.
 *
 * Both measure the same thing — the card's text and its countdown against the
 * 400/440 card widths — so they move out of PromoSection together. Called at
 * the spot the memo was declared, so hook order is unchanged.
 */
export function usePromoTimerFit({ config, lexicalTimerRef }: UsePromoTimerFitArgs) {
  // Dynamic card width across the text fields AND the timer. The timer drives
  // the 400→440 stretch too: if it wraps at the narrow card's content width
  // (344) it needs the wide card. Measured on the live editor at a fixed
  // width, so it's independent of the current card width (no race).
  function computeCardWidth(promo: typeof config.promoCard): number {
    const base = getRequiredCardWidth([
      { html: promo.title || "", field: "title" },
      { html: promo.subtitle || "", field: "subtitle" },
      { html: promo.description || "", field: "description" },
    ]);
    if (base >= 440) return base;
    if (lexicalTimerRef.current?.wrapsAtContentWidth(TIMER_MIN_CONTENT_WIDTH)) {
      return 440;
    }
    return base;
  }

  // True when the timer — measured with its CURRENT countdown — can't fit one
  // line at the widest card. Drives the persistent "Field limit reached" note
  // (like the title's). NOTE: the rendered countdown WIDENS at rollovers
  // ("2 days : 1 hours : 0 mins" → "1 days : 23 hours : 59 mins"), so the
  // memo must also key on the countdown's current digits — they change at
  // most once a minute, so the ghost-measure (a forced layout) runs per
  // digit-change/edit, never per second. buildTimerDisplayHtml keeps the
  // user's style spans so this measures what the card actually renders.
  const timerRemaining = calcTimerRemaining(config.promoCard.endDate || '');
  const timerLimitReached = useMemo(() => {
    if (typeof document === 'undefined') return false;
    if (!config.promoCard.showTimer) return false;
    const tmpl = config.promoCard.timerText || '';
    // Ignore an empty timer (no prefix/suffix around the countdown token).
    const hasPrefixSuffix =
      tmpl
        .replace(/<[^>]*>/g, '')
        .replace(/\{timer\}/gi, '')
        .replace(/&nbsp;|​/g, '')
        .trim().length > 0;
    if (!hasPrefixSuffix) return false;
    const ghost = document.createElement('div');
    ghost.style.cssText =
      'position:absolute;visibility:hidden;white-space:pre;font-size:16px;line-height:24px;letter-spacing:normal;' +
      'font-family:-apple-system, BlinkMacSystemFont, system-ui, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;';
    ghost.innerHTML = buildTimerDisplayHtml(tmpl, timerRemaining);
    document.body.appendChild(ghost);
    const textW = ghost.getBoundingClientRect().width;
    document.body.removeChild(ghost);
    return textW > TIMER_MAX_CONTENT_WIDTH;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    config.promoCard.showTimer,
    config.promoCard.timerText,
    timerRemaining.days,
    timerRemaining.hours,
    timerRemaining.minutes,
  ]);

  return { computeCardWidth, timerLimitReached };
}
