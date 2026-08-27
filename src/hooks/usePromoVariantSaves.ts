'use client';

import { useCallback, useState, type RefObject } from 'react';
import type { CampaignConfig, PromoCard } from '@/types/campaign';
import {
  listVersions,
  saveVersion,
  markLiveVersion,
  updateVersion,
  MAX_VERSIONS,
  type PromoVersion,
} from '@/lib/promo/promoVersions';
import {
  getPromoSignature,
  normalizePromoForCompare,
  promoHasVisibleContent,
} from '@/lib/configSignature';

interface UsePromoVariantSavesArgs {
  savedPromoSignatureRef: RefObject<string | null>;
  persistConfig: (
    cfg: CampaignConfig,
    successMessage?: string,
    scope?: 'announcement' | 'promo',
    options?: { preserveDraft?: boolean },
  ) => Promise<void>;
  setIsPublishing: (publishing: boolean) => void;
}

/**
 * Saving the promo card into My Published, and the dialog that appears when
 * there is no room left.
 *
 * Owns the list, which entry is Live, and the save waiting on the user's
 * answer — state nothing else touches. Five inputs for a hundred and fifty
 * lines, which is what made this worth lifting where the draft group beside it
 * (twenty-seven inputs) was not.
 */
export function usePromoVariantSaves({
  savedPromoSignatureRef,
  persistConfig,
  setIsPublishing,
}: UsePromoVariantSavesArgs) {
  const [pendingVariantSave, setPendingVariantSave] = useState<{
    config: CampaignConfig;
    versions: PromoVersion[];
    // Whether this dialog was opened from a plain Save or from Publish — Publish
    // must finish going live after the variant is stored, not just save.
    mode: 'save' | 'publish';
  } | null>(null);
  const [selectedPromoVersionId, setSelectedPromoVersionId] = useState<string | null>(null);
  /**
   * Everything in My Published.
   *
   * The unsaved-work guard needs these synchronously: a card sitting in My
   * Published is already recoverable, so offering to save it to My Draft is
   * asking the user to keep a second copy of something they haven't lost.
   */
  const [promoVariants, setPromoVariants] = useState<PromoVersion[]>([]);

  const refreshPromoVariants = useCallback(() => {
    listVersions()
      .then(setPromoVariants)
      .catch(() => {});
  }, []);

  function getAutoVariantLabel() {
    return `Saved ${new Date().toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })}`;
  }

  async function getPromoVariantSaveStatus(
    cfg: CampaignConfig,
  ): Promise<{ status: 'skipped' | 'pending' | 'ready'; variantId?: string }> {
    const promoSignature = getPromoSignature(cfg);
    // The saved-signature cache is only trustworthy when the card is ACTUALLY in
    // the saved list. loadConfig seeds savedPromoSignatureRef from the *published*
    // card — which is NOT itself a saved variant — so an early ref short-circuit
    // makes publishing a freshly loaded card return 'skipped' and record nothing
    // in My Published (the reported "empty after publishing" bug). Consult the
    // list itself as the source of truth instead.
    const existingVersions = await listVersions();
    const match = existingVersions.find(
      (version) => JSON.stringify(version.promoCard) === promoSignature,
    );
    if (match) {
      savedPromoSignatureRef.current = promoSignature;
      // Already recorded — make sure it's the highlighted "Live" entry.
      setSelectedPromoVersionId(match.id);
      return { status: 'skipped', variantId: match.id };
    }

    return {
      status: existingVersions.length >= MAX_VERSIONS ? 'pending' : 'ready',
    };
  }

  /**
   * Record which variant is going live, so My Published can tag it by identity
   * instead of guessing from content.
   *
   * The flag lives on the variant, not on the config: the config row has fixed
   * columns and quietly drops anything else, so a pointer stored there survived
   * in memory and vanished on the next read.
   */

  async function markVariantLive(variantId: string | null) {
    await markLiveVersion(variantId);
    refreshPromoVariants();
  }

  async function savePromoVariant(cfg: CampaignConfig, allowOverflow = false) {
    const updatedVersions = await saveVersion(cfg.promoCard, getAutoVariantLabel(), { allowOverflow });
    const savedId = updatedVersions[updatedVersions.length - 1]?.id ?? null;
    setSelectedPromoVersionId(savedId);
    savedPromoSignatureRef.current = getPromoSignature(cfg);
    refreshPromoVariants();
    return savedId;
  }

  /**
   * Whatever is on the website has a saved copy behind it.
   *
   * Publishing the promo saved a variant, but that was the only path that did.
   * Publishing the ANNOUNCEMENT writes the whole config — promo card included —
   * so unpublished promo edits went live with nothing saved and no live-variant
   * pointer; the same was true of Go on air when the recorded variant had since
   * been deleted. The card was then live and unlisted, which is how you end up
   * with something serving that My Published can't show you.
   *
   * So the guarantee lives here, at the single write both paths go through,
   * rather than in each publish handler where the next new path would miss it.
   */
  async function ensureLivePromoVariant(
    cfg: CampaignConfig,
  ): Promise<CampaignConfig> {
    if (!cfg.promoCard?.active) return cfg;
    // A blank card is trivially recreatable — saving it would just spend a slot.
    if (!promoHasVisibleContent(cfg.promoCard)) return cfg;

    const signature = (card: PromoCard) =>
      JSON.stringify(
        normalizePromoForCompare(card as unknown as Record<string, unknown>),
      );

    const live = signature(cfg.promoCard);
    const existing = await listVersions();
    const match = existing.find((version) => signature(version.promoCard) === live);
    if (match) {
      // Already saved — just make sure the marker names it. Compared on
      // normalized content, so the app's own HTML rewrites don't file a second
      // copy of a card that's already in the list.
      if (!match.isLive) {
        setSelectedPromoVersionId(match.id);
        await markVariantLive(match.id);
      }
      return cfg;
    }

    // Overflow is allowed on purpose: the list is capped at five, and dropping
    // the oldest saved design is better than the live card having no copy at
    // all. The publish flow still asks first when it can (see
    // getPromoVariantSaveStatus); this is the backstop for paths that can't.
    const savedId = await savePromoVariant(cfg, true);
    await markVariantLive(savedId);
    return cfg;
  }

  // The variant popup closes on click and the publish continues in the
  // background — so in publish mode we light up the header Publish button's
  // loader (isPublishing) until the persist finishes, exactly like a direct
  // publish. Otherwise the publish would run with no in-progress feedback.
  async function savePendingVariantAndClose() {
    if (!pendingVariantSave) return;
    const { config: cfg, mode } = pendingVariantSave;
    setPendingVariantSave(null);
    if (mode === 'publish') setIsPublishing(true);
    try {
      const savedId = await savePromoVariant(cfg, true);
      if (mode === 'publish') {
        // cfg already has active:true — finish going live, don't re-prompt to publish.
        await markVariantLive(savedId);
        await persistConfig(cfg, 'Campaign is live on your website', 'promo');
      } else {
        await persistConfig(cfg, 'Settings saved and promo variant saved');
      }
    } finally {
      if (mode === 'publish') setIsPublishing(false);
    }
  }

  async function updateExistingVariantAndClose(versionId: string) {
    if (!pendingVariantSave) return;
    const { config: cfg, mode, versions } = pendingVariantSave;
    const version = versions.find((item) => item.id === versionId);
    setPendingVariantSave(null);
    if (mode === 'publish') setIsPublishing(true);
    try {
      await updateVersion(versionId, cfg.promoCard, version?.label);
      setSelectedPromoVersionId(versionId);
      savedPromoSignatureRef.current = getPromoSignature(cfg);
      if (mode === 'publish') {
        await markVariantLive(versionId);
        await persistConfig(cfg, 'Campaign is live on your website', 'promo');
      } else {
        await persistConfig(cfg, 'Settings saved and promo variant updated');
      }
    } finally {
      if (mode === 'publish') setIsPublishing(false);
    }
  }

  function cancelPendingVariantSave() {
    setPendingVariantSave(null);
  }

  function getSelectedPendingVariant() {
    if (!pendingVariantSave || !selectedPromoVersionId) return null;
    return (
      pendingVariantSave.versions.find(
        (version) => version.id === selectedPromoVersionId,
      ) ?? null
    );
  }

  return {
    pendingVariantSave,
    setPendingVariantSave,
    selectedPromoVersionId,
    setSelectedPromoVersionId,
    promoVariants,
    refreshPromoVariants,
    getAutoVariantLabel,
    getPromoVariantSaveStatus,
    markVariantLive,
    savePromoVariant,
    ensureLivePromoVariant,
    savePendingVariantAndClose,
    updateExistingVariantAndClose,
    cancelPendingVariantSave,
    getSelectedPendingVariant,
  };
}
