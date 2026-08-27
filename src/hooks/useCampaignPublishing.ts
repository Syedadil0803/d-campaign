'use client';

import type { Dispatch, RefObject, SetStateAction } from 'react';
import type { CampaignConfig } from '@/types/campaign';
import { isInvalidRange } from '@/lib/dateRange';
import { validatePromo } from '@/lib/promo/validatePromo';
import { defaultConfig } from '@/types/campaign';
import {
  markLiveVersion,
  listVersions,
  type PromoVersion,
} from '@/lib/promo/promoVersions';

interface UseCampaignPublishingArgs {
  config: CampaignConfig;
  configRef: RefObject<CampaignConfig>;
  setConfig: Dispatch<SetStateAction<CampaignConfig>>;
  publishedConfigObjRef: RefObject<CampaignConfig | null>;
  setPublishedConfig: (cfg: CampaignConfig) => void;
  persistConfig: (cfg: CampaignConfig, successMessage?: string, scope?: 'announcement' | 'promo', options?: { preserveDraft?: boolean }) => Promise<void>;
  pendingDraftRef: RefObject<boolean>;
  setReadyToPublishAnnouncement: (ready: boolean) => void;
  setPromoDateErrorPing: Dispatch<SetStateAction<number>>;
  setPublishConfirm: (
    confirm: { warnings: string[]; onConfirm: () => Promise<void> | void } | null,
  ) => void;
  /** From usePromoVariantSaves — publishing records the card in My Published. */
  refreshPromoVariants: () => void;
  getPromoVariantSaveStatus: (
    cfg: CampaignConfig,
  ) => Promise<{ status: 'skipped' | 'pending' | 'ready'; variantId?: string }>;
  setPendingVariantSave: (
    pending: {
      config: CampaignConfig;
      versions: PromoVersion[];
      mode: 'save' | 'publish';
    } | null,
  ) => void;
  savePromoVariant: (cfg: CampaignConfig, allowOverflow?: boolean) => Promise<string | null>;
  markVariantLive: (variantId: string | null) => Promise<void>;
}

/**
 * Going live, coming off air, and the confirmations in front of both.
 *
 * One place for every route that changes what the website is showing —
 * publishing either half, stopping either, and putting either back on air —
 * so the rules about what happens to the draft and the live copy cannot drift
 * apart between them.
 */
