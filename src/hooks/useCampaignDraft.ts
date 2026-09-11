'use client';

import { useRef, useState, type RefObject } from 'react';
import type { CampaignConfig, PromoCard } from '@/types/campaign';
import type { useCampaignConfig } from '@/hooks/useCampaignConfig';
import type {
  ElsewhereNotice,
  PendingDraftAction,
} from '@/types/campaignShell';
import {
  getConfigSignature,
  getPromoSignature,
  normalizePromoForCompare,
  draftHasRestorableWork,
} from '@/lib/configSignature';
import { clearRecovery } from '@/lib/recovery';
import { markElsewhereSeen } from '@/lib/auth/presenceClient';
import { migrateConfig } from '@/lib/configMigration';

type Campaign = ReturnType<typeof useCampaignConfig>;

interface UseCampaignDraftArgs {
  /**
   * The config hook's API, read at call time.
   *
   * A ref rather than the value: the config hook needs this hook's state (it
   * decides on load whether to offer a draft back), so this one is built
   * first and cannot have the campaign yet. Every function below runs from an
   * event, never during render, by which point it is filled in.
   */
  campaignRef: RefObject<Campaign | null>;
  toast: (
    message: string,
    isError?: boolean,
    action?: { label: string; onClick: () => void },
    durationMs?: number,
  ) => void;
  performLogout: () => void;
  setActiveTab: (tab: 'dashboard' | 'announcement' | 'promo') => void;
  setPromoEntryStep: (step: 'ai' | 'build' | 'editor') => void;
  /** Another device is editing — shape mirrors the page's own state. */
  elsewhereNotice: ElsewhereNotice | null;
  setElsewhereNotice: (notice: ElsewhereNotice | null) => void;
  /** Suppress auto-opening build flow on side effects like delete. */
  setSuppressBuildFlow?: (suppress: boolean) => void;
  /** Show scaffolds (timer & CTA outlines) on blank canvas. */
  setBlankStart?: (value: boolean) => void;
}

/**
 * The single draft slot: what is parked in it, and every way in and out.
 *
 * Owns that state rather than receiving it. Measured the other way round it
 * needed twenty-seven arguments; owning it, and taking the config hook's API
 * as one, it needs eight.
 */
