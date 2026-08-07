'use client';

import { useEffect, useRef, useState } from 'react';
import {
  Megaphone,
  Gift,
  Calendar,
  Radio,
  CircleStop,
  Pencil,
  Clock,
  Repeat,
  Upload,
  Check,
  AlertTriangle,
  Eye,
  X,
} from 'lucide-react';
import { CampaignConfig } from '@/types/campaign';
import { stripHtml, getBackgroundStyle } from '@/lib/utils';
import { PromoMiniPreview } from './PromoMiniPreview';
import { AnnouncementBarPreview } from './AnnouncementBarPreview';

interface DashboardProps {
  config: CampaignConfig;
  setActiveTab: (tab: 'dashboard' | 'announcement' | 'promo') => void;
  onStopPromo?: () => void;
  onGoOnAirPromo?: () => void;
  onStopAnnouncement?: () => void;
  onGoOnAirAnnouncement?: () => void;
  promoUnpublished?: boolean;
  announcementUnpublished?: boolean;
}

const DAY = 86_400_000;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function parseDate(s?: string): Date | null {
  if (!s) return null;
  const d = new Date(`${s}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

// Human, unambiguous date format for the operator: 06-Aug-2026.
function fmtDate(s?: string): string {
  const d = parseDate(s);
  if (!d) return '—';
  return `${String(d.getDate()).padStart(2, '0')}-${MONTHS[d.getMonth()]}-${d.getFullYear()}`;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(Math.max(n, lo), hi);
}

function fmtRemaining(ms: number): string {
  if (ms <= 0) return 'ended';
  const d = Math.floor(ms / DAY);
  const h = Math.floor((ms % DAY) / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function timeAgo(iso: string, now: Date): string {
  if (!iso) return 'not yet';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return 'not yet';
  const diff = now.getTime() - then;
  const m = Math.floor(diff / 60_000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// Match the tool's micro-label convention: sans (Geist) bold uppercase — NOT mono.
const MICRO = 'text-[11px] font-bold uppercase tracking-[0.08em]';

export function Dashboard({
  config,
  setActiveTab,
  onStopPromo,
  onGoOnAirPromo,
  onStopAnnouncement,
  onGoOnAirAnnouncement,
  promoUnpublished = false,
  announcementUnpublished = false,
}: DashboardProps) {
  const hasUnpublished = promoUnpublished || announcementUnpublished;
  // Stop / go-on-air both change the live website, so confirm first.
  const [pending, setPending] = useState<{ kind: 'stop' | 'goOnAir'; target: 'promo' | 'announcement' } | null>(
    null,
  );
  // Read-only preview popup for the promo, opened by hovering its thumbnail.
  // The popup is sized to match the promo card; we track the card's size with a
  // ResizeObserver so the value is always current when the popup opens.
  const [showPromoPreview, setShowPromoPreview] = useState(false);
  const [showAnnPreview, setShowAnnPreview] = useState(false);
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
  const checks: { ok: boolean; text: string; action?: { label: string; onClick: () => void } }[] = [
    hasUnpublished
      ? {
          ok: false,
          text: 'You have unpublished changes',
          action: { label: 'Review', onClick: () => setActiveTab(promoUnpublished ? 'promo' : 'announcement') },
        }
      : { ok: true, text: 'All changes are published' },
  ];
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

  const pillBtn =
    'inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium transition-all active:scale-95';
  const primaryBtn = `${pillBtn} bg-primary text-on-primary hover:opacity-90`;
  const ghostBtn = `${pillBtn} border border-border text-on-surface hover:bg-surface-subtle`;
  const stopBtn = `${pillBtn} border border-border text-on-surface hover:text-red-600 hover:border-red-300 dark:hover:text-red-400 dark:hover:border-red-500/40`;

  const statusPill = (active: boolean) =>
    `inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 ${MICRO} ${
      active
        ? 'bg-emerald-100/70 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300'
        : 'bg-surface-subtle text-on-surface-variant'
    }`;

  const liveCount = (promo.active ? 1 : 0) + (ann.active ? 1 : 0);
  const liveLabel =
    liveCount === 0 ? 'Nothing live right now' : liveCount === 2 ? 'Both channels live' : '1 of 2 channels live';
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

  // Hover overlay that reveals a "View" affordance over the promo thumbnail.
  const promoViewOverlay = (
    <button
      type="button"
      onClick={() => setShowPromoPreview(true)}
      aria-label="View promo card preview"
      className="absolute inset-0 z-10 flex items-center justify-center gap-2 rounded-xl bg-black/0 text-transparent opacity-0 transition-all duration-200 group-hover:bg-black/45 group-hover:text-white group-hover:opacity-100 focus-visible:bg-black/45 focus-visible:text-white focus-visible:opacity-100"
    >
      <Eye className="h-5 w-5" />
      <span className="text-sm font-semibold">View</span>
    </button>
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
          {hasUnpublished && (
            <button
              type="button"
              onClick={() => setActiveTab(promoUnpublished ? 'promo' : 'announcement')}
              className={primaryBtn}
            >
              <Upload className="h-4 w-4" />
              Publish changes
            </button>
          )}
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
      <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* Promo */}
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
            <span className={statusPill(promo.active)}>{promo.active ? 'Live' : 'Off'}</span>
          </div>

          {/* hero time-left — the headline number for the promo */}
          {endMs && (
            <div className="mb-4 flex items-baseline gap-2">
              <span
                className={`text-3xl font-bold tracking-tight tabular-nums ${
                  promo.active && !ended ? 'text-on-surface' : 'text-on-surface-variant'
                }`}
              >
                {ended ? 'Ended' : remainingLabel}
              </span>
              {!ended && <span className="text-sm text-on-surface-variant">left</span>}
              {!promo.active && !ended && <span className="text-sm text-on-surface-variant">· not running</span>}
            </div>
          )}

          {/* recessed preview stage — hover to reveal View, click to open the popup */}
          <div className="group relative">
            {promoViewOverlay}
            <div className="flex h-32 items-center justify-center overflow-hidden rounded-xl border border-border bg-surface-subtle p-3 shadow-inner">
              <div
                className="w-full max-w-[220px] rounded-lg p-2 shadow-md"
                style={{ background: getBackgroundStyle(promo.style.background) }}
              >
                <div className="flex flex-col gap-1">
                  <div
                    className="line-clamp-1 rounded px-2 py-1 text-center text-xs font-semibold"
                    style={{
                      background: getBackgroundStyle(promo.style.titleStyle.background),
                      color: promo.style.titleStyle.textColor,
                    }}
                  >
                    {stripHtml(promo.title) || 'Promo title'}
                  </div>
                  <div
                    className="line-clamp-1 rounded px-2 py-1 text-[11px] leading-snug"
                    style={{
                      background: getBackgroundStyle(promo.style.descriptionStyle.background),
                      color: promo.style.descriptionStyle.textColor,
                    }}
                  >
                    {stripHtml(promo.description) || stripHtml(promo.subtitle) || 'Your description here.'}
                  </div>
                  {promo.showButton && (
                    <div
                      className="line-clamp-1 rounded px-2 py-1 text-center text-[11px] font-semibold"
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
            </div>
          </div>

          {/* schedule — dd-mon-yyyy window + progress bar (no percentage; time-left is the hero above) */}
          {endMs ? (
            <div className="mt-4 space-y-2">
              <div className="h-2 w-full overflow-hidden rounded-full bg-surface-subtle">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${promo.active ? progressPct : 0}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-xs font-medium tabular-nums text-on-surface-variant">
                <span>{fmtDate(promo.startDate)}</span>
                <span>{fmtDate(promo.endDate)}</span>
              </div>
            </div>
          ) : (
            <p className="mt-4 text-sm text-on-surface-variant">Not scheduled yet — set a start and end date.</p>
          )}

          {/* actions — View · Edit · lifecycle (View + Edit both open the Promo tab) */}
          <div className="mt-auto flex gap-2 pt-5">
            <button className={`${ghostBtn} flex-1`} onClick={() => setActiveTab('promo')}>
              <Eye className="h-4 w-4" />
              View
            </button>
            <button className={`${ghostBtn} flex-1`} onClick={() => setActiveTab('promo')}>
              <Pencil className="h-4 w-4" />
              Edit
            </button>
            {promo.active ? (
              <button className={`${stopBtn} flex-1`} onClick={() => setPending({ kind: 'stop', target: 'promo' })}>
                <CircleStop className="h-4 w-4" />
                Stop
              </button>
            ) : (
              <button
                className={`${primaryBtn} flex-1`}
                onClick={() => setPending({ kind: 'goOnAir', target: 'promo' })}
              >
                <Radio className="h-4 w-4" />
                Go on air
              </button>
            )}
          </div>
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
            <div className="flex h-32 items-center overflow-hidden rounded-xl border border-border bg-surface-subtle p-3 shadow-inner">
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

          {/* meta */}
          <div className="mt-4 space-y-2.5">
            <div className="flex items-center gap-2 text-sm text-on-surface-variant">
              <Megaphone className="h-4 w-4 shrink-0" />
              <span>
                {annCount} message{annCount === 1 ? '' : 's'} {ann.active ? 'showing now' : 'ready'}
              </span>
            </div>
            <div className="flex items-center gap-2 text-sm text-on-surface-variant">
              <Clock className="h-4 w-4 shrink-0" />
              <span>{ann.active ? 'On air on your site' : 'Hidden — not showing on your site'}</span>
            </div>
            {scheduledMsgs > 0 && (
              <div className="flex items-center gap-2 text-sm text-on-surface-variant">
                <Calendar className="h-4 w-4 shrink-0" />
                <span>
                  {scheduledMsgs} of {annCount} message{annCount === 1 ? '' : 's'} scheduled
                </span>
              </div>
            )}
            {ann.loop && (
              <div className="flex items-center gap-2 text-sm text-on-surface-variant">
                <Repeat className="h-4 w-4 shrink-0" />
                <span>Continuous loop</span>
              </div>
            )}
          </div>

          {/* actions — View · Edit · lifecycle (View + Edit both open the Announcement tab) */}
          <div className="mt-auto flex gap-2 pt-5">
            <button className={`${ghostBtn} flex-1`} onClick={() => setActiveTab('announcement')}>
              <Eye className="h-4 w-4" />
              View
            </button>
            <button className={`${ghostBtn} flex-1`} onClick={() => setActiveTab('announcement')}>
              <Pencil className="h-4 w-4" />
              Edit
            </button>
            {ann.active ? (
              <button
                className={`${stopBtn} flex-1`}
                onClick={() => setPending({ kind: 'stop', target: 'announcement' })}
              >
                <CircleStop className="h-4 w-4" />
                Stop
              </button>
            ) : (
              <button
                className={`${primaryBtn} flex-1`}
                onClick={() => setPending({ kind: 'goOnAir', target: 'announcement' })}
              >
                <Radio className="h-4 w-4" />
                Go on air
              </button>
            )}
          </div>
        </div>
      </section>

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

      {/* Announcement bar preview popup — matches the Announcement tab: the bar spans
          the page content width (max-w-[1840px] with the same 24px side padding),
          not edge-to-edge. Animated replica: real styles, all messages, loop, speed. */}
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