export function useCampaignPublishing({
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
}: UseCampaignPublishingArgs) {
  // Returns true (and fires the fallback guard) when a promo save/publish must
  // be blocked because the date range is invalid.
  function blockPromoSaveIfInvalidRange(): boolean {
    const s = configRef.current.promoCard.startDate;
    const e = configRef.current.promoCard.endDate;
    if (isInvalidRange(s, e)) {
      setPromoDateErrorPing((n) => n + 1);
      return true;
    }
    return false;
  }

  // Tab switches no longer auto-save a draft — drafting is explicit only
  // ("Save as draft"), so switching tabs just switches tabs.

  // Publishing content turns the campaign On Air (BR: "On Air starts the moment
  // you click Publish"). New/edited content always goes live on publish.
  async function handlePublishAnnouncement() {
    const next = {
      ...config,
      announcementBar: { ...config.announcementBar, active: true },
    };
    // Flip the chip to On Air only AFTER the publish finishes — so it appears
    // when the "Publishing…" loader completes, not at the start.
    await persistConfig(next, 'Campaign is live on your website', 'announcement');
    setConfig(next);
    setReadyToPublishAnnouncement(false);
  }

  // Immediate live on/off from the status chip / Dashboard — no Save → Publish.
  // Toggles ONLY the active flag on the PUBLISHED content (never pushes an
  // unpublished draft live) and preserves any pending draft. `active` is
  // excluded from the dirty signature, so mirroring it into the editing config
  // doesn't create phantom "unsaved changes".

  async function setLiveActive(scope: 'promo' | 'announcement', active: boolean) {
    const pending = pendingDraftRef.current;
    const base = publishedConfigObjRef.current ?? configRef.current;
    const next: CampaignConfig =
      scope === 'promo'
        ? { ...base, promoCard: { ...base.promoCard, active, stoppedByUser: !active } }
        : { ...base, announcementBar: { ...base.announcementBar, active } };
    setConfig((c) =>
      scope === 'promo'
        ? { ...c, promoCard: { ...c.promoCard, active, stoppedByUser: !active } }
        : { ...c, announcementBar: { ...c.announcementBar, active } },
    );
    // Optimistically reflect the live status on the Dashboard right away;
    // persistConfig re-confirms it on a successful write.
    setPublishedConfig(next);
    publishedConfigObjRef.current = next;
    await persistConfig(
      next,
      active
        ? 'Campaign is live on your website'
        : 'Campaign switched off — no longer on your website',
      scope,
      { preserveDraft: pending },
    );
  }

  async function stopAnnouncementNow() {
    await setLiveActive('announcement', false);
  }

  async function goOnAirAnnouncementNow() {
    await setLiveActive('announcement', true);
  }

  // Turning a stopped promo back on from the status chip: flip it on
  // provisionally and ask whether to go live. Publish → live; Cancel → revert
  // to the previous (stopped) state.
  // Immediate status changes from the promo status chip — no Save → Publish.
  // Stopping takes the card off now; "Go on air" reactivates the same content.

  async function stopPromoNow() {
    await setLiveActive('promo', false);
  }

  // Deleting the live card from "My Published" is a real removal, not a Stop:
  // besides taking it off air we clear its content from the published config so
  // /api/config and the R2 copy stop carrying it. Unlike Stop, this can't be
  // undone with "Go on air" — the content is gone from the live config.

  async function removeLivePromo() {
    const base = publishedConfigObjRef.current ?? configRef.current;
    await markLiveVersion(null);
    refreshPromoVariants();
    const next: CampaignConfig = {
      ...base,
      promoCard: {
        ...defaultConfig.promoCard,
        active: false,
        stoppedByUser: true,
      },
    };
    setPublishedConfig(next);
    publishedConfigObjRef.current = next;
    await persistConfig(next, 'Removed from your website', 'promo', {
      preserveDraft: pendingDraftRef.current,
    });
  }

  async function goOnAirPromoNow() {
    await setLiveActive('promo', true);
  }

  async function handlePublishPromo() {
    // Publishing content turns the campaign On Air ("On Air starts the moment
    // you click Publish"). Off is reached via the Stop chip, not by publishing.
    const cfgToSave = {
      ...config,
      promoCard: { ...config.promoCard, active: true, stoppedByUser: false },
    };
    const successMsg = 'Campaign is live on your website';

    const variantStatus = await getPromoVariantSaveStatus(cfgToSave);
    if (variantStatus.status === 'pending') {
      // Variant decision dialog handles the actual publish next.
      setConfig(cfgToSave);
      setPendingVariantSave({ config: cfgToSave, versions: await listVersions(), mode: 'publish' });
      return;
    }

    // Flip the chip to On Air only AFTER the publish finishes — so it appears
    // when the "Publishing…" loader completes, not at the start.
    if (variantStatus.status === 'ready') {
      const savedId = await savePromoVariant(cfgToSave);
      await markVariantLive(savedId);
      // persistConfig returns the editor to the default card on success, so
      // there is deliberately no setConfig here: writing the published card
      // back afterwards is what left the finished one sitting on the canvas.
      await persistConfig(cfgToSave, successMsg, 'promo');
      return;
    }

    // 'skipped' — the card is already saved, so that entry is the live one.
    await markVariantLive(variantStatus.variantId ?? null);
    await persistConfig(cfgToSave, successMsg, 'promo');
  }

  function handlePublishPromoWithValidation() {
    if (blockPromoSaveIfInvalidRange()) return;
    const warnings = validatePromo(config.promoCard);
    setPublishConfirm({ warnings, onConfirm: handlePublishPromo });
  }

  function handlePublishAnnouncementWithValidation() {
    setPublishConfirm({ warnings: [], onConfirm: handlePublishAnnouncement });
  }

  return {
    blockPromoSaveIfInvalidRange,
    handlePublishAnnouncement,
    setLiveActive,
    stopAnnouncementNow,
    goOnAirAnnouncementNow,
    stopPromoNow,
    removeLivePromo,
    goOnAirPromoNow,
    handlePublishPromo,
    handlePublishPromoWithValidation,
    handlePublishAnnouncementWithValidation,
  };
}
