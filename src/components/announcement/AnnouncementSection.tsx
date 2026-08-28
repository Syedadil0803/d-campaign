'use client';

import { useState, useRef, useEffect } from 'react';
import { isInvalidRange } from '@/lib/dateRange';
import { CampaignConfig, GradientStyle, defaultConfig } from '@/types/campaign';
import { stripHtml } from '@/lib/utils';
import { useRichTextEditor } from '@/hooks/useRichTextEditor';
import { rgbToHex, fontSizeToLabel } from '@/lib/editor/richTextUtils';
import { Toast, TOAST_ACTION_MS, type ToastAction } from '@/components/shared/Toast';
import { useAnnouncementStyleDropdowns } from '@/components/announcement/useAnnouncementStyleDropdowns';
import { useAnnouncementPopups } from '@/components/announcement/useAnnouncementPopups';
import { useAnnouncementSelection } from '@/components/announcement/useAnnouncementSelection';
import { useAnnouncementRowMenu } from '@/components/announcement/useAnnouncementRowMenu';
import { AnnouncementEditorPanel } from '@/components/announcement/AnnouncementEditorPanel';
import {
    AnnouncementEditorProvider,
  type AnnouncementEditorApi,
} from '@/components/announcement/AnnouncementEditorContext';
import { whatsAppUrl } from '@/lib/whatsapp';
import { useEditorHistory } from '@/hooks/useEditorHistory';
import { EditorSnapshot, LinkSnapshot } from '@/lib/editor/historyManager';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { AnnouncementHeader } from '@/components/announcement/AnnouncementHeader';
import { AnnouncementPreview } from '@/components/announcement/AnnouncementPreview';
import { AnnouncementListPanel } from '@/components/announcement/AnnouncementListPanel';
import {
    matchAnnouncementTheme,
  type AnnouncementTheme,
} from '@/lib/announcement/announcementThemes';

interface AnnouncementSectionProps {
  config: CampaignConfig;
  setConfig: (config: CampaignConfig) => void;
  markChanged: () => void;
  // "Go on air" is a one-click reactivation, only allowed when the current
  // content matches what's already published (same content, not new/edited).
  canReactivate: boolean;
  // Immediate on/off (no Save → Publish) — the page persists the status change.
  onStop: () => void;
  onGoOnAir: () => void;
}

function getThemeOnSurfaceHex(): string {
  if (typeof window === 'undefined') return '#000000';
  const raw = getComputedStyle(document.documentElement).getPropertyValue('--on-surface').trim();
  if (!raw) return '#000000';
  const [r, g, b] = raw.split(/\s+/).map(Number);
  if ([r, g, b].some((v) => Number.isNaN(v))) return '#000000';
  return rgbToHex(`rgb(${r}, ${g}, ${b})`);
}

