'use client';

import { useEffect, useRef, useState } from 'react';
import { Clapperboard, Eye, Gift, Megaphone, Pencil } from 'lucide-react';
import { CampaignConfig } from '@/types/campaign';
import { stripHtml, toLocalISODate } from '@/lib/utils';
import { hasCallToAction } from '@/lib/campaignCta';
import { videoStoryHasContent } from '@/lib/configSignature';
import { videoStoryStatus } from '@/lib/videoStory/videoStoryStatus';
import {
  DAY,
  clamp,
  parseDate,
  fmtRemaining,
  timeAgo,
} from '@/components/dashboard/dashboardFormat';
import {
  BroadcastsLifecycleCard,
  SmartCardLifecycleCard,
  type LifecycleCardProps,
} from '@/components/dashboard/DashboardLifecycleCards';
import { DashboardPopups, type PendingAction } from '@/components/dashboard/DashboardPopups';
import { CommandBar } from '@/components/dashboard/CommandBar';
import { DashboardVideoStoryCard } from '@/components/dashboard/DashboardVideoStoryCard';
import { DashboardSummaryTile } from '@/components/dashboard/DashboardSummaryTile';
import { DashboardCardOverlay } from '@/components/dashboard/DashboardCardOverlay';
import {
  broadcastsFact,
  broadcastsStatus,
  lastSavedLine,
  needsAttention,
  smartCardFact,
  smartCardStatus,
  tileAction,
  tilePill,
  type TileAction,
  videoStoryFact,
  type DashboardWidget,
} from '@/lib/dashboard/tileSummary';

interface DashboardProps {
  config: CampaignConfig;
  draftConfig?: CampaignConfig;
  draftSavedAt?: Date | null;
  promoSavedAt?: Date | null;
  announcementSavedAt?: Date | null;
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
  onStartNewWithDraft?: () => void;
  hasRecoveredWork?: boolean;
  /** Whether the recovered-but-unsaved content actually touches promo/announcement. */
  recoveredAffectsPromo?: boolean;
  recoveredAffectsAnnouncement?: boolean;
  recoveryReason?: 'idle' | 'crash' | null;
  onRestoreRecovery?: (side: 'promo' | 'announcement') => void;
  onDismissRecovery?: (side: 'promo' | 'announcement') => void;
  /** Recovered announcement compose text that was being typed. */
  announcementComposeTextRecovered?: boolean;
  onDismissAnnouncementComposeRecovery?: () => void;
  elsewhereNotice?: { deviceLabel: string; at: string | null; hasUnsavedPromo: boolean; hasUnsavedAnnouncement: boolean } | null;
  onDismissElsewhere?: () => void;
  /** When the Video Story's draft was saved, if it holds work not yet live. */
  videoDraftSavedAt?: Date | null;
  /** Opens the Campaigns tab on the Video Story. */
  onEditVideoStory?: () => void;
  onStopVideoStory?: () => void;
  onGoOnAirVideoStory?: () => void;
}

/** No copy anywhere on the card — the operator hasn't created one yet. */
function isPromoUncreated(promo: CampaignConfig['promoCard']): boolean {
  return !stripHtml(promo.title) && !stripHtml(promo.subtitle) && !stripHtml(promo.description);
}

/**
 * How many widgets the dashboard shows as full cards. Beyond this the cards
 * switch to compact summary tiles, so a 4th+ widget never squeezes the row.
 */
const FULL_CARD_LIMIT = 3;