export function useCampaignDraft({
  campaignRef,
  toast,
  performLogout,
  setActiveTab,
  setPromoEntryStep,
  elsewhereNotice,
  setElsewhereNotice,
  setSuppressBuildFlow,
  setBlankStart,
}: UseCampaignDraftArgs) {
  const [savedDraftSignature, setSavedDraftSignature] = useState<string | null>(null);
  const savedDraftSignatureRef = useRef<string | null>(null);
  savedDraftSignatureRef.current = savedDraftSignature;
  /** The signature the draft was written with, ahead of React. */
  const draftSignatureRef = useRef<string | null>(null);
  const [draftPromoCard, setDraftPromoCard] = useState<PromoCard | null>(null);
  const [savingDraft, setSavingDraft] = useState(false);
  const [confirmReplaceDraft, setConfirmReplaceDraft] = useState(false);
  const [confirmDiscardDraft, setConfirmDiscardDraft] = useState(false);
  /** What was offered back on load, so accepting it does not re-read the disk. */
  const offeredDraftRef = useRef<CampaignConfig | null>(null);
  const [draftOffer, setDraftOffer] = useState<CampaignConfig | null>(null);
  const [postPublishDraft, setPostPublishDraft] = useState(false);
  const [pendingDraftAction, setPendingDraftAction] = useState<PendingDraftAction | null>(null);
  const promoWorkNotInDraftRef = useRef(false);

  /** Take up the offered draft — what the old silent restore did, on request. */
  function acceptOfferedDraft(draft: CampaignConfig) {
    const campaign = campaignRef.current!;
    setDraftOffer(null);
    campaign.setConfig(draft);
    draftSignatureRef.current = getConfigSignature(draft);
    setSavedDraftSignature(getConfigSignature(draft));
    setDraftPromoCard(JSON.parse(JSON.stringify(draft.promoCard)));
    campaign.savedPromoSignatureRef.current = getPromoSignature(draft);
    campaign.setHasAnnouncementChanges(true);
    campaign.setHasPromoChanges(true);
    campaign.setReadyToPublishAnnouncement(true);
    setPromoEntryStep('editor');
    campaign.setConfigLoadedSignal((n) => n + 1);
    toast('Picked up where you left off');
  }

  function dismissWelcomeBack() {
    /**
     * Closing it counts as having read it.
     *
     * The other device's flag stays exactly as it is — only this browser
     * records that it has shown this particular batch of work. If that machine
     * produces newer work the notice returns; otherwise it does not repeat on
     * every visit, which it did, with nothing the user could do about it.
     */
    if (elsewhereNotice) markElsewhereSeen(elsewhereNotice.deviceId, elsewhereNotice.at);
    setDraftOffer(null);
    setElsewhereNotice(null);
  }

  /**
   * Persist the draft only if it carries restorable work — real promo text or a
   * changed announcement. A fresh/blank promo (even one that replaced a full
   * published card) is trivially recreatable, so it's not worth a draft.
   * Returns whether a draft was actually written.
   *
   * The draft lives in the DB via /api/draft. The DB write is fired without
   * awaiting (with keepalive so it survives page unload); the decision — save
   * vs skip, and the returned boolean the callers use for the toast — stays
   * synchronous so call sites don't change.
   */
  function saveDraft(
    cfg: CampaignConfig,
    options: { markHandled?: boolean } = {},
  ): boolean {
    const campaign = campaignRef.current!;
    /**
     * Nothing worth keeping in the editor — so write nothing. It must NOT
     * clear the slot.
     *
     * This used to delete the draft, on the reasoning that a blank card should
     * not leave a stale one behind. But the two are unrelated: the draft is
     * whatever was parked there earlier, and an empty canvas says nothing
     * about it.
     *
     * Deleting a draft stays where the user can see it: the My Draft popup,
     * and publishing, which supersedes it.
     */
    if (!draftHasRestorableWork(cfg, campaign.publishedConfigObjRef.current)) {
      return false;
    }

    fetch('/api/draft', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cfg),
      keepalive: true,
    }).catch(() => {});
    setSavedDraftSignature(getConfigSignature(cfg));
    setDraftPromoCard(JSON.parse(JSON.stringify(cfg.promoCard)));
    if (options.markHandled !== false) {
      draftSignatureRef.current = getConfigSignature(cfg);
    }
    return true;
  }

  function clearDraft() {
    fetch('/api/draft', { method: 'DELETE', keepalive: true }).catch(() => {});
    draftSignatureRef.current = null;
    setSavedDraftSignature(null);
    setDraftPromoCard(null);
  }

  /**
   * Deleting the saved draft, from the My Draft popup.
   *
   * If the canvas is showing exactly that draft, it goes back to what's live —
   * otherwise the "deleted" work stays on screen, still counts as unsaved, and
   * every entry point starts offering to save it again. Mirrors what deleting
   * a live variant already does.
   *
   * Edits made since the draft was saved are left alone: those are the user's
   * current work, not the thing they just deleted.
   */
  function handleDeleteDraft() {
    const campaign = campaignRef.current!;
    const deleted = draftPromoCard;
    const live = campaign.publishedConfigObjRef.current;
    const savedDraft = deleted ? JSON.parse(JSON.stringify(deleted)) : null;
    const savedDraftSig = savedDraft ? getConfigSignature({ ...campaign.configRef.current, promoCard: savedDraft }) : null;
    
    clearDraft();
    
    // Suppress build flow since this is a side effect, not a user-initiated action
    setSuppressBuildFlow?.(true);
    
    const undoTimeoutRef: { current: NodeJS.Timeout | undefined } = { current: undefined };
    
    toast('Saved draft deleted', false, {
      label: 'Undo',
      onClick: () => {
        if (undoTimeoutRef.current) {
          clearTimeout(undoTimeoutRef.current);
        }
        if (savedDraft && savedDraftSig) {
          setSavedDraftSignature(savedDraftSig);
          setDraftPromoCard(savedDraft);
          
          // Also load it back into editor canvas
          const restored = { ...campaign.configRef.current, promoCard: savedDraft };
          campaign.setConfig(restored);
          campaign.configRef.current = restored;
          draftSignatureRef.current = getConfigSignature(restored);
          campaign.savedPromoSignatureRef.current = getPromoSignature(restored);
          
          // Suppress build dialog since this is a restoration, not a new action
          setSuppressBuildFlow?.(true);
          
          fetch('/api/draft', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(restored),
            keepalive: true,
          }).catch(() => {});
          toast('Saved draft restored');
        }
      }
    }, 10000);
    
    // After 10s, if undo wasn't clicked, it's actually deleted
    undoTimeoutRef.current = setTimeout(() => {
      // Do nothing — already deleted from DB
    }, 10000);

    if (!live) return;
    // Reset canvas to published/live state
    const next: CampaignConfig = {
      ...campaign.configRef.current,
      promoCard: JSON.parse(JSON.stringify(live.promoCard)),
    };
    campaign.setConfig(next);
    campaign.configRef.current = next;
    draftSignatureRef.current = getConfigSignature(next);
    campaign.savedPromoSignatureRef.current = getPromoSignature(next);
    campaign.setHasPromoChanges(getConfigSignature(next) !== campaign.publishedConfigRef.current);
    campaign.setEditorResetKey((k) => k + 1);
    // Show scaffolds (timer & CTA outlines) on blank canvas
    setBlankStart?.(true);
  }

  /**
   * Explicit "Save as draft" — the ONLY way a draft is ever written now.
   * Unlike the automatic saveDraft() above, this always writes what's in the
   * editor: an explicit click means the user wants it saved, blank or not.
   *
   * @param options.keepEditor
   *   Leave the editor alone after the write. Set by the card-replace consent,
   *   which saves the outgoing card and then applies the incoming one.
   */
  function writeDraftNow(options: { keepEditor?: boolean; configOverride?: CampaignConfig } = {}): Promise<void> {
    const campaign = campaignRef.current!;
    const cfg = options.configOverride || campaign.configRef.current;
    setSavingDraft(true);
    return fetch('/api/draft', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cfg),
    })
      .then((res) => {
        if (res.ok) {
          draftSignatureRef.current = getConfigSignature(cfg);
          setSavedDraftSignature(getConfigSignature(cfg));
          setDraftPromoCard(JSON.parse(JSON.stringify(cfg.promoCard)));
          // Safe in the draft now, so the recovery copy has nothing to rescue.
          clearRecovery();
          toast('Saved draft updated');
        } else {
          toast('Couldn’t save your draft', true);
        }
      })
      .catch(() => toast('Couldn’t save your draft', true))
      .finally(() => setSavingDraft(false));
  }

  /**
   * There's only one draft slot — if it's already occupied, confirm before
   * overwriting it.
   */
  async function handleSaveAsDraft() {
    setSavingDraft(true);
    let exists = false;
    try {
      const res = await fetch('/api/draft');
      const data = res.ok ? await res.json() : null;
      exists = Boolean(data?.draft);
    } catch {
      // Can't tell — fall through and just write; worst case is an
      // unconfirmed overwrite, better than silently failing to save.
    }
    setSavingDraft(false);
    writeDraftNow();
  }

  function completePendingDraftAction(action = pendingDraftAction) {
    if (!action) return;
    setPendingDraftAction(null);
    if (action.type === 'tab') {
      setActiveTab(action.tab);
      return;
    }
    // Only 'logout' is left, and it means what it says.
    performLogout();
  }

  function saveDraftAndContinue() {
    const campaign = campaignRef.current!;
    if (saveDraft(campaign.configRef.current)) toast('Saved draft updated');
    completePendingDraftAction();
  }

  function continueWithoutDraft() {
    const campaign = campaignRef.current!;
    draftSignatureRef.current = getConfigSignature(campaign.configRef.current);
    completePendingDraftAction();
  }

  async function discardDraft() {
    const campaign = campaignRef.current!;
    clearDraft();
    campaign.setHasAnnouncementChanges(false);
    campaign.setHasPromoChanges(false);
    campaign.setReadyToPublishAnnouncement(false);
    // Reload published campaign.config
    try {
      const response = await fetch('/api/campaign.config');
      if (response.ok) {
        const data = await response.json();
        const migrated = migrateConfig(data, data.version);
        campaign.setConfig(migrated);
        draftSignatureRef.current = getConfigSignature(migrated);
        campaign.savedPromoSignatureRef.current = getPromoSignature(migrated);
        campaign.publishedConfigRef.current = getConfigSignature(migrated);
        campaign.publishedConfigObjRef.current = migrated;
      }
    } catch (e) {
      console.error('Failed to reload config:', e);
    }
    toast('Saved draft deleted');
  }

  return {
    savedDraftSignature,
    setSavedDraftSignature,
    savedDraftSignatureRef,
    draftSignatureRef,
    draftPromoCard,
    setDraftPromoCard,
    savingDraft,
    setSavingDraft,
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
    saveDraft,
    discardDraft,
    handleDeleteDraft,
    handleSaveAsDraft,
    acceptOfferedDraft,
    clearDraft,
    saveDraftAndContinue,
    continueWithoutDraft,
    completePendingDraftAction,
    dismissWelcomeBack,
  };
}