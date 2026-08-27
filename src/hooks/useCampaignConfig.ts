'use client';

import { useRef, useState } from 'react';
import { defaultConfig, type CampaignConfig, type PromoCard } from '@/types/campaign';
import {
  getConfigSignature,
  getPromoSignature,
  normalizePromoForCompare,
  draftHasRestorableWork,
  announcementSignature,
} from '@/lib/configSignature';
import {
  blankLookForVisit,
  currentBlankLook,
} from '@/lib/promo/blankLooks';
import { whatsAppUrl } from '@/lib/whatsapp';
import { migrateConfig } from '@/lib/configMigration';
import { isFirstLoadOfVisit } from '@/lib/visit';
import { cardIsNotUserWork } from '@/lib/promo/promoAuthorship';
import { sampleTemplates } from '@/components/promo/SamplePromoTemplates';
import { readRecoveryEnvelope, clearRecovery } from '@/lib/recovery';

/**
 * What this hook needs from the draft, and nothing more.
 *
 * The two own each other's problems — loading a config decides whether to
 * offer a draft back, and saving a draft rewrites the signatures this holds —
 * so one of them has to be built first. This is the smaller surface, declared
 * as a port so the draft hook can be built second and handed in.
 */
export interface RestoreNotice {
  /** When the local copy was taken. Empty for copies written before it was recorded. */
  localSavedAt: string | null;
  /** When the parked draft was saved, if there is one. Null means there isn't. */
  draftSavedAt: string | null;
  /** The draft is newer than the work being restored. */
  draftIsNewer: boolean;
}

export interface CampaignDraftPort {
  clearDraft: () => void;
  draftSignatureRef: { current: string | null };
  savedDraftSignatureRef: { current: string | null };
  offeredDraftRef: { current: CampaignConfig | null };
  setSavedDraftSignature: (signature: string | null) => void;
  setDraftPromoCard: (card: PromoCard | null) => void;
  setPostPublishDraft: (value: boolean) => void;
}



