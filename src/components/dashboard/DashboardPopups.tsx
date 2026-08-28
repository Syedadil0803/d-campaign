'use client';

import { Calendar, Infinity as InfinityIcon, X } from 'lucide-react';
import type { CampaignConfig } from '@/types/campaign';
import { stripHtml } from '@/lib/utils';
import { AnnouncementBarPreview } from '@/components/announcement/AnnouncementBarPreview';
import { PromoMiniPreview } from '@/components/shared/PromoMiniPreview';
import { fmtDate } from '@/components/dashboard/dashboardFormat';
import { MICRO } from '@/components/dashboard/dashboardStyles';

interface DashboardPopupsProps {
  promo: CampaignConfig['promoCard'];
  ann: CampaignConfig['announcementBar'];
  annCount: number;
  scheduledMsgs: number;
  showPromoPreview: boolean;
  setShowPromoPreview: (show: boolean) => void;
  /** The promo card's measured size, so the popup opens at its real width. */
  cardSize: { width: number; height: number } | null;
  showAnnPreview: boolean;
  setShowAnnPreview: (show: boolean) => void;
  showSchedule: boolean;
  setShowSchedule: (show: boolean) => void;
  scheduleFilter: 'all' | 'scheduled' | 'unscheduled';
  setScheduleFilter: (filter: 'all' | 'scheduled' | 'unscheduled') => void;
  /** The live change awaiting confirmation, and the words for it. */
  pending: { kind: 'stop' | 'goOnAir'; target: 'promo' | 'announcement' } | null;
  setPending: (
    pending: { kind: 'stop' | 'goOnAir'; target: 'promo' | 'announcement' } | null,
  ) => void;
  pendingCopy: { title: string; body: string; cta: string; danger?: boolean } | null;
  confirmPending: () => void;
}

/**
 * Everything the dashboard opens on top of itself: the two previews, the
 * message schedule, and the confirmation that stands in front of any change
 * to what is live.
 */
