'use client';

import type { RefObject } from 'react';
import type { CampaignConfig, PromoCard } from '@/types/campaign';
import type { PromoVersion } from '@/lib/promo/promoVersions';
import type { PromoSectionProps } from '@/components/promo/PromoSection';
import type { PromoCardAction } from '@/components/promo/PromoCardActionDialog';
import type { usePromoUndo } from '@/components/promo/usePromoUndo';
import type { usePromoVersions } from '@/components/promo/usePromoVersions';
import type { usePromoPopupFlags } from '@/components/promo/usePromoPopupFlags';
import type { usePromoFieldStyling } from '@/components/promo/usePromoFieldStyling';
import { clonePromoCard, cardSignature, withDefaultDates } from '@/lib/promo/promoCardIdentity';
import { cardReplaceConsent } from '@/lib/promo/cardReplaceConsent';
import { applyTemplateFull } from '@/lib/promo/promoTemplate';
import { serializeTimerHtml } from '@/lib/editor/timerUtils';
import { whatsAppUrl } from '@/lib/whatsapp';
import { deleteVersion, restoreVersion } from '@/lib/promo/promoVersions';
import {
  overwritesDraftCopy,
  savesToDraftCopy,
  REASSURANCE_BODY,
  CONTINUE_ANYWAY,
} from '@/lib/promo/cardReplaceCopy';

interface UsePromoCardLifecycleArgs {
  /**
   * The four hooks and the section's own props are taken whole rather than as
   * their thirty-nine members.
   *
   * Every function below is a verbatim move, so each group is destructured
   * straight back to the names it had. That keeps the argument list a seam
   * while the bodies stay byte-identical to the ones they replace.
   */
  props: PromoSectionProps;
  undo: ReturnType<typeof usePromoUndo>;
  versionsApi: ReturnType<typeof usePromoVersions>;
  popupFlags: ReturnType<typeof usePromoPopupFlags>;
  styling: ReturnType<typeof usePromoFieldStyling>;

  configRef: RefObject<CampaignConfig>;
  setConfig: (config: CampaignConfig | ((prev: CampaignConfig) => CampaignConfig)) => void;
  markChanged: () => void;
  syncEditorsFromConfig: (card: PromoCard) => void;
  setBlankStart: (blank: boolean) => void;
  startFreshPromoCard: (options?: { silent?: boolean }) => void;
  toast: (message: string, isError?: boolean, action?: { label: string; onClick: () => void }, durationMs?: number) => void;
  /** True when the card on the canvas has nothing on it. */
  canvasIsEmpty: boolean;
  isFreshCardRef: RefObject<boolean>;
  /** The consent dialog's own state — it lives with the section that renders it. */
  setCardActionConfirm: (next: PromoCardAction | null) => void;
}

/**
 * Everything that replaces the whole card on the canvas.
 *
 * Applying a template, applying a saved variant, restoring the draft, clearing
 * the canvas, deleting a variant. Each throws away what is on screen and puts
 * something else there, so each has to ask consent, park the outgoing card
 * where it can be fetched back, and reset the editors, the history and the
 * theme baseline that belonged to the old one.
 *
 * That shared shape is the reason these belong together, and the reason so
 * many "my card vanished" reports came from here: the shape was implemented
 * once per route until installPromoCard collapsed it.
 */
