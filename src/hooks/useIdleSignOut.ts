'use client';

import { useEffect, type RefObject, type Dispatch, type SetStateAction } from 'react';
import type { CampaignConfig } from '@/types/campaign';
import { getConfigSignature } from '@/lib/configSignature';
import { writeRecovery } from '@/lib/recovery';
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

/**
 * Is this the first load of this visit?
 *
 * The arrival messages — work restored, work waiting on another device — are
 * about coming back to the tool, so they should be said once and not again on
 * every refresh.
 *
 * Asking the browser whether the load was a "reload" was the first attempt and
 * was too blunt: plenty of people return to work by refreshing a tab they left
 * open, and those people would never have been told about the other device at
 * all. sessionStorage draws the line where it belongs — it survives refreshes
 * within a tab and is empty again when the tool is opened afresh.
 *
 * Memoised because both messages ask, and the first ask is what marks the
 * visit as seen.
 */


export const IDLE_LIMIT_MS = 60_000;

/**
 * How much of that is spent counting down in front of the user.
 *
 * A lead time rather than a second absolute figure, so raising the limit can
 * never leave the warning firing after the sign-out it is warning about.
 */
export const IDLE_WARNING_LEAD_MS = 30_000;


interface UseIdleSignOutArgs {
  configRef: RefObject<CampaignConfig>;
  /** Whether work would be lost — the two editors answer separately. */
  promoWorkNotInDraftRef: RefObject<boolean>;
  hasAnnouncementChangesRef: RefObject<boolean>;
  draftSignatureRef: RefObject<string | null>;
  /** Why the session ended, read by the sign-in screen on the way back. */
  exitReasonRef: RefObject<'logout' | 'timeout' | null>;
  /** The countdown shown in the warning, as state and as a ref. */
  idleSecondsLeftRef: RefObject<number | null>;
  setIdleSecondsLeft: Dispatch<SetStateAction<number | null>>;
  /** Filled in here so the rest of the page can restart the clock. */
  idleRestartRef: RefObject<(() => void) | null>;
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
  draftSignatureRef,
  exitReasonRef,
  idleSecondsLeftRef,
  setIdleSecondsLeft,
  idleRestartRef,
}: UseIdleSignOutArgs) {
  /**
   * Sign out after a spell of inactivity — and treat it as an accident, not a
   * decision.
   *
   * Someone who walks away has not chosen to stop working, so the order
   * matters: the local copy is written first, while the page is still ours,
   * and only then is anything attempted that can fail. If the logout request
   * never lands, the work is still on disk and the next visit restores it.
   *
   * A minute before that, the countdown appears. It is a dialog in the page,
   * which everyone gets, plus a desktop notification for anyone who granted
   * permission and has switched to another window — the case where the dialog
   * alone would be invisible and the sign-out would arrive unexplained.
   */
  useEffect(() => {
    let idleTimer: number | undefined;
    let warnTimer: number | undefined;
    let tick: number | undefined;

    const signOutIdle = () => {
      const atRisk =
        promoWorkNotInDraftRef.current ||
        (hasAnnouncementChangesRef.current &&
          draftSignatureRef.current !== getConfigSignature(configRef.current));

      if (atRisk) {
        writeRecovery(configRef.current);
        // Raised now rather than left to the debounced reporter, which will not
        // get another turn before this page is gone.
        reportUnsaved(true);
      }

      standDown();
      exitReasonRef.current = 'timeout';
      fetch('/api/auth/logout', { method: 'POST', keepalive: true })
        .catch(() => {})
        .finally(() => {
          window.location.href = '/login?reason=timeout';
        });
    };

    /**
     * Put the warning wherever the user actually is.
     *
     * The dialog is always rendered — it costs nothing in a tab nobody is
     * looking at, and it means someone coming back mid-countdown finds the
     * warning already there instead of being signed out mid-glance. The
     * desktop notification is what reaches them when they are elsewhere, and
     * is suppressed while the tab is visible because the dialog has it covered.
     */
    /**
     * Take every alarm back down.
     *
     * Gathered into one call because there are now four of them — dialog,
     * notification, tab title, icon, dock badge — and each exit from the
     * countdown used to remember them individually. Forgetting one leaves a
     * tab wearing a red dot over a session that is perfectly fine.
     */
    const standDown = () => {
      closeIdleNotification();
      restoreTitle();
      setFaviconAlert(false);
      setAppBadge(null);
    };

    const reachUser = () => {
      // Only while a countdown is actually running. Without this, a listener
      // outliving its warning — clicking the notification restarts the timer,
      // and the next tab switch arrives before the teardown has settled —
      // posts a notification for a warning that is already over.
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
        // Back on the page, where the dialog speaks for itself. Leaving the
        // notification or the title alarm up would have them dismissing the
        // same warning twice.
        standDown();
      }
    };

    const beginWarning = () => {
      const seconds = Math.round(IDLE_WARNING_LEAD_MS / 1000);
      // The ref is written here as well as during render, because what reads
      // it is an event handler that can fire before React has re-rendered —
      // clicking the notification and switching tabs in the same breath.
      idleSecondsLeftRef.current = seconds;
      setIdleSecondsLeft(seconds);
      reachUser();

      // Watched for the whole countdown, not just its first moment. Switching
      // away after the dialog appeared used to mean no notification at all —
      // the warning sat in a tab the user could not see, and the sign-out
      // arrived unannounced.
      document.addEventListener('visibilitychange', reachUser);

      tick = window.setInterval(() => {
        setIdleSecondsLeft((left) => {
          if (left === null) return null;
          const next = Math.max(0, left - 1);
          idleSecondsLeftRef.current = next;
          // Only while they are elsewhere. Rewriting the title of a tab
          // somebody is looking at changes nothing they can see and leaves the
          // window chrome flickering behind the dialog.
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
      /**
       * No clock at all while the tab is on screen.
       *
       * The guard lives here rather than at each caller because there are
       * three — the visibility change, any real input, and the "I'm still
       * here" button — and two of them fire while the page is visible. Without
       * it, typing would start a countdown that then interrupted the person
       * typing.
       */
      if (document.visibilityState === 'visible') return;
      warnTimer = window.setTimeout(beginWarning, IDLE_LIMIT_MS - IDLE_WARNING_LEAD_MS);
      idleTimer = window.setTimeout(signOutIdle, IDLE_LIMIT_MS);
    }

    // Real input only, and only while nothing is being asked. A mousemove
    // listener would keep the session alive under a sleeping cursor, and once
    // the countdown is up it wants an answer rather than a twitch.
    const onActivity = () => {
      if (idleSecondsLeftRef.current !== null) return;
      restart();
    };

    const events: (keyof WindowEventMap)[] = ['pointerdown', 'keydown', 'wheel', 'touchstart'];
    events.forEach((event) => window.addEventListener(event, onActivity, { passive: true }));

    /**
     * The clock only runs while the user is somewhere else.
     *
     * Sitting on the tool reading your own card was enough to be counted idle,
     * because idleness was measured by input alone — so a modal countdown
     * interrupted someone who was plainly present and looking straight at it.
     * Being on the page IS the activity.
     *
     * So the timer starts when the tab is hidden and stops when it comes back,
     * which also means the warning can only ever reach someone who has left —
     * exactly who it is for.
     */
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
