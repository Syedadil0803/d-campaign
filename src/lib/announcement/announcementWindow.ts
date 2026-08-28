import type { CampaignConfig } from '@/types/campaign';

type Announcement = CampaignConfig['announcementBar']['announcements'][number];

/**
 * Is this message inside its scheduled run, today?
 *
 * A missing start means "since always" and a missing end means "until
 * forever", so a message with neither is always in window. Both ends are
 * widened to cover the whole local day — a campaign ending today runs to the
 * end of today, not to midnight at its start.
 *
 * This existed twice, identically: once in AnnouncementSection for the editor
 * preview and once in AnnouncementBarPreview for the dashboard. They agreed,
 * which is luck rather than design — the editor and the dashboard disagreeing
 * about which messages are live is the kind of fault this file exists to make
 * impossible.
 */
export function isAnnouncementInWindow(startDate?: string, endDate?: string): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  /**
   * Each end is checked only if it was set, rather than substituted with a
   * sentinel date and compared anyway.
   *
   * The sentinel was what broke it. "Forever" was new Date(8640000000000000),
   * the largest date JavaScript can hold — and the next line widened it to the
   * end of its day, which overflowed it to Invalid Date. Every comparison
   * against Invalid Date is false, so a message with a start and no end never
   * appeared at all, when it was set to run indefinitely.
   *
   * Not checking an absent bound says the same thing and cannot overflow.
   */
  if (startDate) {
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    if (today < start) return false;
  }
  if (endDate) {
    const end = new Date(endDate);
    // The whole of the last day: a campaign ending today runs until tonight.
    end.setHours(23, 59, 59, 999);
    if (today > end) return false;
  }
  return true;
}

/** The messages that would show on the site right now. */
export function visibleAnnouncements(announcements: Announcement[]): Announcement[] {
  return announcements.filter((a) => isAnnouncementInWindow(a.startDate, a.endDate));
}
