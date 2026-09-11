'use client';

import { useEffect, type RefObject, type Dispatch, type SetStateAction } from 'react';
import type { CampaignConfig } from '@/types/campaign';
import { getConfigSignature } from '@/lib/configSignature';
import { writeRecovery, clearRecovery } from '@/lib/recovery';
import { reportUnsaved } from '@/lib/auth/presenceClient';
import {
  describeDuration,
  setTitleCountdown,
  restoreTitle,
  showIdleNotification,
  closeIdleNotification,
  setFaviconAlert,
  setAppBadge,
} from '@/lib/auth/sessionWarning';

export const IDLE_LIMIT_MS = 20_000; // 20 seconds of inactivity before the countdown starts

/**
 * How much of that is spent counting down in front of the user.
 *
 * A lead time rather than a second absolute figure, so raising the limit can
 * never leave the warning firing after the sign-out it is warning about.
 */
export const IDLE_WARNING_LEAD_MS = 10_000; // 10 seconds of countdown

interface UseIdleSignOutArgs {
  configRef: RefObject<CampaignConfig>;
  /** Whether work would be lost — the two editors answer separately. */
  promoWorkNotInDraftRef: RefObject<boolean>;
  hasAnnouncementChangesRef: RefObject<boolean>;
  hasPromoChangesRef: RefObject<boolean>;
  draftSignatureRef: RefObject<string | null>;
  /** Why the session ended, read by the sign-in screen on the way back. */
  exitReasonRef: RefObject<'logout' | 'timeout' | null>;
  /** The countdown shown in the warning, as state and as a ref. */
  idleSecondsLeftRef: RefObject<number | null>;
  setIdleSecondsLeft: Dispatch<SetStateAction<number | null>>;
  /** Filled in here so the rest of the page can restart the clock. */
  idleRestartRef: RefObject<(() => void) | null>;
  /**
   * The guarded draft save, read at call time.
   *
   * Passed as a ref rather than the function itself: `useCampaignDraft` is
   * built before `useIdleSignOut` in the page, and the function's identity
   * changes on every render. A ref keeps this effect's dependency list empty
   * while still reaching the latest closure.
   */
  saveDraftRef: RefObject<(cfg: CampaignConfig) => boolean>;
  toast: (message: string, isError?: boolean) => void;
}

/**
 * Signing out after a spell of inactivity.
 *
 * One hundred and seventy lines that ask nothing of the page but eight refs,
 * which is why it belongs here rather than among its effects: timers, activity
 * listeners, a visibility handler and a countdown, all existing only to answer
 * one question.
 */
