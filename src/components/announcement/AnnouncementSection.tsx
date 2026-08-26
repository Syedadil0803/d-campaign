'use client';

import { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { Megaphone, MoreVertical, Sparkles, Radio, Infinity as InfinityIcon, MoveLeft, Trash2 } from 'lucide-react';
import { CampaignConfig, GradientStyle, defaultConfig } from '@/types/campaign';
import { getBackgroundStyle, stripHtml } from '@/lib/utils';
import { useRichTextEditor } from '@/hooks/useRichTextEditor';
import { wrapBareTextWithFontSize, rgbToHex, fontSizeToLabel } from '@/lib/richTextUtils';
import RichTextToolbar from '@/components/shared/RichTextToolbar';
import { Toast, TOAST_ACTION_MS, type ToastAction } from '@/components/shared/Toast';
import { formatDateLabel } from '@/lib/calendarDates';
import { InlineCalendar } from '@/components/announcement/InlineCalendar';
import { PopupDropdown } from '@/components/shared/PopupDropdown';
import { CountryFlag, COUNTRY_CODES } from '@/components/shared/CountryFlag';
import { whatsAppUrl, whatsAppLooksShort, maxNationalDigits } from '@/lib/whatsapp';
import { useEditorHistory } from '@/hooks/useEditorHistory';
import { EditorSnapshot, LinkSnapshot } from '@/lib/historyManager';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import {
  announcementThemes,
  matchAnnouncementTheme,
  themeBackgroundCss,
  type AnnouncementTheme,
} from '@/lib/announcementThemes';

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
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  const [selectedUrl, setSelectedUrl] = useState('');
  const [selectedOpenInNewTab, setSelectedOpenInNewTab] = useState(true);
  const [selectedStartDate, setSelectedStartDate] = useState('');
  const [selectedEndDate, setSelectedEndDate] = useState('');
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
  const [actionMenuIndex, setActionMenuIndex] = useState<number | null>(null);
  const [actionMenuPos, setActionMenuPos] = useState<{ top: number; left: number } | null>(null);
  const actionMenuTimer = useRef<number | null>(null);

  function scheduleCloseActionMenu() {
    actionMenuTimer.current = window.setTimeout(() => {
      setActionMenuIndex(null);
      setActionMenuPos(null);
    }, 150);
  }

  function cancelCloseActionMenu() {
    if (actionMenuTimer.current) {
      window.clearTimeout(actionMenuTimer.current);
      actionMenuTimer.current = null;
    }
  }

  // Popup state
  const [showStopConfirm, setShowStopConfirm] = useState(false);
  const [showGoOnAirConfirm, setShowGoOnAirConfirm] = useState(false);
  // Overflow (•••) menu + its "Start fresh" full-reset confirmation.
  const [showResetMenu, setShowResetMenu] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const resetMenuRef = useRef<HTMLDivElement>(null);
  const [showLinkPopup, setShowLinkPopup] = useState(false);
  // WhatsApp destination for the selected message: the same picker the promo
  // card uses, so a number typed here behaves the same way there.
  const [selectedCtaType, setSelectedCtaType] = useState<'link' | 'whatsapp'>('link');
  const [selectedWhatsappNumber, setSelectedWhatsappNumber] = useState('');
  const [selectedCountryCode, setSelectedCountryCode] = useState('+44');
  const [showAnnCountryDropdown, setShowAnnCountryDropdown] = useState(false);
  const [annCountryPos, setAnnCountryPos] = useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);
  const annCountryBtnRef = useRef<HTMLButtonElement>(null);
  const annCountryMenuRef = useRef<HTMLDivElement>(null);
  const [showSchedulePopup, setShowSchedulePopup] = useState(false);
  const [showStartDateCalendar, setShowStartDateCalendar] = useState(false);
  const [showEndDateCalendar, setShowEndDateCalendar] = useState(false);
  const [startDateView, setStartDateView] = useState<Date>(new Date());
  const [endDateView, setEndDateView] = useState<Date>(new Date());
  const [linkPos, setLinkPos] = useState<{ top: number; left: number } | null>(null);
  const [schedulePos, setSchedulePos] = useState<{ top: number; left: number } | null>(null);
  const [showBackgroundTypeDropdown, setShowBackgroundTypeDropdown] = useState(false);
  const [showDirectionDropdown, setShowDirectionDropdown] = useState(false);
  const [backgroundTypePos, setBackgroundTypePos] = useState<{ top: number; left: number; width: number } | null>(null);
  const [directionPos, setDirectionPos] = useState<{ top: number; left: number; width: number } | null>(null);

  const richEditorRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const selectedIndexRef = useRef<number | null>(null);
  selectedIndexRef.current = selectedIndex;
  const configRef = useRef(config);
  configRef.current = config;
  const linkBtnRef = useRef<HTMLButtonElement>(null);
  const scheduleBtnRef = useRef<HTMLButtonElement>(null);
  const linkPopupRef = useRef<HTMLDivElement>(null);
  const schedulePopupRef = useRef<HTMLDivElement>(null);
  const startDateCalendarRef = useRef<HTMLDivElement>(null);
  const endDateCalendarRef = useRef<HTMLDivElement>(null);
  // Always-current invalid flag for close handlers registered with [] deps
  // (the Escape listener) that would otherwise read a stale value.
  const scheduleRangeInvalidRef = useRef(false);
  const actionMenuRef = useRef<HTMLDivElement>(null);
  const backgroundTypeBtnRef = useRef<HTMLButtonElement>(null);
  const backgroundTypeMenuRef = useRef<HTMLDivElement>(null);
  const directionBtnRef = useRef<HTMLButtonElement>(null);
  const directionMenuRef = useRef<HTMLDivElement>(null);

  const [editorDefaultColor, setEditorDefaultColor] = useState('#1a1c1f');

  const {
    activeFormats,
    setActiveFormats,
    formatText,
    applyColor,
    detectFormats,
    ensureDefaultFontSize,
    saveSelection,
    getNormalizedHTML,
  } = useRichTextEditor(richEditorRef, { defaultColor: editorDefaultColor });

  // Editor history (undo/redo)
  const {
    pushImmediateState, pushTypingState, pushLinkState,
    undoEditor, redoEditor, undoLink, redoLink,
    commit: commitHistory,
  } = useEditorHistory();

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

  // Position link popup below its button
  useLayoutEffect(() => {
    if (showLinkPopup && linkBtnRef.current) {
      const rect = linkBtnRef.current.getBoundingClientRect();
      setLinkPos({ top: rect.bottom + window.scrollY + 4, left: rect.left + window.scrollX });
    }
  }, [showLinkPopup]);

  // Position schedule popup below its button
  useLayoutEffect(() => {
    if (showSchedulePopup && scheduleBtnRef.current) {
      const rect = scheduleBtnRef.current.getBoundingClientRect();
      setSchedulePos({ top: rect.bottom + window.scrollY + 4, left: rect.left + window.scrollX });
    }
  }, [showSchedulePopup]);

  useLayoutEffect(() => {
    if (showBackgroundTypeDropdown && backgroundTypeBtnRef.current) {
      const rect = backgroundTypeBtnRef.current.getBoundingClientRect();
      setBackgroundTypePos({ top: rect.bottom + 6, left: rect.left, width: rect.width });
    }
  }, [showBackgroundTypeDropdown]);

  useLayoutEffect(() => {
    if (showDirectionDropdown && directionBtnRef.current) {
      const rect = directionBtnRef.current.getBoundingClientRect();
      const menuWidth = 180;
      const menuHeight = 320;
      const spaceRight = window.innerWidth - rect.right;
      const left = spaceRight >= menuWidth + 10 ? rect.right + 6 : rect.left - menuWidth - 6;
      // Offset: increase this value to move menu down, decrease to move up
      const verticalOffset = 80;
      const top = rect.bottom - menuHeight + verticalOffset;
      setDirectionPos({ top, left, width: menuWidth });
    }
  }, [showDirectionDropdown]);

  useEffect(() => {
    if (showSchedulePopup) return;
    setShowStartDateCalendar(false);
    setShowEndDateCalendar(false);
  }, [showSchedulePopup]);

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
  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        showLinkPopup &&
        linkPopupRef.current && !linkPopupRef.current.contains(target) &&
        linkBtnRef.current && !linkBtnRef.current.contains(target)
      ) {
        setShowLinkPopup(false);
      }
      if (
        showSchedulePopup &&
        // Don't close on outside-click while the range is invalid — the user
        // must fix it or press Clear (mirrors the blocked Done button).
        !(selectedStartDate && selectedEndDate && selectedStartDate > selectedEndDate) &&
        schedulePopupRef.current && !schedulePopupRef.current.contains(target) &&
        scheduleBtnRef.current && !scheduleBtnRef.current.contains(target)
      ) {
        setShowSchedulePopup(false);
      }
      if (
        showBackgroundTypeDropdown &&
        backgroundTypeMenuRef.current && !backgroundTypeMenuRef.current.contains(target) &&
        backgroundTypeBtnRef.current && !backgroundTypeBtnRef.current.contains(target)
      ) {
        setShowBackgroundTypeDropdown(false);
      }
      if (
        showDirectionDropdown &&
        directionMenuRef.current && !directionMenuRef.current.contains(target) &&
        directionBtnRef.current && !directionBtnRef.current.contains(target)
      ) {
        setShowDirectionDropdown(false);
      }
      if (actionMenuIndex !== null && actionMenuRef.current && !actionMenuRef.current.contains(target)) {
        setActionMenuIndex(null);
        setActionMenuPos(null);
      }
    };
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, [showLinkPopup, showSchedulePopup, showBackgroundTypeDropdown, showDirectionDropdown, actionMenuIndex, selectedStartDate, selectedEndDate]);




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

  // ── Clear all selection/editing state ──
  function clearSelection() {
    setSelectedIndex(null);
    setNewAnnouncementText('');
    setSelectedUrl('');
    setSelectedOpenInNewTab(true);
    setSelectedStartDate('');
    setSelectedEndDate('');
    setShowRichToolbar(true);
    setShowLinkPopup(false);
    setShowSchedulePopup(false);
    if (richEditorRef.current) {
      richEditorRef.current.innerHTML = '';
      richEditorRef.current.blur();
    }
    window.getSelection()?.removeAllRanges();
  }

  /**
   * Write the selected message's destination.
   *
   * `url` stays the one field the website reads, so a WhatsApp CTA is stored
   * as its derived wa.me link; the raw number and dialling code ride along
   * only so reopening the popup can repopulate the picker.
   */
  function updateSelectedDestination(next: {
    ctaType?: 'link' | 'whatsapp';
    url?: string;
    whatsappNumber?: string;
    whatsappCountryCode?: string;
  }) {
    if (selectedIndex === null) return;
    const ctaType = next.ctaType ?? selectedCtaType;
    const number = next.whatsappNumber ?? selectedWhatsappNumber;
    const code = next.whatsappCountryCode ?? selectedCountryCode;
    const plainUrl = next.url ?? selectedUrl;

    const updated = [...config.announcementBar.announcements];
    const resolved =
      ctaType === 'whatsapp' ? whatsAppUrl(code, number) : plainUrl || undefined;
    updated[selectedIndex] = {
      ...updated[selectedIndex],
      richText: true,
      ctaType: ctaType === 'whatsapp' ? 'whatsapp' : undefined,
      url: resolved || undefined,
      whatsappNumber: ctaType === 'whatsapp' ? number || undefined : undefined,
      whatsappCountryCode: ctaType === 'whatsapp' ? code : undefined,
    };
    setConfig({
      ...config,
      announcementBar: { ...config.announcementBar, announcements: updated },
    });
    markChanged();
  }

  // ── Select announcement (load into editor in edit mode) ──
  function selectAnnouncement(index: number) {
    const ann = config.announcementBar.announcements[index];
    setSelectedIndex(index);
    setSelectedUrl(ann.url || '');
    setSelectedCtaType(ann.ctaType === 'whatsapp' ? 'whatsapp' : 'link');
    setSelectedWhatsappNumber(ann.whatsappNumber || '');
    setSelectedCountryCode(ann.whatsappCountryCode || '+44');
    setSelectedOpenInNewTab(ann.openInNewTab !== undefined ? ann.openInNewTab : true);
    setSelectedStartDate(ann.startDate || '');
    setSelectedEndDate(ann.endDate || '');
    const normalizedText = ann.richText ? ann.text : wrapBareTextWithFontSize(ann.text);
    setNewAnnouncementText(normalizedText);
    setShowRichToolbar(true);
    if (richEditorRef.current) {
      richEditorRef.current.innerHTML = normalizedText;
      richEditorRef.current.focus();
      // Place cursor at end
      const sel = window.getSelection();
      if (sel) {
        sel.removeAllRanges();
        const range = document.createRange();
        range.selectNodeContents(richEditorRef.current);
        range.collapse(false);
        sel.addRange(range);
      }
    }
    detectFormatsForSelectMode(normalizedText);
  }

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

  function handleMenuAddLink(index: number) {
    openMenuAction(index, 'link');
  }

  function handleMenuSchedule(index: number) {
    openMenuAction(index, 'schedule');
  }

  function openMenuAction(index: number, type: 'link' | 'schedule') {
    selectAnnouncement(index);
    setShowLinkPopup(type === 'link');
    setShowSchedulePopup(type === 'schedule');
    setActionMenuIndex(null);
    setActionMenuPos(null);
  }

  function handleMenuDelete(index: number) {
    removeAnnouncement(index);
    setActionMenuIndex(null);
    setActionMenuPos(null);
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
  const scheduleRangeInvalid = !!(
    selectedStartDate &&
    selectedEndDate &&
    selectedStartDate > selectedEndDate
  );
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




  return (
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

      {/* Header */}
      <div className="px-4 py-2 border-border bg-surface/60 flex items-center justify-between">
        <div className="flex items-center">
          <div className="p-1 bg-primary/15 rounded-lg mr-3 border border-primary/60"><Megaphone className="w-4 h-4 text-primary" /></div>
          <div>
            <h3 className="text-[1.75rem] leading-9 font-bold text-on-surface">Announcement Bar</h3>
            <p className="mt-2 max-w-2xl text-sm text-on-surface-variant">Top banner for site-wide alerts.</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={
              config.announcementBar.active
                ? () => setShowStopConfirm(true)
                : canReactivate
                ? () => setShowGoOnAirConfirm(true)
                : undefined
            }
            disabled={!config.announcementBar.active && !canReactivate}
            aria-pressed={config.announcementBar.active}
            title={
              config.announcementBar.active
                ? 'On air — tap to stop'
                : canReactivate
                ? 'Reactivate the same content — go on air now'
                : 'You have unpublished changes — Save & Publish to go live'
            }
            className={`inline-flex flex-none items-center gap-2 rounded-full border px-4 py-[9px] text-[13px] font-medium transition-colors duration-200 ${
              config.announcementBar.active
                ? 'border-transparent bg-primary/[0.13] text-primary hover:bg-primary/[0.18] cursor-pointer'
                : canReactivate
                ? 'border-border bg-surface-elevated text-on-surface-variant hover:border-primary/50 hover:text-primary cursor-pointer'
                : 'border-border bg-surface-elevated text-on-surface-variant/40 cursor-not-allowed'
            }`}
          >
            {config.announcementBar.active ? (
              <>
                <span className="eq-bars"><i /><i /><i /><i /></span>
                On air · tap to stop
              </>
            ) : (
              <>
                <Radio className="w-4 h-4" />
                Go on air
              </>
            )}
          </button>
          <div ref={resetMenuRef} className="relative">
            <button
              type="button"
              onClick={() => setShowResetMenu((v) => !v)}
              aria-haspopup="menu"
              aria-expanded={showResetMenu}
              title="More actions"
              className="inline-flex h-9 w-9 flex-none items-center justify-center rounded-full border border-border bg-surface-elevated text-on-surface-variant transition-colors hover:border-primary/50 hover:text-primary"
            >
              <MoreVertical className="w-4 h-4" />
            </button>
            {showResetMenu && (
              <div
                role="menu"
                className="absolute right-0 top-full z-30 mt-1 w-48 overflow-hidden rounded-lg border border-border bg-surface-elevated shadow-lg"
              >
                <button
                  type="button"
                  role="menuitem"
                  title="Reset all messages and styling to defaults"
                  onClick={() => { setShowResetMenu(false); setShowResetConfirm(true); }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-medium text-red-500 transition-colors hover:bg-red-500/10"
                >
                  <Trash2 className="w-4 h-4 flex-none" />
                  Start fresh
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-8">
        {/* Preview */}
        <div className="py-4 border-border rounded-md">
          <h4 className="text-xs font-bold text-on-surface-variant uppercase tracking-[0.08em] mb-4">Preview</h4>
          <div className="w-full bg-surface-elevated border-border rounded overflow-hidden">
            {/* Preview always shows the content (with looping) whenever there
                are visible announcements — even when the campaign is stopped.
                On/off only affects the live site, not this preview. */}
            {visibleAnnouncements.length > 0 && (
              <div ref={scrollContainerRef} className="h-10 text-sm font-medium overflow-hidden flex items-center group"
                style={{
                  background: getBackgroundStyle(previewBg),
                  color: config.announcementBar.style.textColor,
                }}>
                <div className="animate-scroll-left">
                  {(() => {
                    const isLoopOn = config.announcementBar.loop !== false;
                    const totalSets = isLoopOn ? loopCopies * 2 : 2;
                    return [...Array(totalSets)].map((_, setIndex) => (
                      <span key={setIndex} className="inline-flex items-center justify-center"
                        style={!isLoopOn ? { minWidth: 'var(--set-min-width, 100%)' } : undefined}>
                        {visibleAnnouncements.map((ann, i) => (
                          <span key={`${setIndex}-${i}`} className="inline-block px-4">
                            {ann.url ? (
                              <a
                                href={ann.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="animated-underline inline-block"
                                dangerouslySetInnerHTML={{ __html: ann.text }}
                              />
                            ) : (
                              <span dangerouslySetInnerHTML={{ __html: ann.text }} />
                            )}
                          </span>
                        ))}
                      </span>
                    ));
                  })()}
                </div>
              </div>
            )}
            {visibleAnnouncements.length === 0 && (
              // No announcements yet — show the configured background so the
              // admin can preview/tune the bar's styling before adding text.
              <div
                className="h-10 flex items-center justify-center text-sm font-medium"
                style={{
                  background: getBackgroundStyle(previewBg),
                  color: config.announcementBar.style.textColor,
                }}
              >
                <span className="opacity-60">Your announcement will appear here</span>
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-stretch">
          {/* Left: Input + Chips + Link */}
          <div className="space-y-5 rounded-2xl border border-border campaign-card-surface p-4 shadow-sm flex flex-col h-[490px] transition-all hover:border-primary/70 hover:shadow-md hover:shadow-primary/20">
            <div className="border-b border-border pb-4">
              <h4 className="text-2xl font-semibold leading-8 text-on-surface">Announcement Content</h4>
              <p className="mt-2 text-sm text-on-surface-variant">Create your message, optionally attach a link, and add timing only if needed.</p>
            </div>

            {/* Announcement Input */}
            <div className="flex-1 flex flex-col justify-between">
              <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-[0.08em] mb-4">Message</label>

              {/* Rich Text Toolbar + Link/Schedule buttons — same row, show/hide with focus */}
              <div className="mb-4">
                <div className="flex items-center gap-1">
                  <div className="flex-1 min-w-0">
                    <RichTextToolbar
                      activeFormats={activeFormats}
                      onFormat={(format) => {
                        const sel = window.getSelection();
                        const hasSelectionInEditor = sel && !sel.isCollapsed && richEditorRef.current?.contains(sel.anchorNode);
                        if (hasSelectionInEditor) {
                          pushImmediateState(getEditorSnapshot());
                          saveSelection();
                          formatText(format);
                          const currentColor = activeFormats.color;
                          setTimeout(() => {
                            const s = window.getSelection();
                            if (s && s.anchorNode) {
                              let foundColor = '';
                              let node: Node | null = s.anchorNode;
                              while (node && node !== document.body) {
                                if (node instanceof HTMLElement && node.style.color) {
                                  foundColor = node.style.color.startsWith('rgb') ? rgbToHex(node.style.color) : node.style.color;
                                  break;
                                }
                                node = node.parentNode;
                              }
                              if (!foundColor) {
                                setActiveFormats(prev => ({ ...prev, color: currentColor }));
                              }
                            }
                          }, 0);
                        } else {
                          // No selection in editor: apply to all text or track for future
                          const hasContent = richEditorRef.current?.textContent?.replace(/\u200B/g, '').trim();
                          if (hasContent) {
                            pushImmediateState(getEditorSnapshot());
                            applyFormatToAll(() => formatText(format));
                          } else {
                            // Empty editor: just track the format for future typing
                            if (format.startsWith('size-')) {
                              setActiveFormats(prev => ({ ...prev, size: format.replace('size-', '') }));
                            } else if (format === 'bold') {
                              setActiveFormats(prev => ({ ...prev, bold: !prev.bold }));
                            } else if (format === 'italic') {
                              setActiveFormats(prev => ({ ...prev, italic: !prev.italic }));
                            }
                          }
                        }
                      }}
                      onColorSelect={(color) => {
                        const sel = window.getSelection();
                        const hasSelectionInEditor = sel && !sel.isCollapsed && richEditorRef.current?.contains(sel.anchorNode);
                        if (hasSelectionInEditor) {
                          pushImmediateState(getEditorSnapshot());
                          saveSelection();
                          applyColor(color);
                          onRichTextInput();
                        } else {
                          // No selection in editor: apply to all text or track for future
                          const hasContent = richEditorRef.current?.textContent?.replace(/\u200B/g, '').trim();
                          if (hasContent) {
                            pushImmediateState(getEditorSnapshot());
                            applyFormatToAll(() => applyColor(color));
                          }
                          setActiveFormats(prev => ({ ...prev, color }));
                        }
                      }}
                      extraActions={
                        <>
                          <div className="border-l border-border h-4 mx-0.5 shrink-0" />

                          <button
                            ref={linkBtnRef}
                            onMouseDown={(e) => {
                              e.preventDefault();
                              if (!newAnnouncementText.trim()) return;
                              setShowLinkPopup(!showLinkPopup);
                              setShowSchedulePopup(false);
                            }}
                            disabled={!newAnnouncementText.trim()}
                            className={`cursor-pointer flex items-center px-1.5 py-1 border rounded transition-colors shrink-0 disabled:opacity-40 disabled:cursor-not-allowed ${selectedUrl ? 'border-primary/80 bg-primary/10 text-primary' : 'border-border hover:border-primary/70 hover:bg-primary/10 hover:text-primary text-on-surface-variant'}`}
                            title={newAnnouncementText.trim() ? 'Add link' : 'Enter text first'}
                          >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                            </svg>
                          </button>

                          <button
                            ref={scheduleBtnRef}
                            onMouseDown={(e) => {
                              e.preventDefault();
                              if (!newAnnouncementText.trim()) return;
                              // Don't let the toggle close the popup while its
                              // date range is invalid — fix it or press Clear.
                              if (showSchedulePopup && scheduleRangeInvalid) return;
                              setShowSchedulePopup(!showSchedulePopup);
                              setShowLinkPopup(false);
                            }}
                            disabled={!newAnnouncementText.trim()}
                            className={`cursor-pointer flex items-center px-1.5 py-1 border rounded transition-colors shrink-0 disabled:opacity-40 disabled:cursor-not-allowed ${(selectedStartDate || selectedEndDate) ? 'border-primary/80 bg-primary/10 text-primary' : 'border-border hover:border-primary/70 hover:bg-primary/10 hover:text-primary text-on-surface-variant'}`}
                            title={newAnnouncementText.trim() ? 'Schedule' : 'Enter text first'}
                          >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                          </button>
                        </>
                      }
                      rightActions={
                        <button
                          type="button"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            openChatGptWithPrompt();
                          }}
                          className="cursor-pointer flex items-center px-1.5 py-1 border rounded transition-colors shrink-0 border-border hover:border-primary/70 hover:bg-primary/10 hover:text-primary text-on-surface-variant ml-1"
                          title="Open ChatGPT with a prompt"
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                        </button>
                      }
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-2 items-end">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-on-surface-variant mb-2">Enter text below</p>
                  <div ref={richEditorRef} contentEditable suppressContentEditableWarning
                    spellCheck={true}
                    onInput={onRichTextInput}
                    onPaste={(e) => {
                      e.preventDefault();
                      const text = e.clipboardData.getData('text/plain');
                      document.execCommand('insertText', false, text);
                    }}
                    onMouseDown={() => {
                      // Click in editor resets styling session
                    }}
                    onMouseUp={() => {
                      if (!richEditorRef.current) return;
                      const hasContent = richEditorRef.current.textContent?.replace(/\u200B/g, '').trim();
                      if (!hasContent) return;
                      const sel = window.getSelection();
                      if (sel && sel.rangeCount > 0 && richEditorRef.current.contains(sel.anchorNode)) {
                        detectFormats();
                      }
                    }}
                    onKeyUp={(e) => {
                      if (!richEditorRef.current) return;

                      // After delete, clean up empty styled nodes
                      if (e.key === 'Backspace' || e.key === 'Delete') {
                        const editor = richEditorRef.current;
                        // Remove empty styled spans and wrappers
                        editor.querySelectorAll('span[style], b, strong, i, em').forEach((el) => {
                          if (!el.textContent?.replace(/\u200B/g, '').trim()) {
                            el.remove();
                          }
                        });

                        const hasContent = editor.textContent?.replace(/\u200B/g, '').trim();
                        if (!hasContent) {
                          setActiveFormats({ bold: false, italic: false, size: 'md', color: editorDefaultColor });
                          editor.innerHTML = '';
                          justDeletedStyledRef.current = false;
                          return;
                        }
                        // Mark that we just deleted — next typed char should use detected formats
                        justDeletedStyledRef.current = true;
                        // Use DOM-walking detection (not queryCommandState which reads stale context)
                        detectFormatsForSelectMode(editor.innerHTML);
                        return;
                      }

                      const hasContent = richEditorRef.current.textContent?.replace(/\u200B/g, '').trim();
                      if (!hasContent) return;
                      const sel = window.getSelection();
                      if (sel && sel.rangeCount > 0 && richEditorRef.current.contains(sel.anchorNode)) {
                        detectFormats();
                      }
                    }}
                    onKeyDown={(e) => {
                      // Any keystroke ends the styling session

                      // ── 1. Selection overwrite — snapshot before replacing selected text ──
                      // A deliberate selection+overwrite always starts a NEW session
                      if (!e.metaKey && !e.ctrlKey) {
                        const sel = window.getSelection();
                        if (
                          sel &&
                          !sel.isCollapsed &&
                          richEditorRef.current?.contains(sel.anchorNode) &&
                          (e.key.length === 1 || e.key === 'Backspace' || e.key === 'Delete')
                        ) {
                          pushImmediateState(getEditorSnapshot());
                          // Typing over a selection is a typing run, not a delete
                          // run — leave the lock off so the rest of the word
                          // collapses into this one step.
                          isDeletingRef.current =
                            e.key === 'Backspace' || e.key === 'Delete';
                        }
                      }

                      // ── 2. First Backspace/Delete — snapshot before destruction begins ──
                      if ((e.key === 'Backspace' || e.key === 'Delete') && !e.metaKey && !e.ctrlKey) {
                        const sel = window.getSelection();
                        if (sel?.isCollapsed && !isDeletingRef.current) {
                          isDeletingRef.current = true;
                          pushImmediateState(getEditorSnapshot());
                        }
                      } else if (
                        (e.key.length === 1 || e.key === 'Enter') &&
                        !e.metaKey &&
                        !e.ctrlKey
                      ) {
                        // Ordinary typing. Snapshot BEFORE the character lands,
                        // so undo restores the text as it was; the stack's
                        // coalescing window folds the rest of the burst in.
                        if (isDeletingRef.current) {
                          // Typing after a delete run ends that run and opens its
                          // own step, so the words survive one Ctrl+Z instead of
                          // being swallowed together with the deletion.
                          isDeletingRef.current = false;
                          pushImmediateState(getEditorSnapshot());
                        } else {
                          pushTypingState(getEditorSnapshot());
                        }
                      }

                      // ── 3. Suppress native undo/redo ──
                      const mod = e.metaKey || e.ctrlKey;
                      if (mod && (e.key.toLowerCase() === 'z' || e.key.toLowerCase() === 'y')) {
                        e.preventDefault();
                        const isUndo = e.key.toLowerCase() === 'z' && !e.shiftKey;
                        const isRedo = (e.key.toLowerCase() === 'z' && e.shiftKey) || e.key.toLowerCase() === 'y';
                        if (isUndo) {
                          const snapshot = undoEditor(getEditorSnapshot());
                          if (snapshot) applyEditorSnapshot(snapshot);
                        } else if (isRedo) {
                          const snapshot = redoEditor(getEditorSnapshot());
                          if (snapshot) applyEditorSnapshot(snapshot);
                        }
                        // After undo/redo, reset delete mode
                        isDeletingRef.current = false;
                        return;
                      }

                      // ── 4. Enter to submit ──
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        addAnnouncement();
                        return;
                      }

                      // ── 5. Seed empty editor ──
                      if (!e.metaKey && !e.ctrlKey && e.key.length === 1 && richEditorRef.current) {
                        const editor = richEditorRef.current;
                        const hasContent = editor.textContent?.replace(/\u200B/g, '').trim();
                        if (!hasContent) {
                          e.preventDefault();
                          const { size, color, bold, italic } = activeFormatsRef.current;
                          const fontSize = size ? ({ xs: '0.75rem', sm: '0.875rem', md: '1rem', lg: '1.125rem', xl: '1.25rem', xxl: '1.5rem' }[size] || '1rem') : '1rem';
                          const resolvedColor = color || editorDefaultColor;
                          let html = `<span style="font-size: ${fontSize}; color: ${resolvedColor}">${e.key}</span>`;
                          if (bold) html = `<b>${html}</b>`;
                          if (italic) html = `<i>${html}</i>`;
                          editor.innerHTML = html;
                          const sel = window.getSelection();
                          if (sel) {
                            sel.removeAllRanges();
                            const range = document.createRange();
                            let lastNode: Node = editor;
                            while (lastNode.lastChild) lastNode = lastNode.lastChild;
                            if (lastNode.nodeType === Node.TEXT_NODE) {
                              range.setStart(lastNode, lastNode.textContent?.length || 0);
                              range.collapse(true);
                            } else {
                              range.selectNodeContents(editor);
                              range.collapse(false);
                            }
                            sel.addRange(range);
                          }
                          onRichTextInput();
                          justDeletedStyledRef.current = false;
                        } else if (justDeletedStyledRef.current) {
                          // After deleting styled text, force-insert with surrounding style
                          e.preventDefault();
                          justDeletedStyledRef.current = false;
                          const { size, color, bold, italic } = activeFormatsRef.current;
                          const fontSize = size ? ({ xs: '0.75rem', sm: '0.875rem', md: '1rem', lg: '1.125rem', xl: '1.25rem', xxl: '1.5rem' }[size] || '1rem') : '1rem';
                          const resolvedColor = color || editorDefaultColor;
                          let charHtml = `<span style="font-size: ${fontSize}; color: ${resolvedColor}">${e.key}</span>`;
                          if (bold) charHtml = `<b>${charHtml}</b>`;
                          if (italic) charHtml = `<i>${charHtml}</i>`;
                          document.execCommand('insertHTML', false, charHtml);
                          onRichTextInput();
                        } else {
                          ensureDefaultFontSize();
                        }
                      }
                    }}
                    onFocus={() => {
                      if (applyingFormatRef.current) return;
                      if (restoringSnapshotRef.current) return;
                      setShowRichToolbar(true);
                      if (!shortcutsTipShown.current && localStorage.getItem('ann_shortcuts_seen') !== 'never') {
                        shortcutsTipShown.current = true;
                        setShowShortcutsTip(true);
                      }
                      if (richEditorRef.current) {
                        const editor = richEditorRef.current;
                        const hasContent = editor.textContent?.replace(/\u200B/g, '').trim();
                        if (hasContent) {
                          detectFormatsForSelectMode(editor.innerHTML);
                        }
                      }
                    }}
                    onBlur={(e) => {
                      if (applyingFormatRef.current) return;
                      if (restoringSnapshotRef.current) return;

                      // Skip if focus moved to toolbar or editor UI (not a true blur)
                      const relatedTarget = e.relatedTarget as HTMLElement | null;
                      const editorContainer = e.currentTarget.closest('.space-y-4');
                      if (relatedTarget && editorContainer?.contains(relatedTarget)) {
                        // Focus stayed inside editor UI — skip snapshot
                      } else {
                        // True blur — capture final state
                        pushImmediateState(getEditorSnapshot());
                      }

                      const text = richEditorRef.current?.textContent?.replace(/\u200B/g, '').trim();
                      if (!text && selectedIndex === null) {
                        setShowRichToolbar(true);
                        if (richEditorRef.current) richEditorRef.current.innerHTML = '';
                      }
                    }}
                    className={`rich-editor shadow-sm block w-full sm:text-sm rounded-md p-3 border outline-none overflow-y-auto overflow-x-hidden h-[44px] min-h-[44px] max-h-[360px] resize-y break-words transition-colors focus:ring-primary/60 focus:border-primary/80 hover:border-primary/70 border-border`}
                    style={{ background: getBackgroundStyle(previewBg), wordBreak: 'break-word', overflowWrap: 'break-word', maxWidth: '100%', caretColor: 'auto' }} />
                </div>
                <button onMouseDown={(e) => {
                  e.preventDefault();
                  addAnnouncement();
                }}
                  disabled={!newAnnouncementText.trim()}
                  className="px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-on-primary bg-primary hover:opacity-95 disabled:opacity-50 disabled:cursor-not-allowed self-end">
                  {selectedIndex !== null ? 'Update' : 'Add'}
                </button>
              </div>
            </div>

            {/* Link popup portal */}
            {showLinkPopup && linkPos && typeof document !== 'undefined' && createPortal(
              <div
                ref={linkPopupRef}
                onMouseDown={(e) => e.stopPropagation()}
                style={{ position: 'absolute', top: linkPos.top, left: linkPos.left, zIndex: 9999 }}
                className="bg-black/10 backdrop-blur-md border border-white/10 rounded-xl shadow-2xl p-3 w-[260px]"
              >
                <button
                  onMouseDown={(e) => { e.stopPropagation(); e.preventDefault(); closePopupAndFocusEditor(); }}
                  aria-label="Close"
                  className="absolute top-0 right-2 text-on-surface-variant hover:text-on-surface p-1 rounded text-xl"
                >
                  ×
                </button>
                {/* Two kinds of destination, one field on the website. */}
                <div className="mb-3 flex gap-1 rounded-lg border border-border p-0.5">
                  {(['link', 'whatsapp'] as const).map((kind) => (
                    <button
                      key={kind}
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        // Switch the mode only. Writing here too would clear
                        // the destination the moment you flipped the toggle —
                        // the other mode has nothing entered yet — so a stray
                        // click destroyed a link that was already set.
                        setSelectedCtaType(kind);
                      }}
                      className={`flex-1 rounded-md px-2 py-1 text-xs font-medium transition-colors ${
                        selectedCtaType === kind
                          ? 'bg-primary/10 text-primary'
                          : 'text-on-surface-variant hover:text-on-surface'
                      }`}
                    >
                      {kind === 'link' ? 'Link' : 'WhatsApp'}
                    </button>
                  ))}
                </div>

                {selectedCtaType === 'whatsapp' ? (
                  <>
                    <p className="text-xs font-medium text-on-surface mb-2">
                      WhatsApp number
                    </p>
                    <div className="flex items-center gap-1.5">
                      <PopupDropdown
                        labelClassName="sr-only"
                        label="Country code"
                        value={selectedCountryCode}
                        // Same shape as the promo card's picker: the name
                        // reads first because that is what people search by,
                        // with the dialling code trailing as the detail.
                        options={COUNTRY_CODES.map(({ code, flag, name }) => ({
                          value: code,
                          label: name,
                          meta: code,
                          searchText: name,
                          icon: <CountryFlag flag={flag} name={name} />,
                        }))}
                        open={showAnnCountryDropdown}
                        onOpen={() => {
                          const btn = annCountryBtnRef.current;
                          if (btn) {
                            const r = btn.getBoundingClientRect();
                            setAnnCountryPos({
                              top: r.bottom + window.scrollY,
                              left: r.left + window.scrollX,
                              width: r.width,
                            });
                          }
                          setShowAnnCountryDropdown((v) => !v);
                        }}
                        onSelect={(v) => {
                          setSelectedCountryCode(v);
                          updateSelectedDestination({ whatsappCountryCode: v });
                          setShowAnnCountryDropdown(false);
                        }}
                        buttonRef={annCountryBtnRef}
                        menuRef={annCountryMenuRef}
                        menuPosition={annCountryPos}
                        compact
                        flip
                        searchable
                        searchPlaceholder="Search country"
                        // Five rows and the search box. Sixty-six countries behind a tall
                        // menu is a wall of names to read past; five is enough to show the
                        // list scrolls and that typing is the faster way through it.
                        menuMaxHeight={200}
                        triggerContent={(() => {
                          const c = COUNTRY_CODES.find(
                            (x) => x.code === selectedCountryCode,
                          );
                          return (
                            <span className="flex items-center gap-1.5">
                              {c ? <CountryFlag flag={c.flag} name={c.name} /> : null}
                              <span>{selectedCountryCode}</span>
                            </span>
                          );
                        })()}
                        buttonClassName="flex h-9 w-[92px] shrink-0 items-center justify-between gap-1 rounded-md border border-border bg-surface px-2 text-sm text-on-surface transition-colors hover:border-primary/70"
                      />
                      <input
                        type="tel"
                        inputMode="numeric"
                        value={selectedWhatsappNumber}
                        onChange={(e) => {
                          const digits = e.target.value
                            .replace(/\D/g, '')
                            .slice(0, maxNationalDigits(selectedCountryCode));
                          setSelectedWhatsappNumber(digits);
                          updateSelectedDestination({ whatsappNumber: digits });
                        }}
                        className="block w-full rounded-md border border-border bg-surface p-2 text-sm text-on-surface"
                        placeholder="7911123456"
                        autoFocus
                      />
                    </div>
                    {/* A short number still links — length is a warning, not a
                        gate, matching how the promo card treats it. */}
                    {whatsAppLooksShort(selectedCountryCode, selectedWhatsappNumber) && (
                      <p className="mt-1.5 text-[11px] text-amber-600 dark:text-amber-500">
                        That looks short for {selectedCountryCode}. Double-check it
                        before publishing.
                      </p>
                    )}
                    {whatsAppUrl(selectedCountryCode, selectedWhatsappNumber) && (
                      <p className="mt-1.5 break-all text-[11px] text-on-surface-variant">
                        Opens{' '}
                        {whatsAppUrl(selectedCountryCode, selectedWhatsappNumber)}
                      </p>
                    )}
                  </>
                ) : (
                <>
                <p className="text-xs font-medium text-on-surface mb-2">Link URL</p>
                <input
                  type="url"
                  value={selectedUrl}
                  onKeyDown={(e) => {
                    const mod = e.metaKey || e.ctrlKey;
                    if (mod && (e.key.toLowerCase() === 'z' || e.key.toLowerCase() === 'y')) {
                      e.preventDefault();
                      const isUndo = e.key.toLowerCase() === 'z' && !e.shiftKey;
                      const isRedo = (e.key.toLowerCase() === 'z' && e.shiftKey) || e.key.toLowerCase() === 'y';
                      if (isUndo) {
                        const snapshot = undoLink(getLinkSnapshot());
                        if (snapshot) applyLinkSnapshot(snapshot);
                      } else if (isRedo) {
                        const snapshot = redoLink(getLinkSnapshot());
                        if (snapshot) applyLinkSnapshot(snapshot);
                      }
                      linkDeletingRef.current = false;
                      return;
                    }
                    // Push before destroying existing URL (first backspace only)
                    if (selectedUrl && (e.key === 'Backspace' || e.key === 'Delete')) {
                      if (!linkDeletingRef.current) {
                        linkDeletingRef.current = true;
                        pushLinkState(getLinkSnapshot());
                      }
                    } else if (selectedUrl && e.key.length === 1 && !mod) {
                      const input = e.target as HTMLInputElement;
                      if (input.selectionStart !== input.selectionEnd) {
                        // About to overwrite selected text
                        if (!linkDeletingRef.current) {
                          linkDeletingRef.current = true;
                          pushLinkState(getLinkSnapshot());
                        }
                      } else {
                        // Typing forward — reset delete mode
                        if (e.key === ' ') linkDeletingRef.current = false;
                      }
                    }
                  }}
                  onChange={(e) => {
                    const nextUrl = e.target.value;
                    setSelectedUrl(nextUrl);
                    if (selectedIndex !== null) {
                      const updated = [...config.announcementBar.announcements];
                      updated[selectedIndex] = { ...updated[selectedIndex], url: nextUrl || undefined, richText: true };
                      setConfig({ ...config, announcementBar: { ...config.announcementBar, announcements: updated } });
                      markChanged();
                    }
                  }}
                  className="block w-full border-border rounded-md p-2 border bg-surface text-on-surface text-sm"
                  placeholder="https://example.com"
                  autoFocus
                />
                <div className="flex items-center mt-3 mb-2">
                  <input
                    type="checkbox"
                    id="openInNewTab"
                    checked={selectedOpenInNewTab}
                    onChange={(e) => {
                      const nextValue = e.target.checked;
                      setSelectedOpenInNewTab(nextValue);
                      if (selectedIndex !== null) {
                        const updated = [...config.announcementBar.announcements];
                        updated[selectedIndex] = { ...updated[selectedIndex], openInNewTab: nextValue || undefined, richText: true };
                        setConfig({ ...config, announcementBar: { ...config.announcementBar, announcements: updated } });
                        markChanged();
                      }
                    }}
                    className="w-4 h-4 rounded border-border text-primary"
                  />
                  <label htmlFor="openInNewTab" className="ml-2 text-xs text-on-surface cursor-pointer">Open in new tab</label>
                </div>
                <p className="text-[10px] text-on-surface-variant mt-1">In this editor, links always open in a new tab. <br /> This setting applies to your live site only.</p>
                </>
                )}
                <div className="flex justify-between items-center mt-2">
                  {(selectedUrl || selectedWhatsappNumber) && (
                    <button
                      onMouseDown={(e) => {
                        e.preventDefault();
                        setSelectedUrl('');
                        setSelectedWhatsappNumber('');
                        setSelectedOpenInNewTab(true);
                        if (selectedIndex !== null) {
                          const updated = [...config.announcementBar.announcements];
                          updated[selectedIndex] = {
                            ...updated[selectedIndex],
                            url: undefined,
                            openInNewTab: undefined,
                            whatsappNumber: undefined,
                            whatsappCountryCode: undefined,
                            richText: true,
                          };
                          setConfig({ ...config, announcementBar: { ...config.announcementBar, announcements: updated } });
                          markChanged();
                        }
                      }}
                      className="text-xs text-primary hover:opacity-80"
                    >
                      Clear
                    </button>
                  )}
                  <button
                    onMouseDown={(e) => {
                      e.preventDefault();
                      closePopupAndFocusEditor();
                    }}
                    className="ml-auto text-xs bg-primary text-on-primary px-3 py-1 rounded hover:opacity-95"
                  >
                    Done
                  </button>
                </div>
              </div>,
              document.body
            )}

            {/* Schedule popup portal */}
            {showSchedulePopup && schedulePos && typeof document !== 'undefined' && createPortal(
              <div
                ref={schedulePopupRef}
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
                style={{ position: 'absolute', top: schedulePos.top, left: schedulePos.left, zIndex: 9999 }}
                className="bg-black/10 backdrop-blur-md border border-white/10 rounded-xl shadow-2xl p-3 w-[260px]">
                <button
                  onMouseDown={(e) => { e.stopPropagation(); e.preventDefault(); if (scheduleRangeInvalid) return; closePopupAndFocusEditor(); }}
                  aria-label="Close"
                  title={scheduleRangeInvalid ? 'Fix invalid date range to close.' : undefined}
                  className={`absolute top-0 right-2 p-1 rounded text-xl ${scheduleRangeInvalid ? 'text-on-surface-variant/40 cursor-not-allowed' : 'text-on-surface-variant hover:text-on-surface'}`}
                >
                  ×
                </button>
                <p className="text-xs font-medium text-on-surface mb-2">Schedule (optional)</p>
                <div className="space-y-2">
                  <div>
                    <label className="block text-[11px] text-on-surface-variant mb-0.5">Start Date</label>
                    <div ref={startDateCalendarRef} className="relative">
                      <button
                        type="button"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          if (selectedStartDate) {
                            const date = new Date(`${selectedStartDate}T00:00:00`);
                            if (!Number.isNaN(date.getTime())) setStartDateView(new Date(date.getFullYear(), date.getMonth(), 1));
                          }
                          setShowStartDateCalendar((prev) => !prev);
                          setShowEndDateCalendar(false);
                        }}
                        className="flex w-full items-center justify-between rounded-xl border border-white/10 bg-black/10 p-1.5 text-sm text-on-surface backdrop-blur-md"
                      >
                        <span className={selectedStartDate ? 'text-on-surface' : 'text-on-surface-variant'}>
                          {formatDateLabel(selectedStartDate)}
                        </span>
                        <svg
                          className={`h-4 w-4 flex-shrink-0 text-on-surface-variant transition-transform duration-200 ${showStartDateCalendar ? 'rotate-180' : 'rotate-0'}`}
                          viewBox="0 0 20 20"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.8"
                        >
                          <path d="M6 8l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </button>
                      {showStartDateCalendar && (
                        <InlineCalendar
                          viewDate={startDateView}
                          onViewDateChange={setStartDateView}
                          selected={selectedStartDate}
                          keyPrefix="start"
                          onSelect={(iso) => {
                            setSelectedStartDate(iso);
                            if (selectedIndex !== null) {
                              const updated = [...config.announcementBar.announcements];
                              updated[selectedIndex] = { ...updated[selectedIndex], startDate: iso || undefined, richText: true };
                              setConfig({ ...config, announcementBar: { ...config.announcementBar, announcements: updated } });
                              markChanged();
                            }
                            setShowStartDateCalendar(false);
                          }}
                        />
                      )}
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] text-on-surface-variant mb-0.5">End Date</label>
                    <div ref={endDateCalendarRef} className="relative">
                      <button
                        type="button"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          if (selectedEndDate) {
                            const date = new Date(`${selectedEndDate}T00:00:00`);
                            if (!Number.isNaN(date.getTime())) setEndDateView(new Date(date.getFullYear(), date.getMonth(), 1));
                          }
                          setShowEndDateCalendar((prev) => !prev);
                          setShowStartDateCalendar(false);
                        }}
                        className={`flex w-full items-center justify-between rounded-xl border bg-black/10 p-1.5 text-sm text-on-surface backdrop-blur-md ${
                          scheduleRangeInvalid ? 'border-red-500 dark:border-red-400' : 'border-white/10'
                        }`}
                      >
                        <span className={selectedEndDate ? 'text-on-surface' : 'text-on-surface-variant'}>
                          {formatDateLabel(selectedEndDate)}
                        </span>
                        <svg
                          className={`h-4 w-4 flex-shrink-0 text-on-surface-variant transition-transform duration-200 ${showEndDateCalendar ? 'rotate-180' : 'rotate-0'}`}
                          viewBox="0 0 20 20"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.8"
                        >
                          <path d="M6 8l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </button>
                      {showEndDateCalendar && (
                        <InlineCalendar
                          viewDate={endDateView}
                          onViewDateChange={setEndDateView}
                          selected={selectedEndDate}
                          keyPrefix="end"
                          onSelect={(iso) => {
                            setSelectedEndDate(iso);
                            if (selectedIndex !== null) {
                              const updated = [...config.announcementBar.announcements];
                              updated[selectedIndex] = { ...updated[selectedIndex], endDate: iso || undefined, richText: true };
                              setConfig({ ...config, announcementBar: { ...config.announcementBar, announcements: updated } });
                              markChanged();
                            }
                            setShowEndDateCalendar(false);
                          }}
                        />
                      )}
                    </div>
                  </div>
                  {scheduleRangeInvalid && (
                    <p className="text-[11px] font-medium text-red-600 dark:text-red-400">
                      End date must be on or after the start date.
                    </p>
                  )}
                  <p className="text-[10px] text-on-surface-variant">Leave empty to always show when bar is active.</p>
                </div>
                <div className="flex justify-between items-center mt-2">
                  {(selectedStartDate || selectedEndDate) && (
                    <button
                      onMouseDown={(e) => {
                        e.preventDefault();
                        setSelectedStartDate('');
                        setSelectedEndDate('');
                        if (selectedIndex !== null) {
                          const updated = [...config.announcementBar.announcements];
                          updated[selectedIndex] = { ...updated[selectedIndex], startDate: undefined, endDate: undefined, richText: true };
                          setConfig({ ...config, announcementBar: { ...config.announcementBar, announcements: updated } });
                          markChanged();
                        }
                      }}
                      className="text-xs text-primary hover:opacity-80"
                    >
                      Clear
                    </button>
                  )}
                  <button
                    onMouseDown={(e) => {
                      e.preventDefault();
                      if (scheduleRangeInvalid) return;
                      closePopupAndFocusEditor();
                    }}
                    disabled={scheduleRangeInvalid}
                    title={scheduleRangeInvalid ? 'Fix invalid date range to save.' : undefined}
                    className="ml-auto text-xs bg-primary text-on-primary px-3 py-1 rounded hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Done
                  </button>
                </div>
              </div>,
              document.body
            )}

            {actionMenuIndex !== null && actionMenuPos && typeof document !== 'undefined' && createPortal(
              <div
                ref={actionMenuRef}
                onMouseDown={(e) => e.stopPropagation()}
                onMouseEnter={() => cancelCloseActionMenu()}
                onMouseLeave={() => scheduleCloseActionMenu()}
                style={{ position: 'absolute', top: actionMenuPos.top, left: actionMenuPos.left, zIndex: 9999 }}
                className="bg-black/10 backdrop-blur-md border border-white/10 rounded-xl shadow-2xl py-1 w-[180px]"
              >
                <button
                  type="button"
                  onMouseDown={(e) => { e.preventDefault(); handleMenuAddLink(actionMenuIndex); }}
                  className="w-full text-left px-3 py-2 text-sm text-on-surface hover:bg-surface-subtle"
                >
                  Add link
                </button>
                <button
                  type="button"
                  onMouseDown={(e) => { e.preventDefault(); handleMenuSchedule(actionMenuIndex); }}
                  className="w-full text-left px-3 py-2 text-sm text-on-surface hover:bg-surface-subtle"
                >
                  Schedule
                </button>
                <div className="my-1 h-px bg-border" />
                <button
                  type="button"
                  onMouseDown={(e) => { e.preventDefault(); handleMenuDelete(actionMenuIndex); }}
                  className="w-full text-left px-3 py-2 text-sm text-primary hover:bg-primary/10"
                >
                  Delete
                </button>
              </div>,
              document.body
            )}

            {/* Style Customization */}
            <div>
              <label className="block text-xl font-semibold leading-7 text-on-surface mb-4">Style Customization</label>

              {/* Type + inline control */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <PopupDropdown
                    label="Background Type"
                    value={bg.type || 'solid'}
                    options={[
                      { value: 'solid', label: 'Solid' },
                      { value: 'linear', label: 'Linear' },
                      { value: 'radial', label: 'Gradient' },
                    ]}
                    open={showBackgroundTypeDropdown}
                    onOpen={() => {
                      setShowBackgroundTypeDropdown((current) => !current);
                      setShowDirectionDropdown(false);
                    }}
                    onSelect={(nextType) => {
                      // The dropdown is typed to plain strings; its options are
                      // exactly the three background types, so this narrows to
                      // what the list can actually produce.
                      updateBgWithHistory({ type: nextType as GradientStyle['type'] });
                      setShowBackgroundTypeDropdown(false);
                    }}
                    buttonRef={backgroundTypeBtnRef}
                    menuRef={backgroundTypeMenuRef}
                    menuPosition={backgroundTypePos}
                  />
                </div>
                <div className="col-span-2">
                  {bg.type === 'linear' && (
                    <div>
                      <label className="block text-xs text-on-surface-variant mb-1">Balance: {bg.midpoint ?? 50}%</label>
                      <input type="range" min="0" max="100" value={bg.midpoint ?? 50}
                        onChange={(e) => updateBg({ midpoint: Number(e.target.value) })}
                        onMouseDown={() => pushImmediateState(getEditorSnapshot())}
                        className="balance-slider mt-3" />
                    </div>
                  )}
                  {bg.type === 'radial' && (
                    <div>
                      <label className="block text-xs text-on-surface-variant mb-1">Balance: {bg.midpoint ?? 50}%</label>
                      <input type="range" min="0" max="100" value={bg.midpoint ?? 50}
                        onChange={(e) => updateBg({ midpoint: Number(e.target.value) })}
                        onMouseDown={() => pushImmediateState(getEditorSnapshot())}
                        className="balance-slider mt-3" />
                    </div>
                  )}
                </div>
              </div>

              {/* Colors + Direction (second line) */}
              <div className="mt-4 min-h-[96px]">
                {bg.type === 'solid' && (
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-on-surface mb-2">Background Color</label>
                      <input type="color" value={bg.startColor} onFocus={() => pushImmediateState(getEditorSnapshot())} onChange={(e) => updateBg({ startColor: e.target.value })}
                        className="bg-color-picker h-11 w-full rounded cursor-pointer" />
                    </div>
                    <div aria-hidden="true" />
                    <div aria-hidden="true" />
                  </div>
                )}

                {bg.type === 'linear' && (
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-on-surface mb-2">Start Color</label>
                      <input type="color" value={bg.startColor} onFocus={() => pushImmediateState(getEditorSnapshot())} onChange={(e) => updateBg({ startColor: e.target.value })}
                        className="bg-color-picker h-11 w-full rounded cursor-pointer" />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-on-surface mb-2">End Color</label>
                      <input type="color" value={bg.endColor} onFocus={() => pushImmediateState(getEditorSnapshot())} onChange={(e) => updateBg({ endColor: e.target.value })}
                        className="bg-color-picker h-11 w-full rounded cursor-pointer" />
                    </div>
                    <div>
                      <PopupDropdown
                        label="Direction"
                        labelClassName="block text-sm font-semibold text-on-surface mb-2"
                        buttonExtraClassName="h-11"
                        value={bg.direction || 'to right'}
                        options={[
                          { value: 'to right', label: 'To Right →' },
                          { value: 'to left', label: 'To Left ←' },
                          { value: 'to bottom', label: 'To Bottom ↓' },
                          { value: 'to top', label: 'To Top ↑' },
                          { value: 'to bottom right', label: 'To Bottom Right ↘' },
                          { value: 'to bottom left', label: 'To Bottom Left ↙' },
                          { value: 'to top right', label: 'To Top Right ↗' },
                          { value: 'to top left', label: 'To Top Left ↖' },
                        ]}
                        open={showDirectionDropdown}
                        onOpen={() => {
                          setShowDirectionDropdown((current) => !current);
                          setShowBackgroundTypeDropdown(false);
                        }}
                        onSelect={(nextDirection) => {
                          pushImmediateState(getEditorSnapshot());
                          updateBg({ direction: nextDirection });
                          setShowDirectionDropdown(false);
                        }}
                        onHover={(dir) => setPreviewDirection(dir)}
                        onHoverEnd={() => setPreviewDirection(null)}
                        buttonRef={directionBtnRef}
                        menuRef={directionMenuRef}
                        menuPosition={directionPos}
                        arrowDirection="right"
                      />
                    </div>
                  </div>
                )}

                {bg.type === 'radial' && (
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-on-surface mb-2">Center Color</label>
                      <input type="color" value={bg.startColor} onFocus={() => pushImmediateState(getEditorSnapshot())} onChange={(e) => updateBg({ startColor: e.target.value })}
                        className="bg-color-picker h-11 w-full rounded cursor-pointer" />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-on-surface mb-2">Outer Color</label>
                      <input type="color" value={bg.endColor} onFocus={() => pushImmediateState(getEditorSnapshot())} onChange={(e) => updateBg({ endColor: e.target.value })}
                        className="bg-color-picker h-11 w-full rounded cursor-pointer" />
                    </div>
                    <div aria-hidden="true" />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right: Message List + Style (single card split into equal halves) */}
          <div className="min-h-0">
            <div className="rounded-2xl border border-border campaign-card-surface p-4 shadow-sm flex flex-col h-[490px] overflow-hidden transition-all hover:border-primary/70 hover:shadow-md hover:shadow-primary/20">
              {/* Header */}
              <div className="border-b border-border pb-4 mb-5 shrink-0 flex items-center justify-between">
                <div>
                  <h4 className="text-2xl font-semibold leading-8 text-on-surface">Manage Announcements</h4>
                  <p className="mt-2 text-sm text-on-surface-variant">View, reorder, and style your announcement messages.</p>
                </div>
                {/* No Undo/Redo buttons here on purpose: editing is Ctrl+Z, and
                    every list action offers Undo in its own toast. */}
                <div className="flex items-center gap-0.5">
                  <button
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={clearAnnouncements}
                    disabled={config.announcementBar.announcements.length === 0}
                    className="ml-1 flex items-center gap-1 rounded px-1.5 py-1 text-[11px] font-medium text-on-surface-variant hover:text-red-500 hover:bg-red-500/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                    title="Remove all messages (Undo to restore)"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Clear
                  </button>
                </div>
              </div>
              {/* Section 1: Message List */}
              <div className="flex-1 min-h-0 flex flex-col pr-1">
                <div className="flex items-center justify-between mb-2 shrink-0">
                  <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-[0.08em]">Message List</label>
                  {config.announcementBar.announcements.length > 0 && (
                    <span className="text-[11px] text-primary font-medium flex items-center animate-pulse">
                      💡 hover a chip & click ••• to manage
                    </span>
                  )}
                </div>
                {config.announcementBar.announcements.length === 0 ? (
                  <div className="flex-1 flex items-center justify-center text-center text-sm text-on-surface-variant">
                    Added text from the left input box will be displayed here
                  </div>
                ) : (
                  <div className="campaign-custom-scrollbar flex-1 min-h-0 overflow-y-auto">
                    <div className="flex flex-wrap gap-2 p-1">
                      {config.announcementBar.announcements.map((ann, index) => (
                        <div key={index}
                          draggable
                          onDragStart={(e) => {
                            setDraggedIndex(index);
                            e.dataTransfer.effectAllowed = 'move';
                          }}
                          onDragOver={(e) => {
                            e.preventDefault();
                            e.dataTransfer.dropEffect = 'move';
                          }}
                          onDrop={(e) => {
                            e.preventDefault();
                            if (draggedIndex !== null) reorderAnnouncements(draggedIndex, index);
                            setDraggedIndex(null);
                          }}
                          onDragEnd={() => setDraggedIndex(null)}
                          onMouseEnter={(e) => {
                            cancelCloseActionMenu();
                            const btn = e.currentTarget.querySelector('[data-action-btn]') as HTMLButtonElement;
                            if (btn) openActionMenu(index, btn);
                          }}
                          onMouseLeave={() => {
                            scheduleCloseActionMenu();
                          }}
                          onClick={() => {
                            if (selectedIndex === index) {
                              clearSelection();
                            } else {
                              const ann = config.announcementBar.announcements[index];
                              setSelectedIndex(index);
                              setSelectedUrl(ann.url || '');
                              setSelectedCtaType(ann.ctaType === 'whatsapp' ? 'whatsapp' : 'link');
                              setSelectedWhatsappNumber(ann.whatsappNumber || '');
                              setSelectedCountryCode(ann.whatsappCountryCode || '+44');
                              setSelectedOpenInNewTab(ann.openInNewTab !== undefined ? ann.openInNewTab : true);
                              setSelectedStartDate(ann.startDate || '');
                              setSelectedEndDate(ann.endDate || '');
                              const normalizedText = ann.richText ? ann.text : wrapBareTextWithFontSize(ann.text);
                              setNewAnnouncementText(normalizedText);
                              if (richEditorRef.current) {
                                richEditorRef.current.innerHTML = normalizedText;
                                richEditorRef.current.blur();
                              }
                              window.getSelection()?.removeAllRanges();
                              detectFormatsForSelectMode(normalizedText);
                            }
                          }}
                          className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm text-[#5a4138] dark:text-[#dbc1b3] bg-primary/20 group relative cursor-pointer transition-all ${selectedIndex === index ? 'ring-[1.5px] ring-primary/80 bg-primary/30' : 'hover:bg-primary/25 hover:ring-1 hover:ring-primary/70'} ${draggedIndex === index ? 'opacity-60' : ''}`}>
                          <span className="flex-1 truncate max-w-[200px]" title={stripHtml(ann.text)}>
                            {stripHtml(ann.text)}
                          </span>
                          <button
                            type="button"
                            data-action-btn
                            onClick={(e) => {
                              e.stopPropagation();
                              openActionMenu(index, e.currentTarget);
                            }}
                            className="text-[#5a4138] dark:text-[#dbc1b3] hover:opacity-80 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                            title="More options"
                          >
                            <MoreVertical className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Bottom: Loop + Style pinned to bottom */}
              <div className="shrink-0 mt-auto">
                {/* Section 2: Loop Toggle */}
                <div className="flex items-center justify-between pt-5 pb-3 border-t border-border">
                  <div>
                    <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-[0.08em]">Loop</label>
                    <p className="mt-2 text-sm text-on-surface-variant">Seamless continuous scroll (duplicates content to fill the bar)</p>
                  </div>
                  <button
                    onClick={() => {
                      setConfig({
                        ...config,
                        announcementBar: { ...config.announcementBar, loop: !(config.announcementBar.loop !== false) },
                      });
                      markChanged();
                    }}
                    aria-pressed={config.announcementBar.loop !== false}
                    title={config.announcementBar.loop !== false ? 'Continuous loop' : 'Single pass'}
                    className={`inline-flex flex-none items-center gap-2 rounded-full border px-4 py-[9px] text-[13px] font-medium cursor-pointer transition-colors duration-200 ${
                      config.announcementBar.loop !== false
                        ? 'border-transparent bg-primary/[0.13] text-primary hover:bg-primary/[0.18]'
                        : 'border-border bg-surface-elevated text-on-surface-variant hover:border-primary/50 hover:text-primary'
                    }`}
                  >
                    {config.announcementBar.loop !== false ? (
                      <>
                        <InfinityIcon className="w-4 h-4 loop-spin" />
                        Continuous
                      </>
                    ) : (
                      <>
                        <MoveLeft className="w-4 h-4" />
                        Single pass
                      </>
                    )}
                  </button>
                </div>

                {/* Section 3: Themes — one click for the whole look.
                    Replaces the old "Background Type Guide", which was a
                    non-clickable legend explaining solid/linear/radial: it
                    taught CSS vocabulary instead of letting anyone pick a bar.
                    The color controls above still fine-tune whatever a theme
                    sets. */}
                <div className="border-t border-border pt-4">
                  <div className="pb-1">
                    <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-[0.08em] mb-1">
                      Themes
                    </label>
                    <p className="mb-1 text-sm text-on-surface-variant">
                      Click any one to restyle the bar — your message stays as written.
                    </p>
                    {/* One scrolling row, not a grid: the panel's height must
                        not grow with the number of themes, so adding more
                        scrolls sideways instead of pushing everything down. */}
                    <div className="campaign-custom-scrollbar flex gap-2 overflow-x-auto px-1.5 pb-3 pt-2">
                      {announcementThemes.map((theme) => (
                        <button
                          key={theme.id}
                          type="button"
                          onClick={() => applyAnnouncementTheme(theme)}
                          title={theme.name}
                          aria-pressed={activeThemeId === theme.id}
                          style={{ background: themeBackgroundCss(theme.background) }}
                          className={`h-8 w-12 shrink-0 rounded-md ring-offset-2 ring-offset-surface transition-all hover:scale-105 ${
                            activeThemeId === theme.id
                              ? 'ring-2 ring-primary'
                              : 'ring-1 ring-border hover:ring-primary/60'
                          }`}
                        />
                      ))}
                    </div>
                  </div>

                </div>
              </div>
            </div>
          </div>
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
  );
}
