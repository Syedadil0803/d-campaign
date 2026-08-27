'use client';

import { Loader2, X } from 'lucide-react';
import type { CampaignConfig } from '@/types/campaign';
import { MAX_VERSIONS, type PromoVersion } from '@/lib/promo/promoVersions';

/**
 * Every modal the campaign page puts in front of an action.
 *
 * They were written inline in page.tsx — three hundred and thirty lines of
 * markup sitting between the page's logic and the screen it renders. Each
 * takes three to six values, which is what made them worth lifting where the
 * page's remaining state groups (twenty-one and twenty-seven inputs) were not.
 *
 * The state shapes live here too, so the dialog and the state that drives it
 * are defined in one place rather than two.
 */

export type PendingDraftAction =
  | { type: 'tab'; tab: 'dashboard' | 'announcement' | 'promo' }
  | { type: 'logout' };

export type PendingDashboardAction = 'create' | 'published';

export interface PendingVariantSave {
  config: CampaignConfig;
  versions: PromoVersion[];
  /** Publish must finish going live after the variant is stored, not just save. */
  mode: 'save' | 'publish';
}

export interface PublishConfirm {
  warnings: string[];
  onConfirm: () => Promise<void> | void;
  title?: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  // When true, confirm runs onConfirm as-is (e.g. to open a follow-up popup)
  // WITHOUT the "Publishing…" state — avoids a flicker when chaining popups.
  deferPublish?: boolean;
  // Runs when the popup is dismissed (Cancel / backdrop) — e.g. to revert a
  // provisional state change.
  onCancel?: () => void;
}

/** Leaving work behind: save it to My Draft, or carry on without. */
export function UnsavedWorkDialog({
  pendingDraftAction,
  savedDraftSignature,
  setPendingDraftAction,
  saveDraftAndContinue,
  continueWithoutDraft,
}: {
  pendingDraftAction: PendingDraftAction | null;
  savedDraftSignature: string | null;
  setPendingDraftAction: (a: PendingDraftAction | null) => void;
  saveDraftAndContinue: () => void;
  continueWithoutDraft: () => void;
}) {
  if (!pendingDraftAction) return null;

  return (
      <div data-modal className="fixed inset-0 z-50 flex items-center justify-center bg-transparent p-4">
        <div
          className="absolute inset-0"
          onClick={() => setPendingDraftAction(null)}
        />
        <div className="relative z-10 w-full max-w-md rounded-xl border border-white/10 bg-black/10 p-5 text-on-surface shadow-2xl backdrop-blur-md">
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold">Save before you sign out?</h2>
              {/* With a draft already parked, the two cards have to be named
                  separately — they are different work, and "save" silently
                  overwrote the one on disk without ever mentioning it. */}
              {savedDraftSignature !== null ? (
                <>
                  {/* Says only what is known. Earlier wording called the
                      saved card "different" — but nothing here establishes
                      that. The signatures differ, which is as true of an
                      older version of the same card as it is of separate
                      work, and the user is left deciding what "different"
                      was supposed to mean. */}
                  <p className="mt-1 text-sm text-on-surface-variant">
                    One card is already saved in{' '}
                    <span className="font-semibold text-on-surface">My Draft</span>{' '}
                    and there is only one slot, so saving these edits
                    permanently replaces it.
                  </p>
                  <p className="mt-3 text-xs text-on-surface-variant/80">
                    Edits you don&apos;t save stay on this browser only.
                  </p>
                </>
              ) : (
                <>
                  <p className="mt-1 text-sm text-on-surface-variant">
                    These edits aren&apos;t in{' '}
                    <span className="font-semibold text-on-surface">My Draft</span>{' '}
                    yet. Saving keeps them with your account, so they are
                    waiting wherever you sign in next.
                  </p>
                  <p className="mt-3 text-xs text-on-surface-variant/80">
                    Until then they stay on this browser — sign in from
                    another browser or another device and they won&apos;t be
                    there.
                  </p>
                </>
              )}
            </div>
            <button
              type="button"
              onClick={() => setPendingDraftAction(null)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-on-surface-variant transition-colors hover:bg-primary/10 hover:text-primary"
              aria-label="Close draft prompt"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Named for what each button does. Signing out is the one exit
              that still drops the local copy, so leaving without saving has
              to say so on the button rather than in small print. */}
          <div className="mt-1 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={continueWithoutDraft}
              className="rounded-md border border-white/10 bg-transparent px-4 py-2 text-sm font-medium text-on-surface-variant transition-colors hover:border-primary/70 hover:text-primary"
            >
              Sign out without saving
            </button>
            <button
              type="button"
              onClick={saveDraftAndContinue}
              className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-on-primary shadow-sm transition-opacity hover:opacity-95"
            >
              {savedDraftSignature !== null ? 'Replace draft & sign out' : 'Save & sign out'}
            </button>
          </div>
        </div>
      </div>
  );
}