export function AnnouncementSection({ config, setConfig, markChanged, canReactivate, onStop, onGoOnAir }: AnnouncementSectionProps) {
  const [newAnnouncementText, setNewAnnouncementText] = useState('');
  // Declared up here because useAnnouncementSelection takes it.
  const richEditorRef = useRef<HTMLDivElement>(null);

  const [showShortcutsTip, setShowShortcutsTip] = useState(false);
  const shortcutsTipShown = useRef(false);
  // Nothing reads this — only the setter is called. Left in place because
  // removing it means deciding whether the toolbar toggle was ever finished.
  const [, setShowRichToolbar] = useState(true);
  const [loopCopies, setLoopCopies] = useState(1);

  /**
   * List actions (delete, reorder, clear, start fresh) are recovered by a
   * one-tap Undo in their own toast, not by history buttons on screen.
   *
   * There used to be an Undo/Redo pair in the list header backed by a 30-deep
   * stack. A visible history control is the main thing that makes a tool feel
   * like a document editor, and it made recovery a thing you had to go and
   * find — the toast puts it where the mistake just happened.
   */
  type AnnouncementList = CampaignConfig['announcementBar']['announcements'];

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

  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  // Popup state
  const [showStopConfirm, setShowStopConfirm] = useState(false);
  const [showGoOnAirConfirm, setShowGoOnAirConfirm] = useState(false);
  // Overflow (•••) menu + its "Start fresh" full-reset confirmation.
  const [showResetMenu, setShowResetMenu] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const resetMenuRef = useRef<HTMLDivElement>(null);
  // WhatsApp destination for the selected message: the same picker the promo
  // card uses, so a number typed here behaves the same way there.
  const styleDropdowns = useAnnouncementStyleDropdowns();
  const {
  } = styleDropdowns;
  /**
   * Filled in below, once the popups hook exists.
   *
   * The two hooks need each other — the popups take the selection's dates so
   * the schedule popup can refuse to close on an invalid range, and clearing
   * the selection has to shut both popups. One of them has to be built first,
   * so the later half is reached through a ref. Event-time only: nothing reads
   * it during a render.
   */
  const closeToolbarPopupsRef = useRef<(() => void) | null>(null);
  const selection = useAnnouncementSelection({
    config,
    setNewAnnouncementText,
    setShowRichToolbar,
    richEditorRef,
    detectFormatsForSelectMode,
    closeToolbarPopupsRef,
  });
  const {
    selectedIndex,
    setSelectedIndex,
    selectedUrl,
    setSelectedUrl,
    selectedOpenInNewTab,
    setSelectedOpenInNewTab,
    selectedStartDate,
    setSelectedStartDate,
    selectedEndDate,
    setSelectedEndDate,
    selectedCtaType,
    selectedWhatsappNumber,
    selectedCountryCode,
    selectedIndexRef,
    clearSelection,
    loadAnnouncementIntoSelection,
    selectAnnouncement,
  } = selection;
  const popups = useAnnouncementPopups({ selectedStartDate, selectedEndDate });
  const {
    showLinkPopup,
    setShowLinkPopup,
    setShowSchedulePopup,
  } = popups;
  closeToolbarPopupsRef.current = () => {
    setShowLinkPopup(false);
    setShowSchedulePopup(false);
  };

  const rowMenu = useAnnouncementRowMenu({
    setShowLinkPopup,
    setShowSchedulePopup,
    selectAnnouncement,
    // Declared below as a function statement, so it is hoisted and available
    // here — it needs the toast and the history, which are built after this.
    removeAnnouncement,
  });
  const {
    openActionMenu,
    scheduleCloseActionMenu,
    cancelCloseActionMenu,
  } = rowMenu;


  const scrollContainerRef = useRef<HTMLDivElement>(null);
  selectedIndexRef.current = selectedIndex;
  const configRef = useRef(config);
  configRef.current = config;
  // Always-current invalid flag for close handlers registered with [] deps
  // (the Escape listener) that would otherwise read a stale value.
  const scheduleRangeInvalidRef = useRef(false);

  const [editorDefaultColor, setEditorDefaultColor] = useState('#1a1c1f');

  const richText = useRichTextEditor(richEditorRef, { defaultColor: editorDefaultColor });
  const {
    activeFormats,
    setActiveFormats,
    detectFormats,
    saveSelection,
    getNormalizedHTML,
  } = richText;

  // Editor history (undo/redo)
  const history = useEditorHistory();
  const {
    pushImmediateState,
    undoEditor, redoEditor, undoLink, redoLink,
    commit: commitHistory,
  } = history;

  // Snapshot helpers
  function getEditorSnapshot(): EditorSnapshot {
    const bg = config.announcementBar.style.background;
    return {
      html: richEditorRef.current?.innerHTML || '',
      bgType: bg.type || 'solid',
      bgStartColor: bg.startColor || '',
      bgEndColor: bg.endColor || '',
      bgDirection: bg.direction || 'to right',
      bgMidpoint: bg.midpoint ?? 50,
      link: selectedUrl,
      openInNewTab: selectedOpenInNewTab,
      startDate: selectedStartDate,
      endDate: selectedEndDate,
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
    if (snapshot.html) {
      detectFormatsForSelectMode(snapshot.html);
    } else {
      setActiveFormats({ bold: false, italic: false, size: 'md', color: editorDefaultColor });
    }
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
    setSelectedUrl(snapshot.link);
    setSelectedOpenInNewTab(snapshot.openInNewTab);
    setSelectedStartDate(snapshot.startDate);
    setSelectedEndDate(snapshot.endDate);
    // Allow next tick to complete before re-enabling history
    setTimeout(() => { restoringSnapshotRef.current = false; }, 0);
  }

  function getLinkSnapshot(): LinkSnapshot {
    return { link: selectedUrl, openInNewTab: selectedOpenInNewTab };
  }

  function applyLinkSnapshot(snapshot: LinkSnapshot) {
    setSelectedUrl(snapshot.link);
    setSelectedOpenInNewTab(snapshot.openInNewTab);
  }

  // Toast state
  const [toast, setToast] = useState<{
    show: boolean;
    message: string;
    isError: boolean;
    action: ToastAction | null;
  }>({ show: false, message: '', isError: false, action: null });
  const toastTimerRef = useRef<number | null>(null);

  function hideToast() {
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
      toastTimerRef.current = null;
    }
    setToast({ show: false, message: '', isError: false, action: null });
  }

  /**
   * `action` turns the toast into a one-tap recovery offer. It gets a longer
   * life than a plain confirmation — long enough to read and reach, still short
   * enough that the offer clearly expires with the toast.
   */
  function showToast(
    message: string,
    isError = false,
    duration = 2500,
    action?: ToastAction,
  ) {
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
      toastTimerRef.current = null;
    }
    setToast({
      show: true,
    message,
    isError,
      action: action
        ? {
            label: action.label,
            onClick: () => {
              hideToast();
              action.onClick();
            },
          }
        : null,
    });
    toastTimerRef.current = window.setTimeout(
    hideToast,
      action ? TOAST_ACTION_MS : duration,
    ) as unknown as number;
  }

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    };
  }, []);

  useEffect(() => {
    const color = getThemeOnSurfaceHex();
    setEditorDefaultColor(color);
    setActiveFormats(prev => prev.color === '#1a1c1f' || prev.color === '#000000' ? { ...prev, color } : prev);

    const root = document.documentElement;
    const observer = new MutationObserver(() => {
      const newColor = getThemeOnSurfaceHex();
      setEditorDefaultColor(newColor);
      setActiveFormats(prev => prev.color === '#1a1c1f' || prev.color === '#000000' ? { ...prev, color: newColor } : prev);
    });
    observer.observe(root, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
    // setActiveFormats is a useState setter, so React guarantees its identity
    // never changes. Naming it satisfies the rule and cannot cause this
    // observer to be torn down and rebuilt.
  }, [setActiveFormats]);

  // Marquee layout: calculate copies for loop mode, or set min-width for non-loop
  // Also dynamically compute --scroll-duration so speed (px/s) stays constant
  const SCROLL_SPEED_PX_PER_SEC = 60; // constant visual speed regardless of content length

  useEffect(() => {
    // Preview loops in both states — don't gate the marquee calc on active.
    if (!scrollContainerRef.current) return;
    const container = scrollContainerRef.current;
    const containerWidth = container.clientWidth;
    if (containerWidth <= 0) return;

    const isLoopOn = config.announcementBar.loop !== false;

    if (isLoopOn) {
      // Loop ON: figure out how many copies of the announcement set fill the container
      const track = container.querySelector('.animate-scroll-left') as HTMLElement;
      if (!track) return;
      // Track has loopCopies * 2 total copies. One visual half = loopCopies copies.
      const halfWidth = track.scrollWidth / 2;
      if (halfWidth <= 0) return;
      const oneSetWidth = halfWidth / loopCopies; // width of one announcement set
      if (oneSetWidth <= 0) return;
      const needed = Math.max(1, Math.ceil(containerWidth / oneSetWidth));
      if (needed !== loopCopies) {
        setLoopCopies(needed);
      }

      // Set duration proportional to content width so speed stays constant.
      // The animation moves translateX(-50%) = halfWidth pixels.
      // duration = halfWidth / speed  →  longer content = longer duration = same speed.
      const duration = Math.max(5, halfWidth / SCROLL_SPEED_PX_PER_SEC);
      track.style.setProperty('--scroll-duration', `${duration.toFixed(1)}s`);
    } else {
      // Loop OFF: set min-width so duplicate stays off-screen
      container.style.setProperty('--set-min-width', `${containerWidth}px`);
      setLoopCopies(1);

      // Also compute duration for non-loop mode based on full track width
      const track = container.querySelector('.animate-scroll-left') as HTMLElement;
      if (track) {
        const halfWidth = track.scrollWidth / 2;
        const duration = Math.max(5, halfWidth / SCROLL_SPEED_PX_PER_SEC);
        track.style.setProperty('--scroll-duration', `${duration.toFixed(1)}s`);
      }
    }
  }, [config.announcementBar.announcements, config.announcementBar.active, config.announcementBar.loop, loopCopies]);

  // Delete selected announcement on Delete/Backspace key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const idx = selectedIndexRef.current;
      if (idx === null) return;
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const target = e.target as HTMLElement;
        const tag = target.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable) return;
        e.preventDefault();
        // Remove from config
        const currentConfig = configRef.current;
        const previous = [...currentConfig.announcementBar.announcements];
        const updated = currentConfig.announcementBar.announcements.filter((_, i) => i !== idx);
        setConfig({
          ...currentConfig,
          announcementBar: { ...currentConfig.announcementBar, announcements: updated },
        });
        clearSelection();
        markChanged();
        showToast('Announcement deleted', false, 2500, undoListAction(previous));
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Click outside to close both popups



  function addAnnouncement() {
    // Adding or updating takes nothing away, so there's nothing to offer back.
    commitHistory(); // The editor moves on — its step history goes with it.
    const html = getNormalizedHTML();
    const updated = [...config.announcementBar.announcements];
    // The destination as the popup currently has it. Add/Update rebuild the
    // whole entry, so without this a WhatsApp number was dropped on the way
    // in — the entry got the (empty) plain-link URL and rendered unlinked.
    const destination =
      selectedCtaType === 'whatsapp'
        ? {
            ctaType: 'whatsapp' as const,
            url: whatsAppUrl(selectedCountryCode, selectedWhatsappNumber) || undefined,
            whatsappNumber: selectedWhatsappNumber || undefined,
            whatsappCountryCode: selectedCountryCode,
          }
        : {
            ctaType: undefined,
            url: selectedUrl || undefined,
            whatsappNumber: undefined,
            whatsappCountryCode: undefined,
          };

    if (selectedIndex !== null) {
      updated[selectedIndex] = {
        ...updated[selectedIndex],
        text: html,
        ...destination,
        openInNewTab: selectedOpenInNewTab || undefined,
        startDate: selectedStartDate || undefined,
        endDate: selectedEndDate || undefined,
        richText: true,
      };
    } else {
      updated.push({
        text: html,
        ...destination,
        openInNewTab: selectedOpenInNewTab || undefined,
        startDate: selectedStartDate || undefined,
        endDate: selectedEndDate || undefined,
        richText: true,
      });
    }

    setConfig({
      ...config,
      announcementBar: {
        ...config.announcementBar,
        announcements: updated,
      },
    });

    clearSelection();
    detectFormats();
    markChanged();
    showToast(selectedIndex !== null ? 'Announcement updated' : 'Announcement added');
  }

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
    showToast('Announcement deleted', false, 2500, undoListAction(previous));
  }

  // Empties the message list; recoverable from its toast.
  function clearAnnouncements() {
    if (config.announcementBar.announcements.length === 0) return;
    const previous = [...config.announcementBar.announcements];
    setConfig({
      ...config,
      announcementBar: {
        ...config.announcementBar,
        announcements: [],
      },
    });
    clearSelection();
    markChanged();
    showToast('All announcements cleared', false, 2500, undoListAction(previous));
  }

  // Full reset of the draft to defaults (messages + styling). Confirm-gated and
  // not undoable, so history is wiped to avoid a confusing partial undo. `active`
  // is left alone — live status is owned by Go on air / Stop.
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
        style: JSON.parse(JSON.stringify(defaultConfig.announcementBar.style)),
      },
    });
    clearSelection();
    commitHistory();
    markChanged();
    // A whole-bar wipe — styling included — so its Undo puts the whole bar
    // back, not just the messages.
    showToast('Started fresh — messages and styling reset to defaults', false, 2500, {
      label: 'Undo',
      onClick: () => {
        setConfig({ ...configRef.current, announcementBar: previousBar });
        clearSelection();
        markChanged();
      },
    });
  }

  // Close the ••• menu on any outside click.
  useEffect(() => {
    if (!showResetMenu) return;
    const onDown = (e: MouseEvent) => {
      if (resetMenuRef.current && !resetMenuRef.current.contains(e.target as Node)) {
        setShowResetMenu(false);
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [showResetMenu]);

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
    showToast('Order changed', false, 2500, undoListAction(previous));
  }

  // ── Undo/Redo keyboard shortcut (custom history, suppress native) ──
  const getEditorSnapshotRef = useRef(getEditorSnapshot);
  getEditorSnapshotRef.current = getEditorSnapshot;
  const applyEditorSnapshotRef = useRef(applyEditorSnapshot);
  applyEditorSnapshotRef.current = applyEditorSnapshot;
  const getLinkSnapshotRef = useRef(getLinkSnapshot);
  getLinkSnapshotRef.current = getLinkSnapshot;
  const applyLinkSnapshotRef = useRef(applyLinkSnapshot);
  applyLinkSnapshotRef.current = applyLinkSnapshot;
  const showLinkPopupRef = useRef(showLinkPopup);
  showLinkPopupRef.current = showLinkPopup;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMac = navigator.platform?.includes('Mac');
      const mod = isMac ? e.metaKey : e.ctrlKey;
      if (!mod) return;

      const isUndo = e.key.toLowerCase() === 'z' && !e.shiftKey;
      const isRedo = (e.key.toLowerCase() === 'z' && e.shiftKey) || e.key.toLowerCase() === 'y';
      if (!isUndo && !isRedo) return;

      const target = e.target as HTMLElement;
      const tag = target.tagName;

      // Link popup input focused → link stack
      if (tag === 'INPUT' && showLinkPopupRef.current) {
        e.preventDefault();
        if (isUndo) {
          const snapshot = undoLink(getLinkSnapshotRef.current());
          if (snapshot) applyLinkSnapshotRef.current(snapshot);
        } else {
          const snapshot = redoLink(getLinkSnapshot());
          if (snapshot) applyLinkSnapshotRef.current(snapshot);
        }
        return;
      }


      // Editor focused → already handled by inline onKeyDown on the contentEditable
      if (target.isContentEditable) {
        return;
      }

      // Nothing specific focused → editor stack
      e.preventDefault();
      if (isUndo) {
        const snapshot = undoEditor(getEditorSnapshotRef.current());
        if (snapshot) applyEditorSnapshotRef.current(snapshot);
      } else {
        const snapshot = redoEditor(getEditorSnapshot());
        if (snapshot) applyEditorSnapshotRef.current(snapshot);
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowLinkPopup(false);
        // Keep the schedule popup open while its date range is invalid.
        if (!scheduleRangeInvalidRef.current) setShowSchedulePopup(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);




  function detectFormatsForSelectMode(html: string) {
    const container = document.createElement('div');
    container.innerHTML = html;

    // Collect all text nodes with actual content
    const textNodes: Node[] = [];
    function findTextNodes(node: Node) {
      if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent?.replace(/\u200B/g, '').trim();
        if (text) textNodes.push(node);
      } else {
        node.childNodes.forEach(findTextNodes);
      }
    }
    findTextNodes(container);

    if (textNodes.length === 0) {
      setActiveFormats({ bold: false, italic: false, size: 'md', color: editorDefaultColor });
      return;
    }

    const sizes = new Set<string>();
    const colors = new Set<string>();
    let allBold = true;
    let allItalic = true;

    textNodes.forEach((textNode) => {
      let foundSize = false;
      let foundColor = false;
      let isBold = false;
      let isItalic = false;

      // Walk up from text node to find effective styles
      let node: HTMLElement | null = textNode.parentElement;
      while (node && node !== container) {
        if (!foundSize && node.style.fontSize) {
          const label = fontSizeToLabel(node.style.fontSize);
          if (label) { sizes.add(label); foundSize = true; }
        }
        if (!foundColor && node.style.color) {
          const c = node.style.color;
          colors.add(c.startsWith('rgb') ? rgbToHex(c) : c);
          foundColor = true;
        }
        const tag = node.tagName;
        if (tag === 'B' || tag === 'STRONG') isBold = true;
        if (tag === 'I' || tag === 'EM') isItalic = true;
        node = node.parentElement;
      }

      if (!isBold) allBold = false;
      if (!isItalic) allItalic = false;
    });

    setActiveFormats({
      bold: allBold,
      italic: allItalic,
      size: sizes.size === 1 ? [...sizes][0] : (sizes.size === 0 ? 'md' : ''),
      color: colors.size === 1 ? [...colors][0] : (colors.size === 0 ? editorDefaultColor : ''),
    });
  }

  // ── Apply format to entire content (selection mode) ──
  const applyingFormatRef = useRef(false);
  const restoringSnapshotRef = useRef(false);
  const activeFormatsRef = useRef(activeFormats);
  activeFormatsRef.current = activeFormats;
  const isDeletingRef = useRef(false);
  const linkDeletingRef = useRef(false);
  const justDeletedStyledRef = useRef(false);
  function applyFormatToAll(action: () => void) {
    if (!richEditorRef.current) return;
    const editor = richEditorRef.current;
    const hasContent = editor.textContent?.replace(/\u200B/g, '').trim();
    if (!hasContent) return;
    applyingFormatRef.current = true;
    const wasFocused = document.activeElement === editor;
    editor.focus();
    const sel = window.getSelection();
    if (sel) {
      sel.removeAllRanges();
      const range = document.createRange();
      range.selectNodeContents(editor);
      sel.addRange(range);
      saveSelection();
    }
    action();
    const html = getNormalizedHTML();
    setNewAnnouncementText(html);
    window.getSelection()?.removeAllRanges();
    if (!wasFocused) editor.blur();
    applyingFormatRef.current = false;
    // Update toolbar from the new DOM state
    detectFormatsForSelectMode(editor.innerHTML);
  }

  function closePopupAndFocusEditor() {
    setShowLinkPopup(false);
    setShowSchedulePopup(false);
    if (richEditorRef.current) {
      richEditorRef.current.focus();
      const range = document.createRange();
      range.selectNodeContents(richEditorRef.current);
      range.collapse(false);
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(range);
    }
  }

  // ── Rich text input handler ──
  function onRichTextInput() {
    if (applyingFormatRef.current) return;
    if (restoringSnapshotRef.current) return;
    const html = getNormalizedHTML();
    setNewAnnouncementText(html);
    // No history push here — handled by intention-based triggers on keyDown/focus/blur
  }

  // ── Style helpers ──
  // Update BG without pushing history (used for live updates like color picker drag)
  function updateBg(patch: Partial<GradientStyle>) {
    setConfig({
      ...config,
      announcementBar: {
        ...config.announcementBar,
        style: {
          ...config.announcementBar.style,
          background: { ...config.announcementBar.style.background, ...patch },
        },
      },
    });
    markChanged();
  }

  // Update BG WITH history push (used for discrete changes like type change, slider release)
  function updateBgWithHistory(patch: Partial<GradientStyle>) {
    pushImmediateState(getEditorSnapshot());
    updateBg(patch);
  }

  /**
   * Apply a ready-made look. Sets background AND text color together — they're
   * a pair, and the fine-grained controls below can still adjust either
   * afterwards.
   */
  function applyAnnouncementTheme(theme: AnnouncementTheme) {
    pushImmediateState(getEditorSnapshot());
    setConfig({
      ...config,
      announcementBar: {
        ...config.announcementBar,
        style: {
          ...config.announcementBar.style,
          background: { ...config.announcementBar.style.background, ...theme.background },
          textColor: theme.textColor,
        },
      },
    });
    markChanged();
  }

  // Status is immediate (no Save → Publish): stopping takes the campaign off,
  // and "Go on air" reactivates the SAME already-published content. The page
  // owns the actual persistence.
  function confirmStop() {
    setShowStopConfirm(false);
    onStop();
  }

  function confirmGoOnAir() {
    setShowGoOnAirConfirm(false);
    onGoOnAir();
  }

  function openChatGptWithPrompt() {
    const plainText = stripHtml(newAnnouncementText || richEditorRef.current?.innerHTML || '').trim() || 'your announcement';
    const prompt = [
      'Write 2-3 short, catchy website announcement banners.',
      'Keep it concise, friendly, and promotional.',
      'Include 1-2 relevant emojis.',
      `Base text: ${plainText}`,
    ].join('\n');

    const url = `https://chatgpt.com/?q=${encodeURIComponent(prompt)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  const bg = config.announcementBar.style.background;
  /** Highlights the theme chip the bar currently matches, if any. */
  const activeThemeId = matchAnnouncementTheme(bg, config.announcementBar.style.textColor);
  const [previewDirection, setPreviewDirection] = useState<string | null>(null);
  const previewBg = previewDirection ? { ...bg, direction: previewDirection } : bg;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Invalid schedule for the message being edited = both dates set and start is
  // after end. Mirrors the Promo schedule: calendars don't gray out the other
  // field; instead we show an inline error and block the popup's Done action.
  const scheduleRangeInvalid = isInvalidRange(selectedStartDate, selectedEndDate);
  scheduleRangeInvalidRef.current = scheduleRangeInvalid;

  const isAnnouncementInWindow = (startDate?: string, endDate?: string) => {
    if (!startDate && !endDate) return true;
    const start = startDate ? new Date(startDate) : new Date(0);
    start.setHours(0, 0, 0, 0);
    const end = endDate ? new Date(endDate) : new Date(8640000000000000);
    end.setHours(23, 59, 59, 999);
    return today >= start && today <= end;
  };

  const visibleAnnouncements = config.announcementBar.announcements.filter((ann) =>
    isAnnouncementInWindow(ann.startDate, ann.endDate)
  );




  /**
   * What the editor panel reads instead of taking props.
   *
   * The six hooks are spread whole rather than listed out, so adding to any of
   * them reaches the panel without a change here — and the context's type
   * inherits their shapes rather than restating them.
   */
  const editorApi: AnnouncementEditorApi = {
    ...styleDropdowns,
    ...popups,
    ...selection,
    ...rowMenu,
    ...richText,
    ...history,
    config,
    setConfig,
    markChanged,
    bg,
    previewBg,
    setPreviewDirection,
    updateBg,
    updateBgWithHistory,
    newAnnouncementText,
    richEditorRef,
    editorDefaultColor,
    scheduleRangeInvalid,
    setShowRichToolbar,
    setShowShortcutsTip,
    shortcutsTipShown,
    addAnnouncement,
    applyFormatToAll,
    onRichTextInput,
    openChatGptWithPrompt,
    closePopupAndFocusEditor,
    detectFormatsForSelectMode,
    getEditorSnapshot,
    applyEditorSnapshot,
    getLinkSnapshot,
    applyLinkSnapshot,
    applyingFormatRef,
    restoringSnapshotRef,
    isDeletingRef,
    linkDeletingRef,
    justDeletedStyledRef,
    activeFormatsRef,
  };

  return (
    <AnnouncementEditorProvider value={editorApi}>
    <section className="rounded-2xl border-border overflow-hidden">
      <Toast
        show={toast.show}
        message={toast.message}
        isError={toast.isError}
        action={toast.action}
        actionDurationMs={TOAST_ACTION_MS}
      />

      {/* Stop Announcement Confirmation — immediate (no save/publish needed) */}
      <ConfirmDialog
        open={showStopConfirm}
        title="Switch off this campaign?"
        confirmLabel="Yes, switch off"
        tone="danger"
        onCancel={() => setShowStopConfirm(false)}
        onConfirm={confirmStop}
      >
        <p className="mt-2 text-sm text-on-surface-variant">
          If you switch off the campaign, the entire campaign stops displaying on your website. Are you sure you want to do it?
        </p>
        <p className="mt-2 text-xs text-on-surface-variant/80">
          You can switch it back on anytime with <strong>Go on air</strong> — as long as the content hasn&apos;t changed. New content needs Save &amp; Publish.
        </p>
      </ConfirmDialog>

      {/* Go On Air Confirmation — reactivate the same published content */}
      <ConfirmDialog
        open={showGoOnAirConfirm}
        title="Go on air?"
        confirmLabel="Yes, go on air"
        onCancel={() => setShowGoOnAirConfirm(false)}
        onConfirm={confirmGoOnAir}
      >
        <p className="mt-2 text-sm text-on-surface-variant">
          This puts the same campaign back on your website right away — no need to save or publish again.
        </p>
      </ConfirmDialog>

      {/* Start Fresh Confirmation — full reset of the announcement draft */}
      {showResetConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0" onClick={() => setShowResetConfirm(false)} />
          <div className="relative z-10 w-full max-w-md rounded-xl border border-white/10 bg-black/10 p-5 text-on-surface shadow-2xl backdrop-blur-md">
            <h2 className="text-base font-semibold">Start fresh?</h2>
            <p className="mt-2 text-sm text-on-surface-variant">
              This clears all announcement messages and resets the colors, text size, loop, and timing back to their defaults.
            </p>
            <p className="mt-2 text-xs text-on-surface-variant/80">
              Only your draft changes — nothing on your live site changes until you Save &amp; Publish. This can&apos;t be recovered with Undo.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowResetConfirm(false)}
                className="rounded-md border border-white/10 bg-transparent px-4 py-2 text-sm font-medium text-on-surface-variant transition-colors hover:border-primary/70 hover:text-primary"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => { setShowResetConfirm(false); startFresh(); }}
                className="rounded-md bg-red-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-opacity hover:bg-red-600"
              >
                Yes, start fresh
              </button>
            </div>
          </div>
        </div>
      )}

      <AnnouncementHeader
        config={config}
        canReactivate={canReactivate}
        showResetMenu={showResetMenu}
        setShowResetMenu={setShowResetMenu}
        setShowStopConfirm={setShowStopConfirm}
        setShowGoOnAirConfirm={setShowGoOnAirConfirm}
        setShowResetConfirm={setShowResetConfirm}
        resetMenuRef={resetMenuRef}
      />

      <div className="space-y-8">
        <AnnouncementPreview
          config={config}
          previewBg={previewBg}
          visibleAnnouncements={visibleAnnouncements}
          loopCopies={loopCopies}
          scrollContainerRef={scrollContainerRef}
        />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-stretch">
          {/* Left: Input + Chips + Link */}
          <AnnouncementEditorPanel />

          <AnnouncementListPanel
            config={config}
            setConfig={setConfig}
            markChanged={markChanged}
            activeThemeId={activeThemeId}
            applyAnnouncementTheme={applyAnnouncementTheme}
            selectedIndex={selectedIndex}
            clearSelection={clearSelection}
            loadAnnouncementIntoSelection={loadAnnouncementIntoSelection}
            detectFormatsForSelectMode={detectFormatsForSelectMode}
            clearAnnouncements={clearAnnouncements}
            reorderAnnouncements={reorderAnnouncements}
            draggedIndex={draggedIndex}
            setDraggedIndex={setDraggedIndex}
            openActionMenu={openActionMenu}
            scheduleCloseActionMenu={scheduleCloseActionMenu}
            cancelCloseActionMenu={cancelCloseActionMenu}
            richEditorRef={richEditorRef}
          />
        </div>
      </div>
      {/* Emoji tip toast */}
      {showShortcutsTip && (
        <div className="fixed top-5 left-5 z-50 animate-bounce-in">
          <div className="bg-black/10 backdrop-blur-sm border border-white/10 rounded-2xl shadow-2xl px-5 py-4 w-[380px]">
            <p className="text-[13px] text-on-surface leading-relaxed">
              💡 You can also add emojis!<br />Press <kbd className="inline bg-primary/10 text-primary border border-primary/70 px-1.5 py-0.5 rounded text-[11px] font-mono font-medium whitespace-nowrap">{navigator.platform?.includes('Mac') ? '⌘ + Ctrl + Space' : 'Win + .'}</kbd> to open the emoji picker
            </p>
            <div className="flex items-center justify-end gap-4 mt-3">
              <button
                onClick={() => { setShowShortcutsTip(false); localStorage.setItem('ann_shortcuts_seen', 'never'); }}
                className="text-[11px] text-on-surface-variant hover:text-on-surface transition-colors"
              >
                Don&apos;t show again
              </button>
              <button
                onClick={() => setShowShortcutsTip(false)}
                className="text-[11px] font-medium text-primary hover:opacity-85 transition-colors"
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
    </AnnouncementEditorProvider>
  );
}
