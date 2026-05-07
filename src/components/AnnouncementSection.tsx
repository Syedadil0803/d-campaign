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
  const [isRichText, setIsRichText] = useState(false);

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
        // Calculate scroll duration based on content width
        const contentWidth = track.scrollWidth;
        const pixelsPerSecond = 60; // Same as Vue widget
        const duration = (contentWidth / 2) / pixelsPerSecond; // Half width / speed
        
        // Set CSS variable for animation duration
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
    let text = '';
    if (isRichText && richEditorRef.current) {
      text = getNormalizedHTML();
    } else {
      text = newAnnouncementText.trim();
    }
    if (!text) return;

    if (selectedIndex !== null) {
      const updated = [...config.announcementBar.announcements];
      updated[selectedIndex] = { ...updated[selectedIndex], text, richText: isRichText };
      setConfig({ ...config, announcementBar: { ...config.announcementBar, announcements: updated } });
      setSelectedIndex(null);
      setSelectedUrl('');
    } else {
      setConfig({
        ...config,
        announcementBar: {
          ...config.announcementBar,
          announcements: [...config.announcementBar.announcements, { text, richText: isRichText }],
        },
      });
    }
    setNewAnnouncementText('');
    if (richEditorRef.current) richEditorRef.current.innerHTML = '';
    markChanged();
  }

  // ── Remove announcement ──
  function removeAnnouncement(index: number) {
    const updated = config.announcementBar.announcements.filter((_, i) => i !== index);
    setConfig({ ...config, announcementBar: { ...config.announcementBar, announcements: updated } });
    if (selectedIndex === index) { setSelectedIndex(null); setSelectedUrl(''); }
    else if (selectedIndex !== null && selectedIndex > index) setSelectedIndex(selectedIndex - 1);
    markChanged();
  }

  // ── Select announcement ──
  function selectAnnouncement(index: number) {
    const ann = config.announcementBar.announcements[index];
    setSelectedIndex(index);
    setSelectedUrl(ann.url || '');
    setIsRichText(ann.richText || false);

    if (ann.richText) {
      setNewAnnouncementText(ann.text);
      setTimeout(() => {
        if (richEditorRef.current) {
          richEditorRef.current.innerHTML = ann.text;
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
    } else {
      setNewAnnouncementText(stripHtml(ann.text));
    }
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

  // ── Toggle rich text mode ──
  function toggleRichText() {
    const next = !isRichText;
    setIsRichText(next);

    if (selectedIndex !== null) {
      const updated = [...config.announcementBar.announcements];
      updated[selectedIndex] = { ...updated[selectedIndex], richText: next };
      if (!next) {
        const plain = stripHtml(updated[selectedIndex].text);
        updated[selectedIndex].text = plain;
        setNewAnnouncementText(plain);
      }
      setConfig({ ...config, announcementBar: { ...config.announcementBar, announcements: updated } });
      markChanged();
    }

    if (next) {
      setTimeout(() => {
        if (richEditorRef.current) {
          richEditorRef.current.innerHTML = newAnnouncementText;
          richEditorRef.current.focus();
        }
      }, 0);
    } else {
      setNewAnnouncementText(stripHtml(newAnnouncementText));
    }
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

  
  return (
    <section className="bg-white shadow rounded-lg border border-gray-200 overflow-hidden dark:bg-gray-800 dark:border-gray-700">
      {/* Header */}
      <div className="px-6 py-3 border-b border-gray-200 bg-gray-50/50 flex items-center justify-between dark:border-gray-700 dark:bg-gray-700/50">
        <div className="flex items-center">
          <div className="p-2 bg-indigo-100 rounded-lg mr-4"><Megaphone className="w-5 h-5 text-indigo-600" /></div>
          <div>
            <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-gray-100">Announcement Bar</h3>
            <p className="mt-1 max-w-2xl text-sm text-gray-500 dark:text-gray-400">Top banner for site-wide alerts.</p>
          </div>
        </div>
        <button onClick={toggleActive} className={`relative inline-flex flex-shrink-0 h-6 w-11 border-2 border-transparent rounded-full cursor-pointer transition-colors duration-200 ${config.announcementBar.active ? 'bg-indigo-600' : 'bg-gray-200'}`}>
          <span className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform transition duration-200 ${config.announcementBar.active ? 'translate-x-5' : 'translate-x-0'}`} />
        </button>
      </div>

      <div className="p-4 space-y-6">
        {/* Preview */}
        <div className="bg-gray-100 p-4 border border-gray-200 rounded-md dark:bg-gray-700 dark:border-gray-600">
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 dark:text-gray-400">Preview</h4>
          <div className="w-full bg-white border border-gray-300 rounded shadow-sm overflow-hidden dark:bg-gray-800 dark:border-gray-600">
            {config.announcementBar.active && config.announcementBar.announcements.length > 0 && (
              <div ref={scrollContainerRef} className="h-10 px-4 text-center text-sm font-medium overflow-hidden flex items-center justify-center group"
                style={{
                  background: getBackgroundStyle(config.announcementBar.style.background),
                  color: config.announcementBar.style.textColor,
                }}>
                <div className="animate-scroll-left">
                  {[...Array(4)].map((_, setIndex) =>
                    config.announcementBar.announcements.map((ann, i) => (
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

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: Input + Style */}
          <div className="space-y-6">
            {/* Announcement Input */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Announcement Text</label>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">Rich Text</span>
                  <button onClick={toggleRichText}
                    className={`px-2 py-0.5 text-xs rounded-md transition-colors ${isRichText ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-700'}`}>
                    {isRichText ? 'ON' : 'OFF'}
                  </button>
                </div>
              </div>

              {/* Rich Text Toolbar */}
              {isRichText && (
                <div className="mb-2">
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
              )}

              <div className="flex gap-2">
                {isRichText ? (
                  <div ref={richEditorRef} contentEditable suppressContentEditableWarning
                    onInput={onRichTextInput}
                    onMouseUp={detectFormats} onKeyUp={detectFormats}
                    onFocus={() => setTimeout(ensureDefaultFontSize, 0)}
                    className="flex-1 shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md p-3 border bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 min-h-[56px] outline-none overflow-auto"
                    data-placeholder="Type announcement text..." />
                ) : (
                  <textarea value={newAnnouncementText}
                    onChange={(e) => setNewAnnouncementText(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addAnnouncement()}
                    rows={2}
                    className="flex-1 shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md p-3 border bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
                    placeholder="Type announcement and press Enter..." />
                )}
                <button onClick={addAnnouncement}
                  disabled={!isRichText && !newAnnouncementText.trim()}
                  className="px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed">
                  Add
                </button>
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

              {/* Solid */}
              {bg.type === 'solid' && (
                <div className="mt-4">
                  <label className="block text-xs text-gray-500 mb-1 dark:text-gray-400">Background Color</label>
                  <input type="color" value={bg.startColor} onChange={(e) => updateBg({ startColor: e.target.value })}
                    className="h-10 w-full rounded border border-gray-300 cursor-pointer dark:border-gray-600" />
                </div>
              )}

              {/* Linear Gradient */}
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

              {/* Radial Gradient */}
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

          {/* Right: Schedule + List + URL */}
          <div className="space-y-6">
            {/* Schedule */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Schedule</label>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Start Date</label>
                  <input type="date" value={config.announcementBar.startDate}
                    onChange={(e) => { setConfig({ ...config, announcementBar: { ...config.announcementBar, startDate: e.target.value } }); markChanged(); }}
                    className="mt-1 block w-full border-gray-300 rounded-md p-2.5 border bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">End Date</label>
                  <input type="date" value={config.announcementBar.endDate}
                    onChange={(e) => { setConfig({ ...config, announcementBar: { ...config.announcementBar, endDate: e.target.value } }); markChanged(); }}
                    className="mt-1 block w-full border-gray-300 rounded-md p-2.5 border bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100" />
                </div>
              </div>
            </div>

            {/* Announcements List */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Announcements</label>
              <div className={`flex flex-wrap gap-2 mb-4 ${config.announcementBar.announcements.length > 2 ? 'max-h-20 overflow-y-auto pr-1' : ''}`}>
                {config.announcementBar.announcements.map((ann, index) => (
                  <div key={index}
                    className={`inline-flex items-center px-3 py-1 rounded-full text-sm bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200 group relative ${selectedIndex === index ? 'ring-1 ring-indigo-300/60 dark:ring-indigo-400/40' : ''}`}>
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

            {/* Link Management */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2 dark:text-gray-300">Link Management</label>
              {selectedIndex !== null ? (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1 dark:text-gray-400">
                      Link URL for &quot;{stripHtml(config.announcementBar.announcements[selectedIndex].text)}&quot;
                    </label>
                    <input type="url" value={selectedUrl}
                      onChange={(e) => {
                        setSelectedUrl(e.target.value);
                        const updated = [...config.announcementBar.announcements];
                        updated[selectedIndex] = { ...updated[selectedIndex], url: e.target.value };
                        setConfig({ ...config, announcementBar: { ...config.announcementBar, announcements: updated } });
                        markChanged();
                      }}
                      className="block w-full border-gray-300 rounded-md p-2.5 border bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
                      placeholder="https://example.com (optional)" />
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">These settings apply only to the selected announcement above.</p>
                </div>
              ) : (
                <div className="text-center py-2 border-2 border-dashed border-gray-300 rounded-lg">
                  <div className="text-gray-400">
                    <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                    </svg>
                    <p className="mt-2 text-sm">Click an announcement to add URL or enable rich text</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
