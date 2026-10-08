'use client';

import { useState, useRef, useEffect, type RefObject } from 'react';
import { isInvalidRange } from '@/lib/dateRange';
import { visibleAnnouncements } from '@/lib/announcement/announcementWindow';
import { DEFAULT_PX_PER_SEC } from '@/lib/announcement/scrollSpeed';
import { buildAnnouncementAiPrompt, chatGptUrl } from '@/lib/announcement/announcementAiPrompt';
import { readFormatsFromHtml } from '@/lib/editor/readFormatsFromHtml';
import { CampaignConfig, GradientStyle, type Announcement } from '@/types/campaign';
import { stripHtml } from '@/lib/utils';
import { useRichTextEditor } from '@/hooks/useRichTextEditor';
import { rgbToHex } from '@/lib/editor/colorUtils';
import { Toast, TOAST_ACTION_MS } from '@/components/shared/Toast';
import { useAnnouncementStyleDropdowns } from '@/components/announcement/useAnnouncementStyleDropdowns';
import { useAnnouncementPopups } from '@/components/announcement/useAnnouncementPopups';
import { useAnnouncementSelection } from '@/components/announcement/useAnnouncementSelection';
import { useAnnouncementSnapshots } from '@/components/announcement/useAnnouncementSnapshots';
import { useAnnouncementListActions } from '@/components/announcement/useAnnouncementListActions';
import { useAnnouncementStaged } from '@/components/announcement/useAnnouncementStaged';
import { useToast } from '@/hooks/useToast';
import { AnnouncementEditorPanel } from '@/components/announcement/AnnouncementEditorPanel';
import {
  AnnouncementEditorProvider,
  type AnnouncementEditorApi,
} from '@/components/announcement/AnnouncementEditorContext';
import { useEditorHistory } from '@/hooks/useEditorHistory';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { AnnouncementHeader } from '@/components/announcement/AnnouncementHeader';
import { AnnouncementPreview } from '@/components/announcement/AnnouncementPreview';
import { AnnouncementListPanel } from '@/components/announcement/AnnouncementListPanel';
import {
  matchAnnouncementTheme,
  type AnnouncementTheme,
} from '@/lib/announcement/announcementThemes';
import { addDebugLog, saveSelectedAnnouncementIndex } from '@/lib/recovery';
import { buildPreviewList, hasVisibleText } from '@/lib/announcement/stagedDraft';
import { useComposeActivity } from '@/hooks/useComposeActivity';
import { useMarqueeLayout } from '@/hooks/useMarqueeLayout';

interface AnnouncementSectionProps {
  config: CampaignConfig;
  setConfig: (config: CampaignConfig) => void;
  markChanged: () => void;
  canReactivate: boolean;
  onStop: () => void;
  onGoOnAir: () => void;
  /**
   * Holds whatever's mid-typed in the compose box across a tab switch. This
   * component unmounts every time the tab changes (it's only rendered while
   * activeTab === 'announcement'), which used to throw away newAnnouncementText
   * along with it. Owned by the parent so it survives the unmount; this
   * component just reads it back on mount and keeps it updated as you type.
   */
  pendingComposeTextRef?: RefObject<string>;
  /** Index of announcement being recovered from browser cache (was being edited). */
  recoveredSelectedAnnouncementIndex?: number | null;
  /** Called after recovered selection is applied. */
  onRestoreRecoveredSelection?: () => void;
  /**
   * Writes a draft to the cloud straight away. Staging a message has to reach
   * the database on the click, not on the next idle save, or the user would
   * not find it on another device.
   */
  saveDraftNow?: (cfg: CampaignConfig) => boolean;
  /** Publishes the given config — the chip promotes and publishes in one click. */
  publishNow?: (cfg: CampaignConfig, successMessage?: string) => Promise<void>;
  /** Shows the publish confirmation; runs `onConfirm` only if the user agrees. */
  confirmPublish?: (onConfirm: () => Promise<void>) => void;
}

function getThemeOnSurfaceHex(): string {
  if (typeof window === 'undefined') return '#000000';
  const raw = getComputedStyle(document.documentElement).getPropertyValue('--on-surface').trim();
  if (!raw) return '#000000';
  const [r, g, b] = raw.split(/\s+/).map(Number);
  if ([r, g, b].some((v) => Number.isNaN(v))) return '#000000';
  return rgbToHex(`rgb(${r}, ${g}, ${b})`);
}

