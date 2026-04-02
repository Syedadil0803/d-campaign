'use client';

import { useState } from 'react';
import { Megaphone, X } from 'lucide-react';
import { CampaignConfig } from '@/types/campaign';
import { getBackgroundStyle, stripHtml } from '@/lib/utils';

interface AnnouncementSectionProps {
  config: CampaignConfig;
  setConfig: (config: CampaignConfig) => void;
  markChanged: () => void;
}

export function AnnouncementSection({ config, setConfig, markChanged }: AnnouncementSectionProps) {
  const [newAnnouncementText, setNewAnnouncementText] = useState('');
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [selectedUrl, setSelectedUrl] = useState('');

  function toggleActive() {
    setConfig({
      ...config,
      announcementBar: {
        ...config.announcementBar,
        active: !config.announcementBar.active,
      },
    });
    markChanged();
  }

  function addAnnouncement() {
    const text = newAnnouncementText.trim();
    if (!text) return;

    if (selectedIndex !== null) {
      const updated = [...config.announcementBar.announcements];
      updated[selectedIndex] = { text, url: selectedUrl };
      setConfig({
        ...config,
        announcementBar: { ...config.announcementBar, announcements: updated },
      });
      setSelectedIndex(null);
      setSelectedUrl('');
    } else {
      setConfig({
        ...config,
        announcementBar: {
          ...config.announcementBar,
          announcements: [...config.announcementBar.announcements, { text }],
        },
      });
    }
    setNewAnnouncementText('');
    markChanged();
  }

  function removeAnnouncement(index: number) {
    const updated = config.announcementBar.announcements.filter((_, i) => i !== index);
    setConfig({
      ...config,
      announcementBar: { ...config.announcementBar, announcements: updated },
    });
    if (selectedIndex === index) {
      setSelectedIndex(null);
      setSelectedUrl('');
    }
    markChanged();
  }

  function selectAnnouncement(index: number) {
    setSelectedIndex(index);
    setSelectedUrl(config.announcementBar.announcements[index].url || '');
    setNewAnnouncementText(stripHtml(config.announcementBar.announcements[index].text));
  }

  function updateStyle(field: string, value: any) {
    setConfig({
      ...config,
      announcementBar: {
        ...config.announcementBar,
        style: {
          ...config.announcementBar.style,
          [field]: value,
        },
      },
    });
    markChanged();
  }

  return (
    <section className="bg-white shadow rounded-lg border border-gray-200 overflow-hidden dark:bg-gray-800 dark:border-gray-700">
      <div className="px-6 py-3 border-b border-gray-200 bg-gray-50/50 flex items-center justify-between dark:border-gray-700 dark:bg-gray-700/50">
        <div className="flex items-center">
          <div className="p-2 bg-indigo-100 rounded-lg mr-4">
            <Megaphone className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-gray-100">Announcement Bar</h3>
            <p className="mt-1 max-w-2xl text-sm text-gray-500 dark:text-gray-400">Top banner for site-wide alerts.</p>
          </div>
        </div>

        <button
          onClick={toggleActive}
          className={`relative inline-flex flex-shrink-0 h-6 w-11 border-2 border-transparent rounded-full cursor-pointer transition-colors ease-in-out duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 ${
            config.announcementBar.active ? 'bg-indigo-600' : 'bg-gray-200'
          }`}
        >
          <span
            className={`pointer-events-none relative inline-block h-5 w-5 rounded-full bg-white shadow transform ring-0 transition ease-in-out duration-200 ${
              config.announcementBar.active ? 'translate-x-5' : 'translate-x-0'
            }`}
          ></span>
        </button>
      </div>

      <div className="p-4 space-y-6">
        <div className="bg-gray-100 p-4 border border-gray-200 rounded-md dark:bg-gray-700 dark:border-gray-600">
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 dark:text-gray-400">Preview</h4>
          <div className="w-full bg-white border border-gray-300 rounded shadow-sm overflow-hidden dark:bg-gray-800 dark:border-gray-600">
            {config.announcementBar.active && config.announcementBar.announcements.length > 0 && (
              <div
                className="h-10 px-4 text-center text-sm font-medium overflow-hidden flex items-center justify-center"
                style={{
                  background: getBackgroundStyle(config.announcementBar.style.background),
                  color: config.announcementBar.style.textColor,
                }}
              >
                <div className="animate-scroll-left">
                  {config.announcementBar.announcements.map((ann, i) => (
                    <span key={i} className="inline-block px-4">
                      {ann.url ? (
                        <a
                          href={ann.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="underline hover:no-underline"
                          style={{ color: config.announcementBar.style.textColor }}
                          dangerouslySetInnerHTML={{ __html: ann.text }}
                        />
                      ) : (
                        <span dangerouslySetInnerHTML={{ __html: ann.text }} />
                      )}
                    </span>
                  ))}
                </div>
              </div>
            )}
            <div className="h-12 bg-white flex items-center justify-between px-4 border-b border-gray-100 dark:bg-gray-900 dark:border-gray-700">
              <div className="w-24 h-4 bg-gray-200 rounded"></div>
              <div className="flex space-x-2">
                <div className="w-12 h-4 bg-gray-100 rounded"></div>
                <div className="w-12 h-4 bg-gray-100 rounded"></div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Announcement Text
              </label>
              <div className="flex gap-2">
                <textarea
                  value={newAnnouncementText}
                  onChange={(e) => setNewAnnouncementText(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addAnnouncement()}
                  rows={2}
                  className="flex-1 shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md p-3 border bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
                  placeholder="Type announcement and press Enter..."
                />
                <button
                  onClick={addAnnouncement}
                  disabled={!newAnnouncementText.trim()}
                  className="px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Add
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2 dark:text-gray-300">
                Style Customization
              </label>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-gray-500 mb-1 dark:text-gray-400">Background Type</label>
                  <select
                    value={config.announcementBar.style.background.type}
                    onChange={(e) => {
                      updateStyle('background', {
                        ...config.announcementBar.style.background,
                        type: e.target.value,
                      });
                    }}
                    className="block w-full border-gray-300 rounded-md p-2 border bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
                  >
                    <option value="solid">Solid</option>
                    <option value="linear">Linear</option>
                    <option value="radial">Gradient</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1 dark:text-gray-400">Text Color</label>
                  <input
                    type="color"
                    value={config.announcementBar.style.textColor}
                    onChange={(e) => updateStyle('textColor', e.target.value)}
                    className="h-10 w-full rounded border border-gray-300 cursor-pointer dark:border-gray-600"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Schedule</label>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Start Date</label>
                  <input
                    type="date"
                    value={config.announcementBar.startDate}
                    onChange={(e) => {
                      setConfig({
                        ...config,
                        announcementBar: { ...config.announcementBar, startDate: e.target.value },
                      });
                      markChanged();
                    }}
                    className="mt-1 block w-full border-gray-300 rounded-md p-2.5 border bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">End Date</label>
                  <input
                    type="date"
                    value={config.announcementBar.endDate}
                    onChange={(e) => {
                      setConfig({
                        ...config,
                        announcementBar: { ...config.announcementBar, endDate: e.target.value },
                      });
                      markChanged();
                    }}
                    className="mt-1 block w-full border-gray-300 rounded-md p-2.5 border bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Announcements</label>
              <div className="flex flex-wrap gap-2 mb-4">
                {config.announcementBar.announcements.map((ann, index) => (
                  <div
                    key={index}
                    className={`inline-flex items-center px-3 py-1 rounded-full text-sm bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200 group relative ${
                      selectedIndex === index ? 'ring-1 ring-indigo-300/60' : ''
                    }`}
                  >
                    <span
                      onClick={() => selectAnnouncement(index)}
                      className="cursor-pointer flex-1 truncate max-w-[250px]"
                      title={stripHtml(ann.text)}
                    >
                      {stripHtml(ann.text)}
                    </span>
                    <button
                      onClick={() => removeAnnouncement(index)}
                      className="ml-2 text-indigo-600 hover:text-indigo-800 dark:text-indigo-300 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {selectedIndex !== null && (
              <div>
                <label className="block text-xs text-gray-500 mb-1 dark:text-gray-400">
                  Link URL for &quot;{stripHtml(config.announcementBar.announcements[selectedIndex].text)}&quot;
                </label>
                <input
                  type="url"
                  value={selectedUrl}
                  onChange={(e) => {
                    setSelectedUrl(e.target.value);
                    const updated = [...config.announcementBar.announcements];
                    updated[selectedIndex] = { ...updated[selectedIndex], url: e.target.value };
                    setConfig({
                      ...config,
                      announcementBar: { ...config.announcementBar, announcements: updated },
                    });
                    markChanged();
                  }}
                  className="block w-full border-gray-300 rounded-md p-2.5 border bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
                  placeholder="https://example.com (optional)"
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
