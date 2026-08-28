'use client';


import { Loader2, X } from 'lucide-react';
import type { CampaignConfig } from '@/types/campaign';
import { MAX_VERSIONS, type PromoVersion } from '@/lib/promo/promoVersions';
import type { RestoreNotice } from '@/hooks/useCampaignConfig';
import type { ElsewhereNotice } from '@/hooks/useCampaignDraft';
import type {
  PendingDraftAction,
  PendingDashboardAction,
  PendingVariantSave,
} from '@/components/shell/campaignShellTypes';
import { describeWhen } from '@/lib/auth/presenceClient';
import {
} from '@/lib/auth/sessionWarning';

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

/**
 * A draft outlived a publish and holds something else.
 *
 * Asked rather than assumed: the draft may be the next campaign, or it may be
 * what was just published and is now redundant.
 */
/**
 * Why the "welcome back" dialog is up, or null when it is not.
 *
 * Three arrivals share one dialog because they answer the same question —
 * what happened to my work — and differ only in the answer.
 */
export type WelcomeBackState =
  /** A local copy was recovered — the fullest case, so it carries the notice. */
  | ({ mode: 'restored'; elsewhere: ElsewhereNotice | null } & RestoreNotice)
  /** A parked draft is being offered back. */
  | { mode: 'draft'; draftSavedAt: string | null; elsewhere: ElsewhereNotice | null }
  /** Only that work exists elsewhere — so the notice is never null here. */
  | { mode: 'elsewhere'; elsewhere: ElsewhereNotice }
  | null;