/** My Published is full — replace an entry, update one, or stop. */
export function VariantSlotFullDialog({
  pendingVariantSave,
  selectedPendingVariant,
  savePendingVariantAndClose,
  updateExistingVariantAndClose,
  cancelPendingVariantSave,
}: {
  pendingVariantSave: PendingVariantSave | null;
  selectedPendingVariant: PromoVersion | null | undefined;
  savePendingVariantAndClose: () => void;
  updateExistingVariantAndClose: (versionId: string) => void;
  cancelPendingVariantSave: () => void;
}) {
  if (!pendingVariantSave) return null;

  return (
      <div data-modal className="fixed inset-0 z-50 flex items-center justify-center bg-transparent p-4">
        <div
          className="absolute inset-0"
          onClick={cancelPendingVariantSave}
        />
        <div className="relative z-10 w-full max-w-md rounded-xl border border-white/10 bg-black/10 p-5 text-on-surface shadow-2xl backdrop-blur-md">
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold">
                Save promo variant?
              </h2>
              <p className="mt-1 text-sm text-on-surface-variant">
                You already have {MAX_VERSIONS} variants. Update the selected variant or replace the oldest.
              </p>
            </div>
            <button
              type="button"
              onClick={cancelPendingVariantSave}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-on-surface-variant transition-colors hover:bg-primary/10 hover:text-primary"
              aria-label="Close variant prompt"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="space-y-2">
            {selectedPendingVariant && (
              <button
                type="button"
                onClick={() =>
                  updateExistingVariantAndClose(selectedPendingVariant.id)
                }
                className="flex w-full items-center justify-between gap-3 rounded-md border border-primary/40 bg-primary/10 px-4 py-2 text-left text-sm font-medium text-on-surface transition-colors hover:border-primary/70 hover:bg-primary/15"
              >
                <span>Update Selected</span>
                <span className="min-w-0 truncate text-xs text-on-surface-variant">
                  {selectedPendingVariant.label}
                </span>
              </button>
            )}
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={cancelPendingVariantSave}
                className="rounded-md border border-white/10 bg-transparent px-4 py-2 text-sm font-medium text-on-surface-variant transition-colors hover:border-primary/70 hover:text-primary"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={savePendingVariantAndClose}
                className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-on-primary shadow-sm transition-opacity hover:opacity-95"
              >
                Save and Replace Oldest
              </button>
            </div>
          </div>
        </div>
      </div>
  );
}

