'use client';

import type { CampaignConfig } from '@/types/campaign';
import type { WelcomeBackState } from '@/types/campaignShell';
import { describeWhen } from '@/lib/auth/presenceClient';

/**
 * The dialogs about the single saved draft: throwing it away, replacing it,
 * what became of it after a publish, and offering it back on arrival.
 *
 * One slot, so every one of these is really the same question asked at a
 * different moment — which is why they belong together and apart from the
 * dialogs that guard an action.
 */

/** Throwing the saved draft away. */
export function DiscardDraftDialog({
  confirmDiscardDraft,
  setConfirmDiscardDraft,
  discardIntentIsStartNew,
  discardDraft,
}: {
  confirmDiscardDraft: boolean;
  setConfirmDiscardDraft: (v: boolean) => void;
  discardIntentIsStartNew?: boolean;
  discardDraft: () => void;
}) {
  if (!confirmDiscardDraft) return null;

  // Discard when starting new: use card colors
  if (discardIntentIsStartNew) {
    return (
      <div data-modal className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="absolute inset-0" onClick={() => setConfirmDiscardDraft(false)} />
        <div className="relative z-10 w-full max-w-md rounded-xl border border-white/10 bg-black/10 p-6 text-on-surface shadow-2xl backdrop-blur-md">
          <h2 className="text-base font-semibold">Discard existing draft?</h2>
          <p className="mt-3 text-sm text-on-surface-variant">
            You have a saved draft. Starting a new campaign will permanently overwrite and delete this draft.
            <br /><br />
            This action cannot be undone.
          </p>
          <div className="mt-6 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setConfirmDiscardDraft(false)}
              className="rounded-md border border-white/10 bg-transparent px-4 py-2 text-sm font-medium text-on-surface-variant transition-colors hover:border-primary/70 hover:text-primary"
            >
              Keep saved draft
            </button>
            <button
              type="button"
              onClick={() => {
                setConfirmDiscardDraft(false);
                discardDraft();
              }}
              className="rounded-md bg-red-600 hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-800 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors"
            >
              Discard & start fresh
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Delete from My Draft: use card colors
  return (
    <div data-modal className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0" onClick={() => setConfirmDiscardDraft(false)} />
      <div className="relative z-10 w-full max-w-md rounded-xl border border-white/10 bg-black/10 p-6 text-on-surface shadow-2xl backdrop-blur-md">
        <h2 className="text-base font-semibold">Delete your saved draft?</h2>
        <p className="mt-3 text-sm text-on-surface-variant">
          Your saved draft will be deleted and you&apos;ll start fresh from what&apos;s currently published. This can&apos;t be undone.
        </p>
        <div className="mt-6 flex justify-end gap-2">
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
            className="rounded-md bg-red-600 hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-800 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors"
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
  editorWorkAtRisk,
  acceptOfferedDraft,
  dismissWelcomeBack,
}: {
  /** Null when nothing is being offered back; otherwise why it is showing. */
  welcomeBack: WelcomeBackState;
  draftOffer: CampaignConfig | null;
  /**
   * True only when the editor holds something the user would lose — not
   * merely when the config is dirty. Accepting the draft replaces the whole
   * editor, so the warning has to be honest about whether that costs anything.
   */
  editorWorkAtRisk: boolean;
  acceptOfferedDraft: (draft: CampaignConfig) => void;
  dismissWelcomeBack: () => void;
}) {
  if (!(welcomeBack)) return null;

  return (
    <div data-modal className="fixed inset-0 z-50 flex items-center justify-center bg-transparent p-4">
      <div className="absolute inset-0" />
      <div className="relative z-10 w-full max-w-lg rounded-xl border border-white/10 bg-black/10 p-6 text-on-surface shadow-2xl backdrop-blur-md">
        {welcomeBack.mode === 'elsewhere' ? (
          <>
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
            <h2 className="text-base font-semibold">
              Welcome back — your draft is waiting
            </h2>
            <p className="mt-1.5 text-sm text-on-surface-variant">
              Your promo card from {describeWhen(welcomeBack.draftSavedAt)} is
              still in My Draft, just as you left it.
            </p>
          </>
        )}

        {welcomeBack.mode === 'draft' && welcomeBack.elsewhere && (
          <p className="mt-2.5 text-sm text-on-surface-variant">
            You were also editing on{' '}
            <span className="font-medium text-on-surface">
              {welcomeBack.elsewhere.deviceLabel}
            </span>
            . Those changes stay on that browser whatever you choose here.
          </p>
        )}

        {welcomeBack.mode === 'elsewhere' && (
          <p className="mt-4 text-xs text-on-surface-variant/80">
            Sign in there and save them to My Draft — then they&apos;ll open
            anywhere.
          </p>
        )}
        {welcomeBack.mode === 'draft' &&
          (editorWorkAtRisk ? (
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
                {editorWorkAtRisk ? 'Keep my unsaved changes' : 'Start something new'}
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
            <button
              type="button"
              onClick={dismissWelcomeBack}
              className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-on-primary shadow-sm transition-opacity hover:opacity-95"
            >
              Continue here
            </button>
          )}
        </div>
      </div>
    </div>
  );
}