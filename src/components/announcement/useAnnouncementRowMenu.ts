'use client';

import { useEffect, useRef, useState } from 'react';

interface UseAnnouncementRowMenuArgs {
  setShowLinkPopup: (show: boolean) => void;
  setShowSchedulePopup: (show: boolean) => void;
  selectAnnouncement: (index: number) => void;
  removeAnnouncement: (index: number) => void;
}

/**
 * The per-row "⋮" menu in the message list.
 *
 * Four inputs for eleven members. Everything it holds — which row is open,
 * where the menu sits, and the grace timer that keeps it open while the
 * pointer crosses the gap between button and menu — belongs to it alone.
 *
 * Every route out of the menu closes it the same way, so the close is one
 * function rather than the pair of setters repeated at each of the four exits.
 */
export function useAnnouncementRowMenu({
  setShowLinkPopup,
  setShowSchedulePopup,
  selectAnnouncement,
  removeAnnouncement,
}: UseAnnouncementRowMenuArgs) {
  const [actionMenuIndex, setActionMenuIndex] = useState<number | null>(null);
  const [actionMenuPos, setActionMenuPos] = useState<{ top: number; left: number } | null>(null);
  const actionMenuTimer = useRef<number | null>(null);
  const actionMenuRef = useRef<HTMLDivElement>(null);

  function closeActionMenu() {
    setActionMenuIndex(null);
    setActionMenuPos(null);
  }

  /**
   * A grace period, not a delay for its own sake: the menu sits eight pixels
   * away from its button, so a pointer travelling between the two leaves both
   * for a moment and would otherwise dismiss the menu on the way.
   */
  function scheduleCloseActionMenu() {
    actionMenuTimer.current = window.setTimeout(closeActionMenu, 150);
  }

  function cancelCloseActionMenu() {
    if (actionMenuTimer.current) {
      window.clearTimeout(actionMenuTimer.current);
      actionMenuTimer.current = null;
    }
  }

  function openActionMenu(index: number, button: HTMLButtonElement) {
    const rect = button.getBoundingClientRect();
    setActionMenuIndex(index);
    setActionMenuPos({
      top: rect.top + window.scrollY,
      left: rect.right + window.scrollX + 8,
    });
    setShowLinkPopup(false);
    setShowSchedulePopup(false);
  }

  function openMenuAction(index: number, type: 'link' | 'schedule') {
    selectAnnouncement(index);
    setShowLinkPopup(type === 'link');
    setShowSchedulePopup(type === 'schedule');
    closeActionMenu();
  }

  function handleMenuAddLink(index: number) {
    openMenuAction(index, 'link');
  }

  function handleMenuSchedule(index: number) {
    openMenuAction(index, 'schedule');
  }

  function handleMenuDelete(index: number) {
    removeAnnouncement(index);
    closeActionMenu();
  }

  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (actionMenuIndex !== null && actionMenuRef.current && !actionMenuRef.current.contains(target)) {
        closeActionMenu();
      }
    };
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
     
  }, [actionMenuIndex]);

  // The grace timer must not outlive the section, or it fires into an
  // unmounted component.
  useEffect(() => () => cancelCloseActionMenu(), []);

  return {
    actionMenuIndex,
    actionMenuPos,
    actionMenuRef,
    openActionMenu,
    scheduleCloseActionMenu,
    cancelCloseActionMenu,
    handleMenuAddLink,
    handleMenuSchedule,
    handleMenuDelete,
  };
}
