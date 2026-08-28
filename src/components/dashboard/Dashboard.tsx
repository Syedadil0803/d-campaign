'use client';

import { useEffect, useRef, useState } from 'react';
import {
  Calendar,
  Pencil,
  Check,
  AlertTriangle,
  Eye,
  X,
  Infinity as InfinityIcon,
} from 'lucide-react';
import { CampaignConfig } from '@/types/campaign';
import { stripHtml } from '@/lib/utils';
import { PromoMiniPreview } from '@/components/shared/PromoMiniPreview';
import { AnnouncementBarPreview } from '@/components/announcement/AnnouncementBarPreview';
import {
  DAY,
  clamp,
  parseDate,
  fmtDate,
  fmtRemaining,
  timeAgo,
} from '@/components/dashboard/dashboardFormat';
import {
  MICRO,
} from '@/components/dashboard/dashboardStyles';
import { DashboardLifecycleCards } from '@/components/dashboard/DashboardLifecycleCards';

interface DashboardProps {
  config: CampaignConfig;
  setActiveTab: (tab: 'dashboard' | 'announcement' | 'promo') => void;
  onStopPromo?: () => void;
  onGoOnAirPromo?: () => void;
  onStopAnnouncement?: () => void;
  onGoOnAirAnnouncement?: () => void;
  /** Opens the promo tab at its start screen — used by the first-run Create. */
  onCreatePromo?: () => void;
  /** Opens the editor with the LIVE card loaded, from the thumbnail's Edit. */
  onEditLivePromo?: () => void;
  promoUnpublished?: boolean;
  announcementUnpublished?: boolean;
}

/** No copy anywhere on the card — the operator hasn't created one yet. */
function isPromoUncreated(promo: CampaignConfig['promoCard']): boolean {
  return !stripHtml(promo.title) && !stripHtml(promo.subtitle) && !stripHtml(promo.description);
}







// Match the tool's micro-label convention: sans (Geist) bold uppercase — NOT mono.

