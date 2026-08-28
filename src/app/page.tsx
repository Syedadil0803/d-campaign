'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  useIdleSignOut,
  IDLE_LIMIT_MS,
  IDLE_WARNING_LEAD_MS,
} from '@/hooks/useIdleSignOut';
import {
  writeRecovery,
  clearRecovery,
} from '@/lib/recovery';
import { isInvalidRange, anyInvalidRange } from '@/lib/dateRange';
import { SlidersHorizontal, Clock } from 'lucide-react';
import { CampaignConfig } from '@/types/campaign';
import { cardIsNotUserWork } from '@/lib/promo/promoAuthorship';
import { forgetVisit } from '@/lib/promo/blankLooks';
import { isBlankLook } from '@/lib/promo/lookSignature';
import { sampleTemplates } from '@/components/promo/SamplePromoTemplates';
import { Header } from '@/components/shell/Header';
import { Dashboard } from '@/components/dashboard/Dashboard';
import { AnnouncementSection } from '@/components/announcement/AnnouncementSection';
import { PromoFlow } from '@/components/promo/PromoFlow';
import { PromoSetupDialog } from '@/components/promo/PromoSetupDialog';
import { Toast, TOAST_ACTION_MS } from '@/components/shared/Toast';
import {
  UnsavedWorkDialog,
  VariantSlotFullDialog,
  PublishConfirmDialog,
  DashboardUnsavedDialog,
  DiscardDraftDialog,
  ReplaceDraftDialog,
} from '@/components/shell/CampaignDialogs';
import { isFirstLoadOfVisit } from '@/lib/visit';
import { useCampaignConfig } from '@/hooks/useCampaignConfig';
import { useCampaignDraft } from '@/hooks/useCampaignDraft';
import { useToast } from '@/hooks/useToast';
import { usePromoVariantSaves } from '@/hooks/usePromoVariantSaves';
import { useCampaignPublishing } from '@/hooks/useCampaignPublishing';
import { getISODateWithOffset } from '@/lib/utils';
import {
  getConfigSignature,
  normalizePromoForCompare,
  getPromoSignature,
  promoHasVisibleContent,
} from '@/lib/configSignature';
import {
  describeWhen,
  fetchUnsavedElsewhere,
  reportUnsaved,
} from '@/lib/auth/presenceClient';
import {
  askNotificationPermission,
  describeDuration,
  notificationPermission,
  notificationsSupported,
  osNotificationHint,
  unblockSteps,
} from '@/lib/auth/sessionWarning';
import {
} from '@/lib/promo/promoVersions';

/**
 * How long the editor sits untouched before signing itself out.
 *
 * Deliberately tiny while this is being tried out: thirty seconds of quiet,
 * then thirty seconds of countdown. Both want raising well before anyone
 * relies on them — the flow they exercise is the interesting part, not the
 * numbers.
 */









/**
 * The template cards, built once.
 *
 * sampleTemplates is a module constant, so mapping it inside the component
 * allocated a fresh twelve-element array on every render for a value that can
 * never change.
 */
const TEMPLATE_CARDS = sampleTemplates.map(
  (t) => t.promoCard as CampaignConfig['promoCard'],
);

