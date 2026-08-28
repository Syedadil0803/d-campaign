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
  if (!startDate && !endDate) return true;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = startDate ? new Date(startDate) : new Date(0);
  start.setHours(0, 0, 0, 0);
  const end = endDate ? new Date(endDate) : new Date(8640000000000000);
  end.setHours(23, 59, 59, 999);
  return today >= start && today <= end;
}

/** The messages that would show on the site right now. */
export function visibleAnnouncements(announcements: Announcement[]): Announcement[] {
  return announcements.filter((a) => isAnnouncementInWindow(a.startDate, a.endDate));
}
