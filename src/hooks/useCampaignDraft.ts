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
  getMessagesSignature,
  messagesHasRestorableWork,
  announcementSignature,
  normalizePromoForCompare,
} from '@/lib/configSignature';
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
  // Messages draft state
  const [savedMessagesSignature, setSavedMessagesSignature] = useState<string | null>(null);
  // Track when draft was last saved to cloud, for dashboard display
  const [draftSavedAt, setDraftSavedAt] = useState<Date | null>(null);
  /**
   * Per-card save timestamps. promoCard and announcementBar now write to
   * separate columns on the draft row via /api/draft/promo and
   * /api/draft/announcement — see startScopedDraftPuts below — so these
   * simply get set to the write's own timestamp whenever that side's
   * request actually goes out. No more inferring "did this side really
   * change" from a signature comparison against the last save: the scoped
   * endpoint IS the guarantee that only the requested side was touched.
   */
  const [promoSavedAt, setPromoSavedAt] = useState<Date | null>(null);
  const [announcementSavedAt, setAnnouncementSavedAt] = useState<Date | null>(null);
  const savedMessagesSignatureRef = useRef<string | null>(null);
  savedMessagesSignatureRef.current = savedMessagesSignature;
  const messagesSignatureRef = useRef<string | null>(null);
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
   * promoCard and announcementBar now write to separate columns on the
   * draft row (/api/draft/promo, /api/draft/announcement) — see the
   * migration in campaignRepository.ts. A whole-config PUT used to be the
   * only option, which meant every save touched both columns whether or
   * not both sides had anything worth saving, and was the root cause of
   * nearly every cross-card bug this draft system had (shared timestamps,
   * "Start New" on one card wiping the other's draft, publish
   * republishing whatever was in the other editor). These decide per side
   * whether there's anything worth writing at all.
   */
  /**
   * Starts up to two independent PUTs — one per side, only for whichever
   * side is actually dirty right now. Separate columns on the same row, so
   * these can never step on each other: saving only the announcement fires
   * only the announcement request, and vice versa.
   *
   * Gated on hasPromoChangesRef / hasAnnouncementChangesRef — the same
   * dirty flags the rest of the app already uses to decide "does this side
   * have unpublished work". An earlier version gated on "does this side
   * have any content at all", which meant an already-saved, untouched
   * promo card got silently re-saved (and its timestamp re-stamped) on
   * every single save, just because it existed — not because anything
   * about it had changed.
   */
  function startScopedDraftPuts(cfg: CampaignConfig) {
    const campaign = campaignRef.current!;
    const now = new Date();
    const requests: { side: 'promo' | 'announcement'; request: Promise<Response> }[] = [];

    // DEBUG: Log to sessionStorage so we can see it after logout
    const debugLog: any = {
      timestamp: new Date().toISOString(),
      hasPromoChangesRef: campaign.hasPromoChangesRef.current,
      hasAnnouncementChangesRef: campaign.hasAnnouncementChangesRef.current,
    };

    // Only save promo if it has REAL changes (flag true + content differs from saved draft)
    if (campaign.hasPromoChangesRef.current) {
      // Use the SAME signature function as markPromoChanged() for consistency
      const promoSig = JSON.stringify(
        normalizePromoForCompare(
          cfg.promoCard as unknown as Record<string, unknown>,
        ),
      );
      // savedPromoSignatureRef stores the RAW promo, so we need to normalize it for comparison
      let savedPromoSig: string | undefined;
      if (campaign.savedPromoSignatureRef.current) {
        try {
          const savedPromoObj = JSON.parse(campaign.savedPromoSignatureRef.current);
          savedPromoSig = JSON.stringify(
            normalizePromoForCompare(savedPromoObj),
          );
        } catch (e) {
          // If parse fails, treat as no saved version
          savedPromoSig = undefined;
        }
      }
      
      debugLog.promoSig_full = promoSig;
      debugLog.savedPromoSig_full = savedPromoSig;
      debugLog.promoMatches = promoSig === savedPromoSig;
      
      if (promoSig !== savedPromoSig) {
        requests.push({
          side: 'promo',
          request: fetch('/api/draft/promo', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ promoCard: cfg.promoCard }),
            keepalive: true,
          }),
        });
        debugLog.promoApiCalled = true;
      }
    }

    // Only save announcement if it has REAL changes (flag true + content differs from saved draft)
    if (campaign.hasAnnouncementChangesRef.current) {
      const annSig = announcementSignature(cfg);
      // Extract announcement signature from the saved full-config draft
      let savedAnnSig: string | null = null;
      if (savedDraftSignatureRef.current) {
        try {
          // savedDraftSignatureRef is a JSON string of the full config
          const savedCfg = JSON.parse(savedDraftSignatureRef.current);
          savedAnnSig = announcementSignature(savedCfg);
        } catch (e) {
          // If parse fails, just treat as null (nothing saved yet)
        }
      }
      
      debugLog.annSig_full = annSig;
      debugLog.savedAnnSig_full = savedAnnSig;
      debugLog.annMatches = annSig === savedAnnSig;
      
      // Only make API call if signatures actually differ from saved draft
      if (annSig !== savedAnnSig) {
        requests.push({
          side: 'announcement',
          request: fetch('/api/draft/announcement', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ announcementBar: cfg.announcementBar }),
            keepalive: true,
          }),
        });
        debugLog.annApiCalled = true;
      }
    }

    // Save debug log to sessionStorage
    debugLog.totalRequests = requests.length;
    try {
      const existing = sessionStorage.getItem('__debug_logs') || '[]';
      const logs = JSON.parse(existing);
      logs.push(debugLog);
      // Keep last 10 logs
      const recent = logs.slice(-10);
      sessionStorage.setItem('__debug_logs', JSON.stringify(recent));
      sessionStorage.setItem('__last_draft_save', JSON.stringify(debugLog));
    } catch (e) {
      // Ignore
    }

    return { requests, now };
  }

  function applyScopedDraftSaveState(
    cfg: CampaignConfig,
    now: Date,
    sides: ('promo' | 'announcement')[],
    options: { markHandled?: boolean } = {},
  ) {
    // Whole-config bookkeeping other draft features (offer/accept, "draft
    // exists" for the promo flow) still rely on — unaffected by the split.
    setSavedDraftSignature(getConfigSignature(cfg));
    setSavedMessagesSignature(getMessagesSignature(cfg));
    if (sides.includes('promo')) {
      setDraftPromoCard(JSON.parse(JSON.stringify(cfg.promoCard)));
      setPromoSavedAt(now);
      // Reset flag after successful save
      const campaign = campaignRef.current!;
      campaign.setHasPromoChanges(false);
    }
    if (sides.includes('announcement')) {
      setAnnouncementSavedAt(now);
      // Reset flag after successful save
      const campaign = campaignRef.current!;
      campaign.setHasAnnouncementChanges(false);
    }
    if (sides.length > 0) setDraftSavedAt(now);
    if (options.markHandled !== false) {
      draftSignatureRef.current = getConfigSignature(cfg);
      messagesSignatureRef.current = getMessagesSignature(cfg);
    }
  }

  /**
   * Fire-and-forget (with keepalive so it survives page unload) — save vs
   * skip, and the returned boolean the callers use for the toast, stay
   * synchronous so call sites don't change. Used by the idle-timeout
   * auto-save, which also writes a local recovery copy as a safety net —
   * so a lost race here isn't a lost save.
   */
  function saveDraft(
    cfg: CampaignConfig,
    options: { markHandled?: boolean } = {},
  ): boolean {
    const { requests, now } = startScopedDraftPuts(cfg);
    if (requests.length === 0) return false;
    requests.forEach(({ request }) => request.catch(() => {}));
    applyScopedDraftSaveState(
      cfg,
      now,
      requests.map((r) => r.side),
      options,
    );
    return true;
  }

  /**
   * Same save, but actually waits for the server to confirm both requests
   * before resolving. Logging out right after a fire-and-forget save raced
   * the logout request against the draft PUT — if the session got
   * invalidated first, the PUT came back 401 and the draft was silently
   * never written, even though the toast had already said "Saved".
   * Anything that logs the user out right after saving must go through
   * this, not saveDraft().
   */
  async function saveDraftAndWaitForCloud(
    cfg: CampaignConfig,
  ): Promise<'skipped' | 'saved' | 'failed'> {
    const { requests, now } = startScopedDraftPuts(cfg);
    if (requests.length === 0) return 'skipped';
    applyScopedDraftSaveState(cfg, now, requests.map((r) => r.side));
    try {
      const results = await Promise.all(requests.map((r) => r.request));
      return results.every((res) => res.ok) ? 'saved' : 'failed';
    } catch {
      return 'failed';
    }
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

    // "My Draft" is the promo card's own slot — only /api/draft/promo, so
    // whatever the announcement side has saved is never touched by this.
    // Optimistic (UI clears immediately, with Undo as the safety net below)
    // rather than awaited — but a silently-failed DELETE here is exactly
    // the "badge persists after discard" bug: at least log it so it's
    // diagnosable instead of invisible.
    fetch('/api/draft/promo', { method: 'DELETE', keepalive: true })
      .then((res) => {
        if (!res.ok) console.error('[handleDeleteDraft] Failed to clear promo draft');
      })
      .catch((e) => console.error('[handleDeleteDraft] Failed to clear promo draft:', e));
    setDraftPromoCard(null);
    setPromoSavedAt(null);

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
          setPromoSavedAt(new Date());

          // Also load it back into editor canvas
          const restored = { ...campaign.configRef.current, promoCard: savedDraft };
          campaign.setConfig(restored);
          campaign.configRef.current = restored;
          draftSignatureRef.current = getConfigSignature(restored);
          campaign.savedPromoSignatureRef.current = getPromoSignature(restored);

          // Suppress build dialog since this is a restoration, not a new action
          setSuppressBuildFlow?.(true);

          fetch('/api/draft/promo', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ promoCard: savedDraft }),
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
   * Explicit "Save as draft" for the PROMO card — reached from the promo
   * editor's own Save button and the card-replace consent flow (which saves
   * the outgoing card before applying the incoming one). Always writes the
   * promo card, blank or not: an explicit click means the user wants it
   * saved. Scoped to /api/draft/promo, so the announcement side — whatever
   * it currently holds, saved or not — is never read or touched by this.
   *
   * @param options.keepEditor
   *   Leave the editor alone after the write. (Kept for call-site parity;
   *   the write itself never touched the editor either way.)
   */
  function writeDraftNow(options: { keepEditor?: boolean; configOverride?: CampaignConfig } = {}): Promise<void> {
    const campaign = campaignRef.current!;
    const cfg = options.configOverride || campaign.configRef.current;
    setSavingDraft(true);
    return fetch('/api/draft/promo', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ promoCard: cfg.promoCard }),
    })
      .then((res) => {
        if (res.ok) {
          const now = new Date();
          draftSignatureRef.current = getConfigSignature(cfg);
          setSavedDraftSignature(getConfigSignature(cfg));
          setDraftPromoCard(JSON.parse(JSON.stringify(cfg.promoCard)));
          setDraftSavedAt(now);
          setPromoSavedAt(now);
          toast("Saved draft updated");
        } else {
          toast("Couldn’t save your draft", true);
        }
      })
      .catch(() => toast('Couldn’t save your draft', true))
      .finally(() => setSavingDraft(false));
  }

  function handleSaveAsDraft() {
    writeDraftNow();
  }

  /**
   * Writes a recovered snapshot to the draft row — both sides, since a
   * crash/idle recovery may hold unsaved work on either or both cards.
   * Used only by the recovery-restore flow (handleRestoreRecovery in
   * page.tsx); every other save path is scoped to one card via
   * writeDraftNow / saveMessagesDraft / saveDraft above.
   */
  async function writeRecoveredDraft(cfg: CampaignConfig): Promise<void> {
    setSavingDraft(true);
    try {
      const [promoRes, annRes] = await Promise.all([
        fetch('/api/draft/promo', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ promoCard: cfg.promoCard }),
        }),
        fetch('/api/draft/announcement', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ announcementBar: cfg.announcementBar }),
        }),
      ]);
      const now = new Date();
      draftSignatureRef.current = getConfigSignature(cfg);
      setSavedDraftSignature(getConfigSignature(cfg));
      if (promoRes.ok) {
        setDraftPromoCard(JSON.parse(JSON.stringify(cfg.promoCard)));
        setPromoSavedAt(now);
      }
      if (annRes.ok) setAnnouncementSavedAt(now);
      if (promoRes.ok || annRes.ok) setDraftSavedAt(now);
    } catch (e) {
      console.error('Failed to write recovered draft:', e);
    } finally {
      setSavingDraft(false);
    }
  }

  /**
   * Save only the messages draft (text + styles, NOT bar background).
   */
  async function saveMessagesDraft() {
    const campaign = campaignRef.current!;
    const cfg = campaign.configRef.current;

    if (!messagesHasRestorableWork(cfg, campaign.publishedConfigObjRef.current)) {
      toast('No message changes to save', false);
      return;
    }

    try {
      const res = await fetch('/api/draft/announcement', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ announcementBar: cfg.announcementBar }),
      });

      if (res.ok) {
        const now = new Date();
        setSavedMessagesSignature(getMessagesSignature(cfg));
        messagesSignatureRef.current = getMessagesSignature(cfg);
        setDraftSavedAt(now);
        setAnnouncementSavedAt(now);
        toast('Messages saved');
      } else {
        toast('Failed to save messages', true);
      }
    } catch {
      toast('Failed to save messages', true);
    }
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

  async function saveDraftAndContinue() {
    const campaign = campaignRef.current!;
    // Awaited, not fire-and-forget: this runs right before a logout, which
    // clears the session. A fire-and-forget PUT here raced the logout
    // request — if the session was invalidated first, the draft write came
    // back 401 and was silently dropped, even though the toast already said
    // "Saved". Must confirm the write landed before letting the caller
    // proceed to logout.
    const result = await saveDraftAndWaitForCloud(campaign.configRef.current);
    if (result === 'failed') {
      toast('Could not save to cloud — check your connection and try again', true);
      return;
    }
    if (result === 'saved') toast('Saved draft updated');
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

  /**
   * "Start New" from the promo card specifically — discards only the promo
   * side. There's one draft row for both cards, so calling the full
   * discardDraft() here (a DELETE on that row) was also wiping out whatever
   * the announcement side had saved, even though the user only asked to
   * start a new promo. If the announcement still has work worth keeping, the
   * row is rewritten with promo blanked out rather than deleted outright.
   */
  /**
   * "Start New" from the promo card — resets the promo editor to blank and
   * clears only the promo column of the draft row. Used to require fetching
   * the current draft, checking whether announcement still had work, and
   * rewriting the row to preserve it (see git history if curious just how
   * much). None of that is needed now: /api/draft/promo only ever touches
   * its own column, so announcement's draft — saved or not — simply can't
   * be affected by this, by construction.
   */
  async function discardPromoDraft() {
    const campaign = campaignRef.current!;

    try {
      const response = await fetch('/api/campaign.config');
      if (response.ok) {
        const data = await response.json();
        const migrated = migrateConfig(data, data.version);
        const nextConfig: CampaignConfig = {
          ...migrated,
          promoCard: campaign.blankPromoCard(),
          // The announcement editor is untouched by a promo discard.
          announcementBar: campaign.configRef.current.announcementBar,
        };
        campaign.setConfig(nextConfig);
        draftSignatureRef.current = getConfigSignature(nextConfig);
        campaign.savedPromoSignatureRef.current = getPromoSignature(nextConfig);
        campaign.publishedConfigRef.current = getConfigSignature(migrated);
        campaign.publishedConfigObjRef.current = migrated;
      }
    } catch (e) {
      console.error('Failed to reload config:', e);
    }

    // Awaited: a fire-and-forget DELETE here meant "Draft pending" cleared
    // on screen immediately but could silently fail to clear server-side —
    // the badge then came right back the next time the draft was fetched,
    // because the row had never actually been deleted. Only drop the local
    // state once the server confirms the row is gone.
    try {
      const res = await fetch('/api/draft/promo', { method: 'DELETE' });
      if (res.ok) {
        setDraftPromoCard(null);
        campaign.setHasPromoChanges(false);
        setPromoSavedAt(null);
      } else {
        console.error('[discardPromoDraft] Failed to clear promo draft');
      }
    } catch (e) {
      console.error('[discardPromoDraft] Failed to clear promo draft:', e);
    }
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
    writeRecoveredDraft,
    saveDraft,
    saveDraftAndWaitForCloud,
    discardDraft,
    discardPromoDraft,
    handleDeleteDraft,
    handleSaveAsDraft,
    acceptOfferedDraft,
    clearDraft,
    saveDraftAndContinue,
    continueWithoutDraft,
    completePendingDraftAction,
    dismissWelcomeBack,
    // Messages draft
    savedMessagesSignature,
    setSavedMessagesSignature,
    savedMessagesSignatureRef,
    messagesSignatureRef,
    saveMessagesDraft,
    // Track when draft was last saved
    draftSavedAt,
    setDraftSavedAt,
    // Per-card save timestamps — independent of each other, sourced from
    // the draft row's own promo_last_updated / announcement_last_updated
    // columns (see useCampaignConfig.ts's load, and each scoped save above).
    promoSavedAt,
    setPromoSavedAt,
    announcementSavedAt,
    setAnnouncementSavedAt,
  };
}