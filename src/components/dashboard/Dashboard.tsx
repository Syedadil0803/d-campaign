'use client';

import { useEffect, useRef, useState } from 'react';
import {
  Pencil,
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
import { DashboardLifecycleCards } from '@/components/dashboard/DashboardLifecycleCards';
import { DashboardPopups } from '@/components/dashboard/DashboardPopups';
import { CommandBar } from '@/components/dashboard/CommandBar'; // <-- ADD THIS IMPORT

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
  promoDraftExists?: boolean;
  onOpenDraft?: () => void;
}

/** No copy anywhere on the card — the operator hasn't created one yet. */
function isPromoUncreated(promo: CampaignConfig['promoCard']): boolean {
  return !stripHtml(promo.title) && !stripHtml(promo.subtitle) && !stripHtml(promo.description);
}

export function Dashboard({
  config,
  setActiveTab,
  onStopPromo,
  onGoOnAirPromo,
  onStopAnnouncement,
  onGoOnAirAnnouncement,
  onCreatePromo,
  onEditLivePromo,
  promoUnpublished,
  announcementUnpublished,
  promoDraftExists,
  onOpenDraft,
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
  // Actionable readiness checks — what actually needs the operator's attention.
  // Actionable readiness checks — what actually needs the operator's attention.
  const checks: { ok: boolean; text: string; severity?: 'high' | 'medium' | 'low'; action?: { label: string; onClick: () => void } }[] = [];

  // P0 (Critical) - Live Promo missing CTA link
  if (promo.active && !hasCta) {
    checks.push({
      ok: false,
      text: 'Promo Card has no call-to-action',
      severity: 'high',
      action: { label: 'Fix', onClick: () => setActiveTab('promo') },
    });
  }

  // P0 (Critical) - Unsaved edits in browser memory (Promo)
  if (promoUnpublished) {
    checks.push({
      ok: false,
      text: 'Unsaved local edits (Promo)',
      severity: 'high',
      action: { label: 'Resume', onClick: () => setActiveTab('promo') },
    });
  }

  // P0 (Critical) - Unsaved edits in browser memory (Announcement)
  if (announcementUnpublished) {
    checks.push({
      ok: false,
      text: 'Unsaved local edits (Bar)',
      severity: 'high',
      action: { label: 'Resume', onClick: () => setActiveTab('announcement') },
    });
  }

  // P1 (Warning) - Promo Card toggled OFF
  if (!promo.active) {
    checks.push({
      ok: false,
      text: 'Promo Card is turned OFF',
      severity: 'medium',
      action: { label: 'Turn On', onClick: () => setPending({ kind: 'goOnAir', target: 'promo' }) },
    });
  }

  // P1 (Warning) - Announcement Bar toggled OFF
  if (!ann.active) {
    checks.push({
      ok: false,
      text: 'Announcement Bar is turned OFF',
      severity: 'medium',
      action: { label: 'Turn On', onClick: () => setPending({ kind: 'goOnAir', target: 'announcement' }) },
    });
  }

  // P2 (Schedule) - Scheduled message window expired (Promo)
  if (promo.active && promo.scheduleMode !== 'openEnded' && endMs && now && now.getTime() > endMs) {
    checks.push({
      ok: false,
      text: 'Schedule ended for announcement',
      severity: 'medium',
      action: { label: 'Extend', onClick: () => setActiveTab('promo') },
    });
  }

  // P3 (Info) - Persisted database draft ready (Promo)
  if (promoDraftExists) {
    checks.push({
      ok: false,
      text: 'Saved draft ready (Promo)',
      severity: 'low',
      action: {
        label: 'Review',
        onClick: () => {
          if (onOpenDraft) {
            onOpenDraft();
          } else {
            setActiveTab('promo');
          }
        },
      },
    });
  }

  // If everything is healthy
  if (checks.every((c) => c.ok)) {
    checks.push({ ok: true, text: 'Promo and announcement look good' });
  }
  // The bar is on/off as a whole; each message can optionally carry its own schedule.
  const scheduledMsgs = ann.announcements.filter((a) => a.startDate || a.endDate).length;

  const liveCount = (promo.active ? 1 : 0) + (ann.active ? 1 : 0);
  const liveLabel = (() => {
    const promoActive = promo.active;
    const annActive = ann.active;

    if (promoActive && annActive) {
      return 'Promo Card & Announcement Bar are both Live';
    }
    if (promoActive && !annActive) {
      return 'Promo Card is Live  •  Announcement Bar is Off';
    }
    if (!promoActive && annActive) {
      return 'Announcement Bar is Live  •  Promo Card is Off';
    }
    // Both Off
    return 'All site campaigns are currently Paused';
  })();
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
      {/* NEW COMMAND BAR - Replaces the old command bar and attention strip */}
      <CommandBar
        lastPublished={now ? `Last published ${timeAgo(config.lastUpdated, now)}` : 'Not yet published'}
        isLive={liveCount > 0}
        liveStatusText={liveLabel}
        initialIssues={issues.map((issue, index) => ({
          id: `issue-${index}`,
          message: issue.text,
          severity: issue.severity ?? 'medium',
          action: issue.action ? {
            label: issue.action.label,
            onClick: issue.action.onClick,
          } : undefined,
        }))}
        onIssueAction={(issueId) => {
          const index = parseInt(issueId.split('-')[1]);
          const issue = issues[index];
          if (issue?.action) {
            issue.action.onClick();
          }
        }}
      />

      {/* Lifecycle cards — Studio layout: recessed preview stage + schedule/meta + actions */}
      <DashboardLifecycleCards
        promo={promo}
        ann={ann}
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