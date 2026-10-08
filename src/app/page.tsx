'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useDarkMode } from '@/hooks/useDarkMode';
import {
  writeRecovery,
  clearRecovery,
} from '@/lib/recovery';
import { isInvalidRange, anyInvalidRange } from '@/lib/dateRange';
import { CampaignConfig } from '@/types/campaign';
import { cardIsNotUserWork } from '@/lib/promo/promoAuthorship';
import { forgetVisit } from '@/lib/promo/blankLooks';
import { isBlankLook } from '@/lib/promo/lookSignature';
import { sampleTemplates } from '@/lib/promo/sampleTemplateCards';
import { Header } from '@/components/shell/Header';
import { PageDialogs } from '@/components/shell/PageDialogs';
import { Dashboard } from '@/components/dashboard/Dashboard';
import { AnnouncementSection } from '@/components/announcement/AnnouncementSection';
import { PromoFlow } from '@/components/promo/PromoFlow';
import { usePromoSetupDialog } from '@/components/promo/usePromoSetupDialog';
import { hasCompleteSchedule } from '@/lib/promo/promoSchedule';
import { Toast, TOAST_ACTION_MS } from '@/components/shared/Toast';
import { useCampaignConfig } from '@/hooks/useCampaignConfig';
import { useCampaignDraft } from '@/hooks/useCampaignDraft';
import { useToast } from '@/hooks/useToast';
import { usePromoVariantSaves } from '@/hooks/usePromoVariantSaves';
import { useComposeTextRecovery } from '@/hooks/useComposeTextRecovery';
import { useArrivalNotices } from '@/hooks/useArrivalNotices';
import { useEditorExitGuards } from '@/hooks/useEditorExitGuards';
import { useRecoveryActions } from '@/hooks/useRecoveryActions';
import { useEditorWorkStatus } from '@/hooks/useEditorWorkStatus';
import { useCampaignPublishing } from '@/hooks/useCampaignPublishing';
import {
  getConfigSignature,
  normalizePromoForCompare,
  getPromoSignature,
  htmlHasVisibleText,
} from '@/lib/configSignature';
import {
  reportUnsaved,
} from '@/lib/auth/presenceClient';
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










