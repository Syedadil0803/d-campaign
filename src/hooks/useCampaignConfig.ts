'use client';

import { useRef, useState } from 'react';
import { defaultConfig, type CampaignConfig, type PromoCard } from '@/types/campaign';
import {
  getConfigSignature,
  getPromoSignature,
  normalizePromoForCompare,
  announcementSignature,
  htmlHasVisibleText,
} from '@/lib/configSignature';
import {
  blankLookForVisit,
  currentBlankLook,
} from '@/lib/promo/blankLooks';
import { whatsAppUrl } from '@/lib/whatsapp';
import { migrateConfig } from '@/lib/configMigration';
import { withDefaultStartDate } from '@/lib/promo/promoCardIdentity';
import { isFirstLoadOfVisit } from '@/lib/visit';
import { cardIsNotUserWork } from '@/lib/promo/promoAuthorship';
import { sampleTemplates } from '@/lib/promo/sampleTemplateCards';
import { readRecoveryEnvelope, clearRecovery } from '@/lib/recovery';

interface CampaignDraftPort {
  clearDraft: () => void;
  draftSignatureRef: { current: string | null };
  savedDraftSignatureRef: { current: string | null };
  offeredDraftRef: { current: CampaignConfig | null };
  setSavedDraftSignature: (signature: string | null) => void;
  setDraftPromoCard: (card: PromoCard | null) => void;
  setPostPublishDraft: (value: boolean) => void;
  setDraftSavedAt: (value: Date | null) => void;
  setPromoSavedAt: (value: Date | null) => void;
  setAnnouncementSavedAt: (value: Date | null) => void;
}

interface UseCampaignConfigArgs {
  toast: (message: string, isError?: boolean) => void;
  promoBlankStart: boolean;
  setPromoEntryStep: (step: 'build' | 'editor') => void;
  ensureLivePromoVariant: (cfg: CampaignConfig) => Promise<CampaignConfig>;
  draftPort: CampaignDraftPort;
  setHasRecoveredWork: (value: boolean) => void;
  setRecoveryReason: (reason: 'idle' | 'crash' | null) => void;
  setBlankStart?: (value: boolean) => void;
  setRecoveredConfig?: (config: CampaignConfig | null) => void;
  /**
   * Which card the recovered-but-not-yet-saved content actually belongs to.
   * hasRecoveredWork alone doesn't say — a recovery pulled in purely from an
   * announcement edit would otherwise show its "recovered" banner on both
   * cards, or on the wrong one, since both cards share the one flag.
   */
  setRecoveredAffectsPromo?: (value: boolean) => void;
  setRecoveredAffectsAnnouncement?: (value: boolean) => void;
}

/**
 * The campaign itself: what is being edited, what is published, and whether
 * the two differ.
 *
 * Owns that state rather than receiving it, which is what makes it a module.
 * Measured the other way round first — leaving the state in the page and
 * passing it in needed twenty-one arguments; owning it needs six.
 */
