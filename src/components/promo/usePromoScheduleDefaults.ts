'use client';

import { useEffect } from 'react';
import { isBlankLook } from '@/lib/promo/lookSignature';
import { getISODateWithOffset } from '@/lib/utils';
import type { PromoSectionProps } from '@/components/promo/promoSectionProps';

interface UsePromoScheduleDefaultsArgs {
  config: PromoSectionProps['config'];
  setConfig: PromoSectionProps['setConfig'];
  blankStart: boolean;
}

/**
 * Fill in a missing schedule — except on a canvas the user just cleared.
 *
 * This exists so a card that arrives without dates still has a valid range.
 * But it watches the whole config, so it also fired the instant Clear
 * emptied the end date and wrote a new one straight back — which completed
 * the schedule, which switched the countdown on. Three separate fixes to
 * clearing the dates were all undone here, one render later.
 *
 * A blank start is the one case where an empty end date is the point: it is
 * the decision being asked for, and the thing the countdown waits on.
 *
 * Moved out of PromoSection verbatim; called where the effect was declared so
 * effect order is unchanged.
 */
export function usePromoScheduleDefaults({
  config,
  setConfig,
  blankStart,
}: UsePromoScheduleDefaultsArgs) {
  useEffect(() => {
    /**
     * The prop cannot be trusted on the first render after a load.
     *
     * `blankStart` is decided in page.tsx and arrives here as a prop, so on the
     * commit where a card is loaded this effect can still see `false` while the
     * card on screen is plainly blank. It then filled in an end date, which
     * completed the schedule, which armed the countdown — and a blank canvas
     * came back from a login with a timer running.
     *
     * Asking the card directly removes the timing from the question: a card
     * with no words wearing a blank palette is a blank start, whatever the
     * prop currently says.
     */
    const plain = (html?: string) => String(html ?? '').replace(/<[^>]*>/g, '').trim();
    const looksBlank =
      isBlankLook(config.promoCard.style) &&
      !plain(config.promoCard.title) &&
      !plain(config.promoCard.subtitle) &&
      !plain(config.promoCard.description) &&
      !plain(config.promoCard.buttonText);

    if (blankStart || looksBlank) return;
    if (config.promoCard.startDate && config.promoCard.endDate) return;
    setConfig({
      ...config,
      promoCard: {
        ...config.promoCard,
        startDate: config.promoCard.startDate || getISODateWithOffset(0),
        endDate: config.promoCard.endDate || getISODateWithOffset(3),
      },
    });
  }, [config, setConfig, blankStart]);
}
