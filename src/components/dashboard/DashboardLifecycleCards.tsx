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
  AlertCircle,
  Info as InfoIcon,
  FolderOpen,
} from 'lucide-react';
import type { CampaignConfig } from '@/types/campaign';
import { stripHtml, getBackgroundStyle } from '@/lib/utils';
import { fmtDate } from '@/components/dashboard/dashboardFormat';
import { describeWhen } from '@/lib/auth/presenceClient';
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
  hasRecoveredWork?: boolean;
  onRestoreRecovery?: () => void;
  onDismissRecovery?: () => void;
  promoUnpublished?: boolean;
  onOpenDraft?: () => void;
  draftSavedAt?: string | null;
  onStartNewWithDraft?: () => void;
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
  hasRecoveredWork = false,
  onRestoreRecovery = () => { },
  onDismissRecovery = () => { },
  promoUnpublished = false,
  onOpenDraft = () => { },
  draftSavedAt = null,
  onStartNewWithDraft = () => { },
}: DashboardLifecycleCardsProps) {
  return (
    <section className="grid grid-cols-2 gap-6 md:gap-6">
      {/* Promo card */}
      <div
        ref={promoCardRef}
        className="flex h-full min-h-[382px] flex-col justify-between gap-4 rounded-2xl border border-border campaign-card-surface p-6 shadow-sm"
      >
        {/* [HEADER ZONE] 40px */}
        <div className="flex h-10 shrink-0 items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-background">
              <Gift className="h-5 w-5 text-primary" />
            </div>
            <div className="flex flex-col gap-0.5">
              <h3 className="text-base font-semibold text-on-surface">Promo card</h3>
              <p className={`${MICRO} text-on-surface-variant`}>Floating widget</p>
            </div>
          </div>
          {(promo.active || promoUnpublished) && (
            <button
              type="button"
              onClick={() => setPending({ kind: 'stop', target: 'promo' })}
              aria-label="Stop the live promo card"
              title="Stop the live promo card"
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-surface-elevated px-3 text-xs font-medium text-on-surface transition-colors hover:bg-surface-subtle hover:text-primary"
            >
              <CircleStop className="h-4 w-4" />
              Stop
            </button>
          )}
        </div>

        {/* [CONSOLIDATED METADATA ZONE] 28px */}
        {promo.active && !endMs ? (
          /* Case 3: evergreen / running continuously */
          <div className="flex h-7 shrink-0 items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-600 dark:bg-emerald-400" />
              <span className="text-[15px] font-semibold text-on-surface">
                Running continuously
              </span>
            </div>
            {promo.startDate && (
              <span className="text-[13px] font-medium tabular-nums text-on-surface-variant">
                Started {fmtDate(promo.startDate)}
              </span>
            )}
          </div>
        ) : endMs || promo.active ? (
          /* Case 2: fixed-term */
          <div className="flex h-7 shrink-0 items-center justify-between gap-2">
            <div className="flex items-baseline gap-1">
              {endMs && (
                <>
                  <span
                    className={`text-[22px] font-bold tracking-tight tabular-nums ${promo.active && !ended ? 'text-on-surface' : 'text-on-surface-variant'
                      }`}
                  >
                    {ended ? 'Ended' : remainingLabel}
                  </span>
                  {!ended && (
                    <span className="ml-1 text-[13px] font-normal text-on-surface-variant">
                      left
                    </span>
                  )}
                </>
              )}
              {!endMs && promo.active && (
                <span className="text-[22px] font-bold text-on-surface">{remainingLabel}</span>
              )}
            </div>
            {(promo.startDate || promo.endDate) && (
              <span className="inline-flex shrink-0 items-center rounded-md bg-surface-subtle px-2 py-0.5 text-xs font-medium tabular-nums text-on-surface-variant">
                {fmtDate(promo.startDate)} – {promo.endDate ? fmtDate(promo.endDate) : '—'}
              </span>
            )}
          </div>
        ) : (
          /* Case 1: empty slot */
          <div className="h-7 shrink-0" aria-hidden />
        )}

        {/* [PREVIEW ZONE] 180px — dotted grid, theme-aware */}
        <div className="group relative">
          {promoViewOverlay}
          <div className="relative flex h-[180px] items-center justify-center overflow-hidden rounded-xl border border-border bg-surface-subtle p-3 text-border shadow-inner [background-image:radial-gradient(currentColor_1px,transparent_1px)] [background-size:16px_16px]">

            {promoUncreated ? (
              <div className="flex w-full max-w-[220px] flex-col gap-2 rounded-lg border border-dashed border-border bg-background/60 p-4 backdrop-blur-[1px]">
                <div className="h-2 w-[65%] animate-pulse rounded-full bg-on-surface-variant/20" />
                <div className="h-2 w-full animate-pulse rounded-full bg-on-surface-variant/15" />
                <div className="h-2 w-[80%] animate-pulse rounded-full bg-on-surface-variant/15" />
                <div className="h-2 w-[95%] animate-pulse rounded-full bg-on-surface-variant/20" />
              </div>
            ) : (
              <div
                className="flex max-h-[120px] w-full max-w-[220px] flex-col justify-center overflow-hidden rounded-lg p-2 shadow-md"
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
                    className="line-clamp-2 rounded px-2 py-0.5 text-[11px] leading-snug"
                    style={{
                      background: getBackgroundStyle(promo.style.descriptionStyle.background),
                      color: promo.style.descriptionStyle.textColor,
                    }}
                  >
                    {stripHtml(promo.description) ||
                      stripHtml(promo.subtitle) ||
                      'Your description here.'}
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

        {/* [HELPER ZONE] 40px */}
        <div className="flex h-10 shrink-0 items-center">
          {hasRecoveredWork ? (
            <div className="flex h-10 w-full items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 dark:border-amber-800 dark:bg-amber-950">
              <AlertCircle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
              <span className="text-[13px] font-medium text-amber-900 dark:text-amber-100">
                Unsaved session recovered from browser cache
              </span>
            </div>
          ) : promoUnpublished ? (
            <div className="flex h-10 w-full items-center gap-2 rounded-lg border border-blue-100 bg-blue-50 px-3 dark:border-blue-800 dark:bg-blue-950">
              <InfoIcon className="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
              <span className="text-[13px] font-medium text-blue-800 dark:text-blue-100">
                Saved to cloud {draftSavedAt ? describeWhen(draftSavedAt) : ''} • Draft pending
              </span>
            </div>
          ) : promo.active ? (
            <div className="flex h-10 w-full items-center gap-2 rounded-lg border border-emerald-100 bg-emerald-50 px-3 dark:border-emerald-800 dark:bg-emerald-950">
              <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-500 dark:bg-emerald-400" />
              <span className="text-[13px] font-medium text-emerald-800 dark:text-emerald-100">
                Live version active on site
              </span>
            </div>
          ) : promoUncreated ? (
            <span className="text-[13px] leading-snug text-on-surface-variant">
              No promo card yet — create one to show it on your site.
            </span>
          ) : null}
        </div>

        {/* [ACTION ZONE] 42px */}
        {hasRecoveredWork ? (
          <div className="flex h-[42px] gap-2.5">
            <button
              type="button"
              onClick={onRestoreRecovery}
              className={`${PRIMARY_BTN} flex-1`}
            >
              Save & Continue
            </button>
            <button
              type="button"
              onClick={onDismissRecovery}
              className={`${GHOST_BTN} flex-1`}
            >
              Discard & Start New
            </button>
          </div>
        ) : promoUnpublished ? (
          <div className="flex h-[42px] gap-2.5">
            <button
              type="button"
              onClick={onOpenDraft}
              className={`${PRIMARY_BTN} flex-1`}
            >
              <FolderOpen className="h-4 w-4" />
              Resume Draft
            </button>
            <button
              type="button"
              onClick={onStartNewWithDraft}
              className={`${GHOST_BTN} flex-1`}
            >
              <Plus className="h-4 w-4" />
              Start New
            </button>
          </div>
        ) : promoUncreated ? (
          <button
            className={`${PRIMARY_BTN} h-[42px] w-full`}
            onClick={() => (onCreatePromo ? onCreatePromo() : setActiveTab('promo'))}
          >
            <Plus className="h-4 w-4" />
            Create promo card
          </button>
        ) : promo.active ? (
          /* Case 3 / live: + Start New (create handler) */
          <div className="flex h-[42px] gap-2.5">
            <button
              className={`${PRIMARY_BTN} flex-1`}
              onClick={() => (onCreatePromo ? onCreatePromo() : setActiveTab('promo'))}
            >
              <Plus className="h-4 w-4" />
              Start New
            </button>
          </div>
        ) : (
          /* Non-live, configured */
          <div className="flex h-[42px] gap-2.5">
            <button
              className={`${PRIMARY_BTN} flex-1`}
              onClick={() => (onCreatePromo ? onCreatePromo() : setActiveTab('promo'))}
            >
              <Plus className="h-4 w-4" />
              Create new
            </button>
            <button
              className={`${PRIMARY_BTN} flex-1`}
              onClick={() => setPending({ kind: 'goOnAir', target: 'promo' })}
            >
              <Radio className="h-4 w-4" />
              Go on air
            </button>
          </div>
        )}
      </div>

      {/* Announcement */}
      <div className="flex h-full min-h-[382px] flex-col justify-between gap-4 rounded-2xl border border-border campaign-card-surface p-6 shadow-sm">
        {/* Header Zone */}
        <div className="flex h-10 shrink-0 items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-background">
              <Megaphone className="h-5 w-5 text-primary" />
            </div>
            <div className="flex flex-col gap-0.5">
              <h3 className="text-base font-semibold text-on-surface">Announcement bar</h3>
              <p className={`${MICRO} text-on-surface-variant`}>Sitewide header</p>
            </div>
          </div>
          {ann.active && (
            <button
              type="button"
              onClick={() => setPending({ kind: 'stop', target: 'announcement' })}
              aria-label="Stop the live announcement bar"
              title="Stop the live announcement bar"
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-surface-elevated px-3 text-xs font-medium text-on-surface transition-colors hover:bg-surface-subtle hover:text-primary"
            >
              <CircleStop className="h-4 w-4" />
              Stop
            </button>
          )}
        </div>

        {/* messages summary */}
        <div className="flex h-7 shrink-0 flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-[22px] font-bold tracking-tight tabular-nums text-on-surface">
            {annCount}
          </span>
          <span className="text-[13px] text-on-surface-variant">
            message{annCount === 1 ? '' : 's'} {ann.active ? 'showing now' : 'ready to show'}
          </span>
          {annCount > 0 && (
            <>
              <span className="text-[13px] text-on-surface-variant/40">·</span>
              <button
                type="button"
                onClick={() => {
                  setScheduleFilter('all');
                  setShowSchedule(true);
                }}
                className="group inline-flex items-center gap-0.5 text-[13px] font-medium text-primary transition-colors hover:opacity-80"
              >
                View schedule breakdown
                <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </button>
            </>
          )}
        </div>

        {/* recessed preview stage */}
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
          <div className="relative flex h-[180px] items-center overflow-hidden rounded-xl border border-border bg-surface-subtle p-3 text-border shadow-inner [background-image:radial-gradient(currentColor_1px,transparent_1px)] [background-size:16px_16px]">
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

        {/* Helper/Alert Zone */}
        <div className="flex h-10 shrink-0 items-center">
          {annCount > 0 ? (
            <div className="flex w-full gap-4 text-[13px] text-on-surface-variant">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 shrink-0" />
                <span>
                  <span className="font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
                    {scheduledMsgs}
                  </span>{' '}
                  scheduled
                </span>
              </div>
              <div className="flex items-center gap-2">
                <InfinityIcon className="h-4 w-4 shrink-0" />
                <span>
                  <span className="font-semibold tabular-nums text-on-surface">
                    {annCount - scheduledMsgs}
                  </span>{' '}
                  unscheduled
                </span>
              </div>
            </div>
          ) : null}
        </div>

        {/* Action Zone */}
        <div className="flex h-[42px] gap-2.5">
          <button
            className={`${GHOST_BTN} flex-1`}
            onClick={() => setActiveTab('announcement')}
          >
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