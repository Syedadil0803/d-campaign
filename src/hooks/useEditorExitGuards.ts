'use client';

import { useEffect, useRef, useState, type RefObject } from 'react';
import type { CampaignConfig } from '@/types/campaign';
import { writeRecovery } from '@/lib/recovery';
import { announcementSignature } from '@/lib/configSignature';
import { reportUnsaved } from '@/lib/auth/presenceClient';
import { useIdleSignOut } from '@/hooks/useIdleSignOut';

interface UseEditorExitGuardsArgs {
  config: CampaignConfig;
  hasAnnouncementChanges: boolean;
  configLoadedSignal: number;
  configRef: RefObject<CampaignConfig>;
  promoWorkNotInDraftRef: RefObject<boolean>;
  hasAnnouncementChangesRef: RefObject<boolean>;
  hasPromoChangesRef: RefObject<boolean>;
  draftSignatureRef: RefObject<string | null>;
  announcementComposeTextRef: RefObject<string>;
  saveDraftAndWaitForCloud: (cfg: CampaignConfig) => Promise<'skipped' | 'saved' | 'failed'>;
  saveMessagesDraft: () => void;
  toast: (message: string, isError?: boolean) => void;
  /**
   * Read at call time, never during render — the page defines it further
   * down than this hook is called, so it arrives wrapped in an arrow.
   */
  editorWorkAtRisk: () => boolean;
}

/**
 * Every way the editor can be left with work still on it: another device
 * being told, the idle sign-out, and the tab closing.
 *
 * Moved out of the page as one block because all three share the same small
 * set of refs and the same question — is anything at risk — and none of them
 * renders anything. The page calls this where the effects used to sit, so
 * they run in the order they always did.
 */