export function AnnouncementSection({ config, setConfig, markChanged, canReactivate, onStop, onGoOnAir, pendingComposeTextRef, recoveredSelectedAnnouncementIndex, onRestoreRecoveredSelection, saveDraftNow, publishNow, confirmPublish }: AnnouncementSectionProps) {
  const [newAnnouncementText, setNewAnnouncementText] = useState('');
  const richEditorRef = useRef<HTMLDivElement>(null);

  // Restore whatever was mid-typed before a tab switch unmounted this
  // component. Runs once, on mount only — selectedIndex always starts null,
  // so this can never clobber an "edit existing announcement" load, which
  // sets the text itself afterward.
  useEffect(() => {
    const pending = pendingComposeTextRef?.current;
    const restoreData = {
      hasPending: !!pending,
      textLength: pending?.length || 0,
      textPreview: pending?.substring(0, 50) || '',
    };
    console.log('[ANNOUNCEMENT] Restoring from pendingComposeTextRef:', restoreData);
    addDebugLog('AnnouncementSection', 'Restore effect: checking pendingComposeTextRef', restoreData);
    
    if (pending) {
      console.log('[ANNOUNCEMENT] Setting newAnnouncementText:', pending.substring(0, 50));
      addDebugLog('AnnouncementSection', 'Restore effect: setting text', {
        textLength: pending.length,
        textPreview: pending.substring(0, 50),
      });
      setNewAnnouncementText(pending);
      if (richEditorRef.current) {
        richEditorRef.current.innerHTML = pending;
        addDebugLog('AnnouncementSection', 'Restore effect: updated richEditorRef.current.innerHTML', {
          textLength: pending.length,
        });
      }
    } else {
      addDebugLog('AnnouncementSection', 'Restore effect: no pending text', {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep the parent-owned copy in sync as the user types, so it's there to
  // restore if they switch tabs before clicking Add.
  useEffect(() => {
    if (pendingComposeTextRef) pendingComposeTextRef.current = newAnnouncementText;
  }, [newAnnouncementText, pendingComposeTextRef]);

  // Handle recovered announcement selection (which announcement was being edited)
  useEffect(() => {
    if (recoveredSelectedAnnouncementIndex !== null && recoveredSelectedAnnouncementIndex !== undefined && selectedIndex === null) {
      const debugData = {
        recoveredIndex: recoveredSelectedAnnouncementIndex,
        totalAnnouncements: config.announcementBar.announcements.length,
      };
      console.log('[ANNOUNCEMENT] Restoring selectedIndex from recovery:', debugData);
      addDebugLog('AnnouncementSection', 'Restoring selectedIndex from recovery', debugData);
      
      if (recoveredSelectedAnnouncementIndex < config.announcementBar.announcements.length) {
        setSelectedIndex(recoveredSelectedAnnouncementIndex);
        onRestoreRecoveredSelection?.();
        addDebugLog('AnnouncementSection', 'Successfully restored recovered announcement index', { index: recoveredSelectedAnnouncementIndex });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recoveredSelectedAnnouncementIndex]);

  const shortcutsTipShown = useRef(false);
  const [, setShowRichToolbar] = useState(true);
  const [showShortcutsTip, setShowShortcutsTip] = useState(false);

  // Derived from config - always in sync
  const isThemeMode = !!(config.announcementBar.activeThemeId || matchAnnouncementTheme(
    config.announcementBar.style.background,
    config.announcementBar.style.textColor
  ));

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
    selectedStartDate,
    selectedEndDate,
    selectedIndexRef,
    clearSelection,
    selectAnnouncement,
  } = selection;

  /** True only while the staged message's publish request is in flight. */
  const [publishingStaged, setPublishingStaged] = useState(false);
  /** Where a new live message will sit in the order, 1 = top. Chosen before publishing. */
  const [stagedPosition, setStagedPosition] = useState(1);
  /** Holds a staged message's HTML between Edit and the input remounting. */
  const restoreStagedHtmlRef = useRef<string | null>(null);
  /** The marquee pauses while the user is composing; see useComposeActivity. */
  const { active: composing, signal: signalComposeActivity } = useComposeActivity();
  const composeWatchStartedRef = useRef(false);

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

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  selectedIndexRef.current = selectedIndex;
  const configRef = useRef(config);
  configRef.current = config;
  const scheduleRangeInvalidRef = useRef(false);

  // Handle recovered announcement selection (which announcement was being edited)
  useEffect(() => {
    if (recoveredSelectedAnnouncementIndex !== null && recoveredSelectedAnnouncementIndex !== undefined && selectedIndex === null) {
      const debugData = {
        recoveredIndex: recoveredSelectedAnnouncementIndex,
        totalAnnouncements: config.announcementBar.announcements.length,
      };
      console.log('[ANNOUNCEMENT] Restoring selectedIndex from recovery:', debugData);
      addDebugLog('AnnouncementSection', 'Restoring selectedIndex from recovery', debugData);
      
      if (recoveredSelectedAnnouncementIndex < config.announcementBar.announcements.length) {
        setSelectedIndex(recoveredSelectedAnnouncementIndex);
        onRestoreRecoveredSelection?.();
        addDebugLog('AnnouncementSection', 'Successfully restored recovered announcement index', { index: recoveredSelectedAnnouncementIndex });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recoveredSelectedAnnouncementIndex]);

  // Track selectedIndex changes in localStorage for recovery on next crash
  useEffect(() => {
    saveSelectedAnnouncementIndex(selectedIndex);
  }, [selectedIndex]);

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

  const pxPerSec = config.announcementBar.speed ?? DEFAULT_PX_PER_SEC;

  const { removeAnnouncement, startFresh, reorderAnnouncements } = useAnnouncementListActions({
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
  });

  const { addAnnouncement, editStaged, discardStaged, publishStaged } = useAnnouncementStaged({
    config,
    setConfig,
    markChanged,
    saveDraftNow,
    publishNow,
    confirmPublish,
    selection,
    richEditorRef,
    setShowRichToolbar,
    detectFormatsForSelectMode,
    detectFormats,
    getNormalizedHTML,
    commitHistory,
    toast,
    publishingStaged,
    setPublishingStaged,
    stagedPosition,
    setStagedPosition,
    restoreStagedHtmlRef,
  });

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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- document listeners are attached once on mount; the undo/redo helpers and popup setters are recreated each render and listing them would re-subscribe every render
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
  const staged = config.announcementBar.staged ?? null;

  /**
   * What the editor currently holds, shaped as a message so the preview can
   * render it exactly as it will look once published. The HTML is passed
   * through untouched — stripping it would show unstyled text that changed
   * appearance the moment it went live.
   */
  const typing: Announcement | null = hasVisibleText(newAnnouncementText)
    ? {
      text: newAnnouncementText,
      url: selectedUrl || undefined,
      startDate: selectedStartDate || undefined,
      endDate: selectedEndDate || undefined,
      richText: true,
    }
    : null;

  const stagedIndex = config.announcementBar.stagedIndex ?? null;
  const previewList = buildPreviewList({
    visible,
    staged,
    stagedReplaces: stagedIndex !== null
      ? config.announcementBar.announcements[stagedIndex] ?? null
      : null,
    editing: selectedIndex !== null
      ? config.announcementBar.announcements[selectedIndex] ?? null
      : null,
    typing,
    position: stagedPosition,
  });
  /** Changes whenever what the preview shows changes. Drives the marquee
   *  layout below and the compose-pause watcher further down. */
  const previewSignature = previewList
    .map((m) => `${m.text}|${m.url ?? ''}|${m.startDate ?? ''}|${m.endDate ?? ''}`)
    .join('␟');

  /**
   * Keyed on what the preview actually shows — published messages plus the
   * staged or typed one — so a first staged message into an empty bar gets
   * measured (it used to draw twice, at the default speed).
   */
  const loopCopies = useMarqueeLayout(scrollContainerRef, {
    loop: config.announcementBar.loop !== false,
    pxPerSec,
    contentKey: `${previewSignature}|${config.announcementBar.active}`,
  });

  /**
   * Hold the marquee still while the user is composing.
   *
   * Keyed on what the preview actually renders, so every editing action is
   * covered by one watcher: typing, size, bold, italic, colour, the link and
   * the dates all change previewSignature. The first run is skipped — arriving at
   * the page is not composing.
   */
  useEffect(() => {
    if (!composeWatchStartedRef.current) {
      composeWatchStartedRef.current = true;
      return;
    }
    signalComposeActivity();
  }, [previewSignature, signalComposeActivity]);

  useEffect(() => {
    scrollContainerRef.current?.classList.toggle('announcement-editing', composing);
  }, [composing]);

  const editorApi: AnnouncementEditorApi = {
    ...styleDropdowns,
    ...popups,
    ...selection,
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
    staged,
    stagedIndex,
    editStaged,
    discardStaged,
    publishStaged,
    publishingStaged,
    stagedPosition,
    setStagedPosition,
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
            visibleAnnouncements={previewList}
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
              reorderAnnouncements={reorderAnnouncements}
              draggedIndex={draggedIndex}
              setDraggedIndex={setDraggedIndex}
              onEdit={selectAnnouncement}
              onCancelEdit={clearSelection}
              onDelete={removeAnnouncement}
              locked={staged !== null}
              stagedIndex={stagedIndex}
            />
          </div>
        </div>

        {showShortcutsTip && (
          <div className="fixed top-5 left-5 z-50 animate-bounce-in">
            {/* <div className="bg-black/10 backdrop-blur-sm border border-white/10 rounded-2xl shadow-2xl px-5 py-4 w-[380px]"> */}
              <div className=" bg-black/10 backdrop-blur-md border border-white/10 rounded-2xl shadow-2xl px-5 py-4 w-[380px]">
              
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