export function usePromoCardLifecycle({
  props,
  undo,
  versionsApi,
  popupFlags,
  styling,
  configRef,
  setConfig,
  markChanged,
  syncEditorsFromConfig,
  setBlankStart,
  startFreshPromoCard,
  toast,
  canvasIsEmpty,
  isFreshCardRef,
  setCardActionConfirm,
}: UsePromoCardLifecycleArgs) {
  const {
    livePromoCard,
    draftPromoCard,
    draftExists,
    draftUpToDate,
    hasUnsavedChanges,
    onSaveDraft,
    onSaveDraftDirect,
    onDeleteDraft,
    onRemoveLive,
    onCardReplaced,
    onSelectedVersionChange,
  } = props;
  const {
    capturePromoRestorePoint,
    nothingToOfferBack,
    toastWithUndo,
    setPromoAppliedCardBaseline,
    promoAppliedCardBaselineRef,
    promoHistory,
    promoAppliedRedoRef,
  } = undo;
  const {
    versions,
    setVersions,
    selectedVersionId,
    setSelectedVersionId,
    setPendingDeleteId,
  } = versionsApi;
  const {
    setShowVersionsPopup,
    setShowDraftPopup,
    setDraftPopupCard,
    setDraftPopupLoading,
    setConfirmDeleteDraft,
  } = popupFlags;

  /** The URL this card's button opens on the live site, if it opens anything. */
  function ctaDestination(card?: PromoCard): string | null {
    const c = card ?? configRef.current.promoCard;
    if (c.ctaType === 'link') {
      const url = (c.buttonUrl || '').trim();
      if (!url) return null;
      return /^https?:\/\//i.test(url) ? url : `https://${url}`;
    }
    if ((c.ctaType || 'whatsapp') === 'whatsapp') {
      // Any typed national digit makes a link. The old rule counted the
      // dialling code too, so the real minimum slid by country and a
      // half-typed number left the button dead with no explanation.
      return whatsAppUrl(c.whatsappCountryCode, c.whatsappNumber);
    }
    return null;
  }

  function isLiveVersion(version: PromoVersion): boolean {
    if (!livePromoCard || !livePromoCard.active) return false;
    // Identity first: publishing marks the variant that went live, so an edit
    // to the live card can't move the tag onto a different entry — or lose it.
    if (versions.some((version) => version.isLive)) return Boolean(version.isLive);
    // Variants saved before the marker existed carry no flag, so fall back to
    // comparing content rather than showing no Live tag at all.
    return cardSignature(version.promoCard) === cardSignature(livePromoCard);
  }

  /**
   * True when a card is on the website but no saved variant is tagged Live —
   * the live card was edited after publishing, its variant was deleted, or the
   * list is empty. The popup then shows the live card itself, so the list can
   * never say "nothing is live" while the site says otherwise.
   */
  function liveCardIsUnlisted(): boolean {
    if (!livePromoCard || !livePromoCard.active) return false;
    return !versions.some(isLiveVersion);
  }

  async function handleDeleteVersion(id: string) {
    // "My Published" mirrors what's on the site, so deleting the entry that's
    // currently on air must also take the card off the website — otherwise the
    // campaign keeps serving to visitors with no saved copy left behind.
    const target = versions.find((v) => v.id === id);
    const targetIndex = versions.findIndex((v) => v.id === id);
    const wasLive = !!target && isLiveVersion(target);
    const wasSelected = selectedVersionId === id;
    const updated = await deleteVersion(id);
    setVersions(updated);
    if (wasSelected) {
      setSelectedVersionId(null);
      onSelectedVersionChange?.(null);
    }
    setPendingDeleteId(null);
    if (wasLive) {
      onRemoveLive();
      // The card is gone from My Published and from the site, so leaving it on
      // the canvas would strand a copy that matches nothing — clear it too.
      // Silent, because taking the card off the site is the headline here and
      // this action carries its own Undo.
      startFreshPromoCard({ silent: true });
      toast("Deleted — the card has been removed from your website");
      return;
    }
    if (!target) {
      toast("Variant deleted");
      return;
    }
    // A delete is the one action here with nothing left on screen to recover
    // from, so its Undo goes back to the list itself — same id, same slot.
    toast("Variant deleted", false, {
      label: "Undo",
      onClick: async () => {
        const restored = await restoreVersion(target, targetIndex);
        setVersions(restored);
        if (wasSelected) {
          setSelectedVersionId(target.id);
          onSelectedVersionChange?.(target.id);
        }
      },
    });
  }

  /**
   * Clearing the canvas moved into the ⋯ menu: it is the one destructive action
   * in the row and was sitting between two everyday ones, styled the same.
   */
  function confirmClearCanvas() {
    confirmCardReplace(startFreshPromoCard, {
                      title: 'Clear the canvas?',
                      // Never routed through the save-first branches: clearing is
                      // destruction the user asked for, so saving is offered as a
                      // third button below, never made a condition of continuing.
                      offerDraftSave: false,
                      body: (
                        <>
                          This removes all content and styling from the card you are editing. Your live
                          campaign remains unchanged.
                          {draftUpToDate ? (
                            <>
                              {' '}
                              This card is already saved in{' '}
                              <span className="font-semibold text-on-surface">My Draft</span>.
                            </>
                          ) : draftExists ? (
                            <>
                              {' '}
                              Keeping a copy will replace the card currently in{' '}
                              <span className="font-semibold text-on-surface">My Draft</span>.
                            </>
                          ) : null}
                        </>
                      ),
                      reassuranceBody:
                        'This removes all content and styling from the card you are editing. Your live ' +
                        'campaign remains unchanged.',
                      // Short enough that three buttons fit one row at max-w-md.
                      // "anyway" only means something next to a save button; alone
                      // it implies a choice that isn't being offered.
                      confirmLabel: canvasIsEmpty || draftUpToDate ? 'Clear canvas' : 'Clear anyway',
                      // Offered only when there is something to save that isn't
                      // already saved — otherwise it's a button that does nothing.
                      ...(canvasIsEmpty || draftUpToDate
                        ? {}
                        : {
                            secondaryLabel: draftExists ? 'Replace draft & clear' : 'Save & clear',
                            onSecondary: () => {
                              saveOutgoingCardToDraft();
                              startFreshPromoCard();
                            },
                          }),
                    });
  }

  // Apply a saved version to the live card — click-to-apply, like a template.
  /**
   * Put a card on the canvas in place of the one there now.
   *
   * The one place a whole card is installed. Applying a template, applying a
   * saved variant and restoring the draft each did this themselves — eleven
   * identical steps written out three times, differing only in how the card is
   * derived and what the toast says. They had already drifted: restoring a
   * draft did not announce the replacement, so the countdown hint appeared for
   * a template and a variant but not for a draft, and nothing recorded whether
   * that was a decision.
   *
   * Every step here exists because installing a card invalidates something the
   * old one owned: the history belongs to a card that is gone, the theme strip
   * reverts to a design that is no longer applied, and the undo offer must
   * hold the moment before any of it moved.
   */
  function installPromoCard(
    next: PromoCard,
    opts: {
      /** The toast to show. Its Undo restores everything captured here. */
      message: string;
      /** Which saved variant this card is, or null when it is not one. */
      versionId?: string | null;
      /** Only the variant route has the popup open to close. */
      closeVersionsPopup?: boolean;
      /**
       * Tell the page a design arrived, which reveals the countdown hint.
       * Explicit because the three routes disagreed about it by accident.
       */
      announceReplacement?: boolean;
    },
  ) {
    const before = capturePromoRestorePoint();
    // A design has arrived, so the blank-canvas mode ends.
    setBlankStart(false);
    // Leaving a fresh card → undo lands on its EDITED state (getPromoSnapshot).
    // Leaving a template/variant → undo lands on its CLEAN baseline.
    isFreshCardRef.current = false;
    promoAppliedRedoRef.current = null;
    // The steps on the stack belong to the card being replaced.
    promoHistory.clear();
    setConfig({ ...configRef.current, promoCard: next });
    syncEditorsFromConfig(next);
    markChanged();
    setPromoAppliedCardBaseline(next);
    const versionId = opts.versionId ?? null;
    setSelectedVersionId(versionId);
    onSelectedVersionChange?.(versionId);
    if (opts.closeVersionsPopup) setShowVersionsPopup(false);
    toastWithUndo(opts.message, before);
    if (opts.announceReplacement) onCardReplaced?.();
  }

  function applyVersion(version: PromoVersion) {
    // Same rule as templates: a variant contributes its design and its copy,
    // not its schedule. Its dates belong to the campaign that already ran, so
    // dragging them onto the card being edited silently re-dates it — and on a
    // past variant those dates are usually in the past.
    const current = configRef.current.promoCard;
    installPromoCard(
      withDefaultDates({
        ...clonePromoCard(version.promoCard),
        active: false,
        startDate: current.startDate || version.promoCard.startDate,
        endDate: current.endDate || version.promoCard.endDate,
      }),
      {
        message: `Variant applied: ${version.label}`,
        versionId: version.id,
        closeVersionsPopup: true,
        announceReplacement: true,
      },
    );
  }

  // Fetch the single saved draft from the DB and open the My Draft popup. We
  // only need its promo card for the preview.
  async function openDraftPopup() {
    setShowDraftPopup(true);
    setDraftPopupLoading(true);
    setDraftPopupCard(null);
    setConfirmDeleteDraft(false);
    try {
      const res = await fetch('/api/draft');
      const data = res.ok ? await res.json() : null;
      setDraftPopupCard((data?.draft?.promoCard as PromoCard | undefined) ?? null);
    } catch {
      setDraftPopupCard(null);
    } finally {
      setDraftPopupLoading(false);
    }
  }

  // Delete the single saved draft from where it's viewed. Only touches the DB
  // row — the card currently in the editor is untouched either way.
  function deleteDraft() {
    onDeleteDraft();
    setDraftPopupCard(null);
    setConfirmDeleteDraft(false);
    toast('Saved draft deleted');
  }

  // Load the saved draft's promo card back into the editor.
  function restoreDraftPromoCard(card: PromoCard) {
    installPromoCard(clonePromoCard(card), {
      message: 'Saved draft loaded into the editor',
      // Deliberately NOT announced: this route never revealed the countdown
      // hint, and preserving that is a decision rather than the oversight it
      // was while the sequence existed in three copies.
      announceReplacement: false,
    });
  }

  /**
   * Apply a template in full — its design AND its sample copy.
   *
   * This is the destructive half of the old Template Hub, kept deliberately:
   * Themes swap the look and keep your words, so the only reason to come here
   * is to take the template's wording too. Callers wrap it in
   * confirmCardReplace, which stays quiet when there's nothing to lose.
   */
  function applyTemplate(template: PromoCard, templateName: string) {
    // Delegates to applyTemplateFull so the schedule survives. Cloning the
    // template wholesale here reset startDate/endDate to the template's own
    // sample dates (every one ships "today"), wiping the dates the user chose
    // when creating the campaign. A template is a design and its copy —
    // scheduling isn't part of it.
    const cloned = withDefaultDates(
      applyTemplateFull(configRef.current.promoCard, template),
    );
    cloned.timerText = serializeTimerHtml(cloned.timerText ?? "");
    installPromoCard(cloned, {
      message: `Template applied: ${templateName}`,
      announceReplacement: true,
    });
  }

  /**
   * Save what is on the canvas now, on the way to replacing it.
   *
   * keepEditor matters: the incoming card is applied immediately after this
   * returns, while the write is still in flight, so the editor must survive
   * the write completing.
   */
  function saveOutgoingCardToDraft() {
    if (onSaveDraftDirect) onSaveDraftDirect({ keepEditor: true });
    else onSaveDraft();
  }

  function confirmCardReplace(
    action: () => void,
    opts: {
      title: string;
      body: React.ReactNode;
      confirmLabel: string;
      /** Copy used when nothing is actually at risk (see below). */
      reassuranceBody?: React.ReactNode;
      /**
       * What is about to take the card's place, as a noun phrase — "this
       * template", "this variant", "a blank canvas". The draft branches below
       * are shared by every card-replacing action, so without this they can
       * only say "the new one", which names nothing.
       */
      replacementLabel?: string;
      /**
       * The card that would replace the current one, when the caller knows it.
       *
       * Lets the consent detect a no-op: applying the template or variant the
       * editor already holds changes nothing, so asking permission for it is
       * noise — and the dialog's own wording ("this replaces the card you're
       * editing") would be false.
       */
      nextCard?: PromoCard;
      /**
       * Whether the draft branches apply. True for actions that swap one card
       * for another, where saving first protects the outgoing work.
       *
       * False for deliberate destruction (Clear Canvas): the user is throwing
       * the card away, so quietly saving it over their existing draft would
       * destroy the draft to preserve something they just discarded.
       */
      offerDraftSave?: boolean;
    },
  ) {
    const pc = configRef.current.promoCard;
    const incoming = opts.replacementLabel ?? 'the new card';
    const offerDraftSave = opts.offerDraftSave !== false;

    const verdict = cardReplaceConsent({
      current: pc,
      next: opts.nextCard,
      live: livePromoCard,
      draft: draftPromoCard,
      draftExists,
      draftUpToDate,
      hasUnsavedChanges,
      appliedBaseline: promoAppliedCardBaselineRef.current?.promoCard ?? null,
      nothingToOfferBack: nothingToOfferBack(pc),
      offerDraftSave,
    });

    if (verdict.kind === 'already-applied') {
      toast("That's already the card you're editing.");
      return;
    }
    if (verdict.kind === 'silent') {
      action();
      return;
    }

    // Every dialog below shares one rule: "No" simply closes it. It cancels the
    // replacement and touches nothing, because a button labelled No must never
    // destroy anything.
    if (verdict.kind === 'overwrites-draft') {
      setCardActionConfirm({
        ...opts,
        ...overwritesDraftCopy(incoming),
        onConfirm: () => {
          saveOutgoingCardToDraft();
          action();
        },
        secondaryLabel: CONTINUE_ANYWAY,
        onSecondary: action,
      });
      return;
    }

    if (verdict.kind === 'reassure') {
      setCardActionConfirm({
        ...opts,
        body: opts.reassuranceBody ?? REASSURANCE_BODY,
        onConfirm: action,
      });
      return;
    }

    if (verdict.kind === 'destructive') {
      setCardActionConfirm({ ...opts, onConfirm: action });
      return;
    }

    setCardActionConfirm({
      ...opts,
      ...savesToDraftCopy(incoming),
      onConfirm: () => {
        saveOutgoingCardToDraft();
        action();
      },
      // Discards the current card without keeping a copy. Offered because some
      // cards are not worth a draft slot, and the cap is five.
      secondaryLabel: CONTINUE_ANYWAY,
      onSecondary: action,
    });
  }

  return {
    installPromoCard,
    ctaDestination,
    isLiveVersion,
    liveCardIsUnlisted,
    handleDeleteVersion,
    confirmClearCanvas,
    applyVersion,
    openDraftPopup,
    deleteDraft,
    restoreDraftPromoCard,
    applyTemplate,
    saveOutgoingCardToDraft,
    confirmCardReplace,
  };
}
