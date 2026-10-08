'use client';

import type { Dispatch, RefObject, SetStateAction } from 'react';
import type { CampaignConfig } from '@/types/campaign';
import { clearRecovery, readRecoveryEnvelope } from '@/lib/recovery';
import { migrateConfig } from '@/lib/configMigration';
import type { useCampaignConfig } from '@/hooks/useCampaignConfig';
import type { useCampaignDraft } from '@/hooks/useCampaignDraft';

type Draft = ReturnType<typeof useCampaignDraft>;

interface UseRecoveryActionsArgs {
  recoveredAffectsPromo: boolean;
  recoveredAffectsAnnouncement: boolean;
  setRecoveredAffectsPromo: Dispatch<SetStateAction<boolean>>;
  setRecoveredAffectsAnnouncement: Dispatch<SetStateAction<boolean>>;
  setHasRecoveredWork: Dispatch<SetStateAction<boolean>>;
  setRecoveryReason: Dispatch<SetStateAction<'idle' | 'crash' | null>>;
  configRef: RefObject<CampaignConfig>;
  campaignRef: RefObject<ReturnType<typeof useCampaignConfig> | null>;
  writeRecoveredDraft: Draft['writeRecoveredDraft'];
  setDraftPromoCard: Draft['setDraftPromoCard'];
  announcementComposeTextRef: RefObject<string>;
  setConfig: Dispatch<SetStateAction<CampaignConfig>>;
  setPromoEntryStep: Dispatch<SetStateAction<'ai' | 'build' | 'editor'>>;
  setActiveTab: Dispatch<SetStateAction<'dashboard' | 'announcement' | 'promo'>>;
  toast: (message: string) => void;
}

/**
 * The two answers to a recovery banner: keep the rescued work, or let it go.
 *
 * Plain functions over the page's state, rebuilt every render exactly as they
 * were when they lived in the page — nothing here is memoised, so there is no
 * dependency list to get wrong. Lifted out because they are the largest pair
 * of handlers the page had and read nothing the banner does not own.
 */
export function useRecoveryActions({
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
}: UseRecoveryActionsArgs) {
  /**
   * "Save & Continue" on a recovery banner.
   *
   * Scoped to the card whose banner was clicked. The banners are per-card, so
   * restoring from the announcement's must not also push the snapshot's promo
   * half into the draft — that overwrote a promo draft the user never touched
   * during the crashed session.
   */
  async function handleRestoreRecovery(side?: 'promo' | 'announcement') {
    // Load the recovered config from localStorage
    const recoveryEnvelope = readRecoveryEnvelope();
    if (recoveryEnvelope?.config) {
      const recovered = migrateConfig(recoveryEnvelope.config, recoveryEnvelope.config.version);

      const sides: ('promo' | 'announcement')[] = side
        ? [side]
        : ([
            recoveredAffectsPromo ? 'promo' : null,
            recoveredAffectsAnnouncement ? 'announcement' : null,
          ].filter(Boolean) as ('promo' | 'announcement')[]);

      // Take only the recovered half/halves being restored; the other card
      // keeps whatever the editor is already holding.
      const next: CampaignConfig = {
        ...configRef.current,
        ...(sides.includes('promo') ? { promoCard: recovered.promoCard } : {}),
        ...(sides.includes('announcement')
          ? { announcementBar: recovered.announcementBar }
          : {}),
      };

      // Update the campaign hook's configRef so PromoSection sees it immediately
      if (campaignRef.current) {
        campaignRef.current.configRef.current = next;
      }

      await writeRecoveredDraft(next, sides);

      // Update draft state so dashboard knows about it
      if (sides.includes('promo')) {
        setDraftPromoCard(JSON.parse(JSON.stringify(next.promoCard)));
      }

      // Restore any in-flight announcement compose text
      if (sides.includes('announcement') && recoveryEnvelope.announcementComposeText) {
        announcementComposeTextRef.current = recoveryEnvelope.announcementComposeText;
      }

      // Update state for editor re-render
      setConfig(next);

      // Bump signal so PromoSection re-reads the recovered config
      if (campaignRef.current) {
        campaignRef.current.setConfigLoadedSignal((n) => n + 1);
      }

      // The other card may still be holding recovered work it hasn't been
      // asked about yet — keep its banner, and the copy on disk behind it.
      const promoLeft = recoveredAffectsPromo && !sides.includes('promo');
      const annLeft = recoveredAffectsAnnouncement && !sides.includes('announcement');
      setRecoveredAffectsPromo(promoLeft);
      setRecoveredAffectsAnnouncement(annLeft);
      if (!promoLeft && !annLeft) clearRecovery();

      const recoveryTargetTab: 'promo' | 'announcement' = sides.includes('promo')
        ? 'promo'
        : 'announcement';
      if (recoveryTargetTab === 'promo') setPromoEntryStep('editor');

      // Switch tabs AFTER React processes the state update
      setTimeout(() => {
        setActiveTab(recoveryTargetTab);
      }, 0);

      toast('Recovery saved to draft');

      if (promoLeft || annLeft) return;
    }

    // Close the recovery alert
    setHasRecoveredWork(false);
    setRecoveryReason(null);
  }

  // Remove the useEffect that was trying to handle the tab switch

  /**
   * "Start new" on a recovery banner — discards that card's recovered work.
   *
   * Scoped like the restore: dismissing the announcement's offer must leave
   * the promo's banner (and the copy on disk behind it) standing.
   */
  function handleDismissRecovery(side?: 'promo' | 'announcement') {
    const promoLeft = recoveredAffectsPromo && side === 'announcement';
    const annLeft = recoveredAffectsAnnouncement && side === 'promo';
    setRecoveredAffectsPromo(promoLeft);
    setRecoveredAffectsAnnouncement(annLeft);
    if (promoLeft || annLeft) return;
    setHasRecoveredWork(false);
    setRecoveryReason(null);
    clearRecovery(); // Clear the local recovery
  }

  return { handleRestoreRecovery, handleDismissRecovery };
}