export function DashboardPopups({
  promo,
  ann,
  annCount,
  scheduledMsgs,
  showPromoPreview,
  setShowPromoPreview,
  cardSize,
  showAnnPreview,
  setShowAnnPreview,
  showSchedule,
  setShowSchedule,
  scheduleFilter,
  setScheduleFilter,
  pending,
  setPending,
  pendingCopy,
  confirmPending,
}: DashboardPopupsProps) {
  return (
    <>
    {/* Promo preview popup — sized to match the card, close with the X */}
    {showPromoPreview && (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowPromoPreview(false)} />
        <div
          className="relative z-10 flex flex-col overflow-hidden rounded-2xl border border-border campaign-card-surface p-4 shadow-2xl"
          style={
            cardSize
              ? { width: cardSize.width, height: cardSize.height, maxWidth: '95vw', maxHeight: '90vh' }
              : undefined
          }
        >
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-on-surface">Promo card preview</h2>
            <button
              type="button"
              onClick={() => setShowPromoPreview(false)}
              aria-label="Close preview"
              className="rounded-lg p-1.5 text-on-surface-variant transition-colors hover:bg-surface-subtle hover:text-on-surface"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="flex flex-1 items-center justify-center overflow-auto rounded-xl border border-border bg-surface-subtle p-6 shadow-inner">
            <div className="w-full max-w-[300px]">
              <PromoMiniPreview promoCard={promo} />
            </div>
          </div>
        </div>
      </div>
    )}

    {/* Announcement bar preview popup — same width as the Announcement tab's preview
        (page content width). Animated replica: real styles, all messages, speed, loop. */}
    {showAnnPreview && (
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowAnnPreview(false)} />
        <div className="relative z-10 mx-auto w-full max-w-[1840px] px-6">
          <div className="overflow-hidden rounded-xl border border-border shadow-2xl">
            <div className="flex items-center justify-between gap-3 border-b border-border bg-surface-elevated px-4 py-2.5">
              <div>
                <h2 className="text-sm font-semibold text-on-surface">Announcement bar preview</h2>
                <p className={`mt-0.5 ${MICRO} text-on-surface-variant`}>
                  {annCount} message{annCount === 1 ? '' : 's'} · {ann.loop === false ? 'No loop' : 'Continuous loop'} · hover to pause
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAnnPreview(false)}
                aria-label="Close preview"
                className="rounded-lg p-1.5 text-on-surface-variant transition-colors hover:bg-surface-subtle hover:text-on-surface"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <AnnouncementBarPreview bar={ann} />
          </div>
        </div>
      </div>
    )}

    {/* Message schedule popup — opened from the "X of N messages scheduled" line */}
    {showSchedule && (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowSchedule(false)} />
        <div className="relative z-10 flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-border campaign-card-surface shadow-2xl">
          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-4 py-3">
            <div>
              <h2 className="text-base font-semibold text-on-surface">Message schedule</h2>
              <p className={`mt-0.5 ${MICRO} text-on-surface-variant`}>
                {annCount} message{annCount === 1 ? '' : 's'} · {scheduledMsgs} scheduled · {annCount - scheduledMsgs} unscheduled
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowSchedule(false)}
              aria-label="Close schedule"
              className="rounded-lg p-1.5 text-on-surface-variant transition-colors hover:bg-surface-subtle hover:text-on-surface"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* filter tabs — clicking a stat on the card opens this pre-filtered */}
          <div className="flex shrink-0 gap-1 border-b border-border px-3 py-2">
            {(
              [
                { key: 'all', label: `All ${annCount}` },
                { key: 'scheduled', label: `Scheduled ${scheduledMsgs}` },
                { key: 'unscheduled', label: `Unscheduled ${annCount - scheduledMsgs}` },
              ] as const
            ).map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setScheduleFilter(t.key)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                  scheduleFilter === t.key
                    ? 'bg-primary/10 text-primary'
                    : 'text-on-surface-variant hover:bg-surface-subtle'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="max-h-[300px] overflow-y-auto p-4">
            {(() => {
              const rows = ann.announcements
                .map((a, i) => ({ a, i, scheduled: !!(a.startDate || a.endDate) }))
                .filter((r) => scheduleFilter === 'all' || (scheduleFilter === 'scheduled') === r.scheduled);
              if (rows.length === 0) {
                return (
                  <p className="py-6 text-center text-sm text-on-surface-variant">
                    No {scheduleFilter} messages.
                  </p>
                );
              }
              return (
                <ul className="space-y-2.5">
                  {rows.map(({ a, scheduled }, idx) => (
                    <li
                      key={idx}
                      className="flex items-start gap-3 rounded-xl border border-border bg-background p-3"
                    >
                      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-surface-subtle text-xs font-semibold tabular-nums text-on-surface-variant">
                        {idx + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium text-on-surface">
                          {stripHtml(a.text)}
                        </div>
                        <div className="mt-1.5">
                          {scheduled ? (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-subtle px-2.5 py-1 text-xs font-medium text-on-surface-variant">
                              <Calendar className="h-3.5 w-3.5 shrink-0" />
                              {a.startDate ? fmtDate(a.startDate) : '—'} → {a.endDate ? fmtDate(a.endDate) : '—'}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100/70 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
                              <InfinityIcon className="h-3.5 w-3.5 shrink-0" />
                              Always on
                            </span>
                          )}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              );
            })()}
          </div>
          <div className="shrink-0 space-y-1.5 border-t border-border p-4 text-xs leading-relaxed text-on-surface-variant">
            <div className="flex items-start gap-2">
              <InfinityIcon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-700 dark:text-emerald-300" />
              <span>
                <strong className="font-medium text-on-surface">Always on</strong> — shows whenever the announcement bar is active (no dates set).
              </span>
            </div>
            <div className="flex items-start gap-2">
              <Calendar className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>
                <strong className="font-medium text-on-surface">Scheduled</strong> — shows only within its start and end dates.
              </span>
            </div>
          </div>
        </div>
      </div>
    )}

    {/* Confirm before anything that changes the live website */}
    {pending && pendingCopy && (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/20" onClick={() => setPending(null)} />
        <div className="relative z-10 w-full max-w-md rounded-xl border border-white/10 bg-black/10 p-5 text-on-surface shadow-2xl backdrop-blur-md">
          <h2 className="text-base font-semibold">{pendingCopy.title}</h2>
          <p className="mt-2 text-sm text-on-surface-variant">{pendingCopy.body}</p>
          <div className="mt-5 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setPending(null)}
              className="rounded-md border border-white/10 bg-transparent px-4 py-2 text-sm font-medium text-on-surface-variant transition-colors hover:border-primary/70 hover:text-primary"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={confirmPending}
              className={`rounded-md px-4 py-2 text-sm font-semibold shadow-sm transition-opacity hover:opacity-95 ${
                pendingCopy.danger ? 'bg-red-500 text-white' : 'bg-primary text-on-primary'
              }`}
            >
              {pendingCopy.cta}
            </button>
          </div>
        </div>
      </div>
    )}    </>
  );
}