/** The last word before anything reaches the website. */
export function PublishConfirmDialog({
  publishConfirm,
  isConfirming,
  setIsConfirming,
  setIsPublishing,
  setPublishConfirm,
}: {
  publishConfirm: PublishConfirm | null;
  isConfirming: boolean;
  setIsConfirming: (v: boolean) => void;
  setIsPublishing: (v: boolean) => void;
  setPublishConfirm: (c: PublishConfirm | null) => void;
}) {
  if (!publishConfirm) return null;

  return (
      <div data-modal className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="absolute inset-0" onClick={() => { if (isConfirming) return; publishConfirm.onCancel?.(); setPublishConfirm(null); }} />
        <div className="relative z-10 w-full max-w-md rounded-xl border border-white/10 bg-black/10 p-5 text-on-surface shadow-2xl backdrop-blur-md">
          <h2 className="text-base font-semibold">{publishConfirm.title ?? 'Publish to website?'}</h2>
          <p className="mt-2 text-sm text-on-surface-variant">
            {publishConfirm.message ?? 'These changes will go live on your website immediately.'}
          </p>
          {publishConfirm.warnings.length > 0 && (
            <div className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
              <p className="text-xs font-semibold text-amber-600 dark:text-amber-400 mb-1.5">Heads up</p>
              <ul className="space-y-1">
                {publishConfirm.warnings.map((w, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-on-surface-variant">
                    <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                    {w}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              disabled={isConfirming}
              onClick={() => { publishConfirm.onCancel?.(); setPublishConfirm(null); }}
              className="rounded-md border border-white/10 bg-transparent px-4 py-2 text-sm font-medium text-on-surface-variant transition-colors hover:border-primary/70 hover:text-primary disabled:opacity-50"
            >
              {publishConfirm.cancelLabel ?? 'Cancel'}
            </button>
            <button
              type="button"
              disabled={isConfirming}
              onClick={async () => {
                const onConfirm = publishConfirm.onConfirm;
                const defer = publishConfirm.deferPublish;
                if (defer) {
                  // Chaining to a follow-up popup — don't show "Publishing…".
                  setPublishConfirm(null);
                  await onConfirm();
                  return;
                }
                // Keep the popup open with a loader on this button until the
                // publish finishes, then close it.
                setIsConfirming(true);
                setIsPublishing(true);
                await onConfirm();
                await new Promise(r => setTimeout(r, 500));
                setIsConfirming(false);
                setIsPublishing(false);
                setPublishConfirm(null);
              }}
              className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-semibold text-on-primary shadow-sm transition-opacity hover:opacity-95 disabled:opacity-80"
            >
              {isConfirming && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {isConfirming ? 'Publishing…' : (publishConfirm.confirmLabel ?? 'Publish Now')}
            </button>
          </div>
        </div>
      </div>
  );
}

/** The same unsaved-work question, asked from the dashboard. */
export function DashboardUnsavedDialog({
  pendingDashboardAction,
  savedDraftSignature,
  setPendingDashboardAction,
  writeDraftNow,
  startCreatePromo,
  openPublishedPicker,
}: {
  pendingDashboardAction: PendingDashboardAction | null;
  savedDraftSignature: string | null;
  setPendingDashboardAction: (a: PendingDashboardAction | null) => void;
  writeDraftNow: () => void;
  startCreatePromo: () => void;
  openPublishedPicker: () => void;
}) {
  if (!pendingDashboardAction) return null;

  return (
      <div data-modal className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="absolute inset-0" onClick={() => setPendingDashboardAction(null)} />
        <div className="relative z-10 w-full max-w-xl rounded-xl border border-white/10 bg-black/10 p-5 text-on-surface shadow-2xl backdrop-blur-md">
          <h2 className="text-base font-semibold">You have unsaved changes</h2>
          <p className="mt-2 text-sm text-on-surface-variant">
            Your promo card has edits that aren&apos;t in{' '}
            <span className="font-semibold text-on-surface">My Draft</span>.{' '}
            {pendingDashboardAction === 'create'
              ? 'Starting a new campaign replaces them.'
              : 'Loading your live card replaces them.'}{' '}
            {savedDraftSignature !== null ? (
              <>
                Saving now replaces the card currently in{' '}
                <span className="font-semibold text-on-surface">My Draft</span>.
              </>
            ) : (
              <>
                Save them to <span className="font-semibold text-on-surface">My Draft</span> to
                keep a copy.
              </>
            )}
          </p>
          <div className="mt-5 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setPendingDashboardAction(null)}
              className="shrink-0 whitespace-nowrap rounded-md px-2 py-2 text-sm font-medium text-on-surface-variant transition-colors hover:text-primary"
            >
              Cancel
            </button>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  const action = pendingDashboardAction;
                  setPendingDashboardAction(null);
                  if (action === 'create') startCreatePromo();
                  else openPublishedPicker();
                }}
                className="whitespace-nowrap rounded-md border border-white/15 bg-transparent px-4 py-2 text-sm font-medium text-on-surface-variant transition-colors hover:border-red-400/70 hover:text-red-500"
              >
                Continue anyway
              </button>
              <button
                type="button"
                onClick={() => {
                  const action = pendingDashboardAction;
                  setPendingDashboardAction(null);
                  writeDraftNow();
                  if (action === 'create') startCreatePromo();
                  else openPublishedPicker();
                }}
                className="whitespace-nowrap rounded-md bg-primary px-4 py-2 text-sm font-semibold text-on-primary shadow-sm transition-opacity hover:opacity-95"
              >
                {savedDraftSignature !== null ? 'Replace draft & continue' : 'Save & continue'}
              </button>
            </div>
          </div>
        </div>
      </div>
  );
}

/** Throwing the saved draft away. */
export function DiscardDraftDialog({
  confirmDiscardDraft,
  setConfirmDiscardDraft,
  discardDraft,
}: {
  confirmDiscardDraft: boolean;
  setConfirmDiscardDraft: (v: boolean) => void;
  discardDraft: () => void;
}) {
  if (!confirmDiscardDraft) return null;

  return (
      <div data-modal className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="absolute inset-0" onClick={() => setConfirmDiscardDraft(false)} />
        <div className="relative z-10 w-full max-w-md rounded-xl border border-white/10 bg-black/10 p-5 text-on-surface shadow-2xl backdrop-blur-md">
          <h2 className="text-base font-semibold">Delete your saved draft?</h2>
          <p className="mt-2 text-sm text-on-surface-variant">
            Your saved draft will be deleted and you&apos;ll start fresh from what&apos;s currently
            published. This can&apos;t be undone.
          </p>
          <div className="mt-5 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setConfirmDiscardDraft(false)}
              className="rounded-md border border-white/10 bg-transparent px-4 py-2 text-sm font-medium text-on-surface-variant transition-colors hover:border-primary/70 hover:text-primary"
            >
              Keep editing
            </button>
            <button
              type="button"
              onClick={() => {
                setConfirmDiscardDraft(false);
                discardDraft();
              }}
              className="rounded-md bg-red-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-95"
            >
              Delete saved draft
            </button>
          </div>
        </div>
      </div>
  );
}

/** Overwriting the one draft slot. */
export function ReplaceDraftDialog({
  confirmReplaceDraft,
  setConfirmReplaceDraft,
  writeDraftNow,
}: {
  confirmReplaceDraft: boolean;
  setConfirmReplaceDraft: (v: boolean) => void;
  writeDraftNow: () => void;
}) {
  if (!confirmReplaceDraft) return null;

  return (
      <div data-modal className="fixed inset-0 z-50 flex items-center justify-center bg-transparent p-4">
        <div className="absolute inset-0" onClick={() => setConfirmReplaceDraft(false)} />
        <div className="relative z-10 w-full max-w-md rounded-xl border border-white/10 bg-black/10 p-5 text-on-surface shadow-2xl backdrop-blur-md">
          <h2 className="text-base font-semibold">Replace saved draft?</h2>
          <p className="mt-2 text-sm text-on-surface-variant">
            You already have a saved draft. Saving now will replace it with what&apos;s currently in the editor.
          </p>
          <div className="mt-5 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setConfirmReplaceDraft(false)}
              className="rounded-md border border-white/10 bg-transparent px-4 py-2 text-sm font-medium text-on-surface-variant transition-colors hover:border-primary/70 hover:text-primary"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                setConfirmReplaceDraft(false);
                writeDraftNow();
              }}
              className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-on-primary shadow-sm transition-opacity hover:opacity-95"
            >
              Replace saved draft
            </button>
          </div>
        </div>
      </div>
  );
}

