/**
 * How the Manage Announcements list sorts and labels its rows.
 *
 * Kept out of the component so the rules can be tested without a DOM, and so
 * the list and the website can never disagree about whether a message is on
 * air: both go through `isAnnouncementInWindow`.
 */

import type { Announcement } from '@/types/campaign';
import { isAnnouncementInWindow } from '@/lib/announcement/announcementWindow';
import { formatDay, startsLater } from '@/lib/announcement/stagedDraft';

/**
 * 'active'    on air now — including a message with no dates, which is always on
 * 'scheduled' dated to begin after today
 * 'ended'     its end date has passed; still in the list, no longer on the site
 *
 * The old list asked `announcementScheduleState`, which calls both an undated
 * message and an expired one 'none' — so an always-on message fell into
 * neither section and vanished from the list.
 */
export type RowState = 'active' | 'scheduled' | 'ended';

export function rowState(message: Announcement): RowState {
  if (startsLater(message.startDate)) return 'scheduled';
  if (!isAnnouncementInWindow(message.startDate, message.endDate)) return 'ended';
  return 'active';
}

export interface ListRow {
  message: Announcement;
  /** Position in the stored array — what reorder, edit and delete act on. */
  index: number;
  state: RowState;
}

/**
 * Splits the list into the two sections the panel shows.
 *
 * Active rows keep their stored order, because that order IS the rotation the
 * website plays; ended ones stay among them, badged, where the user put them.
 * Scheduled rows sort by start date, earliest first — their order is decided
 * by the calendar, not by dragging.
 */
export function groupRows(announcements: Announcement[]): {
  active: ListRow[];
  scheduled: ListRow[];
} {
  const rows = announcements.map((message, index) => ({
    message,
    index,
    state: rowState(message),
  }));
  const active = rows.filter((row) => row.state !== 'scheduled');
  const scheduled = rows
    .filter((row) => row.state === 'scheduled')
    .sort((a, b) => startTime(a.message) - startTime(b.message));
  return { active, scheduled };
}

/** At most this many messages can be waiting to start at once. */
export const SCHEDULE_LIMIT = 3;

export const SCHEDULE_LIMIT_MESSAGE =
  'You can schedule up to 3 messages. Delete one, or wait for one to start, to free a slot.';

/**
 * Whether one more message can be scheduled.
 *
 * `editingIndex` is the row being edited, if any. A scheduled message being
 * edited already holds its slot, so it is left out of the count — otherwise
 * editing one of three scheduled messages would be refused as a fourth.
 */
export function canSchedule(announcements: Announcement[], editingIndex: number | null): boolean {
  const used = announcements.filter(
    (message, index) => index !== editingIndex && rowState(message) === 'scheduled',
  ).length;
  return used < SCHEDULE_LIMIT;
}

function startTime(message: Announcement): number {
  const time = message.startDate ? new Date(message.startDate).getTime() : 0;
  return Number.isNaN(time) ? 0 : time;
}

function isToday(iso: string): boolean {
  const date = new Date(iso);
  const now = new Date();
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
}

function dayLabel(iso: string): string {
  return isToday(iso) ? 'Today' : formatDay(iso);
}

/**
 * The short timing string beside a row's badge. Empty for a message with no
 * dates: it simply runs, and the Live badge already says so.
 */
export function rowTiming(message: Announcement, state: RowState): string {
  const { startDate, endDate } = message;
  if (!startDate && !endDate) return '';

  if (state === 'ended') return endDate ? `Ended ${formatDay(endDate)}` : 'Ended';

  if (state === 'scheduled') {
    return endDate
      ? `${formatDay(startDate!)} → ${formatDay(endDate)}`
      : `Starts ${formatDay(startDate!)}`;
  }

  if (startDate && endDate) return `${dayLabel(startDate)} → ${formatDay(endDate)}`;
  // Open-ended is a choice, so it reads as one — not as a missing end date.
  if (startDate) return `From ${dayLabel(startDate)} onwards`;
  return `Until ${formatDay(endDate!)}`;
}
