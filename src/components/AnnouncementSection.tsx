'use client';

import { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { Megaphone, MoreVertical } from 'lucide-react';
import { CampaignConfig } from '@/types/campaign';
import { getBackgroundStyle, stripHtml } from '@/lib/utils';
import { useRichTextEditor } from '@/hooks/useRichTextEditor';
import { wrapBareTextWithFontSize, rgbToHex, FONT_SIZE_LABEL_MAP } from '@/lib/richTextUtils';
import RichTextToolbar from './RichTextToolbar';

interface AnnouncementSectionProps {
  config: CampaignConfig;
  setConfig: (config: CampaignConfig) => void;
  markChanged: () => void;
}

export function AnnouncementSection({ config, setConfig, markChanged }: AnnouncementSectionProps) {
  const [newAnnouncementText, setNewAnnouncementText] = useState('');
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedUrl, setSelectedUrl] = useState('');
  const [selectedOpenInNewTab, setSelectedOpenInNewTab] = useState(false);
  const [selectedStartDate, setSelectedStartDate] = useState('');
  const [selectedEndDate, setSelectedEndDate] = useState('');
  const [showShortcutsTip, setShowShortcutsTip] = useState(false);
  const shortcutsTipShown = useRef(false);
  const [showRichToolbar, setShowRichToolbar] = useState(false);
  const [showSelectHint, setShowSelectHint] = useState(false);

  // Undo/Redo history
  const undoStackRef = useRef<CampaignConfig['announcementBar']['announcements'][]>([]);
  const redoStackRef = useRef<CampaignConfig['announcementBar']['announcements'][]>([]);
  const MAX_HISTORY = 30;
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [actionMenuIndex, setActionMenuIndex] = useState<number | null>(null);
  const [actionMenuPos, setActionMenuPos] = useState<{ top: number; left: number } | null>(null);

  // Popup state
  const [showLinkPopup, setShowLinkPopup] = useState(false);
  const [showSchedulePopup, setShowSchedulePopup] = useState(false);
  const [linkPos, setLinkPos] = useState<{ top: number; left: number } | null>(null);
  const [schedulePos, setSchedulePos] = useState<{ top: number; left: number } | null>(null);

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
  const actionMenuRef = useRef<HTMLDivElement>(null);

  const {
    activeFormats,
    setActiveFormats,
    formatText,
    applyColor,
    detectFormats,
    ensureDefaultFontSize,
    saveSelection,
    getNormalizedHTML,
  } = useRichTextEditor(richEditorRef, { defaultColor: '#000000' });

  // Dynamic scroll speed calculation
  useEffect(() => {
    if (scrollContainerRef.current && config.announcementBar.active) {
      const container = scrollContainerRef.current;
      const track = container.querySelector('.animate-scroll-left') as HTMLElement;

      if (track) {
        const contentWidth = track.scrollWidth;
        const pixelsPerSecond = 60;
        const duration = (contentWidth / 2) / pixelsPerSecond;
        container.style.setProperty('--scroll-duration', duration + 's');
      }
    }
  }, [config.announcementBar.announcements, config.announcementBar.active]);

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
        pushUndo();
        const currentConfig = configRef.current;
        const updated = currentConfig.announcementBar.announcements.filter((_, i) => i !== idx);
        setConfig({
          ...currentConfig,
          announcementBar: { ...currentConfig.announcementBar, announcements: updated },
        });
        clearSelection();
        markChanged();
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
        schedulePopupRef.current && !schedulePopupRef.current.contains(target) &&
        scheduleBtnRef.current && !scheduleBtnRef.current.contains(target)
      ) {
        setShowSchedulePopup(false);
      }
      if (actionMenuIndex !== null && actionMenuRef.current && !actionMenuRef.current.contains(target)) {
        setActionMenuIndex(null);
        setActionMenuPos(null);
      }
    };
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, [showLinkPopup, showSchedulePopup, actionMenuIndex]);

  function addAnnouncement() {
    pushUndo();
    const html = getNormalizedHTML();
    const updated = [...config.announcementBar.announcements];

    if (selectedIndex !== null) {
      updated[selectedIndex] = {
        ...updated[selectedIndex],
        text: html,
        url: selectedUrl || undefined,
        openInNewTab: selectedOpenInNewTab || undefined,
        startDate: selectedStartDate || undefined,
        endDate: selectedEndDate || undefined,
        richText: true,
      };
    } else {
      updated.push({
        text: html,
        url: selectedUrl || undefined,
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
  }

  function removeAnnouncement(index: number) {
    pushUndo();
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
  }

  function reorderAnnouncements(fromIndex: number, toIndex: number) {
    pushUndo();
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
  }

  // ── Push current state to undo stack before a change ──
  function pushUndo() {
    undoStackRef.current.push([...configRef.current.announcementBar.announcements]);
    if (undoStackRef.current.length > MAX_HISTORY) undoStackRef.current.shift();
    redoStackRef.current = [];
  }

  function undo() {
    if (undoStackRef.current.length === 0) return;
    redoStackRef.current.push([...configRef.current.announcementBar.announcements]);
    const prev = undoStackRef.current.pop()!;
    setConfig({
      ...configRef.current,
      announcementBar: { ...configRef.current.announcementBar, announcements: prev },
    });
    clearSelection();
    markChanged();
  }

  function redo() {
    if (redoStackRef.current.length === 0) return;
    undoStackRef.current.push([...configRef.current.announcementBar.announcements]);
    const next = redoStackRef.current.pop()!;
    setConfig({
      ...configRef.current,
      announcementBar: { ...configRef.current.announcementBar, announcements: next },
    });
    clearSelection();
    markChanged();
  }

  // ── Undo/Redo keyboard shortcut ──
  useEffect(() => {
    const handleUndoRedo = (e: KeyboardEvent) => {
      const isMac = navigator.platform?.includes('Mac');
      const mod = isMac ? e.metaKey : e.ctrlKey;
      if (!mod || e.key.toLowerCase() !== 'z') return;
      // Don't intercept when typing in the editor
      const target = e.target as HTMLElement;
      if (target.isContentEditable) return;
      e.preventDefault();
      if (e.shiftKey) {
        redo();
      } else {
        undo();
      }
    };
    document.addEventListener('keydown', handleUndoRedo);
    return () => document.removeEventListener('keydown', handleUndoRedo);
  }, []);

  // ── Clear all selection/editing state ──
  function clearSelection() {
    setSelectedIndex(null);
    setIsEditing(false);
    setNewAnnouncementText('');
    setSelectedUrl('');
    setSelectedOpenInNewTab(false);
    setSelectedStartDate('');
    setSelectedEndDate('');
    setShowRichToolbar(false);
    if (richEditorRef.current) {
      richEditorRef.current.innerHTML = '';
      richEditorRef.current.blur();
    }
    window.getSelection()?.removeAllRanges();
  }

  // ── Select announcement (selection mode — no cursor) ──
  function selectAnnouncement(index: number) {
    const ann = config.announcementBar.announcements[index];
    setSelectedIndex(index);
    setIsEditing(false);
    setSelectedUrl(ann.url || '');
    setSelectedOpenInNewTab(ann.openInNewTab || false);
    setSelectedStartDate(ann.startDate || '');
    setSelectedEndDate(ann.endDate || '');
    const normalizedText = ann.richText ? ann.text : wrapBareTextWithFontSize(ann.text);
    setNewAnnouncementText(normalizedText);
    setShowRichToolbar(true);
    // Remove focus/cursor — just display content
    if (richEditorRef.current) {
      richEditorRef.current.innerHTML = normalizedText;
      richEditorRef.current.blur();
    }
    window.getSelection()?.removeAllRanges();
    // Detect if styles are uniform — if mixed, show neutral toolbar state
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
      setActiveFormats({ bold: false, italic: false, size: 'md', color: '#000000' });
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
          const label = FONT_SIZE_LABEL_MAP[node.style.fontSize];
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
      color: colors.size === 1 ? [...colors][0] : (colors.size === 0 ? '#000000' : ''),
    });
  }

  // ── Apply format to entire content (selection mode) ──
  const applyingFormatRef = useRef(false);
  const justFocusedRef = useRef(false);
  function applyFormatToAll(action: () => void) {
    if (!richEditorRef.current) return;
    const editor = richEditorRef.current;
    const hasContent = editor.textContent?.replace(/\u200B/g, '').trim();
    // Empty: don't touch DOM, just let toolbar state track the choice
    if (!hasContent) return;
    // Has content: select all and apply
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
  }

  function openActionMenu(index: number, button: HTMLButtonElement) {
    const rect = button.getBoundingClientRect();
    setActionMenuIndex(index);
    setActionMenuPos({
      top: rect.bottom + window.scrollY + 6,
      left: Math.max(12, rect.right + window.scrollX - 180),
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
    const html = getNormalizedHTML();
    setNewAnnouncementText(html);
  }

  // ── Style helpers ──
  function updateBg(patch: Record<string, any>) {
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

  function toggleActive() {
    setConfig({
      ...config,
      announcementBar: { ...config.announcementBar, active: !config.announcementBar.active },
    });
    markChanged();
  }

  const bg = config.announcementBar.style.background;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

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
    <section className="bg-surface-elevated shadow rounded-2xl border border-border overflow-hidden">
      {/* Header */}
      <div className="px-4 py-2 border-b border-border bg-surface/60 flex items-center justify-between">
        <div className="flex items-center">
          <div className="p-1 bg-primary/15 rounded-lg mr-3 border border-primary/30"><Megaphone className="w-4 h-4 text-primary" /></div>
          <div>
            <h3 className="text-lg leading-6 font-semibold text-on-surface">Announcement Bar</h3>
            <p className="mt-0.5 max-w-2xl text-xs text-on-surface-variant">Top banner for site-wide alerts.</p>
          </div>
        </div>
        <button onClick={toggleActive} className={`relative inline-flex flex-shrink-0 h-6 w-11 border-2 border-transparent rounded-full cursor-pointer transition-all duration-200 hover:shadow-sm hover:shadow-primary/20 ${config.announcementBar.active ? 'bg-primary' : 'bg-surface-subtle hover:bg-primary/20'}`}>
          <span className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform transition duration-200 ${config.announcementBar.active ? 'translate-x-5' : 'translate-x-0'}`} />
        </button>
      </div>

      <div className="p-5 space-y-6">
        {/* Preview */}
        <div className="bg-surface-subtle p-4 border border-border rounded-md">
          <h4 className="text-xs font-semibold text-on-surface-variant uppercase tracking-wide mb-2">Preview</h4>
          <div className="w-full bg-surface-elevated border border-border rounded shadow-sm overflow-hidden">
            {config.announcementBar.active && visibleAnnouncements.length > 0 && (
              <div ref={scrollContainerRef} className="h-10 px-4 text-center text-sm font-medium overflow-hidden flex items-center justify-center group"
                style={{
                  background: getBackgroundStyle(config.announcementBar.style.background),
                  color: config.announcementBar.style.textColor,
                }}>
                <div className="animate-scroll-left">
                  {[...Array(4)].map((_, setIndex) =>
                    visibleAnnouncements.map((ann, i) => (
                      <span key={`${setIndex}-${i}`} className="inline-block px-4">
                        {ann.url ? (
                          <a href={ann.url} target="_blank" rel="noopener noreferrer" className="underline hover:no-underline" dangerouslySetInnerHTML={{ __html: ann.text }} />
                        ) : (
                          <span dangerouslySetInnerHTML={{ __html: ann.text }} />
                        )}
                      </span>
                    ))
                  ).flat()}
                </div>
              </div>
            )}
            {!(config.announcementBar.active && visibleAnnouncements.length > 0) && (
              <div className="h-12 bg-surface-elevated flex items-center justify-between px-4 border-b border-border">
                <div className="w-24 h-4 bg-surface-subtle rounded" />
                <div className="flex space-x-2">
                  <div className="w-12 h-4 bg-surface-subtle rounded" />
                  <div className="w-12 h-4 bg-surface-subtle rounded" />
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-stretch">
          {/* Left: Input + Chips + Link */}
          <div className="space-y-4 rounded-2xl border border-border bg-surface-elevated p-4 shadow-sm flex flex-col h-full transition-all hover:border-primary/35 hover:shadow-md hover:shadow-primary/10">
            <div className="border-b border-border pb-3">
              <h4 className="text-base font-semibold text-on-surface">Announcement Content</h4>
              <p className="mt-1 text-xs text-on-surface-variant">Create your message, optionally attach a link, and add timing only if needed.</p>
            </div>
            
            {/* Announcement Input */}
            <div className="flex-1 flex flex-col justify-between">
              <label className="block text-sm font-medium text-on-surface mb-2">Message</label>

              {/* Rich Text Toolbar + Link/Schedule buttons — same row, show/hide with focus */}
              <div className={`mb-2 transition-all ${showRichToolbar ? 'opacity-100 max-h-20' : 'opacity-0 max-h-0 overflow-hidden pointer-events-none'}`}>
                {showSelectHint && (
                  <p className="text-[11px] text-primary font-medium mb-1 animate-pulse">✋ Select text first to change its style</p>
                )}
                <div className="flex items-center gap-1">
                  <div className="flex-1 min-w-0">
                    <RichTextToolbar
                      activeFormats={activeFormats}
                      onFormat={(format) => {
                        if (!isEditing) {
                          applyFormatToAll(() => formatText(format));
                          // Ensure toolbar reflects the size
                          if (format.startsWith('size-')) {
                            setActiveFormats(prev => ({ ...prev, size: format.replace('size-', '') }));
                          } else if (format === 'bold') {
                            setActiveFormats(prev => ({ ...prev, bold: !prev.bold }));
                          } else if (format === 'italic') {
                            setActiveFormats(prev => ({ ...prev, italic: !prev.italic }));
                          }
                        } else {
                          // Only apply if text is selected
                          const sel = window.getSelection();
                          if (sel && !sel.isCollapsed) {
                            saveSelection();
                            formatText(format);
                            // After format, update toolbar from the new DOM state
                            // but preserve color if not found
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
                            setShowSelectHint(true);
                            setTimeout(() => setShowSelectHint(false), 2000);
                          }
                        }
                      }}
                      onColorSelect={(color) => {
                        if (!isEditing) {
                          // In select mode: apply to all content or set for future typing
                          if (richEditorRef.current) {
                            const hasContent = richEditorRef.current.textContent?.replace(/\u200B/g, '').trim();
                            if (hasContent) {
                              applyFormatToAll(() => applyColor(color));
                            }
                          }
                          setActiveFormats(prev => ({ ...prev, color }));
                        } else {
                          const sel = window.getSelection();
                          if (sel && !sel.isCollapsed) {
                            saveSelection();
                            applyColor(color);
                            onRichTextInput();
                          } else {
                            setShowSelectHint(true);
                            setTimeout(() => setShowSelectHint(false), 2000);
                          }
                        }
                      }}
                    />
                  </div>

                  {/* Divider */}
                  <div className="border-l border-border h-4 mx-0.5 shrink-0" />

                  {/* Link button */}
                  <button
                    ref={linkBtnRef}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      if (!newAnnouncementText.trim()) return;
                      setShowLinkPopup(!showLinkPopup);
                      setShowSchedulePopup(false);
                    }}
                    disabled={!newAnnouncementText.trim()}
                    className={`cursor-pointer flex items-center px-1.5 py-1 border rounded transition-colors shrink-0 disabled:opacity-40 disabled:cursor-not-allowed ${selectedUrl ? 'border-primary/50 bg-primary/10 text-primary' : 'border-border hover:border-primary/35 hover:bg-primary/10 hover:text-primary text-on-surface-variant'}`}
                    title={newAnnouncementText.trim() ? 'Add link' : 'Enter text first'}
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                    </svg>
                  </button>

                  {/* Schedule button */}
                  <button
                    ref={scheduleBtnRef}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      if (!newAnnouncementText.trim()) return;
                      setShowSchedulePopup(!showSchedulePopup);
                      setShowLinkPopup(false);
                    }}
                    disabled={!newAnnouncementText.trim()}
                    className={`cursor-pointer flex items-center px-1.5 py-1 border rounded transition-colors shrink-0 disabled:opacity-40 disabled:cursor-not-allowed ${(selectedStartDate || selectedEndDate) ? 'border-primary/50 bg-primary/10 text-primary' : 'border-border hover:border-primary/35 hover:bg-primary/10 hover:text-primary text-on-surface-variant'}`}
                    title={newAnnouncementText.trim() ? 'Schedule' : 'Enter text first'}
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </button>
                </div>
              </div>

              <div className="flex gap-2 items-end">
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-on-surface-variant mb-1">Enter text below</p>
                  <div ref={richEditorRef} contentEditable suppressContentEditableWarning
                    onInput={onRichTextInput}
                    onMouseDown={() => {
                      // If already focused and in select mode, enter edit mode
                      if (document.activeElement === richEditorRef.current && showRichToolbar && !isEditing) {
                        setIsEditing(true);
                        justFocusedRef.current = true;
                        setTimeout(() => {
                          if (richEditorRef.current) {
                            const editor = richEditorRef.current;
                            const hasContent = editor.textContent?.replace(/\u200B/g, '').trim();
                            if (!hasContent) {
                              // Empty: create a span with all chosen properties
                              const { size, color, bold, italic } = activeFormats;
                              const fontSize = size ? ({ xs: '0.75rem', sm: '0.875rem', md: '1rem', lg: '1.125rem', xl: '1.25rem', xxl: '1.5rem' }[size] || '1rem') : '1rem';
                              let html = `<span style="font-size: ${fontSize}; color: ${color || '#000000'}">\u200B</span>`;
                              if (bold) html = `<b>${html}</b>`;
                              if (italic) html = `<i>${html}</i>`;
                              editor.innerHTML = html;
                            }
                            // Place cursor inside the deepest last node
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
                          }
                        }, 0);
                      }
                    }}
                    onMouseUp={() => {
                      if (justFocusedRef.current) {
                        justFocusedRef.current = false;
                        return;
                      }
                      if (isEditing) {
                        detectFormats();
                      }
                    }}
                    onKeyUp={() => {
                      if (isEditing) {
                        detectFormats();
                      }
                    }}
                    onKeyDown={(e) => {
                      // Any typing enters edit mode
                      if (!isEditing && !e.metaKey && !e.ctrlKey && e.key.length === 1) {
                        setIsEditing(true);
                      }
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        addAnnouncement();
                      }
                    }}
                    onFocus={() => {
                      if (applyingFormatRef.current) return;
                      justFocusedRef.current = true;
                      // If already in select mode (e.g. from chip click), go straight to edit mode
                      if (showRichToolbar && !isEditing) {
                        setIsEditing(true);
                        setTimeout(() => {
                          if (richEditorRef.current) {
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
                        }, 0);
                        return;
                      }
                      setShowRichToolbar(true);
                      if (!shortcutsTipShown.current && localStorage.getItem('ann_shortcuts_seen') !== 'never') {
                        shortcutsTipShown.current = true;
                        setShowShortcutsTip(true);
                      }
                      // Always enter select mode first (cell behavior)
                      setIsEditing(false);
                      window.getSelection()?.removeAllRanges();
                      if (richEditorRef.current) {
                        const html = richEditorRef.current.innerHTML;
                        const hasContent = richEditorRef.current.textContent?.replace(/\u200B/g, '').trim();
                        if (hasContent) {
                          detectFormatsForSelectMode(html);
                        } else {
                          // Empty: show defaults
                          setActiveFormats({ bold: false, italic: false, size: 'md', color: '#000000' });
                        }
                      }
                    }}
                    onBlur={() => {
                      // Don't hide toolbar if in select mode or if applying format
                      if (applyingFormatRef.current) return;
                      if (!isEditing && showRichToolbar) return;
                      const text = richEditorRef.current?.textContent?.replace(/\u200B/g, '').trim();
                      if (!text && selectedIndex === null) {
                        setShowRichToolbar(false);
                        setIsEditing(false);
                        if (richEditorRef.current) richEditorRef.current.innerHTML = '';
                      }
                    }}
                    className={`rich-editor shadow-sm block w-full sm:text-sm rounded-md p-3 border outline-none overflow-y-auto overflow-x-hidden h-[44px] min-h-[44px] max-h-[360px] resize-y break-words transition-colors ${!isEditing && showRichToolbar ? 'ring-2 ring-primary/50 border-primary/50 cursor-default caret-transparent' : 'focus:ring-primary/40 focus:border-primary/50 hover:border-primary/35 border-border'}`}
                    style={{ background: getBackgroundStyle(config.announcementBar.style.background), wordBreak: 'break-word', overflowWrap: 'break-word', maxWidth: '100%' }} />
                </div>
                <button onMouseDown={(e) => {
                    e.preventDefault();
                    addAnnouncement();
                  }}
                  disabled={!newAnnouncementText.trim()}
                  className="px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary hover:opacity-95 disabled:opacity-50 disabled:cursor-not-allowed self-end">
                  Add
                </button>
                </div>
              </div>

            {/* Link popup portal */}
            {showLinkPopup && linkPos && typeof document !== 'undefined' && createPortal(
              <div
                ref={linkPopupRef}
                onMouseDown={(e) => e.stopPropagation()}
                style={{ position: 'absolute', top: linkPos.top, left: linkPos.left, zIndex: 9999 }}
                className="bg-surface-elevated border border-border rounded-lg shadow-xl p-3 w-[260px]"
              >
                <p className="text-xs font-medium text-on-surface mb-2">Link URL</p>
                <input
                  type="url"
                  value={selectedUrl}
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
                <p className="text-[10px] text-on-surface-variant mt-1">In this editor, links always open in a new tab. This setting applies to your live site only.</p>
                <div className="flex justify-between items-center mt-2">
                  {selectedUrl && (
                    <button
                      onMouseDown={(e) => {
                        e.preventDefault();
                        setSelectedUrl('');
                        if (selectedIndex !== null) {
                          const updated = [...config.announcementBar.announcements];
                          updated[selectedIndex] = { ...updated[selectedIndex], url: undefined, richText: true };
                          setConfig({ ...config, announcementBar: { ...config.announcementBar, announcements: updated } });
                          markChanged();
                        }
                        setShowLinkPopup(false);
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
                    className="ml-auto text-xs bg-primary text-white px-3 py-1 rounded hover:opacity-95"
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
                style={{ position: 'absolute', top: schedulePos.top, left: schedulePos.left, zIndex: 9999 }}
                className="bg-surface-elevated border border-border rounded-lg shadow-xl p-3 w-[260px]"
              >
                <p className="text-xs font-medium text-on-surface mb-2">Schedule (optional)</p>
                <div className="space-y-2">
                  <div>
                    <label className="block text-[11px] text-on-surface-variant mb-0.5">Start Date</label>
                    <input
                      type="date"
                      value={selectedStartDate}
                      onChange={(e) => {
                        const nextStart = e.target.value;
                        setSelectedStartDate(nextStart);
                        if (selectedIndex !== null) {
                          const updated = [...config.announcementBar.announcements];
                          updated[selectedIndex] = { ...updated[selectedIndex], startDate: nextStart || undefined, richText: true };
                          setConfig({ ...config, announcementBar: { ...config.announcementBar, announcements: updated } });
                          markChanged();
                        }
                      }}
                      className="block w-full border-border rounded-md p-1.5 border bg-surface text-on-surface text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-on-surface-variant mb-0.5">End Date</label>
                    <input
                      type="date"
                      value={selectedEndDate}
                      onChange={(e) => {
                        const nextEnd = e.target.value;
                        setSelectedEndDate(nextEnd);
                        if (selectedIndex !== null) {
                          const updated = [...config.announcementBar.announcements];
                          updated[selectedIndex] = { ...updated[selectedIndex], endDate: nextEnd || undefined, richText: true };
                          setConfig({ ...config, announcementBar: { ...config.announcementBar, announcements: updated } });
                          markChanged();
                        }
                      }}
                      className="block w-full border-border rounded-md p-1.5 border bg-surface text-on-surface text-sm"
                    />
                  </div>
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
                      closePopupAndFocusEditor();
                    }}
                    className="ml-auto text-xs bg-primary text-white px-3 py-1 rounded hover:opacity-95"
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
                style={{ position: 'absolute', top: actionMenuPos.top, left: actionMenuPos.left, zIndex: 9999 }}
                className="bg-surface-elevated border border-border rounded-lg shadow-xl py-1 w-[180px]"
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
              <label className="block text-sm font-medium text-on-surface mb-2">Style Customization</label>
              <div>
                <label className="block text-xs text-on-surface-variant mb-1">Background Type</label>
                <select value={bg.type || 'solid'} onChange={(e) => updateBg({ type: e.target.value })}
                  className="block w-full border-border rounded-md p-2 border bg-surface text-on-surface sm:text-sm">
                  <option value="solid">Solid</option>
                  <option value="linear">Linear</option>
                  <option value="radial">Gradient</option>
                </select>
              </div>

              {bg.type === 'solid' && (
                <div className="mt-4">
                  <label className="block text-xs text-on-surface-variant mb-1">Background Color</label>
                  <input type="color" value={bg.startColor} onChange={(e) => updateBg({ startColor: e.target.value })}
                    className="h-10 w-full rounded border border-border cursor-pointer" />
                </div>
              )}

              {bg.type === 'linear' && (
                <>
                  <div className="grid grid-cols-3 gap-4 mt-4">
                    <div>
                      <label className="block text-xs text-on-surface-variant mb-1">Start Color</label>
                      <input type="color" value={bg.startColor} onChange={(e) => updateBg({ startColor: e.target.value })}
                        className="h-10 w-full rounded border border-border cursor-pointer" />
                    </div>
                    <div>
                      <label className="block text-xs text-on-surface-variant mb-1">End Color</label>
                      <input type="color" value={bg.endColor} onChange={(e) => updateBg({ endColor: e.target.value })}
                        className="h-10 w-full rounded border border-border cursor-pointer" />
                    </div>
                    <div>
                      <label className="block text-xs text-on-surface-variant mb-1">Direction</label>
                      <select value={bg.direction || 'to right'} onChange={(e) => updateBg({ direction: e.target.value })}
                        className="block w-full border-border rounded-md p-2 border bg-surface text-on-surface sm:text-sm">
                        <option value="to right">To Right →</option>
                        <option value="to left">To Left ←</option>
                        <option value="to bottom">To Bottom ↓</option>
                        <option value="to top">To Top ↑</option>
                        <option value="to bottom right">To Bottom Right ↘</option>
                        <option value="to bottom left">To Bottom Left ↙</option>
                        <option value="to top right">To Top Right ↗</option>
                        <option value="to top left">To Top Left ↖</option>
                      </select>
                    </div>
                  </div>
                  <div className="mt-4 space-y-2">
                    <label className="block text-xs text-on-surface-variant">Balance: {bg.midpoint ?? 50}%</label>
                    <input type="range" min="0" max="100" value={bg.midpoint ?? 50}
                      onChange={(e) => updateBg({ midpoint: Number(e.target.value) })}
                      className="w-full h-2 bg-surface-subtle rounded-lg appearance-none cursor-pointer" />
                  </div>
                </>
              )}

              {bg.type === 'radial' && (
                <>
                  <div className="grid grid-cols-2 gap-4 mt-4">
                    <div>
                      <label className="block text-xs text-on-surface-variant mb-1">Center Color</label>
                      <input type="color" value={bg.startColor} onChange={(e) => updateBg({ startColor: e.target.value })}
                        className="h-10 w-full rounded border border-border cursor-pointer" />
                    </div>
                    <div>
                      <label className="block text-xs text-on-surface-variant mb-1">Outer Color</label>
                      <input type="color" value={bg.endColor} onChange={(e) => updateBg({ endColor: e.target.value })}
                        className="h-10 w-full rounded border border-border cursor-pointer" />
                    </div>
                  </div>
                  <div className="mt-4 space-y-2">
                    <label className="block text-xs text-on-surface-variant">Balance: {bg.midpoint ?? 50}%</label>
                    <input type="range" min="0" max="100" value={bg.midpoint ?? 50}
                      onChange={(e) => updateBg({ midpoint: Number(e.target.value) })}
                      className="w-full h-2 bg-surface-subtle rounded-lg appearance-none cursor-pointer" />
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Right: Message List + Style (single card split into equal halves) */}
          <div className="space-y-4">
            <div className="rounded-2xl border border-border bg-surface-elevated p-4 shadow-sm flex flex-col h-full min-h-0 transition-all hover:border-primary/35 hover:shadow-md hover:shadow-primary/10">
              <div className="flex-1 min-h-0 overflow-y-auto pr-1">
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-on-surface">Message List</label>
                  {config.announcementBar.announcements.length > 0 && (
                    <span className="text-[11px] text-primary font-medium flex items-center animate-pulse">
                      💡 hover a chip & click ••• to manage
                    </span>
                  )}
                </div>
                {config.announcementBar.announcements.length === 0 ? (
                  <div className="h-36 flex items-center justify-center text-center text-sm text-on-surface-variant">
                    Added text from the left input box will be displayed here
                  </div>
                ) : (
                  <div className={`flex flex-wrap gap-2 p-1 ${config.announcementBar.announcements.length > 2 ? 'max-h-64 overflow-y-auto' : ''}`}>
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
                        onClick={() => {
                          if (selectedIndex === index) {
                            clearSelection();
                          } else {
                            selectAnnouncement(index);
                          }
                        }}
                        className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm bg-primary/15 text-primary group relative cursor-pointer transition-all ${selectedIndex === index ? 'ring-[1.5px] ring-primary/60 bg-primary/25' : 'hover:bg-primary/20 hover:ring-1 hover:ring-primary/35'} ${draggedIndex === index ? 'opacity-60' : ''}`}>
                        <span className="flex-1 truncate max-w-[200px]" title={stripHtml(ann.text)}>
                          {stripHtml(ann.text)}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            openActionMenu(index, e.currentTarget);
                          }}
                          className="text-primary hover:opacity-80 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                          title="More options"
                        >
                          <MoreVertical className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex-1 min-h-0 border-t border-border pt-4 overflow-auto">
                <div className="border-b border-border pb-3">
                  <h4 className="text-base font-semibold text-on-surface">Style</h4>
                  <p className="mt-1 text-xs text-on-surface-variant">Choose the background style and fine-tune its colors and balance.</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-on-surface mb-2">Background Type Guide</label>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <div
                        className="h-16 rounded-lg border border-border shadow-inner"
                        style={{ background: '#b91c1c' }}
                      />
                      <p className="text-[11px] font-semibold text-on-surface-variant text-center">Solid</p>
                    </div>
                    <div className="space-y-1">
                      <div
                        className="h-16 rounded-lg border border-border shadow-inner"
                        style={{ background: 'linear-gradient(90deg, #111111 0%, #7f1d1d 55%, #ef4444 100%)' }}
                      />
                      <p className="text-[11px] font-semibold text-on-surface-variant text-center">Linear</p>
                    </div>
                    <div className="space-y-1">
                      <div
                        className="h-16 rounded-lg border border-border shadow-inner"
                        style={{ background: 'radial-gradient(circle at 50% 45%, #ef4444 8%, #7f1d1d 45%, #111111 100%)' }}
                      />
                      <p className="text-[11px] font-semibold text-on-surface-variant text-center">Radial</p>
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
          <div className="bg-surface-elevated border border-border rounded-2xl shadow-2xl px-5 py-4 w-[380px]">
            <p className="text-[13px] text-on-surface leading-relaxed">
              💡 You can also add emojis!<br/>Press <kbd className="inline bg-primary/10 text-primary border border-primary/30 px-1.5 py-0.5 rounded text-[11px] font-mono font-medium whitespace-nowrap">{navigator.platform?.includes('Mac') ? '⌘ + Ctrl + Space' : 'Win + .'}</kbd> to open the emoji picker
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
