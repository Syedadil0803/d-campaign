/**
 * The staged-draft flow.
 *
 * One message at a time is "staged": written to the draft config, shown in the
 * preview, and held in a chip until the user publishes or discards it. Nothing
 * reaches the Manage Announcements list until Publish.
 *
 * Kept here rather than in the editor component so the rules are testable
 * without a DOM, and so the two oversized announcement files don't grow.
 */

import type { Announcement } from '@/types/campaign';
import { shortDay } from '@/lib/calendarDates';
import { isAnnouncementInWindow } from '@/lib/announcement/announcementWindow';

/**
 * True when a message is dated to begin after today.
 *
 * Compared in local time, on purpose. Reading today from `toISOString()` gives
 * UTC's date, which for anyone east of Greenwich is still yesterday during the
 * early hours — a message dated today would then read as scheduled, and the
 * editor would offer to schedule something meant to go out now.
 */
export function startsLater(startDate?: string): boolean {
  if (!startDate) return false;
  const start = new Date(startDate);
  if (Number.isNaN(start.getTime())) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  start.setHours(0, 0, 0, 0);
  return start.getTime() > today.getTime();
}

/** True when a rich-text editor's HTML carries actual words, not just markup. */
export function hasVisibleText(html: string): boolean {
  return html.replace(/<[^>]*>/g, '').replace(/​/g, '').trim().length > 0;
}

/**
 * The messages the preview bar should show.
 *
 * `pending` is whatever the user is working on — the staged message, or the
 * text still being typed. It joins the published ones only while its own
 * schedule says it would be on air now, so a future-dated message stays out of
 * the preview until its start date, exactly as it would on the website.
 *
 * The pending message's HTML is passed through untouched: the preview renders
 * it as markup, so stripping it here would show unstyled text that then
 * changed appearance on publish.
 */
export function previewMessages(
  visible: Announcement[],
  pending: Announcement | null | undefined,
  /** Where it will be published, 1 = top (newest first, the default). */
  position = 1,
): Announcement[] {
  if (!pending || !hasVisibleText(pending.text)) return visible;
  if (!isAnnouncementInWindow(pending.startDate, pending.endDate)) return visible;
  const at = Math.min(Math.max(position, 1), visible.length + 1) - 1;
  return [...visible.slice(0, at), pending, ...visible.slice(at)];
}

/**
 * The whole preview list, given everything the editor knows.
 *
 * Three cases, in order: a staged message joins the published ones; text being
 * typed for a row that is already published REPLACES that row, so the preview
 * shows the edit rather than the message twice; anything else being typed joins
 * the end as a new message.
 */
export function buildPreviewList({
  visible,
  staged,
  stagedReplaces,
  editing,
  typing,
  position = 1,
}: {
  visible: Announcement[];
  staged: Announcement | null;
  /** The published message the staged one will replace on publish, if any. */
  stagedReplaces?: Announcement | null;
  /** The published message being edited, if any. Must be the same object as in `visible`. */
  editing: Announcement | null;
  /** What is currently in the editor, or null when it is empty. */
  typing: Announcement | null;
  /** Where a new message will be published, 1 = top. */
  position?: number;
}): Announcement[] {
  if (staged) return replaceOrInsert(visible, stagedReplaces ?? null, staged, position);
  if (!typing) return visible;
  return replaceOrInsert(visible, editing, typing, position);
}

/**
 * Swaps `pending` in for the row it belongs to, or adds a new one at the
 * position it will be published to (top by default).
 *
 * Both the staged message and the one being typed follow this: an edit of a
 * published message stands in its own place, so the preview shows one changed
 * message rather than the old and the new side by side.
 */
function replaceOrInsert(
  visible: Announcement[],
  target: Announcement | null,
  pending: Announcement,
  position: number,
): Announcement[] {
  if (!target) return previewMessages(visible, pending, position);
  return visible.map((message) =>
    message === target ? { ...message, ...pending } : message,
  );
}

/** Plain-text one-liner for the chip, clipped so a long message can't stretch it. */
export function chipExcerpt(html: string, limit = 42): string {
  const text = html.replace(/<[^>]*>/g, '').replace(/​/g, '').trim();
  return text.length > limit ? `${text.slice(0, limit).trimEnd()}…` : text;
}

/**
 * How the chip describes the message's run: "Runs until you stop it", "From Sep 17 onwards",
 * "Today → Oct 20", "Starts Oct 25". Uses `isAnnouncementInWindow` rather than
 * comparing dates here, so the chip and the website never disagree about
 * whether a message is on air.
 */
export function describeWindow(startDate?: string, endDate?: string): string {
  const onAir = isAnnouncementInWindow(startDate, endDate);
  const start = startDate ? shortDay(startDate) : 'today';
  if (!onAir) return `Starts ${start}`;
  // Open-ended is a choice, so it reads as one — not as a missing end date.
  if (!endDate) return startDate ? `From ${start} onwards` : 'Runs until you stop it';
  return `${start} → ${shortDay(endDate)}`;
}
