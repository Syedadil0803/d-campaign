'use client';

import { useState, useRef, useEffect } from 'react';
import { isInvalidRange } from '@/lib/dateRange';
import { visibleAnnouncements } from '@/lib/announcement/announcementWindow';
import { marqueeDurationSeconds, DEFAULT_PX_PER_SEC } from '@/lib/announcement/scrollSpeed';
import { buildAnnouncementAiPrompt, chatGptUrl } from '@/lib/announcement/announcementAiPrompt';
import { readFormatsFromHtml } from '@/lib/editor/readFormatsFromHtml';
import { CampaignConfig, GradientStyle, defaultConfig } from '@/types/campaign';
import { stripHtml } from '@/lib/utils';
import { useRichTextEditor } from '@/hooks/useRichTextEditor';
import { rgbToHex } from '@/lib/editor/colorUtils';
import { Toast, TOAST_ACTION_MS, type ToastAction } from '@/components/shared/Toast';
import { useAnnouncementStyleDropdowns } from '@/components/announcement/useAnnouncementStyleDropdowns';
import { useAnnouncementPopups } from '@/components/announcement/useAnnouncementPopups';
import { useAnnouncementSelection } from '@/components/announcement/useAnnouncementSelection';
import { useAnnouncementRowMenu } from '@/components/announcement/useAnnouncementRowMenu';
import { useAnnouncementSnapshots } from '@/components/announcement/useAnnouncementSnapshots';
import { useToast } from '@/hooks/useToast';
import { AnnouncementEditorPanel } from '@/components/announcement/AnnouncementEditorPanel';
import {
  AnnouncementEditorProvider,
  type AnnouncementEditorApi,
} from '@/components/announcement/AnnouncementEditorContext';
import { whatsAppUrl } from '@/lib/whatsapp';
import { useEditorHistory } from '@/hooks/useEditorHistory';
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
  canReactivate: boolean;
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
  const richEditorRef = useRef<HTMLDivElement>(null);

  const [showShortcutsTip, setShowShortcutsTip] = useState(false);
  const shortcutsTipShown = useRef(false);
  const [, setShowRichToolbar] = useState(true);
  const [loopCopies, setLoopCopies] = useState(1);

  // Derived from config - always in sync
  const isThemeMode = !!(config.announcementBar.activeThemeId || matchAnnouncementTheme(
    config.announcementBar.style.background,
    config.announcementBar.style.textColor
  ));

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

  const [showStopConfirm, setShowStopConfirm] = useState(false);
  const [showGoOnAirConfirm, setShowGoOnAirConfirm] = useState(false);
  const [showResetMenu, setShowResetMenu] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const resetMenuRef = useRef<HTMLDivElement>(null);

  const styleDropdowns = useAnnouncementStyleDropdowns();
  const { } = styleDropdowns;

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
    selectedOpenInNewTab,
    selectedStartDate,
    selectedEndDate,
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

  const history = useEditorHistory();
  const {
    pushImmediateState,
    undoEditor, redoEditor, undoLink, redoLink,
    commit: commitHistory,
  } = history;

  const {
    restoringSnapshotRef,
    getEditorSnapshot,
    applyEditorSnapshot,
    getLinkSnapshot,
    applyLinkSnapshot,
  } = useAnnouncementSnapshots({
    config,
    setConfig,
    richEditorRef,
    editorDefaultColor,
    setActiveFormats,
    setNewAnnouncementText,
    selection,
  });

  const { showToast, toastMessage, toastIsError, toastAction, toast } = useToast();

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
  }, [setActiveFormats]);

  const [resizeTick, setResizeTick] = useState(0);
  useEffect(() => {
    let frame = 0;
    const onResize = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => setResizeTick((t) => t + 1));
    };
    window.addEventListener('resize', onResize);
    return () => { window.removeEventListener('resize', onResize); cancelAnimationFrame(frame); };
  }, []);

  const pxPerSec = config.announcementBar.speed ?? DEFAULT_PX_PER_SEC;
  useEffect(() => {
    if (!scrollContainerRef.current) return;
    const container = scrollContainerRef.current;
    const containerWidth = container.clientWidth;
    if (containerWidth <= 0) return;

    const track = container.querySelector('.animate-scroll-left') as HTMLElement | null;
    if (!track) return;

    const paused = pxPerSec <= 0;
    container.classList.toggle('announcement-paused', paused);
    track.dataset.pxPerSec = String(pxPerSec);

    const halfWidth = track.scrollWidth / 2;
    if (halfWidth <= 0) return;

    if (paused) {
      const firstSet = track.firstElementChild as HTMLElement | null;
      const contentWidth = firstSet ? firstSet.scrollWidth : 0;
      container.classList.toggle('paused-fits', contentWidth > 0 && contentWidth <= containerWidth);
      return;
    }
    container.classList.remove('paused-fits');

    if (config.announcementBar.loop !== false) {
      const oneSetWidth = halfWidth / loopCopies;
      if (oneSetWidth <= 0) return;
      const needed = Math.max(1, Math.ceil(containerWidth / oneSetWidth));
      if (needed !== loopCopies) setLoopCopies(needed);
    } else {
      container.style.setProperty('--set-min-width', `${containerWidth}px`);
      setLoopCopies(1);
    }

    const duration = marqueeDurationSeconds(halfWidth, pxPerSec);
    track.style.setProperty('--scroll-duration', `${duration.toFixed(1)}s`);
  }, [config.announcementBar.announcements, config.announcementBar.active, config.announcementBar.loop, pxPerSec, loopCopies, resizeTick]);

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
  }, []);

  function addAnnouncement() {
    commitHistory();
    const html = getNormalizedHTML();
    const updated = [...config.announcementBar.announcements];
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
    toast(
      selectedIndex !== null ? 'Announcement updated' : 'Announcement added',
      false,
      undefined,
      2500,
    );
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
    toast('Announcement deleted', false, undoListAction(previous));
  }

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
    toast('All announcements cleared', false, undoListAction(previous));
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
    toast('Order changed', false, undoListAction(previous));
  }

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

      if (target.isContentEditable) {
        return;
      }

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
    setActiveFormats(readFormatsFromHtml(html, editorDefaultColor));
  }

  const applyingFormatRef = useRef(false);
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

  function onRichTextInput() {
    if (applyingFormatRef.current) return;
    if (restoringSnapshotRef.current) return;
    const html = getNormalizedHTML();
    setNewAnnouncementText(html);
  }

  function updateBg(patch: Partial<GradientStyle>) {
    setConfig({
      ...config,
      announcementBar: {
        ...config.announcementBar,
        activeThemeId: undefined,
        style: {
          ...config.announcementBar.style,
          background: { ...config.announcementBar.style.background, ...patch },
        },
      },
    });
    markChanged();
  }

  function updateBgWithHistory(patch: Partial<GradientStyle>) {
    pushImmediateState(getEditorSnapshot());
    updateBg(patch);
  }

  function applyAnnouncementTheme(theme: AnnouncementTheme) {
    pushImmediateState(getEditorSnapshot());
    setConfig({
      ...config,
      announcementBar: {
        ...config.announcementBar,
        activeThemeId: theme.id,
        style: {
          ...config.announcementBar.style,
          background: { ...config.announcementBar.style.background, ...theme.background },
          textColor: theme.textColor,
        },
      },
    });
    markChanged();
  }

  function confirmStop() {
    setShowStopConfirm(false);
    onStop();
  }

  function confirmGoOnAir() {
    setShowGoOnAirConfirm(false);
    onGoOnAir();
  }

  function openChatGptWithPrompt() {
    const plainText = stripHtml(newAnnouncementText || richEditorRef.current?.innerHTML || '').trim();
    window.open(chatGptUrl(buildAnnouncementAiPrompt(plainText)), '_blank', 'noopener,noreferrer');
  }

  const bg = config.announcementBar.style.background;
  /** Explicitly selected theme only — no color-match fallback. */
  const activeThemeId = config.announcementBar.activeThemeId ?? null;
  const [previewDirection, setPreviewDirection] = useState<string | null>(null);
  const previewBg = previewDirection ? { ...bg, direction: previewDirection } : bg;
  const scheduleRangeInvalid = isInvalidRange(selectedStartDate, selectedEndDate);
  scheduleRangeInvalidRef.current = scheduleRangeInvalid;

  const visible = visibleAnnouncements(config.announcementBar.announcements);

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
    applyAnnouncementTheme,
    activeThemeId,
    isThemeMode,
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
          show={showToast}
          message={toastMessage}
          isError={toastIsError}
          action={toastAction}
          actionDurationMs={TOAST_ACTION_MS}
        />

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

        <div className="space-y-6">
          <AnnouncementPreview
            config={config}
            previewBg={previewBg}
            visibleAnnouncements={visible}
            loopCopies={loopCopies}
            scrollContainerRef={scrollContainerRef}
            loop={config.announcementBar.loop !== false}
            speed={pxPerSec}
            onLoopChange={(next) => {
              setConfig({ ...config, announcementBar: { ...config.announcementBar, loop: next } });
              markChanged();
            }}
            onSpeedChange={(next) => {
              setConfig({ ...config, announcementBar: { ...config.announcementBar, speed: next } });
              markChanged();
            }}
          />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
            <AnnouncementEditorPanel />
            <AnnouncementListPanel
              config={config}
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