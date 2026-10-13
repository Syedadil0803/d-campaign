import type { CampaignSchedule } from '@/types/campaign';
import { toLocalISODate } from '@/lib/utils';
import { shortDay } from '@/lib/calendarDates';
import { isInvalidRange } from '@/lib/dateRange';

/**
 * Which kind of schedule a widget is on — the card's or the Video Story's.
 *
 * One question asked in one place, so nothing has to infer open-ended from an
 * empty end date — which is a different situation entirely: a range campaign
 * nobody finished scheduling.
 */

/** Runs from its start date until someone stops it. No end, no countdown. */
export const isOpenEnded = (card: Pick<CampaignSchedule, 'scheduleMode'>): boolean =>
  card.scheduleMode === 'openEnded';

/** True once the card has the dates its own schedule needs. */
export const hasCompleteSchedule = (
  card: Pick<CampaignSchedule, 'scheduleMode' | 'startDate' | 'endDate'>,
): boolean => Boolean(card.startDate) && (isOpenEnded(card) || Boolean(card.endDate));


/**
 * What to say about a schedule before it goes live — the card's and the Video
 * Story's. Written twice before, the two copies had already drifted: only the
 * Video Story caught a start date after its end date.
 *
 * `describe` adds the card's plain-language "will run from … to …" line. The
 * Video Story leaves it off; its schedule is on screen beside the publish
 * button already.
 *
 * Dates compare against a local "today", not UTC: east of Greenwich a UTC
 * today is still yesterday for the first hours of the day, which would flag a
 * campaign ending today as already over.
 */
export function scheduleWarnings(
  s: Pick<CampaignSchedule, 'scheduleMode' | 'startDate' | 'endDate'>,
  { describe = false }: { describe?: boolean } = {},
): string[] {
  const today = toLocalISODate(new Date());
  if (isOpenEnded(s)) {
    // No end to reach, so the only question is whether it has started.
    if (!s.startDate) return ['Start date is not set'];
    if (!describe) return [];
    return s.startDate <= today
      ? [`Campaign will run from ${shortDay(s.startDate)} until you stop it (starts immediately)`]
      : [`Campaign is scheduled from ${shortDay(s.startDate)} until you stop it`];
  }
  if (!s.startDate || !s.endDate) return ['Start date or end date is not set'];

  const warnings: string[] = [];
  const past = s.endDate < today;
  const backwards = isInvalidRange(s.startDate, s.endDate);
  if (past) warnings.push('End date is in the past');
  if (backwards) warnings.push('Start date is after end date');
  // A summary of a range that is over or back to front would describe a
  // campaign that cannot run, so it only accompanies a valid one.
  if (describe && !past && !backwards) {
    warnings.push(
      s.startDate <= today
        ? `Campaign will run from ${shortDay(s.startDate)} – ${shortDay(s.endDate)} (starts immediately)`
        : `Campaign is scheduled for ${shortDay(s.startDate)} – ${shortDay(s.endDate)}`,
    );
  }
  return warnings;
}
