'use client';

import { useMemo, type RefObject } from 'react';
import type { CampaignConfig, PromoCard } from '@/types/campaign';
import type { PromoVersion } from '@/lib/promo/promoVersions';
import { cardIsNotUserWork } from '@/lib/promo/promoAuthorship';
import { sampleTemplates } from '@/lib/promo/sampleTemplateCards';
import {
  normalizePromoForCompare,
  promoHasVisibleContent,
  announcementSignature,
  htmlHasVisibleText,
} from '@/lib/configSignature';

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

interface UseEditorWorkStatusArgs {
  config: CampaignConfig;
  publishedConfig: CampaignConfig;
  publishedConfigRef: RefObject<string | null>;
  configRef: RefObject<CampaignConfig>;
  hasPromoChanges: boolean;
  hasAnnouncementChangesRef: RefObject<boolean>;
  draftSignatureRef: RefObject<string | null>;
  draftPromoCard: PromoCard | null;
  promoVariants: PromoVersion[];
  promoWorkNotInDraftRef: RefObject<boolean>;
  announcementComposeTextRef: RefObject<string>;
}

/**
 * What the editor is holding, measured against what is live and what is
 * saved: whether either card can simply go back on air, whether the promo is
 * worth publishing, and whether anything would be lost by leaving.
 *
 * Read-only answers, all derived from state the page already owns. They sit
 * together because they are the same comparison asked four ways, and the page
 * read as one long render-body calculation with them in it.
 */
export function useEditorWorkStatus({
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
}: UseEditorWorkStatusArgs) {
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
   * True when the card differs from what is published, OR when nothing is on air
   * at all. The second half matters: picking a card from My Published while the
   * campaign is stopped changes no content, so a plain comparison says "no
   * changes" and leaves the one button that puts it back on the site unlit.
   *
   * Requires content, so a blank canvas does not light Publish.
   */
  const promoWorthPublishing =
    (hasPromoChanges && promoHasVisibleContent(config.promoCard)) ||
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

  /**
   * Is there anything in the editor the user would lose?
   *
   * Not the same as "is the config dirty". Some load paths blank the canvas
   * deliberately — the draft offer does — and the dirty flag follows, which
   * had the welcome-back dialog warning about losing a blank card the app had
   * just created.
   *
   * The promo half is the authorship test: a blank canvas, an untouched
   * template, or a card already in the draft are all nothing to lose.
   */
  const editorWorkAtRisk = () => {
    if (promoWorkNotInDraftRef.current) return true;

    if (hasAnnouncementChangesRef.current) {
      const currentAnnSig = announcementSignature(configRef.current);
      let savedAnnSig: string | null = null;

      if (draftSignatureRef.current) {
        try {
          const savedCfg = JSON.parse(draftSignatureRef.current);
          savedAnnSig = announcementSignature(savedCfg);
        } catch {
          // If parse fails, treat as no saved version
        }
      }

      if (currentAnnSig !== savedAnnSig) return true;
    }

    if (htmlHasVisibleText(announcementComposeTextRef.current)) return true;

    return false;
  };

  return {
    announcementCanReactivate,
    promoWorthPublishing,
    promoCanReactivate,
    editorWorkAtRisk,
  };
}