export function useIdleSignOut({
  configRef,
  promoWorkNotInDraftRef,
  hasAnnouncementChangesRef,
  hasPromoChangesRef,
  draftSignatureRef,
  exitReasonRef,
  idleSecondsLeftRef,
  setIdleSecondsLeft,
  idleRestartRef,
  saveDraftRef,
  toast,
}: UseIdleSignOutArgs) {
  /**
   * Sign out after a spell of inactivity — and treat it as an accident, not a
   * decision.
   *
   * The order matters: the work is put somewhere it can be found again while
   * the page is still ours, and only then is anything attempted that can
   * fail. What "somewhere" means depends on whether a saved work already
   * exists:
   *
   *   - No saved work yet. The current editor IS the work, so it becomes the
   *     first save — written straight to the cloud draft. The local rescue
   *     copy is cleared at the same time: the work is now saved properly, and
   *     a rescue offer on the next login would be redundant.
   *
   *   - Saved work already exists. The cloud draft is left alone; the current
   *     editor goes to the local rescue slot instead, and the next login
   *     offers to save it. Silently overwriting the user's saved work with
   *     whatever the editor happened to hold would destroy a save they made
   *     on purpose.
   *
   * A short time before that (IDLE_WARNING_LEAD_MS), the countdown appears.
   */
  useEffect(() => {
    let idleTimer: number | undefined;
    let warnTimer: number | undefined;
    let tick: number | undefined;

    const signOutIdle = () => {
      const atRisk =
        promoWorkNotInDraftRef.current ||
        hasPromoChangesRef.current ||
        (hasAnnouncementChangesRef.current &&
          draftSignatureRef.current !== getConfigSignature(configRef.current));

      if (atRisk) {
        const hasCloudDraft = draftSignatureRef.current !== null;
        if (hasCloudDraft) {
          // Saved work already exists — write to recovery only, and mark it
          // as an idle rescue so the next login says so.
          writeRecovery(configRef.current, 'idle');
        } else {
          // No saved work yet — this is the first save
          // Save to cloud draft, but DON'T clear recovery yet
          // Let loadConfig clear it when it detects it's stale
          const written = saveDraftRef.current(configRef.current);
          if (written) {
            // Write recovery with 'idle' reason so next login knows it's from auto-logout
            writeRecovery(configRef.current, 'idle');
            toast('Saved your work');
          }
        }
        reportUnsaved(true);
      }

      standDown();
      exitReasonRef.current = 'timeout';
      fetch('/api/auth/logout', { method: 'POST', keepalive: true })
        .catch(() => { })
        .finally(() => {
          window.location.href = '/login?reason=timeout';
        });
    };

    /**
     * Take every alarm back down.
     */
    const standDown = () => {
      closeIdleNotification();
      restoreTitle();
      setFaviconAlert(false);
      setAppBadge(null);
    };

    const reachUser = () => {
      if (idleSecondsLeftRef.current === null) {
        standDown();
        return;
      }
      if (document.visibilityState === 'hidden') {
        setTitleCountdown(idleSecondsLeftRef.current);
        setFaviconAlert(true);
        setAppBadge(idleSecondsLeftRef.current);
        showIdleNotification(describeDuration(IDLE_LIMIT_MS - IDLE_WARNING_LEAD_MS), () =>
          restart(),
        );
      } else {
        standDown();
      }
    };

    const beginWarning = () => {
      const seconds = Math.round(IDLE_WARNING_LEAD_MS / 1000);
      idleSecondsLeftRef.current = seconds;
      setIdleSecondsLeft(seconds);
      reachUser();

      document.addEventListener('visibilitychange', reachUser);

      tick = window.setInterval(() => {
        setIdleSecondsLeft((left) => {
          if (left === null) return null;
          const next = Math.max(0, left - 1);
          idleSecondsLeftRef.current = next;
          if (document.visibilityState === 'hidden') {
            setTitleCountdown(next);
            setAppBadge(next);
          }
          return next;
        });
      }, 1000);
    };

    const clearAll = () => {
      window.clearTimeout(idleTimer);
      window.clearTimeout(warnTimer);
      window.clearInterval(tick);
      document.removeEventListener('visibilitychange', reachUser);
    };

    function restart() {
      clearAll();
      idleSecondsLeftRef.current = null;
      setIdleSecondsLeft(null);
      standDown();
      if (document.visibilityState === 'visible') return;
      warnTimer = window.setTimeout(beginWarning, IDLE_LIMIT_MS - IDLE_WARNING_LEAD_MS);
      idleTimer = window.setTimeout(signOutIdle, IDLE_LIMIT_MS);
    }

    const onActivity = () => {
      if (idleSecondsLeftRef.current !== null) return;
      restart();
    };

    const events: (keyof WindowEventMap)[] = ['pointerdown', 'keydown', 'wheel', 'touchstart'];
    events.forEach((event) => window.addEventListener(event, onActivity, { passive: true }));

    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        restart();
      } else {
        clearAll();
        idleSecondsLeftRef.current = null;
        setIdleSecondsLeft(null);
        standDown();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    if (document.visibilityState === 'hidden') restart();
    idleRestartRef.current = restart;

    return () => {
      clearAll();
      standDown();
      document.removeEventListener('visibilitychange', onVisibility);
      events.forEach((event) => window.removeEventListener(event, onActivity));
    };
  }, []);
}