export function PostPublishDraftDialog({
  postPublishDraft,
  setPostPublishDraft,
  clearDraft,
  toast,
}: {
  postPublishDraft: boolean;
  setPostPublishDraft: (open: boolean) => void;
  clearDraft: () => void;
  toast: (message: string, isError?: boolean) => void;
}) {
  if (!(postPublishDraft)) return null;

  return (
    <div data-modal className="fixed inset-0 z-50 flex items-center justify-center bg-transparent p-4">
      <div className="absolute inset-0" onClick={() => setPostPublishDraft(false)} />
      {/* Wider than the other dialogs: this one carries a heading that
          runs long, an explanation and a caveat, and at max-w-md the
          heading wrapped onto three lines with the body pressed under it. */}
      <div className="relative z-10 w-full max-w-lg rounded-xl border border-white/10 bg-black/10 p-6 text-on-surface shadow-2xl backdrop-blur-md">
        <h2 className="text-base font-semibold">
          Your card is live — and we kept your draft
        </h2>
        <p className="mt-2 text-sm text-on-surface-variant">
          The one in{' '}
          <span className="font-semibold text-on-surface">My Draft</span>{' '}
          is different from the card you just published, so we&apos;ve kept
          it. Do you want to keep it, or clear the slot?
        </p>
        <p className="mt-3 text-xs text-on-surface-variant/80">
          There is only one draft slot, so keeping it means the next save
          replaces it.
        </p>
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={() => {
              clearDraft();
              setPostPublishDraft(false);
              toast('Saved draft cleared');
            }}
            className="rounded-md border border-white/10 bg-transparent px-4 py-2 text-sm font-medium text-on-surface-variant transition-colors hover:border-primary/70 hover:text-primary"
          >
            Discard it
          </button>
          <button
            type="button"
            onClick={() => setPostPublishDraft(false)}
            className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-on-primary shadow-sm transition-opacity hover:opacity-95"
          >
            Keep my draft
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * One dialog for one moment: work was left behind and is being offered back.
 */
export function WelcomeBackDialog({
  welcomeBack,
  draftOffer,
  hasChanges,
  acceptOfferedDraft,
  dismissWelcomeBack,
}: {
  /** Null when nothing is being offered back; otherwise why it is showing. */
  welcomeBack: WelcomeBackState;
  draftOffer: CampaignConfig | null;
  hasChanges: boolean;
  acceptOfferedDraft: (draft: CampaignConfig) => void;
  dismissWelcomeBack: () => void;
}) {
  if (!(welcomeBack)) return null;

  return (
    <div data-modal className="fixed inset-0 z-50 flex items-center justify-center bg-transparent p-4">
      {/* Blocks what is behind it, but does not dismiss.
          These arrive once, on the way in, and closing one is final — the
          draft offer does not come back until the next load. A click
          landing on the canvas is far more likely to be someone reaching
          for their work than a decision to dismiss, and the buttons are
          right there. */}
      <div className="absolute inset-0" />
      <div className="relative z-10 w-full max-w-lg rounded-xl border border-white/10 bg-black/10 p-6 text-on-surface shadow-2xl backdrop-blur-md">
        {welcomeBack.mode === 'restored' ? (
          <>
            {/* Told, not asked: the work is already on the canvas behind
                this. The session ended without the user ending it, so
                there was no decision to put to them. */}
            {/* One message, whatever is true.
                With edits rescued here AND work stranded on another
                device, this listed both with a timestamp each and left the
                reader matching times to places. What someone needs on the
                way in is smaller: their work was not saved, unsaved work
                stays on the browser that made it, and here is what that
                means for them right now. */}
            {/* Enough to explain itself, in one block of prose.
                Trimmed to a bare heading it stopped saying what had
                actually happened; opening with the rule — "unsaved work
                stays on the browser that made it" — made the reader decode
                policy first. This says what was done, then the one thing
                left to do, as two sentences rather than two paragraphs so
                it reads as a single message.

                One timestamp, on the other device only. Three of them —
                the rescued edits, the parked draft and the other machine —
                was what made this unreadable: the reader ended up matching
                times to places to work out what had happened. A single
                time answers the one question worth asking here, which is
                how recent that other work is. */}
            <h2 className="text-base font-semibold">
              Your unsaved work is back
            </h2>
            <p className="mt-1.5 text-sm text-on-surface-variant">
              We kept what you hadn&apos;t saved and put it back on the canvas.
              {welcomeBack.elsewhere && (
                <>
                  {' '}You were also editing on{' '}
                  <span className="font-medium text-on-surface">
                    {welcomeBack.elsewhere.deviceLabel}
                  </span>{' '}
                  {describeWhen(welcomeBack.elsewhere.at)} — open the tool
                  there to pick that up.
                </>
              )}
            </p>

            {welcomeBack.draftSavedAt && !welcomeBack.elsewhere && (
              <p className="mt-2.5 text-sm text-on-surface-variant">
                Your draft from{' '}
                <span className="font-medium text-on-surface">
                  {describeWhen(welcomeBack.draftSavedAt)}
                </span>{' '}
                is untouched in My Draft.
              </p>
            )}
          </>
        ) : welcomeBack.mode === 'elsewhere' ? (
          <>
            {/* Nothing rescued and nothing parked, so where the work is IS
                the message. Not phrased as a failure to save: everywhere
                else the tool treats not-saving as normal, because it
                rescues work rather than asking about it. */}
            <h2 className="text-base font-semibold">
              Your unsaved changes are on another device
            </h2>
            <p className="mt-1.5 text-sm text-on-surface-variant">
              You were editing on{' '}
              <span className="font-medium text-on-surface">
                {welcomeBack.elsewhere.deviceLabel}
              </span>{' '}
              {describeWhen(welcomeBack.elsewhere.at)}. Those changes never
              made it to a draft, so they&apos;re on that browser only.
            </p>
          </>
        ) : (
          <>
            {/* Asked, because here it is a question: nothing was rescued,
                and the draft was parked on purpose. */}
            <h2 className="text-base font-semibold">
              Welcome back — your draft is waiting
            </h2>
            <p className="mt-1.5 text-sm text-on-surface-variant">
              Your promo card from {describeWhen(welcomeBack.draftSavedAt)} is
              still in My Draft, just as you left it.
            </p>
          </>
        )}

        {/* The other places the work lives, in one sentence each.
            A bordered list of rows was tried here and read as a settings
            panel — boxes and right-aligned timestamps make facts look like
            controls, and none of these are. Prose keeps them as what they
            are: context, on the way to the canvas. */}
        {/* Only the draft offer needs this. The restored branch above
            carries its own lines, and duplicating them here was rendering
            the same situation twice in one dialog — the very thing the
            rewrite was meant to stop. */}
        {welcomeBack.mode === 'draft' && welcomeBack.elsewhere && (
          <p className="mt-2.5 text-sm text-on-surface-variant">
            You were also editing on{' '}
            <span className="font-medium text-on-surface">
              {welcomeBack.elsewhere.deviceLabel}
            </span>
            . Those changes stay on that browser whatever you choose here.
          </p>
        )}

        {/* The one thing that cannot be found out any other way. */}
        {welcomeBack.mode === 'restored' && (
          <p className="mt-4 text-xs text-amber-600 dark:text-amber-500">
            Save it to My Draft so it opens anywhere.
          </p>
        )}
        {welcomeBack.mode === 'elsewhere' && (
          <p className="mt-4 text-xs text-on-surface-variant/80">
            Sign in there and save them to My Draft — then they&apos;ll open
            anywhere.
          </p>
        )}
        {welcomeBack.mode === 'draft' &&
          (hasChanges ? (
            <p className="mt-4 text-xs text-amber-600 dark:text-amber-500">
              The editor has unsaved changes. Opening the draft replaces them.
            </p>
          ) : (
            <p className="mt-4 text-xs text-on-surface-variant/80">
              Either way it stays saved — open it from My Draft whenever you like.
            </p>
          ))}

        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          {welcomeBack.mode === 'draft' ? (
            <>
              <button
                type="button"
                onClick={dismissWelcomeBack}
                className="rounded-md border border-white/10 bg-transparent px-4 py-2 text-sm font-medium text-on-surface-variant transition-colors hover:border-primary/70 hover:text-primary"
              >
                {hasChanges ? 'Keep my unsaved changes' : 'Start something new'}
              </button>
              <button
                type="button"
                onClick={() => draftOffer && acceptOfferedDraft(draftOffer)}
                className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-on-primary shadow-sm transition-opacity hover:opacity-95"
              >
                Continue my draft
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={dismissWelcomeBack}
                className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-on-primary shadow-sm transition-opacity hover:opacity-95"
              >
                {welcomeBack.mode === 'restored' ? 'Continue editing' : 'Continue here'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
