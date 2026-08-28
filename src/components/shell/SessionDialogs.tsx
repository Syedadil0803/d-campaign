'use client';

import type { RefObject } from 'react';
import { Clock, SlidersHorizontal } from 'lucide-react';
import {
  askNotificationPermission,
  describeDuration,
  osNotificationHint,
  unblockSteps,
} from '@/lib/auth/sessionWarning';
import { IDLE_LIMIT_MS, IDLE_WARNING_LEAD_MS } from '@/hooks/useIdleSignOut';
import type { WelcomeBackState } from '@/components/shell/CampaignDialogs';

/**
 * The two dialogs about the session rather than the work: the sign-out
 * countdown, and our ask before the browser's notification prompt.
 *
 * Apart from CampaignDialogs because they answer to the clock and the browser,
 * not to the campaign — and because that file had grown past the standard
 * holding both.
 */

/**
 * The countdown before an idle session signs itself out.
 */
export function IdleCountdownDialog({
  idleSecondsLeft,
  idleRestartRef,
}: {
  idleSecondsLeft: number | null;
  idleRestartRef: RefObject<(() => void) | null>;
}) {
  if (!(idleSecondsLeft !== null)) return null;

  return (
    <div data-modal className="fixed inset-0 z-[60] flex items-center justify-center bg-transparent p-4">
      <div className="absolute inset-0" />
      <div className="relative z-10 w-full max-w-sm rounded-xl border border-white/10 bg-black/10 p-6 text-center text-on-surface shadow-2xl backdrop-blur-md">
        {/* Centred, with the count as the largest thing on it. The question
            is rhetorical — what the reader needs is how long they have, so
            that is what the eye should land on first. */}
        <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-amber-500/15">
          <Clock className="h-5 w-5 text-amber-600 dark:text-amber-500" />
        </div>

        <h2 className="mt-3.5 text-base font-semibold">Are you still there?</h2>
        <p className="mt-1 text-sm text-on-surface-variant">
          No activity for {describeDuration(IDLE_LIMIT_MS - IDLE_WARNING_LEAD_MS)}.
        </p>

        <p className="mt-4 text-3xl font-semibold tabular-nums text-amber-600 dark:text-amber-500">
          {idleSecondsLeft}s
        </p>

        {/* Draining, not filling. Something running out is read without
            being read — the bar says how long is left before the number
            has been focused on. The transition is linear and matches the
            tick, so it slides smoothly rather than stepping. */}
        <div className="mt-2.5 h-1 w-full overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-amber-500 transition-[width] duration-1000 ease-linear"
            style={{
              width: `${(idleSecondsLeft / Math.round(IDLE_WARNING_LEAD_MS / 1000)) * 100}%`,
            }}
          />
        </div>

        {/* Says the quiet part, because a countdown reads as a threat
            otherwise. Nothing is lost either way — which is the point of
            everything else in this file. */}
        <p className="mt-4 text-xs text-on-surface-variant/80">
          Your work is saved. It will be back on the canvas when you sign in again.
        </p>

        <button
          type="button"
          onClick={() => idleRestartRef.current?.()}
          className="mt-5 w-full rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-on-primary shadow-sm transition-opacity hover:opacity-95"
        >
          I&apos;m still here
        </button>
      </div>
    </div>
  );
}

/**
 * Our ask, in front of the browser's — so a refusal costs a dialog rather than
 * the permission itself, which cannot be asked for twice.
 */