export function Dashboard({
  config,
  draftSavedAt,
  promoSavedAt,
  announcementSavedAt,
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
  onStartNewWithDraft,
  hasRecoveredWork,
  recoveredAffectsPromo,
  recoveredAffectsAnnouncement,
  onRestoreRecovery,
  onDismissRecovery,
  announcementComposeTextRecovered,
  onDismissAnnouncementComposeRecovery,
  elsewhereNotice,
  onDismissElsewhere,
  videoDraftSavedAt,
  onEditVideoStory,
  onStopVideoStory,
  onGoOnAirVideoStory,
}: DashboardProps) {
  const promoUncreated = isPromoUncreated(config.promoCard);
  // Stop / go-on-air both change the live website, so confirm first.
  const [pending, setPending] = useState<PendingAction | null>(
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
  // The full card shown over the tiles, and the tile it grew out of.
  const [openCard, setOpenCard] = useState<{ widget: DashboardWidget; tile: HTMLElement } | null>(null);

  // The Smart Card only exists while its overlay is open, so measure it again
  // each time one opens — the preview popup is sized from it.
  useEffect(() => {
    const el = promoCardRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const measure = () => setCardSize({ width: el.offsetWidth, height: el.offsetHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [openCard?.widget]);

  // Date-derived values must wait for mount to avoid SSR/CSR hydration drift.
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  const promo = config.promoCard;
  const ann = config.announcementBar;
  const video = config.videoStory;
  // Before mount there is no "today" to judge an end date by (see `now`), so
  // an ended story reads as live for that first paint, never the other way.
  const videoStatus = videoStoryStatus(video, now ? toLocalISODate(now) : '');
  // Live means showing on the site. An ended story is still switched on, but
  // its dates keep it off the website, so it is not counted or labelled live —
  // it has its own "Schedule ended" check below.
  const videoOnAir = videoStatus === 'live';

  const startMs = parseDate(promo.startDate)?.getTime() ?? null;
  const endD = promo.endDate ? parseDate(promo.endDate) : null;
  const endMs = endD ? endD.getTime() + DAY - 1 : null;

  let remainingLabel = '—';
  let progressPct = 0;
  const ended = !!(now && endMs && now.getTime() > endMs);
  
  // Check if this is an open-ended campaign (no endDate)
  const isOpenEnded = !promo.endDate;
  
  if (isOpenEnded) {
    remainingLabel = 'Open ended • Till you stop it';
  } else if (now && endMs) {
    const rem = endMs - now.getTime();
    remainingLabel = fmtRemaining(rem);
    if (startMs) progressPct = Math.round(clamp(((now.getTime() - startMs) / (endMs - startMs)) * 100, 0, 100));
  }

  const annCount = ann.announcements.length;

  // Actionable readiness checks — what actually needs the operator's attention.
  const hasCta = hasCallToAction(promo);
  // Deliberately NOT listing "you have unpublished changes": the dashboard
  // mirrors what's live on the website only. Editor state is the editor's
  // business — the way back into unfinished work is My Draft below, which is
  // always available rather than appearing as an alert.
  // Actionable readiness checks — what actually needs the operator's attention.
  // Actionable readiness checks — what actually needs the operator's attention.
  // Each check names its widget so that widget's tile can say it needs attention
  // without re-deriving the rule.
  const checks: { ok: boolean; text: string; widget?: DashboardWidget; severity?: 'high' | 'medium' | 'low'; action?: { label: string; onClick: () => void } }[] = [];

  // P0 (Critical) - Live Promo missing CTA link
  if (promo.active && !hasCta) {
    checks.push({
      ok: false,
      text: 'Smart Card has no call-to-action',
      widget: 'promo',
      severity: 'high',
      action: { label: 'Fix', onClick: () => setActiveTab('promo') },
    });
  }

  // P0 (Critical) - Unsaved edits in browser memory (Promo)
  if (promoUnpublished) {
    checks.push({
      ok: false,
      text: 'Unsaved local edits (Smart Card)',
      widget: 'promo',
      severity: 'high',
      action: { label: 'Resume', onClick: () => setActiveTab('promo') },
    });
  }

  // P0 (Critical) - Unsaved edits in browser memory (Announcement)
  if (announcementUnpublished) {
    checks.push({
      ok: false,
      text: 'Unsaved local edits (Broadcasts)',
      widget: 'announcement',
      severity: 'high',
      action: { label: 'Resume', onClick: () => setActiveTab('announcement') },
    });
  }

  // P1 (Warning) - Promo Card toggled OFF
  if (!promo.active) {
    checks.push({
      ok: false,
      text: 'Smart Card is turned OFF',
      widget: 'promo',
      severity: 'medium',
      action: { label: 'Turn On', onClick: () => setPending({ kind: 'goOnAir', target: 'promo' }) },
    });
  }

  // P1 (Warning) - Announcement Bar toggled OFF
  if (!ann.active) {
    checks.push({
      ok: false,
      text: 'Broadcasts are turned OFF',
      widget: 'announcement',
      severity: 'medium',
      action: { label: 'Turn On', onClick: () => setPending({ kind: 'goOnAir', target: 'announcement' }) },
    });
  }

  // P2 (Schedule) - Scheduled message window expired (Promo)
  if (promo.active && promo.scheduleMode !== 'openEnded' && endMs && now && now.getTime() > endMs) {
    checks.push({
      ok: false,
      text: 'Schedule ended for Smart Card',
      widget: 'promo',
      severity: 'medium',
      action: { label: 'Extend', onClick: () => setActiveTab('promo') },
    });
  }

  // The Video Story's own checks, once one exists — a site that never made
  // one has nothing to fix and must not be told it is "turned OFF".
  if (video && videoOnAir && !videoStoryHasContent(video)) {
    checks.push({
      ok: false,
      text: 'Video Story has no video',
      widget: 'videoStory',
      severity: 'high',
      action: { label: 'Fix', onClick: () => onEditVideoStory?.() },
    });
  }
  if (video && videoOnAir && !hasCallToAction(video)) {
    checks.push({
      ok: false,
      text: 'Video Story has no call-to-action',
      widget: 'videoStory',
      severity: 'high',
      action: { label: 'Fix', onClick: () => onEditVideoStory?.() },
    });
  }
  if (videoStatus === 'off') {
    checks.push({
      ok: false,
      text: 'Video Story is turned OFF',
      widget: 'videoStory',
      severity: 'medium',
      action: { label: 'Turn On', onClick: () => setPending({ kind: 'goOnAir', target: 'videoStory' }) },
    });
  }
  if (videoStatus === 'ended') {
    checks.push({
      ok: false,
      text: 'Schedule ended for Video Story',
      widget: 'videoStory',
      severity: 'medium',
      action: { label: 'Extend', onClick: () => onEditVideoStory?.() },
    });
  }

  // P3 (Info) - Persisted database draft ready (Promo)
  if (promoDraftExists) {
    checks.push({
      ok: false,
      text: 'Saved draft ready (Smart Card)',
      widget: 'promo',
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

  const liveCount = (promo.active ? 1 : 0) + (ann.active ? 1 : 0) + (videoOnAir ? 1 : 0);
  const cardAndBarLabel = (() => {
    const promoActive = promo.active;
    const annActive = ann.active;

    if (promoActive && annActive) {
      return 'Smart Card & Broadcasts are both Live';
    }
    if (promoActive && !annActive) {
      return 'Smart Card is Live  •  Broadcasts are Off';
    }
    if (!promoActive && annActive) {
      return 'Broadcasts are Live  •  Smart Card is Off';
    }
    // Both Off
    return videoOnAir
      ? 'Smart Card & Broadcasts are Off'
      : 'All site campaigns are currently Paused';
  })();
  const liveLabel = videoOnAir ? `${cardAndBarLabel}  •  Video Story is Live` : cardAndBarLabel;
  const issues = checks.filter((c) => !c.ok);

  const PENDING_COPY = {
    'promo-stop': {
      title: 'Stop the Smart Card',
      body: 'It comes off your website right away — visitors will stop seeing it.',
      cta: 'Stop card',
      danger: true,
    },
    'promo-goOnAir': {
      title: 'Put the Smart Card on air',
      body: 'It goes live on your website now — visitors will start seeing it.',
      cta: 'Go on air',
      danger: false,
    },
    'announcement-stop': {
      title: 'Stop the Broadcasts',
      body: 'It stops showing on your website right away.',
      cta: 'Stop bar',
      danger: true,
    },
    'announcement-goOnAir': {
      title: 'Put the Broadcasts on air',
      body: 'It starts showing on your website now.',
      cta: 'Go on air',
      danger: false,
    },
    'videoStory-stop': {
      title: 'Stop the Video Story',
      body: 'It comes off your website right away — visitors stop seeing it.',
      cta: 'Stop video',
      danger: true,
    },
    'videoStory-goOnAir': {
      title: 'Put the Video Story on air',
      body: 'It goes live on your website now — visitors start seeing it.',
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
    } else if (pending.target === 'videoStory') {
      if (pending.kind === 'stop') onStopVideoStory?.();
      else onGoOnAirVideoStory?.();
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
        aria-label="View Smart Card preview"
        className={overlayAction}
      >
        <Eye className="h-4 w-4" />
        View
      </button>
      {!promoUncreated && (
        <button
          type="button"
          onClick={() => onEditLivePromo?.()}
          aria-label="Edit the live Smart Card"
          className={overlayAction}
        >
          <Pencil className="h-4 w-4" />
          Edit
        </button>
      )}
    </div>
  );

  const promoRecovered = Boolean(hasRecoveredWork && recoveredAffectsPromo);
  const announcementRecovered = Boolean((hasRecoveredWork && recoveredAffectsAnnouncement) || announcementComposeTextRecovered);
  const cardProps: LifecycleCardProps = {
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
    promoRecovered,
    announcementRecovered,
    onRestoreRecovery,
    onDismissRecovery,
    onDismissAnnouncementComposeRecovery,
    promoUnpublished,
    announcementUnpublished,
    onOpenDraft,
    onStartNewWithDraft,
    draftSavedAt: draftSavedAt ? draftSavedAt.toISOString() : undefined,
    promoSavedAt: promoSavedAt ? promoSavedAt.toISOString() : undefined,
    announcementSavedAt: announcementSavedAt ? announcementSavedAt.toISOString() : undefined,
    elsewhereNotice,
    onDismissElsewhere,
  };
  const todayIso = now ? toLocalISODate(now) : '';
  const promoStatus = smartCardStatus(promoUncreated, promo.active, ended);
  // Broadcasts, Smart Card, Video Story — the order the cards have always had.
  const allTiles = [
    {
      widget: 'announcement' as const,
      icon: Megaphone,
      title: 'Broadcasts',
      subtitle: 'Sitewide header',
      status: broadcastsStatus(ann),
      fact: broadcastsFact(ann),
      // The same draft the full card offers Resume Draft / Save & Continue for.
      hasDraft: announcementRecovered || Boolean(announcementUnpublished),
      savedAt: cardProps.announcementSavedAt,
      // Resume Draft on the full card does exactly this too.
      go: () => setActiveTab('announcement'),
      card: <BroadcastsLifecycleCard {...cardProps} />,
    },
    {
      widget: 'promo' as const,
      icon: Gift,
      title: 'Smart Card',
      subtitle: 'Floating card',
      status: promoStatus,
      fact: smartCardFact(promo, promoStatus, todayIso),
      hasDraft: promoRecovered || Boolean(promoUnpublished),
      savedAt: cardProps.promoSavedAt,
      // The full card's own handlers: Resume Draft, the thumbnail's Edit, Create.
      go: (action: TileAction) => {
        const handler = { Resume: onOpenDraft, Open: onEditLivePromo, Create: onCreatePromo }[action];
        if (handler) handler();
        else setActiveTab('promo');
      },
      card: <SmartCardLifecycleCard {...cardProps} />,
    },
    {
      widget: 'videoStory' as const,
      icon: Clapperboard,
      title: 'Video Story',
      subtitle: 'Floating video',
      status: videoStatus,
      fact: videoStoryFact(video),
      hasDraft: Boolean(videoDraftSavedAt),
      savedAt: videoDraftSavedAt?.toISOString(),
      go: () => onEditVideoStory?.(),
      card: (
        <DashboardVideoStoryCard
          vs={video}
          status={videoStatus}
          draftSavedAt={videoDraftSavedAt ? videoDraftSavedAt.toISOString() : null}
          onEdit={() => onEditVideoStory?.()}
          onStop={() => setPending({ kind: 'stop', target: 'videoStory' })}
          onGoOnAir={() => setPending({ kind: 'goOnAir', target: 'videoStory' })}
        />
      ),
    },
  ];
  // A Video Story nobody has started (not published, no saved draft) gets no
  // card: the dashboard stays the two-card screen until one exists. It is
  // created from the Campaigns menu.
  const tiles = allTiles.filter(
    (t) => t.widget !== 'videoStory' || videoStatus !== 'notCreated' || Boolean(videoDraftSavedAt),
  );
  const openTile = tiles.find((t) => t.widget === openCard?.widget);
  // Up to FULL_CARD_LIMIT widgets show as full cards side by side; past that
  // they switch to compact tiles that open the full card on click.
  const showFullCards = tiles.length <= FULL_CARD_LIMIT;

  return (
    // 1200 for the two-card screen; wider with a third card so three full
    // cards fit in one row.
    <div className={`mx-auto ${tiles.length > 2 ? 'max-w-[1400px]' : 'max-w-[1200px]'} flex flex-col gap-4 px-8 py-8`}>
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

      {showFullCards ? (
        // Full cards in one row from a small laptop up (1024px), one per row
        // below that, so a third card never sits alone on a second row. A
        // row's cards stretch to the tallest so they line up; a card too
        // narrow for its two buttons side by side stacks them instead.
        <div className={`grid grid-cols-1 gap-6 ${tiles.length > 2 ? 'lg:grid-cols-3' : 'md:grid-cols-2'}`}>
          {tiles.map((t) => (
            <div key={t.widget} className="flex [&>*]:w-full">{t.card}</div>
          ))}
        </div>
      ) : (
      /* One tile per widget; the full card opens over them (DashboardCardOverlay).
          auto-fit at 280px: three across on a laptop, two on a tablet, one on a phone. */
      <div className="grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-6">
        {tiles.map((t, i) => (
          <DashboardSummaryTile
            key={t.widget}
            index={i}
            icon={t.icon}
            title={t.title}
            subtitle={t.subtitle}
            pill={tilePill(t.status, needsAttention(issues, t.widget))}
            issues={issues.filter((i) => i.widget === t.widget).map((i) => i.text)}
            fact={t.fact}
            lastSaved={lastSavedLine(t.savedAt)}
            actionLabel={tileAction(t.status, t.hasDraft)}
            onOpen={(tile) => setOpenCard({ widget: t.widget, tile })}
            onAction={() => t.go(tileAction(t.status, t.hasDraft))}
          />
        ))}
      </div>
      )}

      {openTile && openCard && (
        <DashboardCardOverlay
          tile={openCard.tile}
          title={openTile.title}
          suspended={Boolean(pending) || showSchedule || showAnnPreview || showPromoPreview}
          onClosed={() => setOpenCard(null)}
        >
          {openTile.card}
        </DashboardCardOverlay>
      )}

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