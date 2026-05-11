'use client';

import { useState, useRef, useEffect } from 'react';
import { Megaphone, X } from 'lucide-react';
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
  const [selectedStartDate, setSelectedStartDate] = useState('');
  const [selectedEndDate, setSelectedEndDate] = useState('');
  const [showScheduleFields, setShowScheduleFields] = useState(false);
  const [showRichToolbar, setShowRichToolbar] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  const richEditorRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
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

  // ── Toggle active ──
  function toggleActive() {
    setConfig({
      ...config,
      announcementBar: { ...config.announcementBar, active: !config.announcementBar.active },
    });
    markChanged();
  }

  // ── Add / Update announcement ──
  function addAnnouncement() {
    const text = getNormalizedHTML();
    if (!text) return;

    if (selectedIndex !== null) {
      const updated = [...config.announcementBar.announcements];
      updated[selectedIndex] = {
        ...updated[selectedIndex],
        text,
        richText: true,
        url: selectedUrl || undefined,
        startDate: selectedStartDate || undefined,
        endDate: selectedEndDate || undefined,
      };
      setConfig({ ...config, announcementBar: { ...config.announcementBar, announcements: updated } });
      setSelectedIndex(null);
      setSelectedUrl('');
      setSelectedStartDate('');
      setSelectedEndDate('');
      setShowScheduleFields(false);
    } else {
      setConfig({
        ...config,
        announcementBar: {
          ...config.announcementBar,
          announcements: [
            ...config.announcementBar.announcements,
            {
              text,
              richText: true,
              url: selectedUrl || undefined,
              startDate: selectedStartDate || undefined,
              endDate: selectedEndDate || undefined,
            },
          ],
        },
      });
      setSelectedUrl('');
      setSelectedStartDate('');
      setSelectedEndDate('');
      setShowScheduleFields(false);
    }
    setNewAnnouncementText('');
    if (richEditorRef.current) richEditorRef.current.innerHTML = '';
    markChanged();
  }

  // ── Remove announcement ──
  function removeAnnouncement(index: number) {
    const updated = config.announcementBar.announcements.filter((_, i) => i !== index);
    setConfig({ ...config, announcementBar: { ...config.announcementBar, announcements: updated } });
    if (selectedIndex === index) {
      setSelectedIndex(null);
      setSelectedUrl('');
      setSelectedStartDate('');
      setSelectedEndDate('');
      setShowScheduleFields(false);
    }
    else if (selectedIndex !== null && selectedIndex > index) setSelectedIndex(selectedIndex - 1);
    markChanged();
  }

  function reorderAnnouncements(fromIndex: number, toIndex: number) {
    if (fromIndex === toIndex) return;
    const updated = [...config.announcementBar.announcements];
    const [moved] = updated.splice(fromIndex, 1);
    updated.splice(toIndex, 0, moved);

    setConfig({ ...config, announcementBar: { ...config.announcementBar, announcements: updated } });

    if (selectedIndex !== null) {
      if (selectedIndex === fromIndex) {
        setSelectedIndex(toIndex);
      } else if (fromIndex < selectedIndex && selectedIndex <= toIndex) {
        setSelectedIndex(selectedIndex - 1);
      } else if (toIndex <= selectedIndex && selectedIndex < fromIndex) {
        setSelectedIndex(selectedIndex + 1);
      }
    }
    markChanged();
  }

  // ── Select announcement ──
  function selectAnnouncement(index: number) {
    const ann = config.announcementBar.announcements[index];
    setSelectedIndex(index);
    setSelectedUrl(ann.url || '');
    setSelectedStartDate(ann.startDate || '');
    setSelectedEndDate(ann.endDate || '');
    setShowScheduleFields(Boolean(ann.startDate || ann.endDate));
    const normalizedText = ann.richText ? ann.text : wrapBareTextWithFontSize(ann.text);
    setNewAnnouncementText(normalizedText);
    setTimeout(() => {
      if (richEditorRef.current) {
        richEditorRef.current.innerHTML = normalizedText;
        richEditorRef.current.focus();
        const range = document.createRange();
        range.selectNodeContents(richEditorRef.current);
        range.collapse(false);
        const sel = window.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(range);
        detectFormats();
      }
    }, 0);
  }

  // ── Rich text input handler ──
  function onRichTextInput() {
    const html = getNormalizedHTML();
    setNewAnnouncementText(html);
    if (selectedIndex !== null) {
      const updated = [...config.announcementBar.announcements];
      updated[selectedIndex] = { ...updated[selectedIndex], text: html };
      setConfig({ ...config, announcementBar: { ...config.announcementBar, announcements: updated } });
      markChanged();
    }
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
  const hasAnnouncementText = newAnnouncementText.trim().length > 0;

  
  return (
    <section className="bg-surface-elevated shadow rounded-2xl border border-border overflow-hidden">
      {/* Header */}
      <div className="px-6 py-3 border-b border-border bg-surface/60 flex items-center justify-between">
        <div className="flex items-center">
          <div className="p-2 bg-indigo-100 rounded-lg mr-4"><Megaphone className="w-5 h-5 text-indigo-600" /></div>
          <div>
            <h3 className="text-lg leading-6 font-medium text-on-surface">Announcement Bar</h3>
            <p className="mt-1 max-w-2xl text-sm text-on-surface-variant">Top banner for site-wide alerts.</p>
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
            <div className="h-12 bg-white flex items-center justify-between px-4 border-b border-gray-100 dark:bg-gray-900 dark:border-gray-700">
              <div className="w-24 h-4 bg-gray-200 rounded" /><div className="flex space-x-2"><div className="w-12 h-4 bg-gray-100 rounded" /><div className="w-12 h-4 bg-gray-100 rounded" /></div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Left: Input + Chips + Link */}
          <div className="space-y-4 rounded-2xl border border-border bg-white dark:bg-gray-900 p-4 shadow-sm">
            <div className="border-b border-border pb-3">
              <h4 className="text-lg font-semibold text-on-surface">Announcement Content</h4>
              <p className="mt-1 text-xs text-on-surface-variant">Create your message, optionally attach a link, and add timing only if needed.</p>
            </div>
            {/* Announcement Input */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Message</label>
              </div>

              {/* Rich Text Toolbar */}
              <div className={`mb-2 transition-all ${showRichToolbar ? 'opacity-100 max-h-16' : 'opacity-0 max-h-0 overflow-hidden pointer-events-none'}`}>
                <div>
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
              </div>

              <div className="flex gap-2">
                <div className="flex-1">
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
                      setTimeout(ensureDefaultFontSize, 0);
                    }}
                    onBlur={() => setShowRichToolbar(false)}
                    className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md p-3 border bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 outline-none overflow-auto h-[44px] min-h-[44px] max-h-[360px] resize-y"
                    data-placeholder="Type announcement text..." />
                </div>
                <button onClick={addAnnouncement}
                  disabled={!newAnnouncementText.trim()}
                  className="px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed">
                  Add Message
                </button>
              </div>
            </div>

            {/* Announcements List */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Message List</label>
              <div className={`flex flex-wrap gap-2 ${config.announcementBar.announcements.length > 2 ? 'max-h-20 overflow-y-auto pr-1' : ''}`}>
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
                    className={`inline-flex items-center px-3 py-1 rounded-full text-sm bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200 group relative cursor-move ${selectedIndex === index ? 'ring-1 ring-indigo-300/60 dark:ring-indigo-400/40' : ''} ${draggedIndex === index ? 'opacity-60' : ''}`}>
                    <span onClick={() => selectAnnouncement(index)} className="cursor-pointer flex-1 truncate max-w-[250px]" title={stripHtml(ann.text)}>
                      {stripHtml(ann.text)}
                    </span>
                    {ann.url && <a href={ann.url} target="_blank" rel="noopener noreferrer" className="ml-1 text-xs underline hover:no-underline" onClick={(e) => e.stopPropagation()}>🔗</a>}
                    <button onClick={(e) => { e.stopPropagation(); removeAnnouncement(index); }}
                      className="ml-2 text-indigo-600 hover:text-indigo-800 dark:text-indigo-300 dark:hover:text-indigo-100 opacity-0 group-hover:opacity-100 transition-opacity">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2 dark:text-gray-300">Message Link</label>
              <div className="space-y-2">
                <label className="block text-xs text-gray-500 mb-1 dark:text-gray-400">
                  {selectedIndex !== null
                    ? `Link for "${stripHtml(config.announcementBar.announcements[selectedIndex].text)}"`
                    : 'Link URL (Optional)'}
                </label>
                <input type="url" value={selectedUrl}
                  onChange={(e) => {
                    const nextUrl = e.target.value;
                    setSelectedUrl(nextUrl);
                    if (selectedIndex !== null) {
                      const updated = [...config.announcementBar.announcements];
                      updated[selectedIndex] = { ...updated[selectedIndex], url: nextUrl };
                      setConfig({ ...config, announcementBar: { ...config.announcementBar, announcements: updated } });
                      markChanged();
                    }
                  }}
                  disabled={!hasAnnouncementText}
                  className="block w-full border-gray-300 rounded-md p-2.5 border bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 disabled:opacity-60 disabled:cursor-not-allowed"
                  placeholder="https://example.com" />
                <p className="text-xs text-gray-500 dark:text-gray-400">Add message text first, then link this specific message.</p>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2 dark:text-gray-300">Message Schedule (Optional)</label>
              <p className="mb-2 text-xs text-gray-500 dark:text-gray-400">If no timing is set, this message appears whenever the announcement bar is active.</p>
              {!showScheduleFields ? (
                <button
                  type="button"
                  onClick={() => setShowScheduleFields(true)}
                  disabled={!hasAnnouncementText}
                  className="text-xs font-medium text-indigo-600 hover:text-indigo-700 disabled:text-gray-400 disabled:cursor-not-allowed"
                >
                  + Add schedule for this message only
                </button>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1 dark:text-gray-400">Start Date</label>
                      <input
                        type="date"
                        value={selectedStartDate}
                        onChange={(e) => {
                          const nextStart = e.target.value;
                          setSelectedStartDate(nextStart);
                          if (selectedIndex !== null) {
                            const updated = [...config.announcementBar.announcements];
                            updated[selectedIndex] = { ...updated[selectedIndex], startDate: nextStart || undefined };
                            setConfig({ ...config, announcementBar: { ...config.announcementBar, announcements: updated } });
                            markChanged();
                          }
                          if (!nextStart && !selectedEndDate) setShowScheduleFields(false);
                        }}
                        disabled={!hasAnnouncementText}
                        className="block w-full border-gray-300 rounded-md p-2.5 border bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1 dark:text-gray-400">End Date</label>
                      <input
                        type="date"
                        value={selectedEndDate}
                        onChange={(e) => {
                          const nextEnd = e.target.value;
                          setSelectedEndDate(nextEnd);
                          if (selectedIndex !== null) {
                            const updated = [...config.announcementBar.announcements];
                            updated[selectedIndex] = { ...updated[selectedIndex], endDate: nextEnd || undefined };
                            setConfig({ ...config, announcementBar: { ...config.announcementBar, announcements: updated } });
                            markChanged();
                          }
                          if (!selectedStartDate && !nextEnd) setShowScheduleFields(false);
                        }}
                        disabled={!hasAnnouncementText}
                        className="block w-full border-gray-300 rounded-md p-2.5 border bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
                      />
                    </div>
                  </div>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">If both dates are empty, this message stays active whenever the bar is active.</p>
                </>
              )}
            </div>

          </div>

          {/* Right: Style */}
          <div className="space-y-4 rounded-2xl border border-border bg-white dark:bg-gray-900 p-4 shadow-sm">
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

            {/* Style Customization */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2 dark:text-gray-300">Style Customization</label>
              <div>
                <label className="block text-xs text-gray-500 mb-1 dark:text-gray-400">Background Type</label>
                <select value={bg.type} onChange={(e) => updateBg({ type: e.target.value })}
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
        </div>
      </div>
    </section>
  );
}
