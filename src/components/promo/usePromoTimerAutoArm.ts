'use client';

import { useEffect, type MutableRefObject } from 'react';
import type { PromoSectionProps } from '@/components/promo/promoSectionProps';

interface UsePromoTimerAutoArmArgs {
  config: PromoSectionProps['config'];
  configRef: MutableRefObject<PromoSectionProps['config']>;
  setConfig: PromoSectionProps['setConfig'];
  markChanged: PromoSectionProps['markChanged'];
  blankStart: boolean;
  timerAutoArmed: boolean;
  onTimerAutoArmedChange: PromoSectionProps['onTimerAutoArmedChange'];
  onTimerAutoEnabled: PromoSectionProps['onTimerAutoEnabled'];
}

/**
 * A schedule is what makes a countdown mean something, so setting both dates
 * on a freshly cleared card turns the timer on.
 *
 * It starts off after a clear because a countdown with no dates behind it is
 * a number nobody can act on. Once the dates exist the timer has something
 * to count to, and switching it on is what the user was going to do next
 * anyway.
 *
 * Only while blank-starting: on any other card the toggle is the user's, and
 * flipping it under them because they edited a date would be the app
 * overruling a choice they already made.
 *
 * Moved out of PromoSection verbatim; called where the effect was declared so
 * effect order is unchanged.
 */
export function usePromoTimerAutoArm({
  config,
  configRef,
  setConfig,
  markChanged,
  blankStart,
  timerAutoArmed,
  onTimerAutoArmedChange,
  onTimerAutoEnabled,
}: UsePromoTimerAutoArmArgs) {
  useEffect(() => {
    if (!blankStart || !timerAutoArmed) return;
    const { startDate, endDate, showTimer } = config.promoCard;
    if (showTimer || !startDate || !endDate) return;
    // Fires once. Turning the countdown back off by hand afterwards is a
    // decision, and re-arming would overrule it on the next date edit.
    onTimerAutoArmedChange(false);
    setConfig({
      ...configRef.current,
      promoCard: { ...configRef.current.promoCard, showTimer: true },
    });
    markChanged();
    onTimerAutoEnabled?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blankStart, timerAutoArmed, config.promoCard.startDate, config.promoCard.endDate]);
}
