'use client';

import type { ReactNode } from 'react';
import type { PromoCard } from '@/types/campaign';
import { X } from 'lucide-react';
import { PromoMiniPreview } from '@/components/shared/PromoMiniPreview';

/**
 * The saved draft, offered back.
 *
 * One draft exists per account, so this is a single card with two things to
 * do: put it on the canvas, or throw it away. Lifted out of PromoSection
 * unchanged — it holds no state of its own, and every action goes back to the
 * editor.
 */
export function PromoDraftPopup({
  draftCard,
  loading,
  currentCard,
  confirmingDelete,
  onClose,
  onAskDelete,
  onDelete,
  onRestore,
  confirmCardReplace,
}: {
  /** Null while it is still being fetched. */
  draftCard: PromoCard | null;
  loading: boolean;
  currentCard: PromoCard;
  confirmingDelete: boolean;
  onClose: () => void;
  onAskDelete: (asking: boolean) => void;
  onDelete: () => void;
  onRestore: (card: PromoCard) => void;
  confirmCardReplace: (
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
}) {
  // The draft may already be what's on the canvas (you saved it, or just
  // restored it). Restoring it again would be a no-op, so offering to
  // "replace the current card" reads as nonsense — compare the cards and
  // disable the action instead. `active`/`stoppedByUser` are live on/off
  // flags, not content, so they're excluded (same rule as the dirty check).
  const stripCard = (c: PromoCard) => {
    const rest = { ...c } as Record<string, unknown>;
    delete rest.active;
    delete rest.stoppedByUser;
    return JSON.stringify(rest);
  };
  const draftIsOnCanvas =
    !!draftCard && stripCard(draftCard) === stripCard(currentCard);
  return (
    <div data-modal className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0" onClick={() => onClose()} />
      <div className="relative z-10 flex max-h-[90vh] w-[92vw] max-w-[520px] flex-col overflow-hidden rounded-xl border border-white/10 bg-black/10 backdrop-blur-md shadow-2xl">
        <div className="flex items-center justify-between gap-3 border-b border-white/10 px-6 py-3">
          <div>
            <h3 className="text-sm font-semibold text-on-surface">My Draft</h3>
            <p className="text-xs text-on-surface-variant">
              The card you stored — kept until you replace or delete it.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onClose()}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-on-surface-variant transition-colors hover:bg-primary/10 hover:text-primary"
            aria-label="Close draft"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="campaign-custom-scrollbar overflow-y-auto p-6">
          {loading ? (
            <div className="p-8 text-center text-sm text-on-surface-variant">
              Loading your saved draft…
            </div>
          ) : draftCard ? (
            // Render at the card's own width (same as the editor), never
            // stretched to the popup width.
            <div
              className="mx-auto"
              style={{ width: `${draftCard.cardWidth || 400}px`, maxWidth: '100%' }}
            >
              <PromoMiniPreview promoCard={draftCard} faithful />
            </div>
          ) : (
            <div className="p-8 text-center text-sm text-on-surface-variant">
              No saved draft yet. Use “Save as draft” to store the card you’re editing here.
            </div>
          )}
        </div>

        {draftCard && (
          <div className="flex shrink-0 items-center justify-end gap-2 border-t border-white/10 px-6 py-3">
            <button
              type="button"
              onClick={() => onAskDelete(true)}
              className="rounded-lg border border-red-500/40 px-3 py-1.5 text-sm font-semibold text-red-500 transition-colors hover:bg-red-500/10"
            >
              Delete saved draft
            </button>
            <button
              type="button"
              disabled={draftIsOnCanvas}
              title={
                draftIsOnCanvas
                  ? "You're already editing your saved draft."
                  : 'Load your saved draft into the editor'
              }
              onClick={() => {
                onClose();
                confirmCardReplace(() => onRestore(draftCard), {
                  title: 'Continue editing your saved draft?',
                  replacementLabel: 'your saved draft',
                  nextCard: draftCard,
                  body: "This loads your saved draft into the editor, replacing the card you're editing now. What's live on your website won't change until you publish.",
                  reassuranceBody:
                    "This loads your saved draft into the editor. Nothing is lost, and what's live on your website won't change until you publish.",
                  confirmLabel: 'Continue editing',
                });
              }}
              className="rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-on-primary shadow-sm transition-opacity hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {draftIsOnCanvas ? 'Already in editor' : 'Continue editing'}
            </button>
          </div>
        )}

        {confirmingDelete && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 rounded-xl bg-surface-elevated/95 p-6 text-center backdrop-blur-sm">
            <p className="text-sm font-semibold text-on-surface">Delete your saved draft?</p>
            <p className="-mt-1 text-xs text-on-surface-variant">
              Your saved draft will be deleted. This can&apos;t be undone.
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onAskDelete(false)}
                className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-on-surface-variant transition-colors hover:border-primary/70 hover:text-primary"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={onDelete}
                className="rounded-md bg-red-500 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-red-600"
              >
                Delete
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
