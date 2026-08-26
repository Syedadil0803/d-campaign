'use client';

import type { ReactNode } from 'react';

/**
 * A card action that needs confirming, with an optional third way forward.
 *
 * Not shared/ConfirmDialog, and deliberately so: that one is documented as
 * covering "a question, a short explanation, No or Yes", and widening it to
 * take a third button would need the prop-per-difference its own note warns
 * against. This is the three-button shape, kept apart.
 */
export interface PromoCardAction {
  title: string;
  // ReactNode, not string: names of places in the UI ("My Published") are
  // emphasised inline so they read as things you can go and open.
  body: ReactNode;
  confirmLabel: string;
  onConfirm: () => void;
  /**
   * Optional third button, for actions where keeping a copy is worth offering
   * but must never be imposed — Clear Canvas being the case: the user asked to
   * destroy the card, so saving is an offer, not a condition.
   */
  secondaryLabel?: string;
  onSecondary?: () => void;
}

export function PromoCardActionDialog({
  action,
  onDismiss,
}: {
  action: PromoCardAction | null;
  onDismiss: () => void;
}) {
  if (!action) return null;

  return (
    <div data-modal className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/20" onClick={onDismiss} />
      <div
        className={`relative z-10 w-full rounded-xl border border-white/10 bg-black/10 p-5 text-on-surface shadow-2xl backdrop-blur-md ${
          action.secondaryLabel ? 'max-w-xl' : 'max-w-md'
        }`}
      >
        <h2 className="text-base font-semibold">{action.title}</h2>
        <p className="mt-2 text-sm text-on-surface-variant">{action.body}</p>
        {/* Cancel sits apart on the left — it's "leave", not one of the ways
            forward. The two ways forward group on the right, with the safe one
            weighted. Three buttons in a single row read as a queue and hide
            which is which. */}
        <div className="mt-5 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onDismiss}
            className="shrink-0 whitespace-nowrap rounded-md px-2 py-2 text-sm font-medium text-on-surface-variant transition-colors hover:text-primary"
          >
            Cancel
          </button>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                const fn = action.onConfirm;
                onDismiss();
                fn();
              }}
              className={
                action.secondaryLabel
                  ? 'whitespace-nowrap rounded-md border border-white/15 bg-transparent px-4 py-2 text-sm font-medium text-on-surface-variant transition-colors hover:border-red-400/70 hover:text-red-500'
                  : 'whitespace-nowrap rounded-md bg-primary px-4 py-2 text-sm font-semibold text-on-primary shadow-sm transition-opacity hover:opacity-95'
              }
            >
              {action.confirmLabel}
            </button>
            {action.secondaryLabel && action.onSecondary && (
              <button
                type="button"
                onClick={() => {
                  const fn = action.onSecondary!;
                  onDismiss();
                  fn();
                }}
                className="whitespace-nowrap rounded-md bg-primary px-4 py-2 text-sm font-semibold text-on-primary shadow-sm transition-opacity hover:opacity-95"
              >
                {action.secondaryLabel}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
