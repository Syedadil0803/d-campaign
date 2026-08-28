'use client';

import type { ReactNode, RefObject } from 'react';
import {
  Calendar,
  ChevronRight,
  CircleStop,
  Eye,
  Gift,
  Infinity as InfinityIcon,
  Megaphone,
  Pencil,
  Plus,
  Radio,
} from 'lucide-react';
import type { CampaignConfig } from '@/types/campaign';
import { stripHtml, getBackgroundStyle } from '@/lib/utils';
import { fmtDate } from '@/components/dashboard/dashboardFormat';
import {
  GHOST_BTN,
  MICRO,
  PRIMARY_BTN,
  STOP_BTN,
  statusPill,
} from '@/components/dashboard/dashboardStyles';

interface DashboardLifecycleCardsProps {
  promo: CampaignConfig['promoCard'];
  ann: CampaignConfig['announcementBar'];
  /** End of the promo's last day, in ms. Null when it has no end date. */
  endMs: number | null;
  ended: boolean;
  /** No copy anywhere — the operator has not created a card yet. */
  promoUncreated: boolean;
  promoCardRef: RefObject<HTMLDivElement | null>;
  /** The hover-to-reveal View layer over the promo thumbnail. */
  promoViewOverlay: ReactNode;
  annCount: number;
  scheduledMsgs: number;
  setActiveTab: (tab: 'dashboard' | 'announcement' | 'promo') => void;
  setPending: (
    pending: { kind: 'stop' | 'goOnAir'; target: 'promo' | 'announcement' } | null,
  ) => void;
  setScheduleFilter: (filter: 'all' | 'scheduled' | 'unscheduled') => void;
  setShowSchedule: (show: boolean) => void;
  setShowAnnPreview: (show: boolean) => void;
  onCreatePromo?: () => void;
  /** "3 days left", already formatted. */
  remainingLabel: string;
  /** How far through its run the promo is, 0-100. */
  progressPct: number;
}

/**
 * The two cards the dashboard is really about: the promo and the announcement
 * bar, each showing what is on air, how long it has left, and the two ways in.
 *
 * They sit together because they are the same card twice — the same status
 * pill, the same preview stage, the same schedule bar, the same actions — and
 * reading them side by side is how anyone checks the two agree.
 */