export function useEditorExitGuards({
  config,
  hasAnnouncementChanges,
  configLoadedSignal,
  configRef,
  promoWorkNotInDraftRef,
  hasAnnouncementChangesRef,
  hasPromoChangesRef,
  draftSignatureRef,
  announcementComposeTextRef,
  saveDraftAndWaitForCloud,
  saveMessagesDraft,
  toast,
  editorWorkAtRisk,
}: UseEditorExitGuardsArgs) {
  /**
   * Why the page is leaving, when the app is the one making it leave.
   *
   * Both cases have to skip the browser's leave prompt — it is meant for a
   * user closing a tab, not for the app navigating on their behalf. They then
   * split on the local copy: signing out is a decision, and follows the same
   * rule as answering Leave to the close prompt, so the copy goes. Timing out
   * is not a decision at all, so the copy stays and is what gets restored on
   * the way back in.
   */

  /** What we last told the server, so a save clears only a flag we raised. */
  /** What this device last told the server. null until it has said anything. */
  const reportedUnsavedRef = useRef<{ promo: boolean; announcement: boolean } | null>(null);

  /**
   * Seconds left before an idle sign-out, or null when nothing is pending.
   *
   * Only the button clears it. Ordinary activity resets the timer right up
   * until the warning appears, but once it is on screen it wants an answer —
   * a stray scroll from a cat on the keyboard is not somebody saying they are
   * still there, and the dialog blocks the editor anyway.
   */

  /**
   * Tells the server one bit: is work sitting unsaved somewhere.
   *
   * A boolean, which browser, and when — never the card itself. Uploading
   * unsaved work would keep something the user never asked us to keep.
   *
   * `false` is sent only by the browser that said `true`. Otherwise a second
   * device clears the first one's claim just by opening the editor, which is
   * the warning this exists to give.
   */
  useEffect(() => {
    // Nothing is knowable until the first load has settled — reporting against
    // the default config would lower a flag this device raised last session.
    if (!configLoadedSignal) return;

    const promoAtRisk = !!promoWorkNotInDraftRef.current;
    /**
     * Scoped to the announcement half, the same way editorWorkAtRisk is.
     * Comparing the WHOLE config against the baseline meant a dirty promo
     * made the announcement report as unsaved too — so the other device was
     * told to look for announcement work that was never there.
     */
    const annAtRisk = (() => {
      if (!hasAnnouncementChanges) return false;
      let savedAnnSig: string | null = null;
      if (draftSignatureRef.current) {
        try {
          savedAnnSig = announcementSignature(JSON.parse(draftSignatureRef.current));
        } catch {
          // No parseable baseline — treat as nothing saved yet.
        }
      }
      return announcementSignature(config) !== savedAnnSig;
    })();

    const prev = reportedUnsavedRef.current;
    // null means "we have not told the server anything this session", so the
    // first report always goes out — that is what lowers a flag left standing
    // by a crash, once this device comes back and the work is resolved.
    if (prev && prev.promo === promoAtRisk && prev.announcement === annAtRisk) return;

    const id = window.setTimeout(() => {
      const flags = { promo: promoAtRisk, announcement: annAtRisk };
      reportedUnsavedRef.current = flags;
      if (!flags.promo && !flags.announcement) {
        reportUnsaved(false);
      } else {
        reportUnsaved(flags);
      }
    }, 1000);
    return () => window.clearTimeout(id);
  }, [config, hasAnnouncementChanges, configLoadedSignal, draftSignatureRef, promoWorkNotInDraftRef]);

  // Declared here because useIdleSignOut takes them.
  const [idleSecondsLeft, setIdleSecondsLeft] = useState<number | null>(null);
  const idleRestartRef = useRef<(() => void) | null>(null);
  const exitReasonRef = useRef<'logout' | 'timeout' | null>(null);
  const idleSecondsLeftRef = useRef<number | null>(null);
  const saveDraftRef = useRef(saveDraftAndWaitForCloud);
  saveDraftRef.current = saveDraftAndWaitForCloud;
  const saveMessagesRef = useRef(saveMessagesDraft);
  saveMessagesRef.current = saveMessagesDraft;
  useIdleSignOut({
    configRef,
    promoWorkNotInDraftRef,
    hasAnnouncementChangesRef,
    hasPromoChangesRef,
    draftSignatureRef,
    announcementComposeTextRef,
    exitReasonRef,
    idleSecondsLeftRef,
    setIdleSecondsLeft,
    idleRestartRef,
    saveDraftRef,
    saveMessagesRef,
    toast,
  });

  /**
   * Closing the tab asks nothing. The work is written to disk before the page
   * goes, and offered back on the way in — the same path a crash takes.
   *
   * There is deliberately no "Leave site?" prompt. The browser never says
   * which button was pressed, so the tool would have to guess, and guessing
   * wrong throws the work away.
   */
  useEffect(() => {
    const preserveWork = () => {
      // Synchronous localStorage write — the only thing guaranteed to survive
      // an abrupt close. Cloud draft is NOT written here: the page is dying,
      // keepalive fetches race the session cookie, and when they land the next
      // login sees an identical draft + recovery (Case 3) and silently discards
      // the recovery banner the user should have seen.
      writeRecovery(
        configRef.current,
        'crash',
        announcementComposeTextRef.current || undefined,
      );

      // The debounce may not have fired yet (or may never have run) — raise the
      // flag here so the crash is still visible from the user's other devices.
      const rep = reportedUnsavedRef.current;
      if (!rep?.promo && !rep?.announcement) {
        const pDirty = !!promoWorkNotInDraftRef.current;
        const aDirty = hasAnnouncementChangesRef.current;
        if (pDirty || aDirty) reportUnsaved({ promo: pDirty, announcement: aDirty });
      }
    };

    /**
     * Browser close: show warning prompt if there's unsaved work.
     * Modern browsers restrict the message, so it's just generic text.
     * User can still close if they confirm.
     * 
     * BUT: Skip the warning if we're already signing out (manual logout or timeout).
     */
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      // Don't warn if logout or timeout is happening
      if (exitReasonRef.current === 'logout' || exitReasonRef.current === 'timeout') return;

      if (!editorWorkAtRisk()) return;
      e.preventDefault();
      e.returnValue = '';
    };

    /**
     * The page is going.
     *
     * `persisted` means it is being frozen for back/forward cache rather than
     * closed — it will be resumed with everything still in memory, so there is
     * nothing to save and no visit to restore on.
     *
     * Signing out is the one exit that still discards: it is a deliberate act,
     * and the user was offered the draft slot on the way. Everything else —
     * closing, timing out, the lid shutting — keeps the copy.
     */
    const handlePageHide = (e: PageTransitionEvent) => {
      if (e.persisted) return;
      if (exitReasonRef.current === 'logout') return;
      preserveWork();
    };

    /**
     * A tab is hidden before it is discarded, and on mobile a page can be
     * killed while hidden without `pagehide` ever firing. Saving here as well
     * costs a localStorage write on a tab switch and buys the phone case.
     */
    const handleVisibility = () => {
      if (document.visibilityState === 'hidden' && !exitReasonRef.current) preserveWork();
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('pagehide', handlePageHide);
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('pagehide', handlePageHide);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- unload listeners are attached once on mount; editorWorkAtRisk is an inline arrow recreated each render and listing it would re-subscribe every render
  }, []);

  /** Mirrors the countdown for the activity listener, which is bound once. */
  idleSecondsLeftRef.current = idleSecondsLeft;
  /** Lets the dialog's button reach the timer that owns the countdown. */

  return { idleSecondsLeft, idleRestartRef, exitReasonRef };
}