export function useCampaignConfig({
  toast,
  setPromoEntryStep,
  ensureLivePromoVariant,
  draftPort,
  setHasRecoveredWork,
  setRecoveryReason,
  setBlankStart,
  setRecoveredConfig,
  setRecoveredAffectsPromo,
  setRecoveredAffectsAnnouncement,
}: UseCampaignConfigArgs) {
  const [config, setConfig] = useState<CampaignConfig>(defaultConfig);
  const [publishedConfig, setPublishedConfig] = useState<CampaignConfig>(defaultConfig);
  const [hasAnnouncementChanges, setHasAnnouncementChanges] = useState(false);
  const [hasPromoChanges, setHasPromoChanges] = useState(false);
  const [readyToPublishAnnouncement, setReadyToPublishAnnouncement] = useState(false);
  /** Bumped to make the editors re-read a config that arrived from elsewhere. */
  const [configLoadedSignal, setConfigLoadedSignal] = useState(0);
  /** Bumped to remount the editors so they re-read a reverted config. */
  const [editorResetKey, setEditorResetKey] = useState(0);

  const configRef = useRef(config);
  configRef.current = config;
  const hasAnnouncementChangesRef = useRef(hasAnnouncementChanges);
  hasAnnouncementChangesRef.current = hasAnnouncementChanges;
  const hasPromoChangesRef = useRef(hasPromoChanges);
  hasPromoChangesRef.current = hasPromoChanges;
  const publishedConfigRef = useRef<string | null>(null);
  const publishedConfigObjRef = useRef<CampaignConfig | null>(null);
  const savedPromoSignatureRef = useRef<string | null>(null);
  const hasLoadedOnceRef = useRef(false);

  /**
   * Send the promo editor back to the default card.
   *
   * Runs once the work is safely somewhere else — published, or written to the
   * draft. Leaving the finished card sitting in the editor made the next visit
   * ambiguous: what is on screen looks like work in progress, but is really a
   * copy of something already saved, and editing it silently diverges from what
   * is live. Starting from the default card makes "this is new" unmistakable.
   *
   * The signatures are re-baselined at the same time, otherwise the reset would
   * itself register as unsaved work — and the unload rescue would then write
   * this blank card over the draft that was just saved.
   */
  function resetPromoEditorToDefault() {
    const next: CampaignConfig = {
      ...configRef.current,
      promoCard: blankPromoCard(),
    };
    setConfig(next);
    savedPromoSignatureRef.current = getPromoSignature(next);
    draftPort.draftSignatureRef.current = getConfigSignature(next);
    setHasPromoChanges(false);
   setPromoEntryStep('editor');
    // Makes the editors re-read from config — without it the contentEditable
    // fields keep showing the card that was just cleared.
    setConfigLoadedSignal((n) => n + 1);
  }

  /**
   * A blank promo card wearing this visit's palette.
   *
   * Every route that starts from nothing goes through here — opening the tool,
   * creating a campaign, the reset after saving or publishing. They used to
   * copy defaultConfig directly, which is always palette one, so the rotation
   * was invisible everywhere except Clear and closing the tool changed nothing.
   */
  function blankPromoCard(): CampaignConfig['promoCard'] {
    const card = JSON.parse(
      JSON.stringify(defaultConfig.promoCard),
    ) as CampaignConfig['promoCard'];
    card.style = JSON.parse(JSON.stringify(currentBlankLook())) as CampaignConfig['promoCard']['style'];
    // Keep the schedule mode the editor is on. Clearing after save or publish
    // must not silently drop an Open-ended campaign back to Custom dates — the
    // mode belongs to how the user was working, not to the card's content.
    card.scheduleMode = configRef.current.promoCard.scheduleMode;
    // defaultConfig carries no dates, so without this a refresh landed on a
    // card whose Start Date read "Select" — see withDefaultStartDate.
    return withDefaultStartDate(card);
  }

  async function persistConfig(
    cfg: CampaignConfig,
    successMessage = 'Settings saved successfully',
    scope?: 'announcement' | 'promo',
    options: { preserveDraft?: boolean } = {},
  ) {
    try {
      /**
       * `cfg` is built from the shared editor config, which holds BOTH
       * cards' current state at once — so publishing one scope with the
       * config as-is silently republished whatever happened to be sitting
       * in the OTHER tab's editor too (half-typed promo text going live
       * off an announcement publish, and vice versa). A scoped publish must
       * only ever touch the side it names; the other side is pinned to
       * what's already live, completely untouched by editor state.
       */
      const live = publishedConfigObjRef.current;
      const scopedCfg: CampaignConfig =
        scope === 'announcement' && live
          ? { ...cfg, promoCard: live.promoCard }
          : scope === 'promo' && live
            ? { ...cfg, announcementBar: live.announcementBar }
            : cfg;

      // Anything going live gets a saved variant first, so the write below can
      // never publish a card that My Published doesn't know about.
      const guaranteed = await ensureLivePromoVariant(scopedCfg);
      // Build the button destination from the CTA type
      const cfgToSend = { ...guaranteed };
      const pc = cfgToSend.promoCard;
      const cta = pc.ctaType || 'whatsapp';
      if (cta === 'whatsapp') {
        // The same builder the editor preview uses, so what goes live is
        // exactly what the preview button opens. Unconditional, so switching
        // from a link CTA to WhatsApp can't publish the old URL.
        cfgToSend.promoCard = {
          ...pc,
          buttonUrl: whatsAppUrl(pc.whatsappCountryCode, pc.whatsappNumber) ?? '',
        };
      } else if (cta === 'text') {
        // Plain text CTA: styled button with no link
        cfgToSend.promoCard = { ...pc, buttonUrl: '' };
      }

      const response = await fetch('/api/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cfgToSend),
      });

      if (response.ok) {
        // Whatever we just persisted IS the live site now — the Dashboard reads
        // this. Record the guaranteed config, not the one passed in: it carries
        // the live-variant pointer, and without it My Published would show no
        // Live tag until the next reload.
        setPublishedConfig(guaranteed);
        publishedConfigRef.current = getConfigSignature(guaranteed);
        publishedConfigObjRef.current = guaranteed;
        // A live on-air toggle (preserveDraft) must not reset the "unpublished
        // changes" flags — only a real publish does.
        if (!options.preserveDraft) {
          if (scope === 'announcement') setHasAnnouncementChanges(false);
          else if (scope === 'promo') setHasPromoChanges(false);
          else { setHasAnnouncementChanges(false); setHasPromoChanges(false); }
          // Live now, so anything the recovery slot was holding is moot.
          clearRecovery();
          /**
           * There's one draft row for both cards, but promoCard and
           * announcementBar are separate columns (/api/draft/promo,
           * /api/draft/announcement) — so a publish only ever needs to
           * clear its own column. This used to mean fetching the whole
           * draft, rewriting it with the published side reset, and
           * preserving the other side by hand; none of that is needed
           * anymore, since the other column was never touched by this
           * write to begin with.
           */
          if (scope === 'announcement') {
            // Awaited, not fire-and-forget: a "Draft pending" badge that
            // clears on screen but silently failed to clear server-side
            // came back the moment the page reloaded — the row was still
            // there the whole time, the client just never found out the
            // DELETE had failed. Only drop the local flag once the server
            // confirms the row is actually gone.
            try {
              const res = await fetch('/api/draft/announcement', { method: 'DELETE' });
              if (res.ok) {
                draftPort.setAnnouncementSavedAt(null);
              } else {
                console.error('[persistConfig] Failed to clear announcement draft after publish');
              }
            } catch (e) {
              console.error('[persistConfig] Failed to clear announcement draft after publish:', e);
            }
          } else if (scope === 'promo') {
            try {
              const res = await fetch('/api/draft/promo', { method: 'DELETE' });
              if (res.ok) {
                draftPort.setPromoSavedAt(null);
                draftPort.setDraftPromoCard(null);
              } else {
                console.error('[persistConfig] Failed to clear promo draft after publish');
              }
            } catch (e) {
              console.error('[persistConfig] Failed to clear promo draft after publish:', e);
            }
          } else if (draftPort.savedDraftSignatureRef.current !== null) {
            draftPort.clearDraft();
          }
          // The card is live now, so the editor starts fresh for the next one.
          if (scope !== 'announcement') resetPromoEditorToDefault();
        }
        toast(successMessage);
      } else {
        toast('Failed to save settings', true);
      }
    } catch (error) {
      console.error('Failed to save config:', error);
      toast('Failed to save settings', true);
    }
  }

  async function loadConfig() {
    /**
     * Move the blank-canvas rotation on, once for this visit.
     *
     * Has to happen before anything builds a blank card below, so every route
     * in this load agrees on the colour. It advances at most once per visit —
     * a refresh keeps the palette it already had, or the canvas would change
     * under someone mid-edit.
     */
    blankLookForVisit();

    try {
      // Always fetch the published config + the saved draft from the DB.
      const [response, draftResponse] = await Promise.all([
        fetch('/api/config'),
        fetch('/api/draft'),
      ]);
      let publishedCfg: CampaignConfig | null = null;
      if (response.ok) {
        const data = await response.json();
        publishedCfg = migrateConfig(data, data.version);
        publishedConfigRef.current = getConfigSignature(publishedCfg);
        publishedConfigObjRef.current = publishedCfg;
        // Dashboard always mirrors the live/published config, even when a draft
        // is restored into the editors below.
        setPublishedConfig(publishedCfg);
      }

      /**
       * Check saved draft from cloud first to have it available for recovery comparison.
       */
      let draft: CampaignConfig | null = null;
      let promoHasTimestamp = false;
      let announcementHasTimestamp = false;
      if (draftResponse.ok) {
        const draftData = await draftResponse.json();
        draft = (draftData?.draft as CampaignConfig | null) ?? null;
        if (draftData?.promoLastUpdated) {
          draftPort.setPromoSavedAt(new Date(draftData.promoLastUpdated));
          promoHasTimestamp = true;
        }
        if (draftData?.announcementLastUpdated) {
          draftPort.setAnnouncementSavedAt(new Date(draftData.announcementLastUpdated));
          announcementHasTimestamp = true;
        }
        if (draft?.lastUpdated) {
          draftPort.setDraftSavedAt(new Date(draft.lastUpdated));
        }
      }

      /**
       * Disaster management: handle recovery FIRST, before auto-loading draft.
       * This way conflict detection (Case 2) can compare recovery vs draft.
       *
       * Case 1: No cloud draft + recovery exists
       *   → Push recovery to cloud, auto-load it (silent save)
       *
       * Case 2: Cloud draft exists + recovery exists + they DIFFER
       *   → Show recovery banner (user chooses which one — conflict resolution)
       *
       * Case 3: Cloud draft exists + recovery exists + they're IDENTICAL
       *   → Recovery is old/stale, discard it
       */
      const recoveredEnvelope = readRecoveryEnvelope();
      const recovered = recoveredEnvelope?.config ?? null;
      if (recovered && publishedCfg) {
        const restored = migrateConfig(recovered, recovered.version);
        if (getConfigSignature(restored) !== getConfigSignature(publishedCfg)) {
          if (!draft) {
            // Case 1: No cloud draft, recovery exists → push recovery to cloud, auto-load
            // Scoped endpoints so each side gets its own timestamp — the full
            // /api/draft PUT doesn't set per-card timestamps, so the next login
            // would not recognise the draft.
            Promise.all([
              fetch('/api/draft/promo', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ promoCard: restored.promoCard }),
                keepalive: true,
              }),
              fetch('/api/draft/announcement', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ announcementBar: restored.announcementBar }),
                keepalive: true,
              }),
            ]).catch(() => {});

            // Auto-load recovery as the new draft
            setConfig(restored);
            configRef.current = restored;
            draftPort.draftSignatureRef.current = getConfigSignature(restored);
            draftPort.setSavedDraftSignature(getConfigSignature(restored));
            draftPort.setDraftPromoCard(JSON.parse(JSON.stringify(restored.promoCard)));
            savedPromoSignatureRef.current = getPromoSignature(restored);
            // Flag only the side that actually differs from live — see the
            // matching comment further down for why this can't be blanket-true.
            if (promoContentSignature(restored) !== promoContentSignature(publishedCfg)) {
              setHasPromoChanges(true);
            }
            if (announcementSignature(restored) !== announcementSignature(publishedCfg)) {
              setHasAnnouncementChanges(true);
            }
            setPromoEntryStep('editor');
            setBlankStart?.(true);
            clearRecovery();
            setConfigLoadedSignal((n) => n + 1);
            return;
          } else {
            // Cloud draft exists — check if recovery differs from it
            const migrated = migrateConfig(draft, draft.version);
            // Only use cloud draft sides that have a per-card timestamp —
            // the other side is upsert padding, not saved user work.
            const cloudForEditor: CampaignConfig = {
              ...migrated,
              promoCard: promoHasTimestamp ? migrated.promoCard : publishedCfg.promoCard,
              announcementBar: announcementHasTimestamp ? migrated.announcementBar : publishedCfg.announcementBar,
            };
            if (getConfigSignature(restored) !== getConfigSignature(cloudForEditor)) {
              // Case 2: Both exist AND differ
              // Load CLOUD draft into editor (what user sees)
              // Store recovery for dashboard alert (user can restore it from there)
              setConfig(cloudForEditor);
              configRef.current = cloudForEditor;
              draftPort.draftSignatureRef.current = getConfigSignature(cloudForEditor);
              draftPort.setSavedDraftSignature(getConfigSignature(cloudForEditor));
              savedPromoSignatureRef.current = getPromoSignature(cloudForEditor);
              if (promoHasTimestamp) {
                draftPort.setDraftPromoCard(JSON.parse(JSON.stringify(cloudForEditor.promoCard)));
              }
              if (promoHasTimestamp && promoContentSignature(cloudForEditor) !== promoContentSignature(publishedCfg)) {
                setHasPromoChanges(true);
              }
              if (announcementHasTimestamp && announcementSignature(cloudForEditor) !== announcementSignature(publishedCfg)) {
                setHasAnnouncementChanges(true);
              }

              // Mark recovery so dashboard can show alert — scoped to
              // whichever card's content the recovered copy actually adds on
              // top of the cloud draft, so an announcement-only recovery
              // doesn't light up the promo card's banner.
              setHasRecoveredWork(true);
              setRecoveryReason(recoveredEnvelope?.reason ?? 'crash');
              setRecoveredConfig?.(restored);
              // Only flag recovery as affecting a card if it differs from current AND has visible content
              // This prevents flagging empty/default blanks as "meaningful recovery"
              setRecoveredAffectsPromo?.(
                promoContentSignature(restored) !== promoContentSignature(cloudForEditor) &&
                hasPromoVisibleContent(restored.promoCard),
              );
              setRecoveredAffectsAnnouncement?.(
                announcementSignature(restored) !== announcementSignature(cloudForEditor) &&
                hasAnnouncementVisibleContent(restored.announcementBar),
              );
              // Don't clear recovery — user may restore it from dashboard

              setPromoEntryStep('editor');
              setBlankStart?.(true);
              setConfigLoadedSignal((n) => n + 1);
              return;
            } else {
              // Case 3: Both exist but identical — recovery is stale, discard it
              clearRecovery();
            }
          }
        }
        // Identical to what is live — nothing was lost, so drop it quietly.
        clearRecovery();
      }

      /**
       * Now check draft (only if no recovery conflict was found above).
       *
       * The per-card timestamps are the gatekeeper: only load and flag a
       * side from the draft row if the server says that side was explicitly
       * saved. The draft row always carries BOTH columns (the type requires
       * it), but saving one side fills the other with a default — that
       * default differs from published after migration/normalization, which
       * was the root cause of "saving announcement lights up promo" and
       * every variant of that cross-contamination bug.
       */
      if (draft && publishedCfg && (promoHasTimestamp || announcementHasTimestamp)) {
        const migrated = migrateConfig(draft, draft.version);
        const forEditor: CampaignConfig = {
          ...migrated,
          promoCard: promoHasTimestamp ? migrated.promoCard : publishedCfg.promoCard,
          announcementBar: announcementHasTimestamp ? migrated.announcementBar : publishedCfg.announcementBar,
        };

        if (getConfigSignature(forEditor) !== getConfigSignature(publishedCfg)) {
          setConfig(forEditor);
          configRef.current = forEditor;
          draftPort.draftSignatureRef.current = getConfigSignature(forEditor);
          draftPort.setSavedDraftSignature(getConfigSignature(forEditor));
          savedPromoSignatureRef.current = getPromoSignature(forEditor);

          if (promoHasTimestamp) {
            draftPort.setDraftPromoCard(JSON.parse(JSON.stringify(forEditor.promoCard)));
            if (promoContentSignature(forEditor) !== promoContentSignature(publishedCfg)) {
              setHasPromoChanges(true);
            }
          }
          if (announcementHasTimestamp && announcementSignature(forEditor) !== announcementSignature(publishedCfg)) {
            setHasAnnouncementChanges(true);
          }
          setPromoEntryStep(promoHasTimestamp ? 'editor' : 'build');
          setBlankStart?.(true);
          setConfigLoadedSignal((n) => n + 1);
          return;
        }
      }

      if (publishedCfg) {
        /**
         * Nothing pending: the work is done and live, so the editor opens on
         * the default card rather than a copy of what is already out there.
         *
         * Only the promo card is reset — the announcement bar keeps its
         * published content, and the dashboard reads publishedConfig, so what
         * is live is unaffected either way.
         */
        const forEditor: CampaignConfig = {
          ...publishedCfg,
          promoCard: blankPromoCard(),
        };
        setConfig(forEditor);
        draftPort.draftSignatureRef.current = getConfigSignature(forEditor);
        savedPromoSignatureRef.current = getPromoSignature(forEditor);
        setPromoEntryStep('build');
        setConfigLoadedSignal((n) => n + 1);
      }
    } catch (error) {
      console.error('Failed to load config:', error);
      // Still a finished load. The editor waits on this signal before it paints,
      // so leaving it unset after a failure would hold the panel empty for good
      // rather than showing the default card.
      setConfigLoadedSignal((n) => n + 1);
    }
  }

  /**
   * Check if a promo card has any visible user-created content.
   */
  function hasPromoVisibleContent(card: PromoCard): boolean {
    if (!card) return false;
    const { title, subtitle, description, buttonText } = card;
    return (
      htmlHasVisibleText(title) ||
      htmlHasVisibleText(subtitle) ||
      htmlHasVisibleText(description) ||
      htmlHasVisibleText(buttonText)
    );
  }

  /**
   * Check if an announcement bar has any visible user-created content.
   */
  function hasAnnouncementVisibleContent(bar: CampaignConfig['announcementBar']): boolean {
    if (!bar || !bar.announcements) return false;
    return bar.announcements.some((ann) => htmlHasVisibleText(ann.text));
  }

  /**
   * The promo card's content, with the markup noise removed.
   *
   * getPromoSignature stringifies the card raw, so it counts the editors'
   * own re-serialisation as an edit — the very thing normalizePromoForCompare
   * exists to strip.
   */
  function promoContentSignature(cfg: CampaignConfig): string {
    return JSON.stringify(
      normalizePromoForCompare(
        cfg.promoCard as unknown as Record<string, unknown>,
      ),
    );
  }

  function markAnnouncementChanged() {
    setTimeout(() => {
      // Set flag to true if anything changed since we last loaded
      // The real check (comparing against saved draft) happens in startScopedDraftPuts
      setHasAnnouncementChanges(true);
      setReadyToPublishAnnouncement(false);
    }, 0);
  }

  function markPromoChanged() {
    setTimeout(() => {
      // Set flag to true if anything changed since we last loaded
      // The real check (comparing against saved draft) happens in startScopedDraftPuts
      setHasPromoChanges(true);
    }, 0);
  }

  return {
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
    hasPromoChangesRef,
    readyToPublishAnnouncement,
    setReadyToPublishAnnouncement,
    configLoadedSignal,
    setConfigLoadedSignal,
    editorResetKey,
    setEditorResetKey,
    blankPromoCard,
    markAnnouncementChanged,
    markPromoChanged,
    resetPromoEditorToDefault,
    loadConfig,
    persistConfig,
  };
}