export function DashboardLifecycleCards({
  promo,
  ann,
  endMs,
  ended,
  promoUncreated,
  promoCardRef,
  promoViewOverlay,
  annCount,
  scheduledMsgs,
  setActiveTab,
  setPending,
  setScheduleFilter,
  setShowSchedule,
  setShowAnnPreview,
  onCreatePromo,
  remainingLabel,
  progressPct,
}: DashboardLifecycleCardsProps) {
  return (
    <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
  <div ref={promoCardRef} className="flex h-full flex-col rounded-2xl border border-border campaign-card-surface p-4 shadow-sm">
    <div className="mb-4 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center rounded-xl border border-border bg-background p-2.5">
          <Gift className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h3 className="text-base font-semibold text-on-surface">Promo card</h3>
          <p className={`${MICRO} text-on-surface-variant`}>Floating widget</p>
        </div>
      </div>
      <span className={statusPill(promo.active)}>{promo.active ? 'On air' : 'Off'}</span>
    </div>

    {/* hero time-left — headline; fixed-height row so the gray preview box
        lines up with the announcement card's box */}
    <div className="mb-4 flex min-h-[44px] items-baseline gap-2">
      {endMs && (
        <>
          <span
            className={`text-3xl font-bold tracking-tight tabular-nums ${
              promo.active && !ended ? 'text-on-surface' : 'text-on-surface-variant'
            }`}
          >
            {ended ? 'Ended' : remainingLabel}
          </span>
          {!ended && <span className="text-sm text-on-surface-variant">left</span>}
          {!promo.active && !ended && <span className="text-sm text-on-surface-variant">· not running</span>}
        </>
      )}
    </div>

    {/* recessed preview stage — hover to reveal View, click to open the popup */}
    <div className="group relative">
      {promoViewOverlay}
      <div className="flex h-28 items-center justify-center overflow-hidden rounded-xl border border-border bg-surface-subtle p-3 shadow-inner">
        {promoUncreated ? (
          // Nothing made yet — a skeleton says "this is where it appears"
          // without pretending a sample card is real content.
          <div className="w-full max-w-[220px] space-y-1.5 rounded-lg border border-dashed border-border p-2.5">
            <div className="h-3 w-3/4 animate-pulse rounded bg-on-surface-variant/20" />
            <div className="h-2.5 w-full animate-pulse rounded bg-on-surface-variant/15" />
            <div className="h-2.5 w-5/6 animate-pulse rounded bg-on-surface-variant/15" />
            <div className="h-4 w-full animate-pulse rounded bg-on-surface-variant/20" />
          </div>
        ) : (
        <div
          className="w-full max-w-[220px] rounded-lg p-2 shadow-md"
          style={{ background: getBackgroundStyle(promo.style.background) }}
        >
          <div className="flex flex-col gap-1">
            <div
              className="line-clamp-1 rounded px-2 py-0.5 text-center text-xs font-semibold"
              style={{
                background: getBackgroundStyle(promo.style.titleStyle.background),
                color: promo.style.titleStyle.textColor,
              }}
            >
              {stripHtml(promo.title) || 'Promo title'}
            </div>
            <div
              className="line-clamp-1 rounded px-2 py-0.5 text-[11px] leading-snug"
              style={{
                background: getBackgroundStyle(promo.style.descriptionStyle.background),
                color: promo.style.descriptionStyle.textColor,
              }}
            >
              {stripHtml(promo.description) || stripHtml(promo.subtitle) || 'Your description here.'}
            </div>
            {promo.showButton && (
              <div
                className="line-clamp-1 rounded px-2 py-0.5 text-center text-[11px] font-semibold"
                style={{
                  background: getBackgroundStyle(promo.style.buttonStyle.background),
                  color: promo.style.buttonStyle.textColor,
                }}
              >
                {stripHtml(promo.buttonText) || 'Claim offer'}
              </div>
            )}
          </div>
        </div>
        )}
      </div>
    </div>

    {/* schedule — dd-mon-yyyy window + progress bar (no percentage; time-left is the hero above) */}
    {endMs ? (
      <div className="mt-4 space-y-2">
        <div className="h-2 w-full overflow-hidden rounded-full bg-surface-subtle">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${Math.max(progressPct, 2)}%`, opacity: promo.active ? 1 : 0.5 }}
          />
        </div>
        <div className="flex items-center justify-between text-xs font-medium tabular-nums text-on-surface-variant">
          <span>{fmtDate(promo.startDate)}</span>
          <span>{fmtDate(promo.endDate)}</span>
        </div>
      </div>
    ) : promoUncreated ? (
      // Nothing to schedule yet — telling them to set dates for a card
      // that doesn't exist is an instruction they can't act on here.
      <p className="mt-4 text-sm text-on-surface-variant">
        No promo card yet — create one to show it on your site.
      </p>
    ) : (
      <p className="mt-4 text-sm text-on-surface-variant">Not scheduled yet — set a start and end date.</p>
    )}

    {/* actions — two ways in, then lifecycle.
        "Continue where left off" opens whatever you had open; "Edit
        published" starts from the live card. Both are always offered,
        so the dashboard never has to announce that unfinished work
        exists — you just pick which version you want to work on. */}
    {promoUncreated ? (
      <div className="mt-auto pt-4">
        <button
          className={`${PRIMARY_BTN} w-full`}
          onClick={() => (onCreatePromo ? onCreatePromo() : setActiveTab('promo'))}
        >
          <Plus className="h-4 w-4" />
          Create promo card
        </button>
      </div>
    ) : (
    <div className="mt-auto pt-4">
      {/* Three actions, one row: start something new, work on what's
          published, or take it off air. My Draft isn't here — a draft is
          editor state, and the editor is where it belongs. */}
    <div className="flex gap-2">
      <button
        className={`${GHOST_BTN} flex-1`}
        onClick={() => (onCreatePromo ? onCreatePromo() : setActiveTab('promo'))}
      >
        <Plus className="h-4 w-4" />
        Create new
      </button>
      {promo.active ? (
        <button className={`${STOP_BTN} flex-1`} onClick={() => setPending({ kind: 'stop', target: 'promo' })}>
          <CircleStop className="h-4 w-4" />
          Stop
        </button>
      ) : (
        <button
          className={`${PRIMARY_BTN} flex-1`}
          onClick={() => setPending({ kind: 'goOnAir', target: 'promo' })}
        >
          <Radio className="h-4 w-4" />
          Go on air
        </button>
      )}
    </div>
    </div>
    )}
  </div>

  {/* Announcement */}
  <div className="flex h-full flex-col rounded-2xl border border-border campaign-card-surface p-4 shadow-sm">
    <div className="mb-4 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center rounded-xl border border-border bg-background p-2.5">
          <Megaphone className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h3 className="text-base font-semibold text-on-surface">Announcement bar</h3>
          <p className={`${MICRO} text-on-surface-variant`}>Sitewide header</p>
        </div>
      </div>
      <span className={statusPill(ann.active)}>{ann.active ? 'On air' : 'Off'}</span>
    </div>

    {/* messages summary — big count headline, matching the promo hero's size/weight */}
    <div className="mb-4 flex min-h-[44px] flex-wrap items-baseline gap-x-2 gap-y-1">
      <span className="text-3xl font-bold tracking-tight tabular-nums text-on-surface">{annCount}</span>
      <span className="text-sm text-on-surface-variant">
        message{annCount === 1 ? '' : 's'} {ann.active ? 'showing now' : 'ready to show'}
      </span>
      {annCount > 0 && (
        <>
          <span className="text-sm text-on-surface-variant/40">·</span>
          <button
            type="button"
            onClick={() => {
              setScheduleFilter('all');
              setShowSchedule(true);
            }}
            className="group inline-flex items-center gap-0.5 text-sm font-medium text-primary transition-colors hover:opacity-80"
          >
            View schedule breakdown
            <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </button>
        </>
      )}
    </div>

    {/* recessed preview stage — hover to reveal View, click to open the popup */}
    <div className="group relative">
      <button
        type="button"
        onClick={() => setShowAnnPreview(true)}
        aria-label="View announcement bar preview"
        className="absolute inset-0 z-10 flex items-center justify-center gap-2 rounded-xl bg-black/0 text-transparent opacity-0 transition-all duration-200 group-hover:bg-black/45 group-hover:text-white group-hover:opacity-100 focus-visible:bg-black/45 focus-visible:text-white focus-visible:opacity-100"
      >
        <Eye className="h-5 w-5" />
        <span className="text-sm font-semibold">View</span>
      </button>
      <div className="flex h-28 items-center overflow-hidden rounded-xl border border-border bg-surface-subtle p-3 shadow-inner">
        <div
          className="w-full overflow-hidden rounded-md"
          style={{ background: getBackgroundStyle(ann.style.background) }}
        >
          <div
            className="truncate px-3 py-2 text-center text-sm font-medium"
            style={{ color: ann.style.textColor }}
          >
            {stripHtml(ann.announcements[0]?.text) || 'Your announcement shows here'}
          </div>
        </div>
      </div>
    </div>

    {/* details below the box — read-only scheduled / unscheduled summary */}
    {annCount > 0 && (
      <div className="mt-4 space-y-2.5">
        <div className="flex items-center gap-2 text-sm text-on-surface-variant">
          <Calendar className="h-4 w-4 shrink-0" />
          <span>
            <span className="font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
              {scheduledMsgs}
            </span>{' '}
            scheduled
          </span>
        </div>
        <div className="flex items-center gap-2 text-sm text-on-surface-variant">
          <InfinityIcon className="h-4 w-4 shrink-0" />
          <span>
            <span className="font-semibold tabular-nums text-on-surface">{annCount - scheduledMsgs}</span>{' '}
            unscheduled
          </span>
        </div>
      </div>
    )}

    {/* actions — Edit · lifecycle (same as promo: no read-only screen) */}
    <div className="mt-auto flex gap-2 pt-4">
      <button className={`${GHOST_BTN} flex-1`} onClick={() => setActiveTab('announcement')}>
        <Pencil className="h-4 w-4" />
        Edit
      </button>
      {ann.active ? (
        <button
          className={`${STOP_BTN} flex-1`}
          onClick={() => setPending({ kind: 'stop', target: 'announcement' })}
        >
          <CircleStop className="h-4 w-4" />
          Stop
        </button>
      ) : (
        <button
          className={`${PRIMARY_BTN} flex-1`}
          onClick={() => setPending({ kind: 'goOnAir', target: 'announcement' })}
        >
          <Radio className="h-4 w-4" />
          Go on air
        </button>
      )}
    </div>
  </div>
    </section>
  );
}
