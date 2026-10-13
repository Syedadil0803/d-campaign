import type { CampaignConfig } from '@/types/campaign';

const isDue = (startDate: string | undefined, today: string) =>
  Boolean(startDate) && startDate! <= today;

/**
 * What the live config becomes when a scheduled campaign goes up, or null when
 * it is not due yet.
 *
 * Each widget the row carries is checked against its own start date, and only
 * the widgets are copied — the live announcement bar, and the live Video Story
 * when the row carries none, stay as they are. Copying the whole row used to
 * put back whatever announcement bar happened to be live when it was scheduled.
 *
 * ponytail: a row carrying both widgets waits until BOTH are due, so neither is
 * ever dropped by deleting the row early. Nothing schedules a Video Story yet;
 * if that ever needs per-widget timing, give each widget its own scheduled row.
 */
export function mergeScheduled(
  live: CampaignConfig | null,
  scheduled: CampaignConfig,
  today: string,
): CampaignConfig | null {
  if (!isDue(scheduled.promoCard?.startDate, today)) return null;
  if (scheduled.videoStory && !isDue(scheduled.videoStory.startDate, today)) return null;
  // No live row to merge into: the scheduled one is all there is.
  if (!live) return scheduled;
  return {
    ...live,
    promoCard: scheduled.promoCard,
    videoStory: scheduled.videoStory ?? live.videoStory,
    lastUpdated: scheduled.lastUpdated,
  };
}
