'use client';

import { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { Megaphone, MoreVertical } from 'lucide-react';
import { CampaignConfig } from '@/types/campaign';
import { getBackgroundStyle, stripHtml } from '@/lib/utils';
import { useRichTextEditor } from '@/hooks/useRichTextEditor';
import { wrapBareTextWithFontSize } from '@/lib/richTextUtils';
import RichTextToolbar from './RichTextToolbar';

interface AnnouncementSectionProps {
  config: CampaignConfig;
  setConfig: (config: CampaignConfig) => void;
  markChanged: () => void;
}

export function AnnouncementSection({ config, setConfig, markChanged }: AnnouncementSectionProps) {
  const [newAnnouncementText, setNewAnnouncementText] = useState('');
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [selectedUrl, setSelectedUrl] = useState('');
  const [selectedOpenInNewTab, setSelectedOpenInNewTab] = useState(false);
  const [selectedStartDate, setSelectedStartDate] = useState('');
  const [selectedEndDate, setSelectedEndDate] = useState('');
  const [showRichToolbar, setShowRichToolbar] = useState(false);
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
  const messageListRef = useRef<HTMLDivElement>(null);
  const {
    activeFormats,
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
        const currentConfig = configRef.current;
        const updated = currentConfig.announcementBar.announcements.filter((_, i) => i !== idx);
        setConfig({
          ...currentConfig,
          announcementBar: { ...currentConfig.announcementBar, announcements: updated },
        });
        // Clear editor and selection state
        setSelectedIndex(null);
        setNewAnnouncementText('');
        setSelectedUrl('');
        setSelectedOpenInNewTab(false);
        setSelectedStartDate('');
        setSelectedEndDate('');
        if (richEditorRef.current) {
          richEditorRef.current.innerHTML = '';
        }
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
      // Deselect message when clicking outside message list
      if (
        selectedIndexRef.current !== null &&
        messageListRef.current && !messageListRef.current.contains(target) &&
        richEditorRef.current && !richEditorRef.current.contains(target) &&
        (!linkPopupRef.current || !linkPopupRef.current.contains(target)) &&
        (!schedulePopupRef.current || !schedulePopupRef.current.contains(target)) &&
        (!actionMenuRef.current || !actionMenuRef.current.contains(target))
      ) {
        setSelectedIndex(null);
        setNewAnnouncementText('');
        setSelectedUrl('');
        setSelectedOpenInNewTab(false);
        setSelectedStartDate('');
        setSelectedEndDate('');
        if (richEditorRef.current) {
          richEditorRef.current.innerHTML = '';
        }
      }
    };
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, [showLinkPopup, showSchedulePopup, actionMenuIndex]);

  function addAnnouncement() {
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

    setNewAnnouncementText('');
    setSelectedIndex(null);
    setSelectedUrl('');
    setSelectedOpenInNewTab(false);
    setSelectedStartDate('');
    setSelectedEndDate('');
    if (richEditorRef.current) {
      richEditorRef.current.innerHTML = '';
      richEditorRef.current.focus();
    }
    detectFormats();
    markChanged();
  }

  function removeAnnouncement(index: number) {
    const updated = config.announcementBar.announcements.filter((_, currentIndex) => currentIndex !== index);
    setConfig({
      ...config,
      announcementBar: {
        ...config.announcementBar,
        announcements: updated,
      },
    });

    if (selectedIndex === index) {
      setSelectedIndex(null);
      setNewAnnouncementText('');
      setSelectedUrl('');
      setSelectedOpenInNewTab(false);
      setSelectedStartDate('');
      setSelectedEndDate('');
      if (richEditorRef.current) {
        richEditorRef.current.innerHTML = '';
      }
    } else if (selectedIndex !== null && selectedIndex > index) {
      setSelectedIndex(selectedIndex - 1);
    }

    markChanged();
  }

  function reorderAnnouncements(fromIndex: number, toIndex: number) {
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

  // ── Select announcement ──
  function selectAnnouncement(index: number) {
    const ann = config.announcementBar.announcements[index];
    setSelectedIndex(index);
    setSelectedUrl(ann.url || '');
    setSelectedOpenInNewTab(ann.openInNewTab || false);
    setSelectedStartDate(ann.startDate || '');
    setSelectedEndDate(ann.endDate || '');
    const normalizedText = ann.richText ? ann.text : wrapBareTextWithFontSize(ann.text);
    setNewAnnouncementText(normalizedText);
    setTimeout(() => {
      if (richEditorRef.current) {
        richEditorRef.current.innerHTML = normalizedText;
        richEditorRef.current.focus();

        // Place cursor at end of the last text node (inside the styled span)
        const sel = window.getSelection();
        if (sel) {
          sel.removeAllRanges();
          const range = document.createRange();
          // Find the deepest last text node
          let lastNode: Node = richEditorRef.current;
          while (lastNode.lastChild) {
            lastNode = lastNode.lastChild;
          }
          if (lastNode.nodeType === Node.TEXT_NODE) {
            range.setStart(lastNode, lastNode.textContent?.length || 0);
            range.collapse(true);
          } else {
            range.selectNodeContents(richEditorRef.current);
            range.collapse(false);
          }
          sel.addRange(range);
        }

        detectFormats();
      }
    }, 0);
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

  function handleMenuEdit(index: number) {
    selectAnnouncement(index);
    setActionMenuIndex(null);
    setActionMenuPos(null);
  }

  function handleMenuAddLink(index: number) {
    selectAnnouncement(index);
    setShowLinkPopup(true);
    setShowSchedulePopup(false);
    setActionMenuIndex(null);
    setActionMenuPos(null);
  }

  function handleMenuSchedule(index: number) {
    selectAnnouncement(index);
    setShowSchedulePopup(true);
    setShowLinkPopup(false);
    setActionMenuIndex(null);
    setActionMenuPos(null);
  }

  function handleMenuDelete(index: number) {
    removeAnnouncement(index);
    setActionMenuIndex(null);
    setActionMenuPos(null);
  }

  // ── Rich text input handler ──
  function onRichTextInput() {
    const html = getNormalizedHTML();
    setNewAnnouncementText(html);
    detectFormats();
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
          <div className="p-1 bg-indigo-100 rounded-lg mr-3"><Megaphone className="w-4 h-4 text-indigo-600" /></div>
          <div>
            <h3 className="text-base leading-5 font-medium text-on-surface">Announcement Bar</h3>
            <p className="mt-0.5 max-w-2xl text-xs text-on-surface-variant">Top banner for site-wide alerts.</p>
          </div>
        </div>
        <button onClick={toggleActive} className={`relative inline-flex flex-shrink-0 h-6 w-11 border-2 border-transparent rounded-full cursor-pointer transition-colors duration-200 ${config.announcementBar.active ? 'bg-indigo-600' : 'bg-gray-200'}`}>
          <span className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform transition duration-200 ${config.announcementBar.active ? 'translate-x-5' : 'translate-x-0'}`} />
        </button>
      </div>

      <div className="p-5 space-y-6">
        {/* Preview */}
        <div className="bg-gray-100 p-4 border border-gray-200 rounded-md dark:bg-gray-700 dark:border-gray-600">
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 dark:text-gray-400">Preview</h4>
          <div className="w-full bg-white border border-gray-300 rounded shadow-sm overflow-hidden dark:bg-gray-800 dark:border-gray-600">
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
                          <a href={ann.url} target={ann.openInNewTab ? '_blank' : '_self'} rel={ann.openInNewTab ? 'noopener noreferrer' : ''} className="underline hover:no-underline" dangerouslySetInnerHTML={{ __html: ann.text }} />
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
              <div className="h-12 bg-white flex items-center justify-between px-4 border-b border-gray-100 dark:bg-gray-900 dark:border-gray-700">
                <div className="w-24 h-4 bg-gray-200 rounded" />
                <div className="flex space-x-2">
                  <div className="w-12 h-4 bg-gray-100 rounded" />
                  <div className="w-12 h-4 bg-gray-100 rounded" />
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-stretch">
          {/* Left: Input + Chips + Link */}
          <div className="space-y-4 rounded-2xl border border-border bg-white dark:bg-gray-900 p-4 shadow-sm flex flex-col h-full">
            <div className="border-b border-border pb-3">
              <h4 className="text-lg font-semibold text-on-surface">Announcement Content</h4>
              <p className="mt-1 text-xs text-on-surface-variant">Create your message, optionally attach a link, and add timing only if needed.</p>
            </div>
            
            {/* Announcement Input */}
            <div className="flex-1 flex flex-col justify-between">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Message</label>

              {/* Rich Text Toolbar + Link/Schedule buttons — same row, show/hide with focus */}
              <div className={`mb-2 transition-all ${showRichToolbar ? 'opacity-100 max-h-16' : 'opacity-0 max-h-0 overflow-hidden pointer-events-none'}`}>
                <div className="flex items-center gap-1">
                  <div className="flex-1 min-w-0">
                    <RichTextToolbar
                      activeFormats={activeFormats}
                      onFormat={(format) => {
                        saveSelection();
                        formatText(format);
                      }}
                      onColorSelect={(color) => {
                        saveSelection();
                        applyColor(color);
                        onRichTextInput();
                      }}
                    />
                  </div>

                  {/* Divider */}
                  <div className="border-l border-gray-300 h-4 mx-0.5 shrink-0" />

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
                    className={`cursor-pointer flex items-center px-1.5 py-1 border rounded transition-colors shrink-0 disabled:opacity-40 disabled:cursor-not-allowed ${selectedUrl ? 'border-indigo-500 bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400' : 'border-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 dark:border-gray-600 text-gray-600 dark:text-gray-300'}`}
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
                    className={`cursor-pointer flex items-center px-1.5 py-1 border rounded transition-colors shrink-0 disabled:opacity-40 disabled:cursor-not-allowed ${(selectedStartDate || selectedEndDate) ? 'border-indigo-500 bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400' : 'border-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 dark:border-gray-600 text-gray-600 dark:text-gray-300'}`}
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
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Enter text below</p>
                  <div ref={richEditorRef} contentEditable suppressContentEditableWarning
                    onInput={onRichTextInput}
                    onMouseUp={detectFormats} onKeyUp={detectFormats}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        addAnnouncement();
                      }
                    }}
                    onFocus={() => {
                      setShowRichToolbar(true);
                      setTimeout(() => {
                        ensureDefaultFontSize();
                        detectFormats();
                      }, 0);
                    }}
                    onBlur={() => {
                      // Keep toolbar visible if a popup is open
                      if (!showLinkPopup && !showSchedulePopup) {
                        setShowRichToolbar(false);
                      }
                    }}
                    className="rich-editor shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md p-3 border dark:border-gray-600 outline-none overflow-y-auto overflow-x-hidden h-[44px] min-h-[44px] max-h-[360px] resize-y break-words"
                    style={{ background: getBackgroundStyle(config.announcementBar.style.background), wordBreak: 'break-word', overflowWrap: 'break-word', maxWidth: '100%' }} />
                </div>
                <button onMouseDown={(e) => {
                    e.preventDefault();
                    addAnnouncement();
                  }}
                  disabled={!newAnnouncementText.trim()}
                  className="px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed self-end">
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
                className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-xl p-3 w-[260px]"
              >
                <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">Link URL</p>
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
                  className="block w-full border-gray-300 rounded-md p-2 border bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 text-sm"
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
                    className="w-4 h-4 rounded border-gray-300 text-indigo-600 dark:border-gray-600"
                  />
                  <label htmlFor="openInNewTab" className="ml-2 text-xs text-gray-700 dark:text-gray-300 cursor-pointer">Open in new tab</label>
                </div>
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
                      className="text-xs text-red-500 hover:text-red-600"
                    >
                      Clear
                    </button>
                  )}
                  <button
                    onMouseDown={(e) => {
                      e.preventDefault();
                      setShowLinkPopup(false);
                      if (richEditorRef.current) {
                        richEditorRef.current.focus();
                        const range = document.createRange();
                        range.selectNodeContents(richEditorRef.current);
                        range.collapse(false);
                        const sel = window.getSelection();
                        sel?.removeAllRanges();
                        sel?.addRange(range);
                      }
                    }}
                    className="ml-auto text-xs bg-indigo-600 text-white px-3 py-1 rounded hover:bg-indigo-700"
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
                className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-xl p-3 w-[260px]"
              >
                <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">Schedule (optional)</p>
                <div className="space-y-2">
                  <div>
                    <label className="block text-[11px] text-gray-500 dark:text-gray-400 mb-0.5">Start Date</label>
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
                      className="block w-full border-gray-300 rounded-md p-1.5 border bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-gray-500 dark:text-gray-400 mb-0.5">End Date</label>
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
                      className="block w-full border-gray-300 rounded-md p-1.5 border bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 text-sm"
                    />
                  </div>
                  <p className="text-[10px] text-gray-400 dark:text-gray-500">Leave empty to always show when bar is active.</p>
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
                      className="text-xs text-red-500 hover:text-red-600"
                    >
                      Clear
                    </button>
                  )}
                  <button
                    onMouseDown={(e) => {
                      e.preventDefault();
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
                    }}
                    className="ml-auto text-xs bg-indigo-600 text-white px-3 py-1 rounded hover:bg-indigo-700"
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
                className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-xl py-1 w-[180px]"
              >
                <button
                  type="button"
                  onMouseDown={(e) => { e.preventDefault(); handleMenuAddLink(actionMenuIndex); }}
                  className="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  Add link
                </button>
                <button
                  type="button"
                  onMouseDown={(e) => { e.preventDefault(); handleMenuSchedule(actionMenuIndex); }}
                  className="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  Schedule
                </button>
                <div className="my-1 h-px bg-gray-200 dark:bg-gray-700" />
                <button
                  type="button"
                  onMouseDown={(e) => { e.preventDefault(); handleMenuDelete(actionMenuIndex); }}
                  className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                >
                  Delete
                </button>
              </div>,
              document.body
            )}

            {/* Style Customization */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2 dark:text-gray-300">Style Customization</label>
              <div>
                <label className="block text-xs text-gray-500 mb-1 dark:text-gray-400">Background Type</label>
                <select value={bg.type || 'solid'} onChange={(e) => updateBg({ type: e.target.value })}
                  className="block w-full border-gray-300 rounded-md p-2 border bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 sm:text-sm">
                  <option value="solid">Solid</option>
                  <option value="linear">Linear</option>
                  <option value="radial">Gradient</option>
                </select>
              </div>

              {bg.type === 'solid' && (
                <div className="mt-4">
                  <label className="block text-xs text-gray-500 mb-1 dark:text-gray-400">Background Color</label>
                  <input type="color" value={bg.startColor} onChange={(e) => updateBg({ startColor: e.target.value })}
                    className="h-10 w-full rounded border border-gray-300 cursor-pointer dark:border-gray-600" />
                </div>
              )}

              {bg.type === 'linear' && (
                <>
                  <div className="grid grid-cols-3 gap-4 mt-4">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1 dark:text-gray-400">Start Color</label>
                      <input type="color" value={bg.startColor} onChange={(e) => updateBg({ startColor: e.target.value })}
                        className="h-10 w-full rounded border border-gray-300 cursor-pointer dark:border-gray-600" />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1 dark:text-gray-400">End Color</label>
                      <input type="color" value={bg.endColor} onChange={(e) => updateBg({ endColor: e.target.value })}
                        className="h-10 w-full rounded border border-gray-300 cursor-pointer dark:border-gray-600" />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1 dark:text-gray-400">Direction</label>
                      <select value={bg.direction || 'to right'} onChange={(e) => updateBg({ direction: e.target.value })}
                        className="block w-full border-gray-300 rounded-md p-2 border bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 sm:text-sm">
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
                    <label className="block text-xs text-gray-500 dark:text-gray-400">Balance: {bg.midpoint ?? 50}%</label>
                    <input type="range" min="0" max="100" value={bg.midpoint ?? 50}
                      onChange={(e) => updateBg({ midpoint: Number(e.target.value) })}
                      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700" />
                  </div>
                </>
              )}

              {bg.type === 'radial' && (
                <>
                  <div className="grid grid-cols-2 gap-4 mt-4">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1 dark:text-gray-400">Center Color</label>
                      <input type="color" value={bg.startColor} onChange={(e) => updateBg({ startColor: e.target.value })}
                        className="h-10 w-full rounded border border-gray-300 cursor-pointer dark:border-gray-600" />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1 dark:text-gray-400">Outer Color</label>
                      <input type="color" value={bg.endColor} onChange={(e) => updateBg({ endColor: e.target.value })}
                        className="h-10 w-full rounded border border-gray-300 cursor-pointer dark:border-gray-600" />
                    </div>
                  </div>
                  <div className="mt-4 space-y-2">
                    <label className="block text-xs text-gray-500 dark:text-gray-400">Balance: {bg.midpoint ?? 50}%</label>
                    <input type="range" min="0" max="100" value={bg.midpoint ?? 50}
                      onChange={(e) => updateBg({ midpoint: Number(e.target.value) })}
                      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700" />
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Right: Message List + Style (single card split into equal halves) */}
          <div className="space-y-4">
            <div className="rounded-2xl border border-border bg-white dark:bg-gray-900 p-4 shadow-sm flex flex-col h-full min-h-0">
              <div className="flex-1 min-h-0 overflow-y-auto pr-1">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Message List</label>
                {config.announcementBar.announcements.length === 0 ? (
                  <div className="h-36 flex items-center justify-center text-center text-sm text-gray-400 dark:text-gray-500">
                    Added text from the left input box will be displayed here
                  </div>
                ) : (
                  <div ref={messageListRef} className={`flex flex-wrap gap-2 p-1 ${config.announcementBar.announcements.length > 2 ? 'max-h-64 overflow-y-auto' : ''}`}>
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
                            setSelectedIndex(null);
                            setNewAnnouncementText('');
                            setSelectedUrl('');
                            setSelectedOpenInNewTab(false);
                            setSelectedStartDate('');
                            setSelectedEndDate('');
                            if (richEditorRef.current) {
                              richEditorRef.current.innerHTML = '';
                            }
                          } else {
                            selectAnnouncement(index);
                          }
                        }}
                        className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200 group relative cursor-pointer transition-all ${selectedIndex === index ? 'ring-[1.5px] ring-indigo-500/80 dark:ring-indigo-400/60 bg-indigo-200/80 dark:bg-indigo-800/80' : 'hover:bg-indigo-150 dark:hover:bg-indigo-850'} ${draggedIndex === index ? 'opacity-60' : ''}`}>
                        <span className="flex-1 truncate max-w-[200px]" title={stripHtml(ann.text)}>
                          {stripHtml(ann.text)}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            openActionMenu(index, e.currentTarget);
                          }}
                          className="text-indigo-600 hover:text-indigo-800 dark:text-indigo-300 dark:hover:text-indigo-100 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
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
                  <h4 className="text-lg font-semibold text-on-surface">Style</h4>
                  <p className="mt-1 text-xs text-on-surface-variant">Choose the background style and fine-tune its colors and balance.</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2 dark:text-gray-300">Background Type Guide</label>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <div
                        className="h-16 rounded-lg border border-gray-300 dark:border-gray-600 shadow-inner"
                        style={{ background: '#b91c1c' }}
                      />
                      <p className="text-[11px] font-semibold text-gray-600 dark:text-gray-300 text-center">Solid</p>
                    </div>
                    <div className="space-y-1">
                      <div
                        className="h-16 rounded-lg border border-gray-300 dark:border-gray-600 shadow-inner"
                        style={{ background: 'linear-gradient(90deg, #111111 0%, #7f1d1d 55%, #ef4444 100%)' }}
                      />
                      <p className="text-[11px] font-semibold text-gray-600 dark:text-gray-300 text-center">Linear</p>
                    </div>
                    <div className="space-y-1">
                      <div
                        className="h-16 rounded-lg border border-gray-300 dark:border-gray-600 shadow-inner"
                        style={{ background: 'radial-gradient(circle at 50% 45%, #ef4444 8%, #7f1d1d 45%, #111111 100%)' }}
                      />
                      <p className="text-[11px] font-semibold text-gray-600 dark:text-gray-300 text-center">Radial</p>
                    </div>
                  </div>
                </div>

              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
