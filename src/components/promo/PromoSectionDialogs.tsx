'use client';

import type { RefObject, ReactNode } from 'react';
import type { CampaignConfig, PromoCard } from '@/types/campaign';
import type { PromoVersion } from '@/lib/promo/promoVersions';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { PromoTemplatesPopup } from '@/components/promo/PromoTemplatesPopup';
import { PromoDraftPopup } from '@/components/promo/PromoDraftPopup';
import { PromoVersionsPopup } from '@/components/promo/PromoVersionsPopup';

type ConfirmCardReplace = (
  action: () => void,
  opts: {
    title: string;
    body: ReactNode;
    confirmLabel: string;
    reassuranceBody?: ReactNode;
    replacementLabel?: string;
    nextCard?: PromoCard;
    offerDraftSave?: boolean;
  },
) => void;

interface PromoSectionDialogsProps {
  showStopConfirm: boolean;
  setShowStopConfirm: (open: boolean) => void;
  confirmStopCampaign: () => void;
  showGoOnAirConfirm: boolean;
  setShowGoOnAirConfirm: (open: boolean) => void;
  confirmGoOnAir: () => void;

  showTemplatesPopup: boolean;
  setShowTemplatesPopup: (open: boolean) => void;
  templatesFromBuild: boolean;
  setTemplatesFromBuild: (from: boolean) => void;
  onTemplatesBack: (() => void) | undefined;
  startFreshPromoCard: (options?: { silent?: boolean }) => void;
  applyTemplate: (template: PromoCard, templateName: string) => void;

  showDraftPopup: boolean;
  setShowDraftPopup: (open: boolean) => void;
  draftPopupCard: PromoCard | null;
  draftPopupLoading: boolean;
  confirmDeleteDraft: boolean;
  setConfirmDeleteDraft: (asking: boolean) => void;
  deleteDraft: () => void;
  restoreDraftPromoCard: (card: PromoCard) => void;

  showVersionsPopup: boolean;
  setShowVersionsPopup: (open: boolean) => void;
  versions: PromoVersion[];
  livePromoCard: PromoCard | undefined;
  pendingDeleteId: string | null;
  setPendingDeleteId: (id: string | null) => void;
  isLiveVersion: (version: PromoVersion) => boolean;
  liveCardIsUnlisted: () => boolean;
  applyVersion: (version: PromoVersion) => void;
  handleDeleteVersion: (id: string) => void;

  config: CampaignConfig;
  configRef: RefObject<CampaignConfig>;
  confirmCardReplace: ConfirmCardReplace;
}

/**
 * Everything the promo editor puts on top of itself: the two campaign
 * confirmations and the three card popups.
 *
 * Props rather than the editor context, because none of this is the editor —
 * it is the shell around it, and the popups already take explicit props of
 * their own. Grouping them here keeps the section's return to the thing it
 * actually lays out.
 */
export function PromoSectionDialogs({
  showStopConfirm,
  setShowStopConfirm,
  confirmStopCampaign,
  showGoOnAirConfirm,
  setShowGoOnAirConfirm,
  confirmGoOnAir,
  showTemplatesPopup,
  setShowTemplatesPopup,
  templatesFromBuild,
  setTemplatesFromBuild,
  onTemplatesBack,
  startFreshPromoCard,
  applyTemplate,
  showDraftPopup,
  setShowDraftPopup,
  draftPopupCard,
  draftPopupLoading,
  confirmDeleteDraft,
  setConfirmDeleteDraft,
  deleteDraft,
  restoreDraftPromoCard,
  showVersionsPopup,
  setShowVersionsPopup,
  versions,
  livePromoCard,
  pendingDeleteId,
  setPendingDeleteId,
  isLiveVersion,
  liveCardIsUnlisted,
  applyVersion,
  handleDeleteVersion,
  config,
  configRef,
  confirmCardReplace,
}: PromoSectionDialogsProps) {
  return (
    <>
      {/* Stop Campaign Confirmation — immediate (no save/publish needed) */}
      <ConfirmDialog
        open={showStopConfirm}
        title="Switch off this campaign?"
        confirmLabel="Yes, switch off"
        tone="danger"
        onCancel={() => setShowStopConfirm(false)}
        onConfirm={confirmStopCampaign}
      >
        <p className="mt-2 text-sm text-on-surface-variant">
          If you switch off the campaign, the entire campaign stops displaying on your website. Are you sure you want to do it?
        </p>
        <p className="mt-2 text-xs text-on-surface-variant/80">
          You can switch it back on anytime with <strong>Go on air</strong> — as long as the content hasn&apos;t changed. New content needs Save &amp; Publish.
        </p>
      </ConfirmDialog>

      {/* Go On Air Confirmation — reactivate the same published content */}
      <ConfirmDialog
        open={showGoOnAirConfirm}
        title="Go on air?"
        confirmLabel="Yes, go on air"
        onCancel={() => setShowGoOnAirConfirm(false)}
        onConfirm={confirmGoOnAir}
      >
        <p className="mt-2 text-sm text-on-surface-variant">
          This puts the same campaign back on your website right away — no need to save or publish again.
        </p>
      </ConfirmDialog>

      {/* Paste-from-AI import */}
      {/* Sample Templates popup — shows the same 6 cards; click one to apply */}
      {showTemplatesPopup && (
        <PromoTemplatesPopup
          currentCard={configRef.current.promoCard}
          showBack={templatesFromBuild && Boolean(onTemplatesBack)}
          onBack={() => {
            setShowTemplatesPopup(false);
            setTemplatesFromBuild(false);
            onTemplatesBack?.();
          }}
          // Closing always clears the came-from-build flag; every exit did
          // that separately before, and one of them forgetting would have
          // stranded a Back button with nowhere to go.
          onClose={() => {
            setShowTemplatesPopup(false);
            setTemplatesFromBuild(false);
          }}
          onStartFresh={startFreshPromoCard}
          onApplyTemplate={applyTemplate}
          confirmCardReplace={confirmCardReplace}
        />
      )}

      {/* My Draft popup — the single saved, unpublished draft. */}
      {showDraftPopup && (
        <PromoDraftPopup
          draftCard={draftPopupCard}
          loading={draftPopupLoading}
          currentCard={config.promoCard}
          confirmingDelete={confirmDeleteDraft}
          onClose={() => setShowDraftPopup(false)}
          onAskDelete={setConfirmDeleteDraft}
          onDelete={deleteDraft}
          onRestore={restoreDraftPromoCard}
          confirmCardReplace={confirmCardReplace}
        />
      )}

      {/* Versions popup — save / restore / delete up to MAX_VERSIONS snapshots */}
      {showVersionsPopup && (
        <PromoVersionsPopup
          versions={versions}
          livePromoCard={livePromoCard}
          currentCard={config.promoCard}
          pendingDeleteId={pendingDeleteId}
          isLiveVersion={isLiveVersion}
          liveCardIsUnlisted={liveCardIsUnlisted}
          onClose={() => setShowVersionsPopup(false)}
          onApply={applyVersion}
          onDelete={handleDeleteVersion}
          onAskDelete={setPendingDeleteId}
          onStopLive={() => setShowStopConfirm(true)}
          confirmCardReplace={confirmCardReplace}
        />
      )}
    </>
  );
}