export default function Home() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'announcement' | 'promo'>('dashboard');
  const [hasRecoveredWork, setHasRecoveredWork] = useState(false);
  const [recoveryReason, setRecoveryReason] = useState<'idle' | 'crash' | null>(null);
  // Which card the recovered-but-unsaved content actually belongs to —
  // hasRecoveredWork alone doesn't say, and both cards used to show the
  // banner off the same flag regardless of which one the recovery affected.
  const [recoveredAffectsPromo, setRecoveredAffectsPromo] = useState(false);
  const [recoveredAffectsAnnouncement, setRecoveredAffectsAnnouncement] = useState(false);
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
  const {
    announcementComposeTextRef,
    announcementComposeTextRecovered,
    setAnnouncementComposeTextRecovered,
    recoveredSelectedAnnouncementIndex,
    setRecoveredSelectedAnnouncementIndex,
  } = useComposeTextRecovery();

  const [isConfirming, setIsConfirming] = useState(false);
  const { isDarkMode, toggleDarkMode } = useDarkMode();

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
  const [restoreNotice] = useState<{
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














  const {
    askNotifications,
    setAskNotifications,
    elsewhereNotice,
    setElsewhereNotice,
    dismissElsewhere,
  } = useArrivalNotices();


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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- offeredDraftRef and setDraftOffer are stable (useRef / useState setter) but are destructured from useCampaignDraft further down, so listing them here would read them before declaration (TDZ ReferenceError on render)
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
  const [openBuildSignal] = useState(0);
  // Bumped once the real card lands from the DB. The editor mounts on
  // defaultConfig, so anything the editor seeds from the card at mount time
  // would otherwise freeze on the default template's look.


  const [promoTimerAutoArmed, setPromoTimerAutoArmed] = useState(false);




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
    elsewhereNotice,
    setElsewhereNotice,
  });
  const {
    savedDraftSignature,
    draftSignatureRef,
    mergedSavedSignature,
    draftPromoCard,
    setDraftPromoCard,
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
    writeRecoveredDraft,
    discardDraft,
    discardPromoDraft,
    handleDeleteDraft,
    handleSaveAsDraft,
    acceptOfferedDraft,
    clearDraft,
    saveDraftAndContinue,
    continueWithoutDraft,
    dismissWelcomeBack,
    saveDraft,
    saveDraftAndWaitForCloud,
    saveMessagesDraft,
    draftSavedAt,
    promoSavedAt,
    announcementSavedAt,
  } = draft;

  const campaign = useCampaignConfig({
    toast,
    promoBlankStart,
    setPromoEntryStep,
    ensureLivePromoVariant: (cfg: CampaignConfig) =>
      ensureLiveVariantRef.current(cfg),
    draftPort: draft,
    setHasRecoveredWork,
    setRecoveryReason,
    setRecoveredAffectsPromo,
    setRecoveredAffectsAnnouncement,
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
    hasAnnouncementChangesRef,
    hasPromoChanges,
    setHasPromoChanges,
    hasPromoChangesRef,
    configLoadedSignal,
    editorResetKey,
    setEditorResetKey,
    recoveredComposeTextRef,
    markAnnouncementChanged,
    markPromoChanged,
    loadConfig,
    persistConfig,
  } = campaign;


  // Both announcement and promo save straight to draft from the tab strip.
  const hasChanges = hasAnnouncementChanges || hasPromoChanges;
  // Any pending draft work (unsaved edits) — a live on-air toggle must preserve this, not discard it.
  const pendingDraft = hasChanges;
  const pendingDraftRef = useRef(pendingDraft);
  pendingDraftRef.current = pendingDraft;
  const hasChangesRef = useRef(hasChanges);
  hasChangesRef.current = hasChanges;

  /**
   * `draftPromoCard !== null` only means "a draft row exists" — the draft
   * always carries a promoCard (the type requires it) even when what was
   * actually saved is announcement-only work. Saving messages must never
   * light up the promo card, so the promo alert requires the draft's promo
   * content to genuinely differ from what is live, not just that a draft
   * exists.
   */
  const promoDraftDiffersFromLive = draftPromoCard
    ? JSON.stringify(normalizePromoForCompare(draftPromoCard as unknown as Record<string, unknown>)) !==
      JSON.stringify(normalizePromoForCompare(publishedConfig.promoCard as unknown as Record<string, unknown>))
    : false;

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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once on mount; loadConfig is recreated each render and listing it would reload the config in a loop
  }, []);

  useEffect(() => {
    const atRisk = editorWorkAtRisk();

    if (!atRisk) {
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
       *
       * Also guarded on the recovery banner: while it is up, the editor holds
       * the published card (nothing at risk) and the recovered copy is the
       * thing the banner is offering. Clearing here would delete the offer out
       * from under the user before they could accept it.
       */
      if (hasLoadedOnceRef.current && !hasRecoveredWork) clearRecovery();
      return;
    }

    // DON'T write recovery here - it overwrites existing recovery!
    // Recovery is ONLY written on beforeunload/pagehide to capture absolute latest
    // eslint-disable-next-line react-hooks/exhaustive-deps -- editorWorkAtRisk is recreated each render; the effect is meant to re-run only when the work itself (config, changes, recovery banner) changes
  }, [config, hasAnnouncementChanges, hasRecoveredWork]);

  /**
   * Sync promoWorkNotInDraftRef with hasPromoChanges so unsaved work detection works.
   */
  useEffect(() => {
    promoWorkNotInDraftRef.current = hasPromoChanges;
  }, [hasPromoChanges, promoWorkNotInDraftRef]);

  const { idleSecondsLeft, idleRestartRef, exitReasonRef } = useEditorExitGuards({
    config,
    hasAnnouncementChanges,
    configLoadedSignal,
    configRef,
    promoWorkNotInDraftRef,
    hasAnnouncementChangesRef,
    hasPromoChangesRef,
    draftSignatureRef,
    announcementComposeTextRef,
    saveDraftAndWaitForCloud,
    saveMessagesDraft,
    toast,
    editorWorkAtRisk: () => editorWorkAtRisk(),
  });

  /**
   * Rebuild both flags from the card each time one loads.
   *
   * They are React state, so a reload wipes them — and a reload is exactly
   * when work comes back. Read them from the card instead: a card still
   * wearing the blank look has had no design chosen, and one with no end date
   * has a schedule left to finish.
   *
   * Deriving here means every route in — recovery, draft, published, fresh —
   * gets the same answer without having to remember to set anything.
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
  }, [configLoadedSignal, configRef, hasLoadedOnceRef]);

  useEffect(() => {
    if (!configLoadedSignal) return;
    if (recoveredComposeTextRef.current) {
      announcementComposeTextRef.current = recoveredComposeTextRef.current;
      recoveredComposeTextRef.current = null;
    }
  }, [configLoadedSignal, announcementComposeTextRef, recoveredComposeTextRef]);


  /**
   * One dialog for arriving, not three.
   *
   * Three things can be true at once: edits were rescued, a draft is parked, and
   * another device holds unsaved work. As separate dialogs they stacked up and
   * described one situation from three angles.
   *
   * The lead is whatever needs acting on soonest — rescued edits (already on the
   * canvas), then the parked draft (a real question), then the other device
   * (only ever news). The rest become lines underneath.
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
    // Elsewhere-only no longer shows a popup — it appears in the dashboard
    // alert zone on both cards instead.
    return null;
  })();

  const [pendingPromoPopup, setPendingPromoPopup] = useState<'published' | 'draft' | null>(null);
  const [bypassUnsavedCheckRef] = useState({ current: false });
  // The schedule dialog serves two intents, and they end differently:
  //   'new'      → starting a campaign, so it continues to the build panel
  //   'schedule' → an existing card just missing dates, so it returns to work
  const setup = usePromoSetupDialog(() => configRef.current.promoCard);

  // Close setup dialog when switching away from promo tab
  useEffect(() => {
    if (activeTab !== 'promo') {
      setup.setVisible(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- setup is a new object every render; listing it would hide the dialog on every render while off the promo tab instead of only on the tab change
  }, [activeTab]);

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
        // An open-ended card is complete with a start date alone, so asking
        // it for an end date would prompt on every visit to the tab.
        if (!nothingToSchedule && !hasCompleteSchedule(pc)) setup.openForCard();
      }
      setActiveTab(tab);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- setup is a new object every render and would make this callback unstable; configRef is read via .current
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
    if (bypassUnsavedCheckRef.current) {
      startCreatePromo();
      return;
    }
    // If there's no draft in cloud, just start new (nothing to protect)
    if (draftPromoCard === null) {
      startCreatePromo();
      return;
    }
    // Only show unsaved check if there's a draft in cloud to protect
    if (promoWorkNotInDraftRef.current) {
      setPendingDashboardAction('create');
      return;
    }
    startCreatePromo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** The actual create flow, once nothing is at risk. */
  // Instead of opening the setup dialog (which we hid), directly go to promo editor
  const startCreatePromo = () => {
    handleDashboardTabSwitch('promo');
  };

  /**
   * When "Start New" is clicked while a draft exists, show confirmation.
   * After discard, the DiscardDraftDialog will handle the flow via this callback.
   */
  const handleStartNewWithDraft = useCallback(async () => {
    // Clear only the promo side of the draft — this is "Start New" from the
    // promo card specifically, so the announcement's saved work (if any)
    // must survive it.
    /**
     * Into the editor FIRST, then clear.
     *
     * The promo editor is unmounted while the dashboard is up, and its text
     * fields are contentEditable nodes seeded by an effect — so blanking the
     * config from here while it is unmounted changed the state and left the
     * canvas painted with the draft. Clearing once it is mounted lets
     * usePromoEditorSync see the change and repaint.
     */
    bypassUnsavedCheckRef.current = true;
    startCreatePromo();
    bypassUnsavedCheckRef.current = false;
    const undo = await discardPromoDraft();
    // Raised here rather than inside the discard so it lands with the cleared
    // canvas, which is what the offer is about.
    // An action toast already lives for TOAST_ACTION_MS (10s), long enough to
    // be read and acted on.
    if (undo) toast('Promo draft discarded', false, { label: 'Undo', onClick: undo });
    else toast('Promo draft discarded');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [discardPromoDraft, startCreatePromo, toast]);


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
      draftSignatureRef.current = mergedSavedSignature(next, ['promo']);
      savedPromoSignatureRef.current = getPromoSignature(next);
      setHasPromoChanges(getConfigSignature(next) !== publishedConfigRef.current);
      setEditorResetKey((k) => k + 1);
    }
    setPromoEntryStep('editor');
    setActiveTab('promo');
    toast('Your live card is loaded — edit it here, or use Improve with AI.');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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














  const { handleRestoreRecovery, handleDismissRecovery } = useRecoveryActions({
    recoveredAffectsPromo,
    recoveredAffectsAnnouncement,
    setRecoveredAffectsPromo,
    setRecoveredAffectsAnnouncement,
    setHasRecoveredWork,
    setRecoveryReason,
    configRef,
    campaignRef,
    writeRecoveredDraft,
    setDraftPromoCard,
    announcementComposeTextRef,
    setConfig,
    setPromoEntryStep,
    setActiveTab,
    toast,
  });














  function handleLogout() {
    /**
     * The same at-risk test the close prompt uses, rather than "differs from
     * the draft" — a card already sitting in My Published is not work about to
     * be lost, and stopping someone on the way out for it teaches them to
     * click through the one time it matters.
     */
    if (editorWorkAtRisk()) {
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
    // Compose text isn't part of the cloud draft — re-write recovery just for
    // it so the next login can restore it into the input box.
    if (htmlHasVisibleText(announcementComposeTextRef.current)) {
      writeRecovery(configRef.current, 'idle', announcementComposeTextRef.current);
    }
    /**
     * Unconditional, unlike the editor path: signing out on purpose means the
     * user was asked about anything at risk and answered. Presence rows are
     * keyed per device, so this lowers only this browser's flag — and it has
     * to run even when this session never raised one, to clear a flag left
     * standing by an earlier crash on this same device.
     */
    reportUnsaved(false);

    // The session is a signed cookie, so only the server can end it. Navigate
    // either way: a failed request must not strand someone on a page they have
    // asked to leave, and the cookie expires on its own.
    fetch('/api/auth/logout', { method: 'POST', keepalive: true })
      .catch(() => { })
      .finally(() => {
        window.location.href = '/login';
      });
  }




  const selectedPendingVariant = getSelectedPendingVariant();

  const {
    announcementCanReactivate,
    promoWorthPublishing,
    promoCanReactivate,
    editorWorkAtRisk,
  } = useEditorWorkStatus({
    config,
    publishedConfig,
    publishedConfigRef,
    configRef,
    hasPromoChanges,
    hasAnnouncementChangesRef,
    draftSignatureRef,
    draftPromoCard,
    promoVariants,
    promoWorkNotInDraftRef,
    announcementComposeTextRef,
  });


  return (
    <div className="campaign-page-bg flex h-screen text-on-surface">
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        <Header
          activeTab={activeTab}
          setActiveTab={handleTabSwitch}
          hasAnnouncementChanges={hasAnnouncementChanges}
          hasPromoChanges={promoWorthPublishing}
          promoDateInvalid={promoDateRangeInvalid}
          announcementDateInvalid={announcementDateRangeInvalid}
          isPublishing={isPublishing}
          isDarkMode={isDarkMode}
          toggleDarkMode={toggleDarkMode}
          handlePublishAnnouncement={handlePublishAnnouncementWithValidation}
          handlePublishPromo={handlePublishPromoWithValidation}
          handleLogout={handleLogout}
        />

        <main
          ref={mainScrollRef}
          className={`flex-1 overflow-y-auto bg-transparent px-6 pt-8 pb-6 ${activeTab === 'promo' || activeTab === 'announcement' ? 'campaign-custom-scrollbar' : ''
            }`}
        >
          <div className={`max-w-[1840px] mx-auto ${activeTab === 'promo' || activeTab === 'dashboard' ? '' : 'space-y-8 pb-12'}`}>
            {activeTab === 'dashboard' && (
              <Dashboard
                key={`dashboard-${publishedConfig.announcementBar.active}-${publishedConfig.promoCard.active}`}
                config={publishedConfig}
                draftConfig={config}
                draftSavedAt={draftSavedAt}
                promoSavedAt={promoSavedAt}
                announcementSavedAt={announcementSavedAt}
                setActiveTab={handleDashboardTabSwitch}
                onCreatePromo={handleCreatePromo}
                onEditLivePromo={handleOpenPublishedPromo}
                onStopPromo={stopPromoNow}
                onGoOnAirPromo={goOnAirPromoNow}
                onStopAnnouncement={stopAnnouncementNow}
                onGoOnAirAnnouncement={goOnAirAnnouncementNow}
                promoUnpublished={promoDraftDiffersFromLive}
                announcementUnpublished={hasAnnouncementChanges}
                promoDraftExists={draftPromoCard !== null}
                onOpenDraft={() => {
                  setPromoEntryStep('editor');
                  setActiveTab('promo');
                }}
                onStartNewWithDraft={handleStartNewWithDraft}
                hasRecoveredWork={hasRecoveredWork}
                recoveredAffectsPromo={recoveredAffectsPromo}
                recoveredAffectsAnnouncement={recoveredAffectsAnnouncement}
                recoveryReason={recoveryReason}
                onRestoreRecovery={handleRestoreRecovery}
                onDismissRecovery={handleDismissRecovery}
                announcementComposeTextRecovered={announcementComposeTextRecovered}
                onDismissAnnouncementComposeRecovery={() => setAnnouncementComposeTextRecovered(false)}
                elsewhereNotice={elsewhereNotice}
                onDismissElsewhere={dismissElsewhere}
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
                pendingComposeTextRef={announcementComposeTextRef}
                recoveredSelectedAnnouncementIndex={recoveredSelectedAnnouncementIndex}
                onRestoreRecoveredSelection={() => setRecoveredSelectedAnnouncementIndex(null)}
                saveDraftNow={(cfg) => {
                  /**
                   * The ref, not just markAnnouncementChanged(). That marker
                   * defers to a setTimeout and sets state, so the ref the draft
                   * PUT is gated on is still false on this tick — staging would
                   * have skipped the write in silence and the message would
                   * never have reached the user's other devices. The signature
                   * check inside still stops a redundant write.
                   */
                  hasAnnouncementChangesRef.current = true;
                  return saveDraft(cfg);
                }}
                publishNow={handlePublishAnnouncement}
                confirmPublish={(onConfirm) => setPublishConfirm({ warnings: [], onConfirm })}
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
                hasRecoveredWork={hasRecoveredWork}
                recoveryReason={recoveryReason}
                onRestoreRecovery={() => handleRestoreRecovery('promo')}
                onDismissRecovery={() => handleDismissRecovery('promo')}
              />
            )}
          </div>
        </main>
      </div>

      <PageDialogs
        postPublishDraft={postPublishDraft}
        setPostPublishDraft={setPostPublishDraft}
        clearDraft={clearDraft}
        toast={toast}
        welcomeBack={welcomeBack}
        draftOffer={draftOffer}
        editorWorkAtRisk={editorWorkAtRisk()}
        acceptOfferedDraft={acceptOfferedDraft}
        dismissWelcomeBack={dismissWelcomeBack}
        idleSecondsLeft={idleSecondsLeft}
        idleRestartRef={idleRestartRef}
        askNotifications={askNotifications}
        setAskNotifications={setAskNotifications}
        pendingDraftAction={pendingDraftAction}
        savedDraftSignature={savedDraftSignature}
        setPendingDraftAction={setPendingDraftAction}
        saveDraftAndContinue={saveDraftAndContinue}
        continueWithoutDraft={continueWithoutDraft}
        pendingVariantSave={pendingVariantSave}
        selectedPendingVariant={selectedPendingVariant}
        savePendingVariantAndClose={savePendingVariantAndClose}
        updateExistingVariantAndClose={updateExistingVariantAndClose}
        cancelPendingVariantSave={cancelPendingVariantSave}
        publishConfirm={publishConfirm}
        isConfirming={isConfirming}
        setIsConfirming={setIsConfirming}
        setIsPublishing={setIsPublishing}
        setPublishConfirm={setPublishConfirm}
        pendingDashboardAction={pendingDashboardAction}
        setPendingDashboardAction={setPendingDashboardAction}
        writeDraftNow={writeDraftNow}
        startCreatePromo={startCreatePromo}
        openPublishedPicker={openPublishedPicker}
        confirmDiscardDraft={confirmDiscardDraft}
        setConfirmDiscardDraft={setConfirmDiscardDraft}
        discardDraft={discardDraft}
        confirmReplaceDraft={confirmReplaceDraft}
        setConfirmReplaceDraft={setConfirmReplaceDraft}
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
