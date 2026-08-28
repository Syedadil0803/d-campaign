'use client';


import type { CampaignConfig } from '@/types/campaign';
import type {
  WelcomeBackState,
} from '@/types/campaignShell';
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