interface UseCampaignConfigArgs {
  toast: (message: string, isError?: boolean) => void;
  promoBlankStart: boolean;
  setPromoEntryStep: (step: 'build' | 'editor') => void;
  /** Shape declared here so the page and this agree on one definition. */
  setRestoreNotice: (notice: RestoreNotice | null) => void;
  ensureLivePromoVariant: (cfg: CampaignConfig) => Promise<CampaignConfig>;
  draftPort: CampaignDraftPort;
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
  setRestoreNotice,
  ensureLivePromoVariant,
  draftPort,
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
    setPromoEntryStep('build');
    // Makes the editors re-read from config — without it the contentEditable
    // fields keep showing the card that was just cleared.
    setConfigLoadedSignal((n) => n + 1);
  }

  /**
   * Drafting is manual — except when the work is about to be lost.
   *
   * On tab close or refresh we take one rescue copy so unsaved work survives,
   * and warn with the native prompt.
   *
   * The test is whether anything would actually be lost, which is a narrower
   * question than "has anything changed".
   *
   * Comparing against the published card alone was wrong, and so was
   * comparing against the saved draft alone: a card can equally be sitting in
   * My Published, and one the user never authored — a blank canvas, an
   * untouched template — is not worth stopping anybody over. The promo half
   * reuses the check the dashboard already makes, which weighs all three
   * places a card can be recovered from and whether it is the user's work at
   * all.
   *
   * A prompt that fires when there is nothing to lose is one people learn to
   * click through without reading, which costs more than it saves.
   *
   * Nothing is written on the way out. The local copy is for moving around
   * inside the tool, not for closing it: if the user is told their work may be
   * lost and leaves anyway, quietly keeping it makes the warning a lie.
   */
  /**
   * Keep a local copy of work in progress, continuously.
   *
   * The unload handler below covers a deliberate close, but it is not a
   * guarantee: a crash, a killed tab, a battery running out or a phone
   * switching apps never fire it. Writing as the user works means the copy is
   * already there whatever happens next.
   *
   * Debounced because this runs on every keystroke's worth of state, and
   * localStorage writes are synchronous — doing it eagerly would stutter the
   * editor it is meant to protect.
   *
   * Only real work is kept: the same at-risk test the close prompt uses, so a
   * blank canvas, a stock template or the published card unedited never
   * displaces something worth recovering.
   */
  /** True once a card has been loaded — see the recovery effect below. */

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
    return card;
  }

  /**
   * May the countdown switch itself on once both dates exist?
   *
   * Only after Clear, where the end date is genuinely missing and supplying it
   * is the user finishing the schedule. Create new collects both dates before
   * the card has been seen, so the same behaviour there is the app deciding
   * for them — which is why this is a separate flag and not `promoBlankStart`.
   */

  async function persistConfig(
    cfg: CampaignConfig,
    successMessage = 'Settings saved successfully',
    scope?: 'announcement' | 'promo',
    options: { preserveDraft?: boolean } = {},
  ) {
    try {
      // Anything going live gets a saved variant first, so the write below can
      // never publish a card that My Published doesn't know about.
      const guaranteed = await ensureLivePromoVariant(cfg);
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
          /**
           * What happens to the saved draft is the user's call, not ours.
           *
           * Publishing used to delete it outright, on the reasoning that going
           * live supersedes the parked copy. Sometimes true — but a draft is
           * whatever the user put aside, often work on a different card, and
           * publishing says nothing about wanting that gone.
           *
           * So: if the draft is what was just published, it is redundant and
           * goes quietly — nothing can be lost, the content is live. If it
           * differs, it is asked about rather than assumed.
           */
          // Live now, so anything the recovery slot was holding is moot.
          clearRecovery();
          if (draftPort.savedDraftSignatureRef.current !== null) {
            if (draftPort.savedDraftSignatureRef.current === getConfigSignature(guaranteed)) {
              draftPort.clearDraft();
            } else {
              draftPort.setPostPublishDraft(true);
            }
          }
          // The card is live now, so the editor starts fresh for the next one.
          // Undefined scope saves both, so it counts as a promo publish too.
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

      let draft: CampaignConfig | null = null;
      if (draftResponse.ok) {
        const draftData = await draftResponse.json();
        draft = (draftData?.draft as CampaignConfig | null) ?? null;
      }

      /**
       * Work that was in progress when the page went away comes back first,
       * and without being asked about.
       *
       * The user did not choose to stop, so finding anything other than where
       * they left off reads as data loss. It is cleared as it is taken up —
       * one accident, one restore — and a draft parked in My Draft is left
       * exactly where it is, still on its chip.
       */
      const recoveredEnvelope = readRecoveryEnvelope();
      const recovered = recoveredEnvelope?.config ?? null;
      if (recovered && publishedCfg) {
        const restored = migrateConfig(recovered, recovered.version);
        if (getConfigSignature(restored) !== getConfigSignature(publishedCfg)) {
          clearRecovery();
          setConfig(restored);
          draftPort.draftSignatureRef.current = getConfigSignature(publishedCfg);
          savedPromoSignatureRef.current = getPromoSignature(publishedCfg);
          /**
           * Flag only what is genuinely the user's, rather than marking
           * everything changed on the way in.
           *
           * A recovery copy is the whole config, so it carries the promo card
           * even when the announcements were the part at risk. Marking the
           * promo changed regardless would report unpublished work for a card
           * that is a stock template, or the published one unedited — and
           * every guard downstream reads those flags.
           */
          const promoIsOwnWork = !cardIsNotUserWork(
            restored.promoCard,
            sampleTemplates.map((t) => t.promoCard as CampaignConfig['promoCard']),
          );
          setHasAnnouncementChanges(
            announcementSignature(restored) !== announcementSignature(publishedCfg),
          );
          setHasPromoChanges(
            promoIsOwnWork &&
              getPromoSignature(restored) !== getPromoSignature(publishedCfg),
          );
          setPromoEntryStep('editor');
          setConfigLoadedSignal((n) => n + 1);

          /**
           * A parked draft is left exactly where it is.
           *
           * The restored work goes on the canvas and the draft stays on its
           * chip, because they are two different things: one is where the user
           * was, the other is what they last decided to keep. Overwriting the
           * draft with the rescue would spend a deliberate save on an accident.
           * The notice then has to name both, or the user is looking at a
           * canvas and a draft chip that disagree with no explanation.
           */
          let draftSavedAt: string | null = null;
          let draftIsNewer = false;
          if (draft) {
            const migratedDraft = migrateConfig(draft, draft.version);
            draftPort.setSavedDraftSignature(getConfigSignature(migratedDraft));
            draftPort.setDraftPromoCard(JSON.parse(JSON.stringify(migratedDraft.promoCard)));
            draftSavedAt = migratedDraft.lastUpdated ?? null;

            // Only claimable when both times are known: a recovery written
            // before copies carried a timestamp has nothing to compare, and
            // guessing would put a warning in front of the wrong person.
            const takenAt = recoveredEnvelope?.savedAt;
            if (takenAt && draftSavedAt) {
              draftIsNewer = new Date(draftSavedAt).getTime() > new Date(takenAt).getTime();
            }
          }
          /**
           * Announced only when the work was genuinely away.
           *
           * A refresh restores through this same path, so every reload was
           * telling the user their work had been rescued — from a page they
           * had just reloaded themselves, with the card already in front of
           * them. Nothing was at stake and nothing needed saying.
           *
           * The browser distinguishes the two: a reload reports 'reload',
           * while reopening the tool is a 'navigate'. Restoring still happens
           * either way — only the announcement is held back.
           */
          if (isFirstLoadOfVisit()) {
            setRestoreNotice({
              localSavedAt: recoveredEnvelope?.savedAt || null,
              draftSavedAt,
              draftIsNewer,
            });
          }
          return;
        }
        // Identical to what is live — nothing was lost, so drop it quietly.
        clearRecovery();
      }

      if (draft) {
        const migrated = migrateConfig(draft, draft.version);
        /**
         * Nothing worth restoring in it — so do not offer it. It is left on
         * disk rather than deleted: this runs on every load, with no user
         * action behind it, and the test is a heuristic. Getting it wrong
         * should cost a missing prompt, not the user's saved work.
         */
        if (!draftHasRestorableWork(migrated, publishedCfg)) {
          // deliberately nothing
        } else if (publishedCfg && getConfigSignature(migrated) !== getConfigSignature(publishedCfg)) {
          /**
           * A draft exists and differs from what's live. It used to be poured
           * straight into the editor, which meant landing on half-finished work
           * with no way to tell it apart from the published card.
           *
           * Now the canvas starts clear and the draft is offered: the toast
           * says it's there, and taking it is a decision rather than a
           * surprise. Declining leaves it saved — the My Draft dot still shows.
           */
          /**
           * The canvas starts on the default card, not the published one.
           *
           * Loading the live card here made "Start something new" a lie — the
           * user declined the draft and was left holding a copy of what is
           * already out there, which then reads as work in progress and
           * diverges from the live card the moment it is touched. The
           * published card stays one click away under My Published.
           *
           * Only the promo card is reset; the announcement bar keeps its
           * published content.
           */
          const forEditor: CampaignConfig = {
            ...publishedCfg,
            promoCard: blankPromoCard(),
          };
          setConfig(forEditor);
          draftPort.draftSignatureRef.current = getConfigSignature(forEditor);
          savedPromoSignatureRef.current = getPromoSignature(forEditor);
          draftPort.setSavedDraftSignature(getConfigSignature(migrated));
          setPromoEntryStep('build');
          setConfigLoadedSignal((n) => n + 1);
          // Held, not announced: the draft is about the promo editor, so the
          // offer waits until that is the screen being looked at. Raised on
          // the dashboard it interrupts a page the draft has nothing to do
          // with, and expires before the user reaches the editor.
          draftPort.offeredDraftRef.current = migrated;
          return;
        } else {
          /**
           * The draft is identical to what is live, so there is nothing to
           * offer — but it is not deleted either.
           *
           * Nothing here is a user action, and the app should not be removing
           * saved things on its own. Keeping it costs a dot on the My Draft
           * chip; deleting it costs the user something they chose to save,
           * every time this heuristic is wrong.
           */
        }
      }

      if (publishedCfg) {
        /**
         * Nothing pending: the work is done and live, so the editor opens on
         * the default card rather than a copy of what is already out there.
         *
         * Only the promo card is reset — the announcement bar keeps its
         * published content, and the dashboard reads publishedConfig, so what
         * is live is unaffected either way. The published card stays one click
         * away under My Published.
         *
         * Loading the live card here was what made a cleared canvas come back
         * as the published design after a refresh: the entry step opened the
         * picker, but the card underneath was still the live one.
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

  // Stage the announcement for publish. No automatic draft write here —
  // drafting is explicit-only ("Save as draft" in the Promo tab strip, which
  // covers the full config including the announcement) — this just flips the
  // header to "ready to Publish" and asks whether to publish now.

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

  // Both of these ask "does MY half still match what is published?".
  //
  // They used to compare the whole config signature, which answered a
  // different question: it went true whenever EITHER half differed. So an
  // unpublished promo card kept the announcement tab reading "unsaved
  // changes" with nothing in the announcement bar touched, and neither flag
  // could clear until both halves matched. Comparing each half against its own
  // published counterpart is what the flags are named for.

  function markAnnouncementChanged() {
    setTimeout(() => {
      const published = publishedConfigObjRef.current;
      if (
        published &&
        announcementSignature(published) === announcementSignature(configRef.current)
      ) {
        setHasAnnouncementChanges(false);
        return;
      }
      setHasAnnouncementChanges(true);
      setReadyToPublishAnnouncement(false);
    }, 0);
  }

  function markPromoChanged() {
    setTimeout(() => {
      const published = publishedConfigObjRef.current;
      if (
        published &&
        promoContentSignature(published) === promoContentSignature(configRef.current)
      ) {
        setHasPromoChanges(false);
        return;
      }
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
