'use client';

import { useEffect, useRef, useState } from 'react';
import {
  readRecoveryEnvelope,
  addDebugLog,
  getSelectedAnnouncementIndex,
} from '@/lib/recovery';

/**
 * The announcement's half-typed message, and putting it back after a crash.
 *
 * Lifted out of the page whole: a ref, two flags and the mount effect that
 * fills them, none of which reads anything else on the page. Called where the
 * effect used to sit, so it still runs before every other effect the page
 * declares after it.
 */
export function useComposeTextRecovery() {
  // Survives AnnouncementSection unmounting on a tab switch — see the prop's
  // doc comment on AnnouncementSectionProps for why this can't just live
  // inside that component.
  const announcementComposeTextRef = useRef('');

  // Restore recovered compose text on first mount
  const hasRestoredRecoveryRef = useRef(false);
  const [announcementComposeTextRecovered, setAnnouncementComposeTextRecovered] = useState(false);
  const [recoveredSelectedAnnouncementIndex, setRecoveredSelectedAnnouncementIndex] = useState<number | null>(null);

  useEffect(() => {
    if (hasRestoredRecoveryRef.current) return;
    hasRestoredRecoveryRef.current = true;

    const recovery = readRecoveryEnvelope();
    const savedSelectedIndex = getSelectedAnnouncementIndex();

    if (recovery?.announcementComposeText) {
      const debugData = {
        textLength: recovery.announcementComposeText.length,
        textPreview: recovery.announcementComposeText.substring(0, 50),
        selectedIndex: savedSelectedIndex,
      };
      console.log('[RECOVERY] Direct restore on mount:', debugData);
      addDebugLog('page.tsx', 'Restoring compose text directly on mount', debugData);
      announcementComposeTextRef.current = recovery.announcementComposeText;
      setAnnouncementComposeTextRecovered(true);
      if (savedSelectedIndex !== null) {
        setRecoveredSelectedAnnouncementIndex(savedSelectedIndex);
      }
    } else {
      addDebugLog('page.tsx', 'No compose text in recovery on mount', {});
    }
  }, []);

  return {
    announcementComposeTextRef,
    announcementComposeTextRecovered,
    setAnnouncementComposeTextRecovered,
    recoveredSelectedAnnouncementIndex,
    setRecoveredSelectedAnnouncementIndex,
  };
}
