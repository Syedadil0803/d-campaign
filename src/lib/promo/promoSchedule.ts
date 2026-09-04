import type { PromoCard } from '@/types/campaign';

/**
 * Which kind of schedule a card is on.
 *
 * One question asked in one place, so nothing has to infer open-ended from an
 * empty end date — which is a different situation entirely: a range campaign
 * nobody finished scheduling.
 */

/** Runs from its start date until someone stops it. No end, no countdown. */
export const isOpenEnded = (card: Pick<PromoCard, 'scheduleMode'>): boolean =>
  card.scheduleMode === 'openEnded';

/** True once the card has the dates its own schedule needs. */
export const hasCompleteSchedule = (
  card: Pick<PromoCard, 'scheduleMode' | 'startDate' | 'endDate'>,
): boolean => Boolean(card.startDate) && (isOpenEnded(card) || Boolean(card.endDate));

/** A countdown needs an end to count towards, so it belongs to ranges alone. */
export const canShowTimer = (card: Pick<PromoCard, 'scheduleMode'>): boolean => !isOpenEnded(card);
