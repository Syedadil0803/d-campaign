'use client';

import type { ReactNode } from 'react';
import type { PromoCard } from '@/types/campaign';
import type { PromoVersion } from '@/lib/promo/promoVersions';
import { PromoMiniPreview } from '@/components/shared/PromoMiniPreview';
import { promoCardsEqual } from '@/lib/promo/promoCardIdentity';
import { formatScheduleRange } from '@/lib/calendarDates';
import { MAX_VERSIONS } from '@/lib/promo/promoVersions';
import { X, Radio, CalendarDays } from 'lucide-react';

/**
 * "My Published" — the saved cards, with what is currently on the website
 * called out at the top.
 *
 * Lifted out of PromoSection whole. It reads nothing and decides nothing: the
 * list, which card is live and whether a delete is awaiting confirmation all
 * arrive as props, and every action is handed back to the editor. That is why
 * it could move without touching behaviour — there was no state here to
 * relocate, only markup that had been sitting inside a five-thousand-line
 * function.
 */
export function PromoVersionsPopup({
  versions,
  livePromoCard,
  currentCard,
  pendingDeleteId,
  isLiveVersion,
  liveCardIsUnlisted,
  onClose,
  onApply,
  onDelete,
  onAskDelete,
  onStopLive,
  confirmCardReplace,
}: {
  versions: PromoVersion[];
  livePromoCard?: PromoCard;
  /** What is on the canvas now — a saved card matching it is already applied. */
  currentCard: PromoCard;
  /** The card a delete is currently asking about, if any. */
  pendingDeleteId: string | null;
  isLiveVersion: (version: PromoVersion) => boolean;
  /** True when the live card is not one of the saved ones. */
  liveCardIsUnlisted: () => boolean;
  onClose: () => void;
  onApply: (version: PromoVersion) => void;
  onDelete: (id: string) => void;
  onAskDelete: (id: string | null) => void;
  onStopLive: () => void;
  /**
   * Asks before replacing whatever is on the canvas, then runs the action.
   *
   * The options are the editor's, spelled out rather than borrowed, so this
   * component states what it passes instead of depending on the shape of a
   * function it does not own.
   */
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
  return (
    <div data-modal className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0"
        onClick={() => onClose()}
      />
      <div className="relative z-10 flex max-h-[90vh] w-[92vw] max-w-[1500px] flex-col overflow-hidden rounded-xl border border-border backdrop-blur-md shadow-2xl">
        <div className="flex items-center justify-between border-border px-6 py-2">
          <div>
            <p className="text-sm text-on-surface-variant">
              Click a variant to apply it to your promo card ({versions.length}/
              {MAX_VERSIONS}).
            </p>
          </div>
          <button
            type="button"
            onClick={() => onClose()}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-on-surface-variant transition-colors hover:bg-primary/10 hover:text-primary"
            aria-label="Close variants"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Saved versions grid (newest first) — click a card to apply */}
        <div className="campaign-custom-scrollbar overflow-y-auto p-6">
          {/* What's on the website, when no saved variant is carrying the
              Live tag. Without this the list can read "nothing is live"
              while the card is still serving — and with the list empty
              there was no control anywhere in here to take it off. */}
          {liveCardIsUnlisted() && livePromoCard && (
            <div className="mb-6 rounded-xl border border-primary/40 bg-primary/5 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="flex items-center gap-2 text-sm font-semibold text-on-surface">
                    <Radio className="h-3.5 w-3.5 text-primary" />
                    Live on your website
                  </p>
                  <p className="mt-1 text-xs text-on-surface-variant">
                    This card is serving now but isn&apos;t one of your saved
                    variants — it was edited after publishing, or its variant
                    was deleted.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onStopLive();
                  }}
                  className="shrink-0 rounded-md border border-border px-3 py-1.5 text-xs font-semibold text-on-surface-variant transition-colors hover:border-red-500/70 hover:text-red-500"
                >
                  Take it off my website
                </button>
              </div>
              <div className="mt-3 max-w-xs">
                <PromoMiniPreview promoCard={livePromoCard} />
              </div>
            </div>
          )}

          {versions.length === 0 ? (
            <div className="p-10 text-center text-sm text-on-surface-variant">
              No saved variants yet.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
              {[...versions].reverse().map((version) => {
                // Two independent facts: what's on your website, and what's
                // in your editor. A variant can be either, both or neither.
                const isLive = isLiveVersion(version);
                const isOnCanvas = promoCardsEqual(version.promoCard, currentCard);
                return (
                  <div
                    key={version.id}
                    onClick={() => {
                      onClose();
                      if (isOnCanvas) return;
                      confirmCardReplace(() => onApply(version), {
                        title: 'Apply this variant?',
                        replacementLabel: 'this saved variant',
                        nextCard: version.promoCard,
                        body: "This replaces the card you're editing with this saved variant. It won't change what's live on your website until you publish.",
                        confirmLabel: 'Apply variant',
                      });
                    }}
                    className={`group relative rounded-xl border bg-white p-3 shadow-sm transition-colors dark:border-gray-700 dark:bg-gray-900 ${
                      isOnCanvas
                        ? 'cursor-default border-primary/60 ring-1 ring-primary/30'
                        : 'cursor-pointer border-gray-200 hover:border-primary hover:shadow-lg hover:ring-1 hover:ring-primary'
                    }`}
                  >
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <p className="min-w-0 truncate text-xs font-semibold text-gray-800 dark:text-gray-200">
                        {version.label}
                      </p>
                      <div className="flex shrink-0 items-center gap-1">
                        {/* Live first — it's the fact about the website.
                            "In editor" is only worth saying when the
                            variant isn't already marked Live. */}
                        {isLive ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-green-500/15 px-2 py-0.5 text-[10px] font-semibold text-green-600 dark:text-green-400">
                            <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                            Live
                          </span>
                        ) : isOnCanvas ? (
                          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                            In editor
                          </span>
                        ) : (
                          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium dark:bg-gray-700 dark:text-gray-200">
                            Click to apply
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onAskDelete(version.id);
                          }}
                          className="inline-flex h-6 w-6 items-center justify-center rounded-md text-gray-400 transition-colors hover:bg-red-500/10 hover:text-red-500"
                          aria-label={`Delete variant ${version.label}`}
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                    {formatScheduleRange(version.promoCard.startDate, version.promoCard.endDate) && (
                      <p className="mb-2 flex items-center gap-1 text-[11px] font-medium text-gray-500 dark:text-gray-400">
                        <CalendarDays className="h-3 w-3" />
                        {formatScheduleRange(version.promoCard.startDate, version.promoCard.endDate)}
                      </p>
                    )}
                    <PromoMiniPreview promoCard={version.promoCard} />

                    {pendingDeleteId === version.id && (
                      <div
                        onClick={(e) => e.stopPropagation()}
                        className="absolute inset-0 z-10 flex cursor-default flex-col items-center justify-center gap-3 rounded-xl bg-surface-elevated/95 p-4 text-center backdrop-blur-sm"
                      >
                        <p className="text-sm font-medium text-on-surface">
                          Delete “{version.label}”?
                        </p>
                        {isLive ? (
                          <p className="-mt-1 text-[11px] font-medium text-red-500">
                            This card is live. Deleting it removes it from your
                            website right away. This can’t be undone.
                          </p>
                        ) : (
                          <p className="-mt-1 text-[11px] text-on-surface-variant">
                            You’ll have a few seconds to undo this.
                          </p>
                        )}
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onAskDelete(null);
                            }}
                            className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-on-surface-variant transition-colors hover:border-primary/70 hover:text-primary"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onDelete(version.id);
                            }}
                            className="rounded-md bg-red-500 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-red-600"
                          >
                            {isLive ? 'Delete & take offline' : 'Delete'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
