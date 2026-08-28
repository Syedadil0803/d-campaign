'use client';

import { useEffect, useRef, useState } from 'react';
import {
  Pencil,
  Check,
  AlertTriangle,
  Eye,
} from 'lucide-react';
import { CampaignConfig } from '@/types/campaign';
import { stripHtml } from '@/lib/utils';
import {
  DAY,
  clamp,
  parseDate,
  fmtRemaining,
  timeAgo,
} from '@/components/dashboard/dashboardFormat';
import {
  MICRO,
} from '@/components/dashboard/dashboardStyles';
import { DashboardLifecycleCards } from '@/components/dashboard/DashboardLifecycleCards';
import { DashboardPopups } from '@/components/dashboard/DashboardPopups';

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

      <DashboardPopups
        promo={promo}
        ann={ann}
        annCount={annCount}
        scheduledMsgs={scheduledMsgs}
        showPromoPreview={showPromoPreview}
        setShowPromoPreview={setShowPromoPreview}
        cardSize={cardSize}
        showAnnPreview={showAnnPreview}
        setShowAnnPreview={setShowAnnPreview}
        showSchedule={showSchedule}
        setShowSchedule={setShowSchedule}
        scheduleFilter={scheduleFilter}
        setScheduleFilter={setScheduleFilter}
        pending={pending}
        setPending={setPending}
        pendingCopy={pendingCopy}
        confirmPending={confirmPending}
      />
    </div>
  );
}