export function Dashboard({
  config,
  setActiveTab,
  onStopPromo,
  onGoOnAirPromo,
  onStopAnnouncement,
  onGoOnAirAnnouncement,
  onCreatePromo,
  onEditLivePromo,
}: DashboardProps) {
  const promoUncreated = isPromoUncreated(config.promoCard);
  // Stop / go-on-air both change the live website, so confirm first.
  const [pending, setPending] = useState<{ kind: 'stop' | 'goOnAir'; target: 'promo' | 'announcement' } | null>(
    null,
  );
  // Read-only preview popup for the promo, opened by hovering its thumbnail.
  // The popup is sized to match the promo card; we track the card's size with a
  // ResizeObserver so the value is always current when the popup opens.
  const [showPromoPreview, setShowPromoPreview] = useState(false);
  const [showAnnPreview, setShowAnnPreview] = useState(false);
  const [showSchedule, setShowSchedule] = useState(false);
  const [scheduleFilter, setScheduleFilter] = useState<'all' | 'scheduled' | 'unscheduled'>('all');
  const [cardSize, setCardSize] = useState<{ width: number; height: number } | null>(null);
  const promoCardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = promoCardRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const measure = () => setCardSize({ width: el.offsetWidth, height: el.offsetHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Date-derived values must wait for mount to avoid SSR/CSR hydration drift.
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  const promo = config.promoCard;
  const ann = config.announcementBar;

  const startMs = parseDate(promo.startDate)?.getTime() ?? null;
  const endD = parseDate(promo.endDate);
  const endMs = endD ? endD.getTime() + DAY - 1 : null;

  let remainingLabel = '—';
  let progressPct = 0;
  const ended = !!(now && endMs && now.getTime() > endMs);
  if (now && endMs) {
    const rem = endMs - now.getTime();
    remainingLabel = fmtRemaining(rem);
    if (startMs) progressPct = Math.round(clamp(((now.getTime() - startMs) / (endMs - startMs)) * 100, 0, 100));
  }

  const annCount = ann.announcements.length;

  // Actionable readiness checks — what actually needs the operator's attention.
  const hasCta =
    promo.showButton &&
    ((promo.ctaType === 'whatsapp' && !!promo.whatsappNumber) ||
      (promo.ctaType === 'link' && !!promo.buttonUrl) ||
      promo.ctaType === 'text');
  // Deliberately NOT listing "you have unpublished changes": the dashboard
  // mirrors what's live on the website only. Editor state is the editor's
  // business — the way back into unfinished work is My Draft below, which is
  // always available rather than appearing as an alert.
  const checks: { ok: boolean; text: string; action?: { label: string; onClick: () => void } }[] = [];
  if (promo.active && !hasCta) {
    checks.push({
      ok: false,
      text: 'Promo has no call-to-action',
      action: { label: 'Add one', onClick: () => setActiveTab('promo') },
    });
  }
  if (!ann.active) {
    checks.push({
      ok: false,
      text: 'Announcement bar is off',
      action: { label: 'Turn on', onClick: () => setPending({ kind: 'goOnAir', target: 'announcement' }) },
    });
  }
  if (checks.every((c) => c.ok)) {
    checks.push({ ok: true, text: 'Promo and announcement look good' });
  }
  // The bar is on/off as a whole; each message can optionally carry its own schedule.
  const scheduledMsgs = ann.announcements.filter((a) => a.startDate || a.endDate).length;

  const liveCount = (promo.active ? 1 : 0) + (ann.active ? 1 : 0);
  const liveLabel =
    liveCount === 0 ? 'Nothing on air right now' : liveCount === 2 ? 'Both channels on air' : '1 of 2 channels on air';
  const issues = checks.filter((c) => !c.ok);

  const PENDING_COPY = {
    'promo-stop': {
      title: 'Stop the promo card?',
      body: 'It comes off your website right away — visitors will stop seeing it.',
      cta: 'Stop promo',
      danger: true,
    },
    'promo-goOnAir': {
      title: 'Put the promo card live?',
      body: 'It goes live on your website now — visitors will start seeing it.',
      cta: 'Go on air',
      danger: false,
    },
    'announcement-stop': {
      title: 'Switch off the announcement bar?',
      body: 'It stops showing on your website right away.',
      cta: 'Stop bar',
      danger: true,
    },
    'announcement-goOnAir': {
      title: 'Put the announcement bar on air?',
      body: 'It starts showing on your website now.',
      cta: 'Go on air',
      danger: false,
    },
  } as const;
  const pendingCopy = pending ? PENDING_COPY[`${pending.target}-${pending.kind}` as keyof typeof PENDING_COPY] : null;

  const confirmPending = () => {
    if (!pending) return;
    if (pending.target === 'promo') {
      if (pending.kind === 'stop') onStopPromo?.();
      else onGoOnAirPromo?.();
    } else {
      if (pending.kind === 'stop') onStopAnnouncement?.();
      else onGoOnAirAnnouncement?.();
    }
    setPending(null);
  };

  /**
   * Hover overlay over the promo thumbnail: View, and Edit beside it.
   *
   * Edit sits on the card it acts on, which is where you'd reach for it —
   * better than a button in a row underneath that has to name which card it
   * means.
   */
  const overlayAction =
    'inline-flex items-center gap-1.5 rounded-lg bg-white/15 px-3 py-1.5 text-sm font-semibold text-white ring-1 ring-white/30 backdrop-blur-sm transition-colors hover:bg-white/25';

  const promoViewOverlay = (
    <div className="absolute inset-0 z-10 flex items-center justify-center gap-2 rounded-xl bg-black/0 opacity-0 transition-all duration-200 group-hover:bg-black/45 group-hover:opacity-100 focus-within:bg-black/45 focus-within:opacity-100">
      <button
        type="button"
        onClick={() => setShowPromoPreview(true)}
        aria-label="View promo card preview"
        className={overlayAction}
      >
        <Eye className="h-4 w-4" />
        View
      </button>
      {!promoUncreated && (
        <button
          type="button"
          onClick={() => onEditLivePromo?.()}
          aria-label="Edit the live promo card"
          className={overlayAction}
        >
          <Pencil className="h-4 w-4" />
          Edit
        </button>
      )}
    </div>
  );

  return (
    <div className="flex flex-col gap-4">
      {/* Command bar — one-line site status + the publish action */}
      <section className="flex flex-col gap-3 rounded-2xl border border-border campaign-card-surface p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="relative flex h-2.5 w-2.5">
            {liveCount > 0 && (
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
            )}
            <span
              className={`relative inline-flex h-2.5 w-2.5 rounded-full ${
                liveCount > 0 ? 'bg-emerald-500' : 'bg-on-surface-variant'
              }`}
            />
          </span>
          <div>
            <p className={`${MICRO} text-on-surface-variant`}>Your site</p>
            <p className="text-sm font-semibold text-on-surface">{liveLabel}</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-xs text-on-surface-variant">
            Last published {now ? timeAgo(config.lastUpdated, now) : '—'}
          </span>
          {/* No "Publish changes" here — publishing belongs to the editor,
              where you can see what you'd be publishing. Surfacing it on the
              dashboard also meant leaking editor state into a view that only
              reports what's live. */}
        </div>
      </section>

      {/* Attention strip — loud only when something actually needs fixing */}
      {issues.length > 0 ? (
        <section className="rounded-2xl border border-amber-300/60 bg-amber-50/70 p-3 dark:border-amber-500/25 dark:bg-amber-500/[0.07]">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <span className={`inline-flex items-center gap-1.5 ${MICRO} text-amber-700 dark:text-amber-400`}>
              <AlertTriangle className="h-3.5 w-3.5" />
              Needs attention
            </span>
            {issues.map((c, i) => (
              <span key={i} className="inline-flex items-center gap-2 text-sm text-on-surface">
                <span aria-hidden className="inline-block h-2 w-2 shrink-0 rounded-full bg-amber-500/80 dark:bg-amber-400/80" />
                {c.text}
                {c.action && (
                  <button
                    type="button"
                    onClick={c.action.onClick}
                    className="font-semibold text-primary transition-opacity hover:opacity-80"
                  >
                    {c.action.label}
                  </button>
                )}
              </span>
            ))}
          </div>
        </section>
      ) : (
        <section className="flex items-center gap-2 rounded-2xl border border-emerald-300/50 bg-emerald-50/60 px-4 py-2.5 text-sm text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/[0.07] dark:text-emerald-300">
          <Check className="h-4 w-4 shrink-0" />
          Everything&apos;s live and healthy — nothing needs your attention.
        </section>
      )}

      {/* Lifecycle cards — Studio layout: recessed preview stage + schedule/meta + actions */}
      <DashboardLifecycleCards
        promo={promo}
        ann={ann}
        now={now}
        endMs={endMs}
        ended={ended}
        promoUncreated={promoUncreated}
        promoCardRef={promoCardRef}
        promoViewOverlay={promoViewOverlay}
        annCount={annCount}
        scheduledMsgs={scheduledMsgs}
        setActiveTab={setActiveTab}
        setPending={setPending}
        setScheduleFilter={setScheduleFilter}
        setShowSchedule={setShowSchedule}
        setShowAnnPreview={setShowAnnPreview}
        onCreatePromo={onCreatePromo}
        remainingLabel={remainingLabel}
        progressPct={progressPct}
      />

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
      )}
    </div>
  );
}
