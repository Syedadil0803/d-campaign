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

/**
 * How a message's schedule reads in the list, so the editor can badge it.
 *
 * Two independent facts decide the badge — when it runs, and whether it ends —
 * so the five states are every combination worth marking:
 *
 *   none              — no dates, or a bounded run already past
 *   current           — live now, set to end (a bounded run)
 *   future            — starts on a later day, set to end
 *   openEndedCurrent  — live now, a start but no end, so it runs until stopped
 *   openEndedFuture   — starts on a later day, then runs until stopped
 *
 * ── Badge standard (the reason behind each mark, not just the mark) ──
 *
 * One glyph per row, read as COLOUR + SHAPE. It is a traffic light for the two
 * questions a user asks of the list: is this on air, and does it ever stop?
 *
 *   COLOUR answers "is it on air right now?" — the traffic-light half:
 *     emerald (green) = LIVE NOW, showing on the site.  Green = go / on.
 *     amber           = QUEUED, starts on a later day.   Amber = wait, not yet.
 *   A live row also carries an emerald ring on the whole pill, so the list can
 *   be scanned for what is on air without reading a single icon.
 *
 *   SHAPE answers "does it ever end?":
 *     ∞  infinity     = never ends, runs until switched off.
 *     ▤  calendar/clock = it has a bound — a clock while it waits to start,
 *                         a calendar-check once it is live and ending on a date.
 *
 * The two compose, so no row ever needs two icons:
 *   current           emerald calendar-check + ring
 *   future            amber clock
 *   openEndedCurrent  emerald infinity + ring
 *   openEndedFuture   amber infinity          ← colour carries "starts later",
 *                                               so it stays one glyph, not clock+∞
 *   none              (no glyph, no ring)
 *
 * Derived from the same window rule above, so the badge and what actually shows
 * on the site can never disagree.
 */
export type AnnouncementScheduleState =
  | 'none'
  | 'current'
  | 'future'
  | 'openEndedCurrent'
  | 'openEndedFuture';

export function announcementScheduleState(
  startDate?: string,
  endDate?: string,
): AnnouncementScheduleState {
  if (!startDate && !endDate) return 'none'; // nothing to mark

  if (startDate) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    // Not showing yet — split by whether it will ever end.
    if (today < start) return endDate ? 'future' : 'openEndedFuture';
  }
  if (!isAnnouncementInWindow(startDate, endDate)) return 'none'; // a bounded run already past
  if (endDate) return 'current'; // live now, ends on its date
  return 'openEndedCurrent'; // a start that has arrived, no end → runs on
}
