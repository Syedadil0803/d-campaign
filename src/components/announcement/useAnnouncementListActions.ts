'use client';

import { useEffect, type RefObject } from 'react';
import { CampaignConfig, defaultConfig } from '@/types/campaign';
import type { ToastAction } from '@/components/shared/Toast';
import type { useToast } from '@/hooks/useToast';

interface UseAnnouncementListActionsArgs {
  config: CampaignConfig;
  setConfig: (config: CampaignConfig) => void;
  markChanged: () => void;
  /** Latest config, for handlers that outlive the render they were made in. */
  configRef: RefObject<CampaignConfig>;
  selectedIndex: number | null;
  setSelectedIndex: (index: number | null) => void;
  selectedIndexRef: RefObject<number | null>;
  clearSelection: () => void;
  commitHistory: () => void;
  toast: ReturnType<typeof useToast>['toast'];
}

type AnnouncementList = CampaignConfig['announcementBar']['announcements'];

/**
 * Changes made to the published list itself: delete (button or the Delete
 * key), reorder, and Start fresh. Every one of them offers the same Undo, so
 * they share undoListAction rather than each restoring the list its own way.
 *
 * Holds the Delete-key listener, so it must be called where that effect used
 * to sit in AnnouncementSection to keep the effect order unchanged.
 */
export function useAnnouncementListActions({
  config,
  setConfig,
  markChanged,
  configRef,
  selectedIndex,
  setSelectedIndex,
  selectedIndexRef,
  clearSelection,
  commitHistory,
  toast,
}: UseAnnouncementListActionsArgs) {
  function undoListAction(previous: AnnouncementList): ToastAction {
    return {
      label: 'Undo',
      onClick: () => {
        setConfig({
          ...configRef.current,
          announcementBar: {
            ...configRef.current.announcementBar,
            announcements: previous,
          },
        });
        clearSelection();
        markChanged();
      },
    };
  }

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const idx = selectedIndexRef.current;
      if (idx === null) return;
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const target = e.target as HTMLElement;
        const tag = target.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable) return;
        e.preventDefault();
        const currentConfig = configRef.current;
        const previous = [...currentConfig.announcementBar.announcements];
        const updated = currentConfig.announcementBar.announcements.filter((_, i) => i !== idx);
        setConfig({
          ...currentConfig,
          announcementBar: { ...currentConfig.announcementBar, announcements: updated },
        });
        clearSelection();
        markChanged();
        toast('Announcement deleted', false, undoListAction(previous));
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the Delete-key listener is attached once on mount and reads the selection and config via refs; listing the handlers would re-subscribe every render
  }, []);

  function removeAnnouncement(index: number) {
    const previous = [...config.announcementBar.announcements];
    const updated = config.announcementBar.announcements.filter((_, currentIndex) => currentIndex !== index);
    setConfig({
      ...config,
      announcementBar: {
        ...config.announcementBar,
        announcements: updated,
      },
    });

    if (selectedIndex === index) {
      clearSelection();
    } else if (selectedIndex !== null && selectedIndex > index) {
      setSelectedIndex(selectedIndex - 1);
    }

    markChanged();
    toast('Announcement deleted', false, undoListAction(previous));
  }

  function startFresh() {
    const previousBar = JSON.parse(
      JSON.stringify(config.announcementBar),
    ) as CampaignConfig['announcementBar'];
    setConfig({
      ...config,
      announcementBar: {
        ...config.announcementBar,
        announcements: [],
        loop: false,
        startDate: '',
        endDate: '',
        activeThemeId: undefined,
        style: JSON.parse(JSON.stringify(defaultConfig.announcementBar.style)),
      },
    });
    clearSelection();
    commitHistory();
    markChanged();
    toast('Started fresh — messages and styling reset to defaults', false, {
      label: 'Undo',
      onClick: () => {
        setConfig({ ...configRef.current, announcementBar: previousBar });
        clearSelection();
        markChanged();
      },
    });
  }

  function reorderAnnouncements(fromIndex: number, toIndex: number) {
    const previous = [...config.announcementBar.announcements];
    const updated = [...config.announcementBar.announcements];
    const [movedAnnouncement] = updated.splice(fromIndex, 1);
    updated.splice(toIndex, 0, movedAnnouncement);
    const currentSelectedIndex = selectedIndex;

    setConfig({
      ...config,
      announcementBar: {
        ...config.announcementBar,
        announcements: updated,
      },
    });

    if (currentSelectedIndex === fromIndex) {
      setSelectedIndex(toIndex);
    } else if (currentSelectedIndex !== null && fromIndex < currentSelectedIndex && currentSelectedIndex <= toIndex) {
      setSelectedIndex(currentSelectedIndex - 1);
    } else if (currentSelectedIndex !== null && toIndex <= currentSelectedIndex && currentSelectedIndex < fromIndex) {
      setSelectedIndex(currentSelectedIndex + 1);
    }
    markChanged();
    toast('Order changed', false, undoListAction(previous));
  }

  return { removeAnnouncement, startFresh, reorderAnnouncements };
}
