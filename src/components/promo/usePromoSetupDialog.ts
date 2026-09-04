'use client';

import { useCallback, useState } from 'react';
import { getISODateWithOffset } from '@/lib/utils';
import type { CampaignConfig, PromoCard } from '@/types/campaign';

/** The answer the setup dialog collects before a card is edited. */
export type ScheduleAnswer = {
  scheduleMode: NonNullable<PromoCard['scheduleMode']>;
  startDate: string;
  endDate: string;
};

/**
 * State for "Set up your campaign".
 *
 * The dialog sets its answer and continues in the same tick, so the answer is
 * handed to the caller rather than read back from here — see `open`/`edit`.
 */
export function usePromoSetupDialog(cardNow: () => CampaignConfig['promoCard']) {
  const [intent, setIntent] = useState<'new' | 'schedule'>('new');
  const [visible, setVisible] = useState(false);
  const [mode, setMode] = useState<ScheduleAnswer['scheduleMode']>('range');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  /** A brand-new campaign: nothing carried over from the last one. */
  const openForNewCard = useCallback(() => {
    setIntent('new');
    setMode('range');
    setStartDate(getISODateWithOffset(0));
    setEndDate('');
    setVisible(true);
  }, []);

  /** The card on screen, to change or complete its schedule. */
  const openForCard = useCallback(() => {
    const card = cardNow();
    setIntent('schedule');
    setMode(card.scheduleMode ?? 'range');
    setStartDate(card.startDate || getISODateWithOffset(0));
    setEndDate(card.endDate || '');
    setVisible(true);
  }, [cardNow]);

  /** What the dialog holds now, for a caller that was given no answer. */
  const current = (): ScheduleAnswer => ({ scheduleMode: mode, startDate, endDate });

  return {
    intent,
    visible,
    setVisible,
    mode,
    setMode,
    startDate,
    setStartDate,
    endDate,
    setEndDate,
    openForNewCard,
    openForCard,
    current,
  };
}
