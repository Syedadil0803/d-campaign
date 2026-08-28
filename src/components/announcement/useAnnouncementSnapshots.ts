'use client';

import { useRef, type RefObject } from 'react';
import type { CampaignConfig } from '@/types/campaign';
import type { EditorSnapshot, LinkSnapshot } from '@/lib/editor/historyManager';
import type { ActiveFormats } from '@/hooks/useRichTextEditor';
import { readFormatsFromHtml } from '@/lib/editor/readFormatsFromHtml';

interface UseAnnouncementSnapshotsArgs {
  config: CampaignConfig;
  setConfig: (config: CampaignConfig) => void;
  richEditorRef: RefObject<HTMLDivElement | null>;
  editorDefaultColor: string;
  setActiveFormats: (formats: ActiveFormats) => void;
  setNewAnnouncementText: (text: string) => void;
  selection: {
    selectedUrl: string;
    setSelectedUrl: (url: string) => void;
    selectedOpenInNewTab: boolean;
    setSelectedOpenInNewTab: (open: boolean) => void;
    selectedStartDate: string;
    setSelectedStartDate: (date: string) => void;
    selectedEndDate: string;
    setSelectedEndDate: (date: string) => void;
  };
}

/**
 * Reading and restoring the editor's undo/redo steps.
 *
 * A step is more than the text: it carries the bar's background and the
 * message's link and schedule, because those are edited from the same toolbar
 * and a Ctrl+Z that put back the words while leaving a colour behind would be
 * half an undo.
 *
 * The selection is taken as one object rather than eight arguments — it is
 * already a group, and listing its members here would only restate the shape
 * useAnnouncementSelection already defines.
 *
 * Owns restoringSnapshotRef, the guard that stops a restore being recorded as
 * a fresh edit; it exists for nothing else.
 */
export function useAnnouncementSnapshots({
  config,
  setConfig,
  richEditorRef,
  editorDefaultColor,
  setActiveFormats,
  setNewAnnouncementText,
  selection,
}: UseAnnouncementSnapshotsArgs) {
  const restoringSnapshotRef = useRef(false);

  function getEditorSnapshot(): EditorSnapshot {
    const bg = config.announcementBar.style.background;
    return {
      html: richEditorRef.current?.innerHTML || '',
      bgType: bg.type || 'solid',
      bgStartColor: bg.startColor || '',
      bgEndColor: bg.endColor || '',
      bgDirection: bg.direction || 'to right',
      bgMidpoint: bg.midpoint ?? 50,
      link: selection.selectedUrl,
      openInNewTab: selection.selectedOpenInNewTab,
      startDate: selection.selectedStartDate,
      endDate: selection.selectedEndDate,
    };
  }

  function applyEditorSnapshot(snapshot: EditorSnapshot) {
    restoringSnapshotRef.current = true;
    // Restore editor HTML
    if (richEditorRef.current) {
      richEditorRef.current.innerHTML = snapshot.html;
      // Place cursor inside the deepest last node (so typing inherits styles)
      const sel = window.getSelection();
      if (sel) {
        sel.removeAllRanges();
        const range = document.createRange();
        let lastNode: Node = richEditorRef.current;
        while (lastNode.lastChild) lastNode = lastNode.lastChild;
        if (lastNode.nodeType === Node.TEXT_NODE) {
          range.setStart(lastNode, lastNode.textContent?.length || 0);
          range.collapse(true);
        } else {
          range.selectNodeContents(richEditorRef.current);
          range.collapse(false);
        }
        sel.addRange(range);
      }
    }
    setNewAnnouncementText(snapshot.html);
    // Restore formats from the HTML (source of truth)
    setActiveFormats(
      snapshot.html
        ? readFormatsFromHtml(snapshot.html, editorDefaultColor)
        : { bold: false, italic: false, size: 'md', color: editorDefaultColor },
    );
    // Restore background
    setConfig({
      ...config,
      announcementBar: {
        ...config.announcementBar,
        style: {
          ...config.announcementBar.style,
          background: {
            ...config.announcementBar.style.background,
            type: snapshot.bgType as CampaignConfig['announcementBar']['style']['background']['type'],
            startColor: snapshot.bgStartColor,
            endColor: snapshot.bgEndColor,
            direction: snapshot.bgDirection,
            midpoint: snapshot.bgMidpoint,
          },
        },
      },
    });
    // Restore link/schedule
    selection.setSelectedUrl(snapshot.link);
    selection.setSelectedOpenInNewTab(snapshot.openInNewTab);
    selection.setSelectedStartDate(snapshot.startDate);
    selection.setSelectedEndDate(snapshot.endDate);
    // Allow next tick to complete before re-enabling history
    setTimeout(() => { restoringSnapshotRef.current = false; }, 0);
  }

  function getLinkSnapshot(): LinkSnapshot {
    return { link: selection.selectedUrl, openInNewTab: selection.selectedOpenInNewTab };
  }

  function applyLinkSnapshot(snapshot: LinkSnapshot) {
    selection.setSelectedUrl(snapshot.link);
    selection.setSelectedOpenInNewTab(snapshot.openInNewTab);
  }

  return {
    restoringSnapshotRef,
    getEditorSnapshot,
    applyEditorSnapshot,
    getLinkSnapshot,
    applyLinkSnapshot,
  };
}
