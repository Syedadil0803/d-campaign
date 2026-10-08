'use client';

import { useEffect, useState } from 'react';
import { isFirstLoadOfVisit } from '@/lib/visit';
import { fetchUnsavedElsewhere, markElsewhereSeen } from '@/lib/auth/presenceClient';
import {
  notificationPermission,
  notificationsSupported,
} from '@/lib/auth/sessionWarning';

/**
 * The two things the page may have to tell someone as they arrive: that it
 * would like to send notifications, and that unsaved work is sitting in
 * another browser.
 *
 * Each is one piece of state and the mount effect that raises it, and neither
 * reads anything else on the page — which is what let them leave it. Called at
 * the spot the effects used to occupy, so they still run in the same order.
 */
export function useArrivalNotices() {
  /**
   * The notification card has two things to say.
   *
   * 'ask' comes before the browser's own prompt, so "Not now" costs nothing —
   * only someone who chose Allow ever reaches the real one, and a browser prompt
   * can be answered only once.
   *
   * 'blocked' is Allow here, then Block in the browser. The offer cannot be
   * repeated (a denied permission resolves instantly without prompting), so all
   * that is left is to say where the switch is.
   */
  const [askNotifications, setAskNotifications] = useState<
    'ask' | 'blocked' | 'enabled' | null
  >(null);

  /**
   * Unsaved work is sitting in a different browser.
   *
   * There is nothing to restore here — that is the whole message. Work that was
   * never saved as a draft stays in the browser that made it, so the only
   * honest thing to say is where it is and how to get it back.
   */
  const [elsewhereNotice, setElsewhereNotice] = useState<{
    deviceId: string;
    deviceLabel: string;
    at: string | null;
    hasUnsavedPromo: boolean;
    hasUnsavedAnnouncement: boolean;
  } | null>(null);

  /**
   * Raise the notification card, once per visit.
   *
   * Silent only when the permission is already granted. Denied still gets a
   * card, because the way it usually happens is someone accepting here and
   * then hitting Block in the browser's prompt — they wanted this and ended up
   * without it. What it says changes, though: an Allow button against a denied
   * permission is a button that does nothing.
   */
  useEffect(() => {
    if (!notificationsSupported()) return;
    const permission = notificationPermission();
    if (permission === 'granted') return; // Nothing to ask for.
    setAskNotifications(permission === 'denied' ? 'blocked' : 'ask');
  }, []);

  /**
   * Is any OTHER browser holding unsaved work for this account?
   *
   * This browser names itself so the server can leave it out — its own flag is
   * still up while it holds work, and reporting that back would tell someone
   * their edits are elsewhere while they are looking at them. A device holding
   * unsaved work cannot hand it over either, so the answer only ever explains
   * why that work is not here.
   */
  useEffect(() => {
    let cancelled = false;
    // Said once a visit — see isFirstLoadOfVisit.
    if (!isFirstLoadOfVisit()) return;

    fetchUnsavedElsewhere().then((elsewhere) => {
      if (cancelled || !elsewhere) return;
      setElsewhereNotice({
        deviceId: elsewhere.deviceId,
        deviceLabel: elsewhere.deviceLabel,
        at: elsewhere.at,
        hasUnsavedPromo: elsewhere.hasUnsavedPromo,
        hasUnsavedAnnouncement: elsewhere.hasUnsavedAnnouncement,
      });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const dismissElsewhere = () => {
    if (elsewhereNotice) markElsewhereSeen(elsewhereNotice.deviceId, elsewhereNotice.at);
    setElsewhereNotice(null);
  };

  return {
    askNotifications,
    setAskNotifications,
    elsewhereNotice,
    setElsewhereNotice,
    dismissElsewhere,
  };
}