export default function Home() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'announcement' | 'promo'>('dashboard');
  // `config` is the editing/draft state (what the editors show). `publishedConfig`
  // is what's actually LIVE on the website — the Dashboard renders this so it
  // never shows unpublished draft content as if it were live.








  const {
    showToast,
    toastMessage,
    toastIsError,
    toastAction,
    toast,
  } = useToast();
  const [publishConfirm, setPublishConfirm] = useState<{
    warnings: string[];
    onConfirm: () => Promise<void> | void;
    title?: string;
    message?: string;
    confirmLabel?: string;
    cancelLabel?: string;
    // When true, confirm runs onConfirm as-is (e.g. to open a follow-up popup)
    // WITHOUT the "Publishing…" state — avoids a flicker when chaining popups.
    deferPublish?: boolean;
    // Runs when the popup is dismissed (Cancel / backdrop) — e.g. to revert a
    // provisional state change.
    onCancel?: () => void;
  } | null>(null);
  const [isPublishing, setIsPublishing] = useState(false);
  // Which guided-flow step the promo tab is on. Publish is an editor action, so
  // the header hides it while the user is still picking a start or writing copy.
  // Where the promo tab opens. Dashboard's View/Edit act on an existing
  // campaign, so they go straight to the editor; the nav tab starts fresh.
  // Includes 'ai' so the dashboard's create dialog can send someone straight
  // to the AI screen without passing through the editor first.
  // Where the promo tab opens: the editor, or the editor with the AI panel
  // already up. There is no separate start screen any more.
  const [promoEntryStep, setPromoEntryStep] = useState<'ai' | 'build' | 'editor'>('editor');
  const mainScrollRef = useRef<HTMLElement>(null);


  const [isConfirming, setIsConfirming] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);

  /**
   * What the config hook needs from the draft, and nothing else.
   *
   * The two own each other's problems — loading decides whether to offer a
   * draft back, saving one rewrites the signatures the config holds — so one
   * is built first and handed the other's smaller surface.
   */
  /**
   * usePromoVariantSaves needs the config, and the config hook needs one
   * function from it, so one has to come second. Only ever called from a
   * publish, never during render.
   */
  /**
   * The promo canvas was cleared and nothing has been chosen since.
   *
   * Held here rather than inside the editor because the editor unmounts every
   * time the user visits another tab. It went with it, so a cleared card came
   * back without its countdown and button outlines and looked like it had
   * quietly lost half of itself. The flag describes the card, and the card
   * lives here.
   */
  const [promoBlankStart, setPromoBlankStart] = useState(false);

  /**
   * The session ended without the user ending it — a timeout, or the machine
   * going away — and their work was put back.
   *
   * Shown after the fact, never as a question. They did not choose to stop, so
   * the editor restores what they had and then says so; asking "want it back?"
   * makes an accident into a decision they have to get right.
   */
  const [restoreNotice, setRestoreNotice] = useState<{
    /** When the local copy was taken. Empty for copies written before it was recorded. */
    localSavedAt: string | null;
    /** When the parked draft was saved, if there is one. Null means there isn't. */
    draftSavedAt: string | null;
    /**
     * The draft is newer than the work being restored.
     *
     * Which means it was saved after this browser stopped — from somewhere
     * else, by definition, since this browser was gone. Worth saying before
     * they replace it, because the usual assumption is the opposite: that the
     * draft is the older thing and these edits move it forward.
     */
    draftIsNewer: boolean;
  } | null>(null);

  const ensureLiveVariantRef = useRef<
    (cfg: CampaignConfig) => Promise<CampaignConfig>
  >(async (cfg) => cfg);







  // The published config object (not just its signature) — lets draft checks
  // compare the announcement against what's live.














  /**
   * Raise the notification card, once per visit.
   *
   * Silent only when the permission is already granted. Denied still gets a
   * card, because the way it usually happens is someone accepting here and
   * then hitting Block in the browser's prompt — they wanted this and ended up
   * without it. What it says changes, though: an Allow button against a denied
   * permission is a button that does nothing.
   */
  useEffect(() => {
    if (!notificationsSupported()) return;
    const permission = notificationPermission();
    if (permission === 'granted') return; // Nothing to ask for.
    setAskNotifications(permission === 'denied' ? 'blocked' : 'ask');
  }, []);

  /**
   * Is any OTHER browser holding unsaved work for this account?
   *
   * This browser names itself so the server can leave it out — its own flag is
   * still up while it holds work, and reporting that back would tell someone
   * their edits are elsewhere while they are looking at them. A device holding
   * unsaved work cannot hand it over either, so the answer only ever explains
   * why that work is not here.
   */
  useEffect(() => {
    let cancelled = false;
    // Said once a visit — see isFirstLoadOfVisit.
    if (!isFirstLoadOfVisit()) return;

    fetchUnsavedElsewhere().then((elsewhere) => {
      if (cancelled || !elsewhere) return;
      setElsewhereNotice({
        deviceId: elsewhere.deviceId,
        deviceLabel: elsewhere.deviceLabel,
        at: elsewhere.at,
      });
    });
    return () => {
      cancelled = true;
    };
  }, []);


  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  useEffect(() => {
    mainScrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, [activeTab]);

  /**
   * Offer the saved draft once the promo editor is actually open.
   *
   * A dialog rather than a toast: this is a question, and a toast is a poor
   * place to ask one — it times out while the user is still reading, and
   * answering it means hitting a target that is about to disappear.
   *
   * The ref is cleared as it opens, so switching tabs back and forth doesn't
   * re-ask about a draft already passed on. Declining leaves it saved and
   * reachable from the My Draft chip.
   */
  useEffect(() => {
    if (activeTab !== 'promo') {
      // Leaving the tab answers it: the question was about this editor, and a
      // dialog rendered at page level would otherwise follow the user to the
      // dashboard and be waiting again on every return. The draft is not
      // touched — it stays on the My Draft chip.
      setDraftOffer(null);
      return;
    }
    if (!offeredDraftRef.current) return;
    setDraftOffer(offeredDraftRef.current);
    offeredDraftRef.current = null;
  }, [activeTab]);

  /**
   * A dashboard action held back because the editor has work that isn't in the
   * draft. Both entries lead somewhere that replaces the canvas, so the user
   * is offered the save here rather than losing it silently.
   */
  const [pendingDashboardAction, setPendingDashboardAction] = useState<
    'create' | 'published' | null
  >(null);
  // Bumped to open the build panel when the flow is already mounted.
  const [openBuildSignal, setOpenBuildSignal] = useState(0);
  // Bumped once the real card lands from the DB. The editor mounts on
  // defaultConfig, so anything the editor seeds from the card at mount time
  // would otherwise freeze on the default template's look.


  const [promoTimerAutoArmed, setPromoTimerAutoArmed] = useState(false);



  /**
   * Unsaved work is sitting in a different browser.
   *
   * There is nothing to restore here — that is the whole message. Work that was
   * never saved as a draft stays in the browser that made it, so the only
   * honest thing to say is where it is and how to get it back.
   */
  const [elsewhereNotice, setElsewhereNotice] = useState<{
    deviceId: string;
    deviceLabel: string;
    at: string | null;
  } | null>(null);

  /**
   * The draft is built before the campaign because the campaign needs its
   * state; the campaign is handed back through this ref, which every draft
   * function reads at call time.
   */
  const campaignRef = useRef<ReturnType<typeof useCampaignConfig> | null>(null);

  const draft = useCampaignDraft({
    campaignRef,
    toast,
    performLogout,
    setActiveTab,
    setPromoEntryStep,
    setRestoreNotice,
    elsewhereNotice,
    setElsewhereNotice,
  });
  const {
    savedDraftSignature,
    draftSignatureRef,
    draftPromoCard,
    savingDraft,
    confirmReplaceDraft,
    setConfirmReplaceDraft,
    confirmDiscardDraft,
    setConfirmDiscardDraft,
    offeredDraftRef,
    draftOffer,
    setDraftOffer,
    postPublishDraft,
    setPostPublishDraft,
    pendingDraftAction,
    setPendingDraftAction,
    promoWorkNotInDraftRef,
    writeDraftNow,
    discardDraft,
    handleDeleteDraft,
    handleSaveAsDraft,
    acceptOfferedDraft,
    clearDraft,
    saveDraftAndContinue,
    continueWithoutDraft,
    dismissWelcomeBack,
  } = draft;

  const campaign = useCampaignConfig({
    toast,
    promoBlankStart,
    setPromoEntryStep,
    setRestoreNotice,
    ensureLivePromoVariant: (cfg: CampaignConfig) =>
      ensureLiveVariantRef.current(cfg),
    draftPort: draft,
  });
  campaignRef.current = campaign;

  const {
    config,
    setConfig,
    configRef,
    publishedConfig,
    setPublishedConfig,
    publishedConfigRef,
    publishedConfigObjRef,
    savedPromoSignatureRef,
    hasLoadedOnceRef,
    hasAnnouncementChanges,
    setHasAnnouncementChanges,
    hasAnnouncementChangesRef,
    hasPromoChanges,
    setHasPromoChanges,
    readyToPublishAnnouncement,
    setReadyToPublishAnnouncement,
    configLoadedSignal,
    editorResetKey,
    setEditorResetKey,
    blankPromoCard,
    markAnnouncementChanged,
    markPromoChanged,
    loadConfig,
    persistConfig,
    } = campaign;

  // Announcement still stages via Save → Publish (promo saves straight to a
  // draft from the tab strip instead, so it has no staged/"ready" state).
  const hasChanges = hasAnnouncementChanges || hasPromoChanges;
  // Any pending draft work (unsaved edits OR a staged-but-unpublished
  // announcement) — a live on-air toggle must preserve this, not discard it.
  const pendingDraft = hasChanges || readyToPublishAnnouncement;
  const pendingDraftRef = useRef(pendingDraft);
  pendingDraftRef.current = pendingDraft;
  const hasChangesRef = useRef(hasChanges);
  hasChangesRef.current = hasChanges;

  const {
    pendingVariantSave,
    setPendingVariantSave,
    setSelectedPromoVersionId,
    promoVariants,
    refreshPromoVariants,
    getPromoVariantSaveStatus,
    markVariantLive,
    savePromoVariant,
    ensureLivePromoVariant,
    savePendingVariantAndClose,
    updateExistingVariantAndClose,
    cancelPendingVariantSave,
    getSelectedPendingVariant,
  } = usePromoVariantSaves({
    savedPromoSignatureRef,
    persistConfig,
    setIsPublishing,
  });
  ensureLiveVariantRef.current = ensureLivePromoVariant;

  useEffect(() => {
    refreshPromoVariants();
  }, [refreshPromoVariants]);

  useEffect(() => {
    loadConfig();
    
    const savedDarkMode = localStorage.getItem('darkMode');
    if (savedDarkMode !== null) {
      setIsDarkMode(savedDarkMode === 'true');
    } else {
      setIsDarkMode(window.matchMedia('(prefers-color-scheme: dark)').matches);
    }
  }, []);

  useEffect(() => {
    const promoAtRisk = promoWorkNotInDraftRef.current;
    const announcementAtRisk =
      hasAnnouncementChanges &&
      draftSignatureRef.current !== getConfigSignature(config);

    if (!promoAtRisk && !announcementAtRisk) {
      /**
       * Nothing at risk means nothing to recover — so the copy goes.
       *
       * Leaving it was the bug behind "Clear doesn't clear": clearing the
       * canvas puts the card beyond risk, this effect returned without writing
       * anything, and the copy taken a moment earlier stayed on disk. The next
       * visit dutifully restored the card the user had just thrown away.
       *
       * Guarded on a load having happened, because on first mount the config
       * is the default and nothing is at risk yet — clearing here would delete
       * the very copy loadConfig is about to read.
       */
      if (hasLoadedOnceRef.current) clearRecovery();
      return;
    }

    const id = window.setTimeout(() => writeRecovery(config), 800);
    return () => window.clearTimeout(id);
  }, [config, hasAnnouncementChanges]);

  /**
   * Keep the account's one-bit answer to "is work sitting unsaved somewhere?"
   * current.
   *
   * This is the only thing the server is told about unsaved work. Not the
   * card — that is the point of it being unsaved, and copying it up on every
   * edit would both cost a round trip per keystroke and quietly keep something
   * the user never asked us to keep. A boolean, the browser it is in, and when:
   * enough for another device to explain itself, and nothing more.
   *
   * Sent on the change, never on a timer, and `false` only when this browser
   * was the one that said `true`. Reporting "all clear" unconditionally would
   * let a second device wipe out the first device's claim just by loading the
   * editor, which is exactly the warning this exists to give.
   */
  useEffect(() => {
    const atRisk =
      promoWorkNotInDraftRef.current ||
      (hasAnnouncementChanges && draftSignatureRef.current !== getConfigSignature(config));
    if (reportedUnsavedRef.current === atRisk) return;

    const id = window.setTimeout(() => {
      reportedUnsavedRef.current = atRisk;
      reportUnsaved(atRisk);
    }, 1000);
    return () => window.clearTimeout(id);
  }, [config, hasAnnouncementChanges]);

  // Declared here because useIdleSignOut takes them.
  const [idleSecondsLeft, setIdleSecondsLeft] = useState<number | null>(null);
  const idleRestartRef = useRef<(() => void) | null>(null);
  const exitReasonRef = useRef<'logout' | 'timeout' | null>(null);
  const idleSecondsLeftRef = useRef<number | null>(null);
  useIdleSignOut({
    configRef,
    promoWorkNotInDraftRef,
    hasAnnouncementChangesRef,
    draftSignatureRef,
    exitReasonRef,
    idleSecondsLeftRef,
    setIdleSecondsLeft,
    idleRestartRef,
  });

  /**
   * Leaving is never a question any more.
   *
   * The browser's "Leave site?" prompt used to guard this, with the tool
   * offering a draft to anyone who cancelled. It went because it was answering
   * the wrong question. Closing a tab is not a decision about the work — most
   * of the time it is a machine going to sleep, a window being tidied, or a
   * shutdown — and a prompt there asks people to make a call about something
   * they were not thinking about, at the one moment they are trying to be
   * elsewhere. Worse, it could only ever be a warning: the browser will not
   * say which button was pressed, so the tool had to guess, and answering
   * Leave threw the work away on the strength of that guess.
   *
   * What replaces it is the same thing that already handles a crash: the work
   * is on disk before the page goes, and it comes back on the way in. Nothing
   * is asked, and nothing is lost.
   */
  useEffect(() => {
    const preserveWork = () => {
      const atRisk =
        promoWorkNotInDraftRef.current ||
        (hasAnnouncementChangesRef.current &&
          draftSignatureRef.current !== getConfigSignature(configRef.current));
      if (!atRisk) return;

      // Synchronous, so it completes while the page still exists — the
      // debounced autosave may have up to 800ms of edits still pending.
      writeRecovery(configRef.current);
      // Raised now rather than left to the debounced reporter, which will not
      // get another turn. keepalive carries it past the page's death.
      if (!reportedUnsavedRef.current) reportUnsaved(true);
    };

    /**
     * The page is going.
     *
     * `persisted` means it is being frozen for back/forward cache rather than
     * closed — it will be resumed with everything still in memory, so there is
     * nothing to save and no visit to restore on.
     *
     * Signing out is the one exit that still discards: it is a deliberate act,
     * and the user was offered the draft slot on the way. Everything else —
     * closing, timing out, the lid shutting — keeps the copy.
     */
    const handlePageHide = (e: PageTransitionEvent) => {
      if (e.persisted) return;
      if (exitReasonRef.current === 'logout') return;
      preserveWork();
    };

    /**
     * A tab is hidden before it is discarded, and on mobile a page can be
     * killed while hidden without `pagehide` ever firing. Saving here as well
     * costs a localStorage write on a tab switch and buys the phone case.
     */
    const handleVisibility = () => {
      if (document.visibilityState === 'hidden' && !exitReasonRef.current) preserveWork();
    };

    window.addEventListener('pagehide', handlePageHide);
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      window.removeEventListener('pagehide', handlePageHide);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);

  /**
   * Rebuild both flags from the card whenever one is loaded.
   *
   * They are React state, so a reload wipes them — and a reload is exactly
   * when work comes back. Typing a title, closing the tool and returning
   * restored the card but not the fact that its canvas had been cleared, so
   * the countdown and button outlines were missing from a card that plainly
   * still needed them.
   *
   * Both are readable from the card, which is the real record: a card still
   * wearing the blank look has had no design chosen, and one with no end date
   * has a schedule left to finish. Deriving them here means every path that
   * loads a card — recovery, draft, published, a fresh page — gets the same
   * answer without having to remember to set anything.
   */
  useEffect(() => {
    if (!configLoadedSignal) return;
    const card = configRef.current.promoCard;
    const wearingBlank = isBlankLook(card.style);
    /**
     * A blank start needs an empty card, not just an unstyled one.
     *
     * Publishing a card with only a headline and opening it again showed
     * "A supporting line" and "A little more about the offer" in the fields
     * left empty — placeholders, but indistinguishable from the tool having
     * written copy nobody asked for. Whatever was empty when it was saved has
     * to be empty when it comes back.
     */
    const plain = (html?: string) => String(html ?? '').replace(/<[^>]*>/g, '').trim();
    const hasWords = Boolean(
      plain(card.title) || plain(card.subtitle) || plain(card.description) || plain(card.buttonText),
    );
    setPromoBlankStart(wearingBlank && !hasWords);
    hasLoadedOnceRef.current = true;
    // Only armed while the end date is still the missing piece. A restored
    // card that already has one must not have its countdown switched on for it.
    setPromoTimerAutoArmed(wearingBlank && !card.endDate);
  }, [configLoadedSignal]);

  /**
   * Why the page is leaving, when the app is the one making it leave.
   *
   * Both cases have to skip the browser's leave prompt — it is meant for a
   * user closing a tab, not for the app navigating on their behalf. They then
   * split on the local copy: signing out is a decision, and follows the same
   * rule as answering Leave to the close prompt, so the copy goes. Timing out
   * is not a decision at all, so the copy stays and is what gets restored on
   * the way back in.
   */

  /** What we last told the server, so a save clears only a flag we raised. */
  const reportedUnsavedRef = useRef(false);

  /**
   * Seconds left before an idle sign-out, or null when nothing is pending.
   *
   * Only the button clears it. Ordinary activity resets the timer right up
   * until the warning appears, but once it is on screen it wants an answer —
   * a stray scroll from a cat on the keyboard is not somebody saying they are
   * still there, and the dialog blocks the editor anyway.
   */

  /**
   * The notification card, and which of two things it has to say.
   *
   * 'ask' is the offer, shown before the browser's own prompt so that "Not
   * now" costs nothing — it dismisses ours and returns next visit, and the
   * real prompt is only ever reached by someone who chose Allow.
   *
   * 'blocked' is the awkward middle: they chose Allow here and then Block in
   * the browser. They asked for this and do not have it, so staying silent
   * would strand them — but the offer cannot be repeated either, because a
   * denied permission makes requestPermission() resolve instantly without
   * prompting. All that is left to do is say where the switch is.
   */
  const [askNotifications, setAskNotifications] = useState<
    'ask' | 'blocked' | 'enabled' | null
  >(null);

  /** Mirrors the countdown for the activity listener, which is bound once. */
  idleSecondsLeftRef.current = idleSecondsLeft;
  /** Lets the dialog's button reach the timer that owns the countdown. */

  /**
   * Everything worth saying about arriving, gathered into one answer.
   *
   * Three facts can be true at once: this browser rescued edits from a session
   * that ended, a draft is parked, and another device is holding unsaved work
   * of its own. They were up to three dialogs queued behind one another, so
   * the second device — the awkward case, where all three apply — greeted
   * people with a stack of boxes describing one situation from three angles.
   *
   * The lead is whichever fact needs acting on soonest: rescued edits first,
   * because they are already on the canvas; then a parked draft, which is a
   * real question; then work stranded on another device, which is only ever
   * news. The others become lines underneath.
   */
  const welcomeBack = (() => {
    if (activeTab !== 'promo') return null;
    // Stands down while the sign-out countdown is up. Two glass panels stacked
    // on each other read as one broken thing, and arriving is not the pressing
    // matter when the session is about to end. It comes straight back when the
    // countdown is answered, since none of its state has been touched.
    if (idleSecondsLeft !== null) return null;
    const elsewhere = elsewhereNotice;
    if (restoreNotice) return { mode: 'restored' as const, ...restoreNotice, elsewhere };
    if (draftOffer) {
      return { mode: 'draft' as const, draftSavedAt: draftOffer.lastUpdated ?? null, elsewhere };
    }
    if (elsewhere) return { mode: 'elsewhere' as const, elsewhere };
    return null;
  })();

  const [pendingPromoPopup, setPendingPromoPopup] = useState<'published' | 'draft' | null>(null);
  // The schedule dialog serves two intents, and they end differently:
  //   'new'      → starting a campaign, so it continues to the build panel
  //   'schedule' → an existing card just missing dates, so it returns to work
  const [createIntent, setCreateIntent] = useState<'new' | 'schedule'>('new');
  const [showCreateSetup, setShowCreateSetup] = useState(false);
  const [createStart, setCreateStart] = useState('');
  const [createEnd, setCreateEnd] = useState('');
  /** Bumped to remount the editors so they re-read a reverted config. */

  // Invalid promo schedule = both dates set and start is after end. Blocks
  // Save/Publish (disabled CTA); the ping triggers PromoSection's scroll+flash
  // fallback if a save is somehow still attempted.
  const promoDateRangeInvalid = isInvalidRange(
    config.promoCard.startDate,
    config.promoCard.endDate,
  );

  // Announcements schedule per message, so any one of them being back to front
  // has to block the header the same way. Without this the popup refused to
  // close on a bad range while Save and Publish stayed live beside it — the bad
  // range could be saved and published from the header instead.
  const announcementDateRangeInvalid = anyInvalidRange(
    config.announcementBar.announcements,
  );
  const [promoDateErrorPing, setPromoDateErrorPing] = useState(0);

  const {
    handlePublishAnnouncement,
    stopAnnouncementNow,
    goOnAirAnnouncementNow,
    stopPromoNow,
    removeLivePromo,
    goOnAirPromoNow,
    handlePublishPromoWithValidation,
    handlePublishAnnouncementWithValidation,
  } = useCampaignPublishing({
    config,
    configRef,
    setConfig,
    publishedConfigObjRef,
    setPublishedConfig,
    persistConfig,
    pendingDraftRef,
    setReadyToPublishAnnouncement,
    setPromoDateErrorPing,
    setPublishConfirm,
    refreshPromoVariants,
    getPromoVariantSaveStatus,
    setPendingVariantSave,
    savePromoVariant,
    markVariantLive,
  });

  const handleTabSwitch = useCallback(
    (tab: 'dashboard' | 'announcement' | 'promo') => {
      if (tab === activeTab) return;
      // The Promo Card tab goes straight into the editor on the last edited
      // state — same as every other route into promo.
      if (tab === 'promo') {
        setPromoEntryStep('editor');
        // Reaching the editor by the tab used to skip the schedule question
        // entirely, so a card started this way had no dates — while the editor
        // marks Campaign Duration REQUIRED and Publish refuses without it.
        // Ask here too, so the date step can't be missed whichever door is used.
        const pc = configRef.current.promoCard;
        /**
         * Only worth asking once there is a card to schedule.
         *
         * A cleared canvas deliberately has no end date — the user sets it in
         * the panel, and that is what switches the countdown on. Forcing the
         * dialog on the way back into the tab took that decision off them and
         * refilled the field they had just been left to fill.
         *
         * Publish still refuses without dates, so nothing escapes unscheduled;
         * the ask simply waits until there is something to schedule.
         */
        const nothingToSchedule = cardIsNotUserWork(
          pc,
          sampleTemplates.map((t) => t.promoCard as CampaignConfig['promoCard']),
        );
        if (!nothingToSchedule && (!pc.startDate || !pc.endDate)) {
          setCreateIntent('schedule');
          setCreateStart(pc.startDate || getISODateWithOffset(0));
          setCreateEnd(pc.endDate || '');
          setShowCreateSetup(true);
        }
      }
      setActiveTab(tab);
    },
    [activeTab],
  );

  /**
   * AI content landed on the card. Nothing is saved here — drafting stays
   * explicit — but the promo tab should now reopen on the editor rather than
   * the start picker, so leaving and coming back keeps the generated card.
   */
  const handleAiApplied = useCallback(() => {
    setPromoEntryStep('editor');
  }, []);

  /**
   * "Create promo card" on an empty dashboard. The schedule + build-method
   * dialog opens HERE, over the dashboard, rather than sending the user to a
   * picker first — there's nothing to pick from on a first run.
   */
  const handleCreatePromo = useCallback(() => {
    if (promoWorkNotInDraftRef.current) {
      setPendingDashboardAction('create');
      return;
    }
    startCreatePromo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** The actual create flow, once nothing is at risk. */
  const startCreatePromo = useCallback(() => {
    setCreateIntent('new');
    setCreateStart(getISODateWithOffset(0));
    setCreateEnd('');
    setShowCreateSetup(true);
  }, []);

  /**
   * Dashboard → the editor with a picker already open.
   *
   * The choice of WHICH card belongs in front of the canvas it loads onto, so
   * these entries don't load anything themselves — they open My Published or
   * My Draft and let the user pick there.
   */
  const handleOpenPublishedPromo = useCallback(() => {
    if (promoWorkNotInDraftRef.current) {
      setPendingDashboardAction('published');
      return;
    }
    openPublishedPicker();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Loads the LIVE card into the editor, once nothing is at risk.
   *
   * Straight to the card rather than the picker: this comes from Edit on the
   * dashboard thumbnail, which shows the live card — so that's the card the
   * user means. My Published is still there for choosing a different one.
   */
  const openPublishedPicker = useCallback(() => {
    const live = publishedConfigObjRef.current;
    if (live) {
      const next: CampaignConfig = {
        ...configRef.current,
        promoCard: JSON.parse(JSON.stringify(live.promoCard)),
      };
      setConfig(next);
      configRef.current = next;
      draftSignatureRef.current = getConfigSignature(next);
      savedPromoSignatureRef.current = getPromoSignature(next);
      setHasPromoChanges(getConfigSignature(next) !== publishedConfigRef.current);
      setEditorResetKey((k) => k + 1);
    }
    setPromoEntryStep('editor');
    setActiveTab('promo');
    toast('Your live card is loaded — edit it here, or use Improve with AI.');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Commits the schedule from the dashboard dialog and opens the editor with
   * the build panel up. The dashboard asks WHEN; the editor asks HOW, next to
   * the card that the answer applies to.
   */
  function startNewPromo() {
    /**
     * "Create new" starts from a blank card, not from whatever was last on the
     * canvas. Keeping the old card meant AI wrote on top of a previous
     * campaign's leftovers, and the AI panel previewed a card the user wasn't
     * making. Unsaved work is already protected by the guard that runs before
     * this — by the time we're here, the user has agreed to move on.
     *
     * The schedule-only path (an existing card missing dates) leaves the card
     * alone: nothing about that flow says "start over".
     */
    const startingFresh = createIntent === 'new';

    setConfig((prev) => ({
      ...prev,
      promoCard: startingFresh
        ? {
            ...blankPromoCard(),
            // On-air state belongs to the website, not the card being drafted;
            // creating a new one must never take the live campaign down.
            active: prev.promoCard.active,
            stoppedByUser: prev.promoCard.stoppedByUser,
            startDate: createStart,
            endDate: createEnd,
          }
        : { ...prev.promoCard, startDate: createStart, endDate: createEnd },
    }));
    markPromoChanged();
    if (startingFresh) {
      // A blank card, so the skeleton outlines belong here too...
      setPromoBlankStart(true);
      // ...but the dates were answered in the dialog a moment ago, so the
      // countdown stays off until the user asks for it. Without this the
      // auto-on rule sees a blank card with a complete schedule and switches
      // it on before they have even seen the card.
      setPromoTimerAutoArmed(false);
    }
    // Remount so the contentEditable fields re-read the blank card; without it
    // the old text stays visible even though state has been replaced.
    if (startingFresh) setEditorResetKey((k) => k + 1);
    setShowCreateSetup(false);
    // "Create new" always continues to the build panel — that's the point of
    // it. The schedule-only prompt returns to the card it interrupted, unless
    // that card is blank, in which case building is what comes next anyway.
    const hasContent = promoHasVisibleContent(configRef.current.promoCard);
    const goToBuild = createIntent === 'new' || !hasContent;
    setPromoEntryStep(goToBuild ? 'build' : 'editor');
    // Covers the case where the promo tab is already open: initialStep is only
    // read at mount, so without this the dialog closed onto nothing.
    if (goToBuild) setOpenBuildSignal((n) => n + 1);
    setActiveTab('promo');
  }

  // Dashboard shortcuts (Edit / the card itself) open an existing campaign, so
  // they bypass the guided picker and land in the editor.
  const handleDashboardTabSwitch = useCallback(
    (tab: 'dashboard' | 'announcement' | 'promo') => {
      if (tab === activeTab) return;
      if (tab === 'promo') setPromoEntryStep('editor');
      setActiveTab(tab);
    },
    [activeTab],
  );














  function handleSaveAnnouncement() {
    setHasAnnouncementChanges(false);
    setReadyToPublishAnnouncement(true);
    toast('Changes saved — please publish to go live');
    setPublishConfirm({
      warnings: [],
      onConfirm: handlePublishAnnouncement,
      title: 'Changes saved',
      message: 'Ready to publish, or you can review and publish later.',
      confirmLabel: 'Publish now',
      cancelLabel: 'Publish later',
    });
  }













  function toggleDarkMode() {
    const newMode = !isDarkMode;
    setIsDarkMode(newMode);
    localStorage.setItem('darkMode', newMode.toString());
  }

  function handleLogout() {
    /**
     * The same at-risk test the close prompt uses, rather than "differs from
     * the draft" — a card already sitting in My Published is not work about to
     * be lost, and stopping someone on the way out for it teaches them to
     * click through the one time it matters.
     */
    const promoAtRisk = promoWorkNotInDraftRef.current;
    const announcementAtRisk =
      hasAnnouncementChanges &&
      draftSignatureRef.current !== getConfigSignature(configRef.current);
    if (promoAtRisk || announcementAtRisk) {
      setPendingDraftAction({ type: 'logout' });
      return;
    }
    performLogout();
  }

  function performLogout() {
    /**
     * Signing out on purpose, so the local copy goes with the session — the
     * same rule as answering Leave to the close prompt. Anything worth keeping
     * was offered a draft slot before this ran.
     */
    exitReasonRef.current = 'logout';
    // Signing back in is a new visit, so the blank canvas should move on.
    forgetVisit();
    clearRecovery();
    if (reportedUnsavedRef.current) reportUnsaved(false);

    // The session is a signed cookie, so only the server can end it. Navigate
    // either way: a failed request must not strand someone on a page they have
    // asked to leave, and the cookie expires on its own.
    fetch('/api/auth/logout', { method: 'POST', keepalive: true })
      .catch(() => {})
      .finally(() => {
        window.location.href = '/login';
      });
  }




  const selectedPendingVariant = getSelectedPendingVariant();

  // "Go on air" is a one-click reactivation, allowed only when the announcement
  // is off AND its content matches what's currently published (same content,
  // not new/edited). Otherwise the user must Save → Publish.
  const announcementCanReactivate = (() => {
    if (config.announcementBar.active) return false;
    if (!publishedConfigRef.current) return false;
    try {
      const pub = JSON.parse(publishedConfigRef.current) as CampaignConfig;
      const sig = (ab: CampaignConfig['announcementBar']) => {
        const clone: Record<string, unknown> = { ...ab };
        delete clone.active;
        return JSON.stringify(clone);
      };
      return sig(config.announcementBar) === sig(pub.announcementBar);
    } catch {
      return false;
    }
  })();

  // Same rule for the promo card (ignore active + stoppedByUser status flags).
  /**
   * Is there a promo card worth publishing right now?
   *
   * True either when the card differs from what was published, or when
   * nothing is on air at all. The second half is the point: selecting a card
   * from My Published while the campaign is stopped changes nothing about the
   * content, so the ordinary comparison says "no changes" and Publish stayed
   * dark — leaving the one button that puts a card back on the website unlit
   * with a perfectly good card on screen.
   *
   * Guarded on the card having content, so a blank canvas with nothing live
   * does not light Publish for something there is nothing to publish.
   */
  const promoWorthPublishing =
    hasPromoChanges ||
    (!publishedConfig.promoCard.active &&
      promoHasVisibleContent(config.promoCard));

  const promoCanReactivate = (() => {
    if (config.promoCard.active) return false;
    if (!publishedConfigRef.current) return false;
    try {
      const pub = JSON.parse(publishedConfigRef.current) as CampaignConfig;
      const sig = (pc: CampaignConfig['promoCard']) => {
        const clone: Record<string, unknown> = { ...pc };
        delete clone.active;
        delete clone.stoppedByUser;
        return JSON.stringify(clone);
      };
      return sig(config.promoCard) === sig(pub.promoCard);
    } catch {
      return false;
    }
  })();

  // Work worth protecting: the promo differs from what's live AND isn't the
  // thing already sitting in the draft.
  /**
   * Computed from the cards themselves rather than from `hasPromoChanges`.
   *
   * That flag is only recalculated when something calls markPromoChanged(), so
   * it survives events that make it untrue — deleting the saved draft being the
   * one that bit: the flag stayed true, the guard fired, and "Create new" asked
   * to save work into a draft the user had just deleted. A refresh "fixed" it
   * only because reloading recomputed everything from scratch.
   */
  /**
   * Recomputed only when one of the cards it compares actually changes.
   *
   * This ran in the render body, so every keystroke in the editor re-ran the
   * whole comparison: a deep normalise and stringify of the current card, the
   * published card, the draft, and EVERY saved variant, plus the authorship
   * check, which walks all twelve templates twice — once for their words and
   * once for their looks. With ten saved cards that is roughly forty full-card
   * serialisations per character typed, to answer a question whose inputs had
   * not moved.
   */
  promoWorkNotInDraftRef.current = useMemo(() => {
    // Normalised, like every other comparison: a raw stringify counts the
    // app's own rewrites (the injected default font-size span, zero-width
    // characters, the re-serialised timer, the auto cardWidth) as edits — so
    // simply opening the editor made "Create new" claim there was unsaved work.
    const sig = (card: CampaignConfig['promoCard']) =>
      JSON.stringify(
        normalizePromoForCompare(card as unknown as Record<string, unknown>),
      );
    const current = sig(config.promoCard);
    const differsFromLive = current !== sig(publishedConfig.promoCard);
    const differsFromDraft = !draftPromoCard || current !== sig(draftPromoCard);
    // My Published counts as saved. Matching any variant in there means the
    // card can be brought back, so there is nothing to protect.
    const differsFromSaved = !promoVariants.some((v) => sig(v.promoCard) === current);
    /**
     * Differing from everything stored is not the same as being worth saving.
     * A cleared canvas matches nothing, so the guard fired on the way to
     * "Create new" offering to preserve a blank card; a freshly picked
     * template did the same for words nobody wrote.
     */
    const worthProtecting = !cardIsNotUserWork(
      config.promoCard,
      TEMPLATE_CARDS,
    );
    return worthProtecting && differsFromLive && differsFromDraft && differsFromSaved;
  }, [config.promoCard, publishedConfig.promoCard, draftPromoCard, promoVariants]);

  return (
    <div className="campaign-page-bg flex h-screen text-on-surface">
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        <Header
          activeTab={activeTab}
          setActiveTab={handleTabSwitch}
          hasAnnouncementChanges={hasAnnouncementChanges}
          hasPromoChanges={promoWorthPublishing}
          readyToPublishAnnouncement={readyToPublishAnnouncement}
          promoDateInvalid={promoDateRangeInvalid}
          announcementDateInvalid={announcementDateRangeInvalid}
          isPublishing={isPublishing}
          isDarkMode={isDarkMode}
          toggleDarkMode={toggleDarkMode}
          handleSaveAnnouncement={handleSaveAnnouncement}
          handlePublishAnnouncement={handlePublishAnnouncementWithValidation}
          handlePublishPromo={handlePublishPromoWithValidation}
          handleLogout={handleLogout}
        />

        <main
          ref={mainScrollRef}
          className={`flex-1 overflow-y-auto bg-transparent px-6 pt-8 pb-6 ${
            activeTab === 'promo' || activeTab === 'announcement' ? 'campaign-custom-scrollbar' : ''
          }`}
        >
          <div className={`max-w-[1840px] mx-auto ${activeTab === 'promo' || activeTab === 'dashboard' ? '' : 'space-y-8 pb-12'}`}>
            {activeTab === 'dashboard' && (
              <Dashboard
                config={publishedConfig}
                setActiveTab={handleDashboardTabSwitch}
                onCreatePromo={handleCreatePromo}
                onEditLivePromo={handleOpenPublishedPromo}
                onStopPromo={stopPromoNow}
                onGoOnAirPromo={goOnAirPromoNow}
                onStopAnnouncement={stopAnnouncementNow}
                onGoOnAirAnnouncement={goOnAirAnnouncementNow}
                promoUnpublished={hasPromoChanges}
                announcementUnpublished={hasAnnouncementChanges || readyToPublishAnnouncement}
              />
            )}

            {activeTab === 'announcement' && (
              <AnnouncementSection
                key={`announcement-${editorResetKey}`}
                config={config}
                setConfig={setConfig}
                markChanged={markAnnouncementChanged}
                canReactivate={announcementCanReactivate}
                onStop={stopAnnouncementNow}
                onGoOnAir={goOnAirAnnouncementNow}
              />
            )}

            {activeTab === 'promo' && (
              <PromoFlow
                  key={`promo-${editorResetKey}`}
                  onAiApplied={handleAiApplied}
                  openBuildSignal={openBuildSignal}
                  configLoadedSignal={configLoadedSignal}
                  blankStart={promoBlankStart}
                  onBlankStartChange={setPromoBlankStart}
                  timerAutoArmed={promoTimerAutoArmed}
                  onTimerAutoArmedChange={setPromoTimerAutoArmed}
                  pendingPopup={pendingPromoPopup}
                  onPendingPopupHandled={() => setPendingPromoPopup(null)}
                  initialStep={promoEntryStep}
                  config={config}
                  setConfig={setConfig}
                  markChanged={markPromoChanged}
                  toast={toast}
                  onSelectedVersionChange={setSelectedPromoVersionId}
                  canReactivate={promoCanReactivate}
                  livePromoCard={publishedConfig.promoCard}
                  draftPromoCard={draftPromoCard}
                  onStop={stopPromoNow}
                  onGoOnAir={goOnAirPromoNow}
                  dateErrorPing={promoDateErrorPing}
                  hasUnsavedChanges={hasPromoChanges}
                  onSaveDraft={handleSaveAsDraft}
                  // Writes the draft with no replace-confirm of its own — the
                  // template dialogs already asked, and asking twice for one
                  // decision reads as a bug.
                  onSaveDraftDirect={writeDraftNow}
                  savingDraft={savingDraft}
                  onDeleteDraft={handleDeleteDraft}
                  draftUpToDate={
                    savedDraftSignature !== null &&
                    savedDraftSignature === getConfigSignature(config)
                  }
                  draftExists={savedDraftSignature !== null}
                onRemoveLive={removeLivePromo}
              />
            )}
          </div>
        </main>
      </div>

      {/* A draft outlived a publish and holds something else. Asked rather
          than assumed: it is the user's copy, and only they know whether the
          card they just put live replaced it or was never related to it. */}
      {postPublishDraft && (
        <div data-modal className="fixed inset-0 z-50 flex items-center justify-center bg-transparent p-4">
          <div className="absolute inset-0" onClick={() => setPostPublishDraft(false)} />
          {/* Wider than the other dialogs: this one carries a heading that
              runs long, an explanation and a caveat, and at max-w-md the
              heading wrapped onto three lines with the body pressed under it. */}
          <div className="relative z-10 w-full max-w-lg rounded-xl border border-white/10 bg-black/10 p-6 text-on-surface shadow-2xl backdrop-blur-md">
            <h2 className="text-base font-semibold">
              Your card is live — and we kept your draft
            </h2>
            <p className="mt-2 text-sm text-on-surface-variant">
              The one in{' '}
              <span className="font-semibold text-on-surface">My Draft</span>{' '}
              is different from the card you just published, so we&apos;ve kept
              it. Do you want to keep it, or clear the slot?
            </p>
            <p className="mt-3 text-xs text-on-surface-variant/80">
              There is only one draft slot, so keeping it means the next save
              replaces it.
            </p>
            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => {
                  clearDraft();
                  setPostPublishDraft(false);
                  toast('Saved draft cleared');
                }}
                className="rounded-md border border-white/10 bg-transparent px-4 py-2 text-sm font-medium text-on-surface-variant transition-colors hover:border-primary/70 hover:text-primary"
              >
                Discard it
              </button>
              <button
                type="button"
                onClick={() => setPostPublishDraft(false)}
                className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-on-primary shadow-sm transition-opacity hover:opacity-95"
              >
                Keep my draft
              </button>
            </div>
          </div>
        </div>
      )}

      {/* One dialog for one moment.
          Coming back to work in progress has three shapes — edits rescued from
          a session that ended, those edits alongside a parked draft, or a
          draft on its own — and they were being told by two different dialogs
          with two different voices. They describe the same situation from
          different angles, so they are one thing that reads its state.
          Held until the promo tab: it talks about the canvas and My Draft,
          which are that editor's. Announcement work is still restored, just
          not announced here — this message has nowhere to say it. */}
      {welcomeBack && (
        <div data-modal className="fixed inset-0 z-50 flex items-center justify-center bg-transparent p-4">
          {/* Blocks what is behind it, but does not dismiss.
              These arrive once, on the way in, and closing one is final — the
              draft offer does not come back until the next load. A click
              landing on the canvas is far more likely to be someone reaching
              for their work than a decision to dismiss, and the buttons are
              right there. */}
          <div className="absolute inset-0" />
          <div className="relative z-10 w-full max-w-lg rounded-xl border border-white/10 bg-black/10 p-6 text-on-surface shadow-2xl backdrop-blur-md">
            {welcomeBack.mode === 'restored' ? (
              <>
                {/* Told, not asked: the work is already on the canvas behind
                    this. The session ended without the user ending it, so
                    there was no decision to put to them. */}
                {/* One message, whatever is true.
                    With edits rescued here AND work stranded on another
                    device, this listed both with a timestamp each and left the
                    reader matching times to places. What someone needs on the
                    way in is smaller: their work was not saved, unsaved work
                    stays on the browser that made it, and here is what that
                    means for them right now. */}
                {/* Enough to explain itself, in one block of prose.
                    Trimmed to a bare heading it stopped saying what had
                    actually happened; opening with the rule — "unsaved work
                    stays on the browser that made it" — made the reader decode
                    policy first. This says what was done, then the one thing
                    left to do, as two sentences rather than two paragraphs so
                    it reads as a single message.

                    One timestamp, on the other device only. Three of them —
                    the rescued edits, the parked draft and the other machine —
                    was what made this unreadable: the reader ended up matching
                    times to places to work out what had happened. A single
                    time answers the one question worth asking here, which is
                    how recent that other work is. */}
                <h2 className="text-base font-semibold">
                  Your unsaved work is back
                </h2>
                <p className="mt-1.5 text-sm text-on-surface-variant">
                  We kept what you hadn&apos;t saved and put it back on the canvas.
                  {welcomeBack.elsewhere && (
                    <>
                      {' '}You were also editing on{' '}
                      <span className="font-medium text-on-surface">
                        {welcomeBack.elsewhere.deviceLabel}
                      </span>{' '}
                      {describeWhen(welcomeBack.elsewhere.at)} — open the tool
                      there to pick that up.
                    </>
                  )}
                </p>

                {welcomeBack.draftSavedAt && !welcomeBack.elsewhere && (
                  <p className="mt-2.5 text-sm text-on-surface-variant">
                    Your draft from{' '}
                    <span className="font-medium text-on-surface">
                      {describeWhen(welcomeBack.draftSavedAt)}
                    </span>{' '}
                    is untouched in My Draft.
                  </p>
                )}
              </>
            ) : welcomeBack.mode === 'elsewhere' ? (
              <>
                {/* Nothing rescued and nothing parked, so where the work is IS
                    the message. Not phrased as a failure to save: everywhere
                    else the tool treats not-saving as normal, because it
                    rescues work rather than asking about it. */}
                <h2 className="text-base font-semibold">
                  Your unsaved changes are on another device
                </h2>
                <p className="mt-1.5 text-sm text-on-surface-variant">
                  You were editing on{' '}
                  <span className="font-medium text-on-surface">
                    {welcomeBack.elsewhere.deviceLabel}
                  </span>{' '}
                  {describeWhen(welcomeBack.elsewhere.at)}. Those changes never
                  made it to a draft, so they&apos;re on that browser only.
                </p>
              </>
            ) : (
              <>
                {/* Asked, because here it is a question: nothing was rescued,
                    and the draft was parked on purpose. */}
                <h2 className="text-base font-semibold">
                  Welcome back — your draft is waiting
                </h2>
                <p className="mt-1.5 text-sm text-on-surface-variant">
                  Your promo card from {describeWhen(welcomeBack.draftSavedAt)} is
                  still in My Draft, just as you left it.
                </p>
              </>
            )}

            {/* The other places the work lives, in one sentence each.
                A bordered list of rows was tried here and read as a settings
                panel — boxes and right-aligned timestamps make facts look like
                controls, and none of these are. Prose keeps them as what they
                are: context, on the way to the canvas. */}
            {/* Only the draft offer needs this. The restored branch above
                carries its own lines, and duplicating them here was rendering
                the same situation twice in one dialog — the very thing the
                rewrite was meant to stop. */}
            {welcomeBack.mode === 'draft' && welcomeBack.elsewhere && (
              <p className="mt-2.5 text-sm text-on-surface-variant">
                You were also editing on{' '}
                <span className="font-medium text-on-surface">
                  {welcomeBack.elsewhere.deviceLabel}
                </span>
                . Those changes stay on that browser whatever you choose here.
              </p>
            )}

            {/* The one thing that cannot be found out any other way. */}
            {welcomeBack.mode === 'restored' && (
              <p className="mt-4 text-xs text-amber-600 dark:text-amber-500">
                Save it to My Draft so it opens anywhere.
              </p>
            )}
            {welcomeBack.mode === 'elsewhere' && (
              <p className="mt-4 text-xs text-on-surface-variant/80">
                Sign in there and save them to My Draft — then they&apos;ll open
                anywhere.
              </p>
            )}
            {welcomeBack.mode === 'draft' &&
              (hasChanges ? (
                <p className="mt-4 text-xs text-amber-600 dark:text-amber-500">
                  The editor has unsaved changes. Opening the draft replaces them.
                </p>
              ) : (
                <p className="mt-4 text-xs text-on-surface-variant/80">
                  Either way it stays saved — open it from My Draft whenever you like.
                </p>
              ))}

            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              {welcomeBack.mode === 'draft' ? (
                <>
                  <button
                    type="button"
                    onClick={dismissWelcomeBack}
                    className="rounded-md border border-white/10 bg-transparent px-4 py-2 text-sm font-medium text-on-surface-variant transition-colors hover:border-primary/70 hover:text-primary"
                  >
                    {hasChanges ? 'Keep my unsaved changes' : 'Start something new'}
                  </button>
                  <button
                    type="button"
                    onClick={() => draftOffer && acceptOfferedDraft(draftOffer)}
                    className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-on-primary shadow-sm transition-opacity hover:opacity-95"
                  >
                    Continue my draft
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={dismissWelcomeBack}
                    className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-on-primary shadow-sm transition-opacity hover:opacity-95"
                  >
                    {welcomeBack.mode === 'restored' ? 'Continue editing' : 'Continue here'}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* The countdown.
          Always a dialog in the page, because that is the only warning
          everyone gets — permission may never have been granted, and a desktop
          notification is suppressed while the tab is visible anyway. It blocks
          the editor on purpose: the point is to be answered. */}
      {idleSecondsLeft !== null && (
        <div data-modal className="fixed inset-0 z-[60] flex items-center justify-center bg-transparent p-4">
          <div className="absolute inset-0" />
          <div className="relative z-10 w-full max-w-sm rounded-xl border border-white/10 bg-black/10 p-6 text-center text-on-surface shadow-2xl backdrop-blur-md">
            {/* Centred, with the count as the largest thing on it. The question
                is rhetorical — what the reader needs is how long they have, so
                that is what the eye should land on first. */}
            <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-amber-500/15">
              <Clock className="h-5 w-5 text-amber-600 dark:text-amber-500" />
            </div>

            <h2 className="mt-3.5 text-base font-semibold">Are you still there?</h2>
            <p className="mt-1 text-sm text-on-surface-variant">
              No activity for {describeDuration(IDLE_LIMIT_MS - IDLE_WARNING_LEAD_MS)}.
            </p>

            <p className="mt-4 text-3xl font-semibold tabular-nums text-amber-600 dark:text-amber-500">
              {idleSecondsLeft}s
            </p>

            {/* Draining, not filling. Something running out is read without
                being read — the bar says how long is left before the number
                has been focused on. The transition is linear and matches the
                tick, so it slides smoothly rather than stepping. */}
            <div className="mt-2.5 h-1 w-full overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-amber-500 transition-[width] duration-1000 ease-linear"
                style={{
                  width: `${(idleSecondsLeft / Math.round(IDLE_WARNING_LEAD_MS / 1000)) * 100}%`,
                }}
              />
            </div>

            {/* Says the quiet part, because a countdown reads as a threat
                otherwise. Nothing is lost either way — which is the point of
                everything else in this file. */}
            <p className="mt-4 text-xs text-on-surface-variant/80">
              Your work is saved. It will be back on the canvas when you sign in again.
            </p>

            <button
              type="button"
              onClick={() => idleRestartRef.current?.()}
              className="mt-5 w-full rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-on-primary shadow-sm transition-opacity hover:opacity-95"
            >
              I&apos;m still here
            </button>
          </div>
        </div>
      )}

      {/* Our ask, in front of the browser's.
          The browser's own prompt is a one-shot: decline it and no code can
          raise it again. So "Not now" closes only this, and the real prompt is
          reached solely by someone who chose Allow.

          A corner card rather than a modal. This is an offer, not a decision
          the editor should be held up for — a full dialog gave a small
          convenience the same weight as losing work, and it was the first
          thing people met on the way in. */}
      {askNotifications && !welcomeBack && idleSecondsLeft === null && (
        <div className="animate-slide-in-corner fixed right-4 bottom-4 z-40 w-72 rounded-lg border border-white/10 bg-black/20 p-3.5 text-on-surface shadow-xl backdrop-blur-md">
          {askNotifications === 'ask' ? (
            <>
              {/* Two short lines. The second is the only thing that justifies
                  the permission at all — the in-page countdown already covers
                  the case where you are looking at the tab. */}
              {/* Warns about the third gate before consent, not after.
                  Someone who allows here and then sees nothing has no reason
                  to suspect their system is muting the browser — so the
                  clause goes in upfront, while the exact path waits for the
                  confirmation card, where it is actually actionable. */}
              <p className="text-sm font-medium">Notify you before signing out?</p>
              <p className="mt-1 text-xs text-on-surface-variant">
                Works even when this tab is hidden. Your system must allow
                browser notifications too.
              </p>
              <div className="mt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setAskNotifications(null)}
                  className="rounded-md px-2.5 py-1.5 text-xs font-medium text-on-surface-variant transition-colors hover:text-primary"
                >
                  Not now
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    // Inside the click on purpose: Chrome ignores a permission
                    // request that is not tied to a gesture.
                    const result = await askNotificationPermission();
                    // Blocked at the browser's prompt after accepting ours —
                    // switch to saying where the switch is rather than
                    // vanishing, since they did ask for this.
                    if (result === 'denied') return setAskNotifications('blocked');
                    // Granted: confirm it, and name the one gate left that
                    // nothing can check on their behalf.
                    if (result === 'granted') return setAskNotifications('enabled');
                    setAskNotifications(null);
                  }}
                  className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-on-primary shadow-sm transition-opacity hover:opacity-95"
                >
                  Allow
                </button>
              </div>
            </>
          ) : askNotifications === 'enabled' ? (
            <>
              {/* Shown once, straight after granting.
                  Two gates are now open and a third is not readable from here,
                  so this is the only chance to mention it before someone
                  concludes the feature is broken. Phrased as a condition, not
                  an instruction — for most people nothing more is needed. */}
              <p className="text-sm font-medium">Notifications are on</p>
              <p className="mt-1 text-xs text-on-surface-variant">
                Not seeing them? Your system may be muting the browser:{' '}
                {osNotificationHint() ?? 'check your notification settings.'}
              </p>
              <div className="mt-3 flex justify-end">
                <button
                  type="button"
                  onClick={() => setAskNotifications(null)}
                  className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-on-primary shadow-sm transition-opacity hover:opacity-95"
                >
                  Got it
                </button>
              </div>
            </>
          ) : (
            <>
              {/* No Allow button: only the user can undo a block, from browser
                  settings, so offering one here would be theatre. */}
              <p className="text-sm font-medium">Notifications are blocked</p>
              {/* The icon is drawn, not described. Someone scanning a toolbar
                  should be matching a shape, not decoding "padlock or sliders"
                  — and no single word for it is right across Chrome versions. */}
              <p className="mt-1 text-xs leading-relaxed text-on-surface-variant">
                {(() => {
                  const hint = unblockSteps();
                  if (hint.kind === 'menu') return hint.text;
                  return (
                    <>
                      {hint.before}{' '}
                      <SlidersHorizontal className="mx-0.5 inline-block h-3.5 w-3.5 -translate-y-px align-middle text-on-surface" />{' '}
                      {hint.after}
                    </>
                  );
                })()}
              </p>
              {/* A solid button, not the quiet text one the offer uses for
                  "Not now". There is no choice on this card — dismissing is
                  the only thing to do — so the single action should look like
                  one rather than like the lesser of two options. */}
              <div className="mt-3 flex justify-end">
                <button
                  type="button"
                  onClick={() => setAskNotifications(null)}
                  className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-on-primary shadow-sm transition-opacity hover:opacity-95"
                >
                  Got it
                </button>
              </div>
            </>
          )}
        </div>
      )}

      <UnsavedWorkDialog
        pendingDraftAction={pendingDraftAction}
        savedDraftSignature={savedDraftSignature}
        setPendingDraftAction={setPendingDraftAction}
        saveDraftAndContinue={saveDraftAndContinue}
        continueWithoutDraft={continueWithoutDraft}
      />

      <VariantSlotFullDialog
        pendingVariantSave={pendingVariantSave}
        selectedPendingVariant={selectedPendingVariant}
        savePendingVariantAndClose={savePendingVariantAndClose}
        updateExistingVariantAndClose={updateExistingVariantAndClose}
        cancelPendingVariantSave={cancelPendingVariantSave}
      />

      {/* No "welcome back" popup. Saving a draft is a deliberate act, so
          announcing it back on every load interrupts the one moment someone
          wants to start working. The draft is restored into the editor
          silently and the My Draft chip carries a dot instead. */}

      {/* Publish Confirmation */}
      <PublishConfirmDialog
        publishConfirm={publishConfirm}
        isConfirming={isConfirming}
        setIsConfirming={setIsConfirming}
        setIsPublishing={setIsPublishing}
        setPublishConfirm={setPublishConfirm}
      />

      {/* First-run campaign setup, opened from the dashboard's "Create promo
          card". Same dialog the guided flow uses, so the questions asked are
          identical wherever a campaign starts. */}
      {showCreateSetup && (
        <PromoSetupDialog
          sourceLabel="a blank card"
          scheduleOnly
          onContinue={startNewPromo}
          startDate={createStart}
          endDate={createEnd}
          onChangeStart={setCreateStart}
          onChangeEnd={setCreateEnd}
          onChoose={() => startNewPromo()}
          onClose={() => setShowCreateSetup(false)}
        />
      )}

      {/* Unsaved promo work, caught at the dashboard before an action that
          would replace the canvas. Saving is offered, never required — the
          same rule as Clear Canvas. */}
      <DashboardUnsavedDialog
        pendingDashboardAction={pendingDashboardAction}
        savedDraftSignature={savedDraftSignature}
        setPendingDashboardAction={setPendingDashboardAction}
        writeDraftNow={writeDraftNow}
        startCreatePromo={startCreatePromo}
        openPublishedPicker={openPublishedPicker}
      />

      {/* Discard Draft consent — deleting a draft is destructive, so confirm first */}
      <DiscardDraftDialog
        confirmDiscardDraft={confirmDiscardDraft}
        setConfirmDiscardDraft={setConfirmDiscardDraft}
        discardDraft={discardDraft}
      />

      {/* Replace-draft consent — there's only one draft slot, so saving again
          overwrites whatever's already there. */}
      <ReplaceDraftDialog
        confirmReplaceDraft={confirmReplaceDraft}
        setConfirmReplaceDraft={setConfirmReplaceDraft}
        writeDraftNow={writeDraftNow}
      />

      <Toast
        show={showToast}
        message={toastMessage}
        isError={toastIsError}
        action={toastAction}
        actionDurationMs={TOAST_ACTION_MS}
      />
    </div>
  );
}