export function NotificationsPromptDialog({
  askNotifications,
  setAskNotifications,
  welcomeBack,
  idleSecondsLeft,
}: {
  /** Which of the three prompts to show, or null for none. */
  askNotifications: 'ask' | 'blocked' | 'enabled' | null;
  setAskNotifications: (ask: 'ask' | 'blocked' | 'enabled' | null) => void;
  welcomeBack: WelcomeBackState;
  idleSecondsLeft: number | null;
}) {
  if (!(askNotifications && !welcomeBack && idleSecondsLeft === null)) return null;

  return (
    <div className="animate-slide-in-corner fixed right-4 bottom-4 z-40 w-72 rounded-lg border border-white/10 bg-black/20 p-3.5 text-on-surface shadow-xl backdrop-blur-md">
      {askNotifications === 'ask' ? (
        <>
          {/* Two short lines. The second is the only thing that justifies
              the permission at all — the in-page countdown already covers
              the case where you are looking at the tab. */}
          {/* Warns about the third gate before consent, not after.
              Someone who allows here and then sees nothing has no reason
              to suspect their system is muting the browser — so the
              clause goes in upfront, while the exact path waits for the
              confirmation card, where it is actually actionable. */}
          <p className="text-sm font-medium">Notify you before signing out?</p>
          <p className="mt-1 text-xs text-on-surface-variant">
            Works even when this tab is hidden. Your system must allow
            browser notifications too.
          </p>
          <div className="mt-3 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setAskNotifications(null)}
              className="rounded-md px-2.5 py-1.5 text-xs font-medium text-on-surface-variant transition-colors hover:text-primary"
            >
              Not now
            </button>
            <button
              type="button"
              onClick={async () => {
                // Inside the click on purpose: Chrome ignores a permission
                // request that is not tied to a gesture.
                const result = await askNotificationPermission();
                // Blocked at the browser's prompt after accepting ours —
                // switch to saying where the switch is rather than
                // vanishing, since they did ask for this.
                if (result === 'denied') return setAskNotifications('blocked');
                // Granted: confirm it, and name the one gate left that
                // nothing can check on their behalf.
                if (result === 'granted') return setAskNotifications('enabled');
                setAskNotifications(null);
              }}
              className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-on-primary shadow-sm transition-opacity hover:opacity-95"
            >
              Allow
            </button>
          </div>
        </>
      ) : askNotifications === 'enabled' ? (
        <>
          {/* Shown once, straight after granting.
              Two gates are now open and a third is not readable from here,
              so this is the only chance to mention it before someone
              concludes the feature is broken. Phrased as a condition, not
              an instruction — for most people nothing more is needed. */}
          <p className="text-sm font-medium">Notifications are on</p>
          <p className="mt-1 text-xs text-on-surface-variant">
            Not seeing them? Your system may be muting the browser:{' '}
            {osNotificationHint() ?? 'check your notification settings.'}
          </p>
          <div className="mt-3 flex justify-end">
            <button
              type="button"
              onClick={() => setAskNotifications(null)}
              className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-on-primary shadow-sm transition-opacity hover:opacity-95"
            >
              Got it
            </button>
          </div>
        </>
      ) : (
        <>
          {/* No Allow button: only the user can undo a block, from browser
              settings, so offering one here would be theatre. */}
          <p className="text-sm font-medium">Notifications are blocked</p>
          {/* The icon is drawn, not described. Someone scanning a toolbar
              should be matching a shape, not decoding "padlock or sliders"
              — and no single word for it is right across Chrome versions. */}
          <p className="mt-1 text-xs leading-relaxed text-on-surface-variant">
            {(() => {
              const hint = unblockSteps();
              if (hint.kind === 'menu') return hint.text;
              return (
                <>
                  {hint.before}{' '}
                  <SlidersHorizontal className="mx-0.5 inline-block h-3.5 w-3.5 -translate-y-px align-middle text-on-surface" />{' '}
                  {hint.after}
                </>
              );
            })()}
          </p>
          {/* A solid button, not the quiet text one the offer uses for
              "Not now". There is no choice on this card — dismissing is
              the only thing to do — so the single action should look like
              one rather than like the lesser of two options. */}
          <div className="mt-3 flex justify-end">
            <button
              type="button"
              onClick={() => setAskNotifications(null)}
              className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-on-primary shadow-sm transition-opacity hover:opacity-95"
            >
              Got it
            </button>
          </div>
        </>
      )}
    </div>
  );
}
