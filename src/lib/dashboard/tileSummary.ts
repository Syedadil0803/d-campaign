import type { CampaignConfig, CampaignSchedule } from '@/types/campaign';
import { isOpenEnded } from '@/lib/promo/promoSchedule';
import { describeWhen } from '@/lib/auth/presenceClient';
import { DAY, fmtDate, parseDate } from '@/components/dashboard/dashboardFormat';

/**
 * What each dashboard summary tile says, kept pure so the words are tested.
 *
 * The tiles never decide status or issues for themselves: the dashboard has
 * already worked those out (videoStoryStatus, its checks list) and passes them
 * in. This file only turns those answers into the status chip, the fact beside
 * it, the last-saved line and the button's word.
 */

export type DashboardWidget = 'announcement' | 'promo' | 'videoStory';
export type WidgetStatus = 'notCreated' | 'off' | 'ended' | 'live';
export type PillTone = 'live' | 'attention' | 'off' | 'ended' | 'notCreated';

const PILL_LABEL: Record<PillTone, string> = {
  live: 'Live',
  attention: 'Needs Attention',
  off: 'Off',
  ended: 'Ended',
  notCreated: 'Not created',
};

/** Only a live widget can need attention — an Off or Ended pill already says what is wrong. */
export function tilePill(status: WidgetStatus, attention: boolean): { tone: PillTone; label: string } {
  const tone: PillTone = status === 'live' && attention ? 'attention' : status;
  return { tone, label: PILL_LABEL[tone] };
}

/**
 * Whether the dashboard's issues list holds something for this widget.
 *
 * Low severity is a saved draft waiting to be reviewed — not a fault in what
 * visitors see, so it must not turn a healthy live widget amber.
 */
export function needsAttention(
  issues: { widget?: DashboardWidget; severity?: 'high' | 'medium' | 'low' }[],
  widget: DashboardWidget,
): boolean {
  return issues.some((i) => i.widget === widget && i.severity !== 'low');
}

/** Broadcasts have no "ended" — the bar is on or off as a whole. No messages and off = never made. */
export function broadcastsStatus(ann: CampaignConfig['announcementBar']): WidgetStatus {
  if (ann.active) return 'live';
  return ann.announcements.length === 0 ? 'notCreated' : 'off';
}

/** Same order the full card reads: no copy, then switched off, then past its end date. */
export function smartCardStatus(uncreated: boolean, active: boolean, ended: boolean): WidgetStatus {
  if (uncreated) return 'notCreated';
  if (!active) return 'off';
  return ended ? 'ended' : 'live';
}

/**
 * "Ends in 3 days" / "No end date" / "Ended".
 *
 * Whole calendar days, because the tile is a glance — the full card keeps the
 * hours-and-minutes countdown. Before mount there is no today (hydration), so
 * it names the end date instead of guessing a count.
 */
export function scheduleLine(
  s: Pick<CampaignSchedule, 'endDate' | 'scheduleMode'>,
  ended: boolean,
  todayIso: string,
): string {
  if (isOpenEnded(s) || !s.endDate) return 'No end date';
  if (ended) return 'Ended';
  const end = parseDate(s.endDate);
  const today = parseDate(todayIso);
  if (!end || !today) return `Ends ${fmtDate(s.endDate)}`;
  // Rounded: a DST change makes the gap between two midnights 23 or 25 hours.
  const days = Math.round((end.getTime() - today.getTime()) / DAY);
  if (days <= 0) return 'Ends today';
  return `Ends in ${days} day${days === 1 ? '' : 's'}`;
}

/**
 * The fact after the status chip's dot. `strong` is the number the eye should
 * land on, rendered bold; `text` follows it. Not shown for a widget that is
 * not created — the chip already says so (DashboardSummaryTile).
 */
export type TileFact = { strong?: string; text: string };

export function broadcastsFact(ann: CampaignConfig['announcementBar']): TileFact {
  const n = ann.announcements.length;
  return { strong: String(n), text: `Message${n === 1 ? '' : 's'} Active` };
}

export function smartCardFact(promo: CampaignConfig['promoCard'], status: WidgetStatus, todayIso: string): TileFact {
  return { text: scheduleLine(promo, status === 'ended', todayIso) };
}

// ponytail: the clip's length is not stored yet, so the tile says whether a
// clip exists rather than "<n>s video"; show seconds once uploads save a duration.
export function videoStoryFact(vs: CampaignConfig['videoStory']): TileFact {
  return { text: vs?.videoUrl ? 'Video added' : 'No video yet' };
}

/**
 * The big button's word. Resume when there is unpublished work to go back to
 * (the same draft the full card offers Resume Draft for), Create when the
 * widget does not exist yet, otherwise Open.
 */
export type TileAction = 'Create' | 'Resume' | 'Open';

export function tileAction(status: WidgetStatus, hasDraft: boolean): TileAction {
  if (status === 'notCreated' && !hasDraft) return 'Create';
  return hasDraft ? 'Resume' : 'Open';
}

/** "Last saved: Today at 2:15 PM" — the full card's own wording (describeWhen) without seconds, capitalised to start a line. */
export function lastSavedLine(savedIso: string | null | undefined): string | null {
  if (!savedIso) return null;
  const when = describeWhen(savedIso, false);
  return `Last saved: ${when.charAt(0).toUpperCase()}${when.slice(1)}`;
}
