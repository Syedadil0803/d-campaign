'use client';

import type { RefObject } from 'react';
import { Infinity as InfinityIcon, MoreVertical, MoveLeft, Trash2 } from 'lucide-react';
import type { CampaignConfig } from '@/types/campaign';
import { stripHtml } from '@/lib/utils';
import { isInvalidRange } from '@/lib/dateRange';
import {
  announcementThemes,
  themeBackgroundCss,
  type AnnouncementTheme,
} from '@/lib/announcement/announcementThemes';

interface AnnouncementListPanelProps {
  config: CampaignConfig;
  setConfig: (config: CampaignConfig) => void;
  markChanged: () => void;
  /** Which swatch the current background matches, or null when it is custom. */
  activeThemeId: string | null;
  applyAnnouncementTheme: (theme: AnnouncementTheme) => void;
  selectedIndex: number | null;
  clearSelection: () => void;
  loadAnnouncementIntoSelection: (index: number) => string;
  detectFormatsForSelectMode: (html: string) => void;
  clearAnnouncements: () => void;
  reorderAnnouncements: (fromIndex: number, toIndex: number) => void;
  draggedIndex: number | null;
  setDraggedIndex: (index: number | null) => void;
  openActionMenu: (index: number, button: HTMLButtonElement) => void;
  scheduleCloseActionMenu: () => void;
  cancelCloseActionMenu: () => void;
  /** Focus returns to the editor after a list action, so typing carries on. */
  richEditorRef: RefObject<HTMLDivElement | null>;
}

/**
 * The right-hand card: the message list (select, reorder, per-row menu) above
 * the styling controls. Editing itself lives in the left panel — this side
 * only chooses what is being edited and how the bar looks.
 */
export function AnnouncementListPanel({
  config,
  setConfig,
  markChanged,
  activeThemeId,
  applyAnnouncementTheme,
  selectedIndex,
  clearSelection,
  loadAnnouncementIntoSelection,
  detectFormatsForSelectMode,
  clearAnnouncements,
  reorderAnnouncements,
  draggedIndex,
  setDraggedIndex,
  openActionMenu,
  scheduleCloseActionMenu,
  cancelCloseActionMenu,
  richEditorRef,
}: AnnouncementListPanelProps) {
  return (
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
                {config.announcementBar.announcements.map((ann, index) => {
                // A back-to-front schedule blocks Save and Publish in the
                // header. Without marking the message that carries it,
                // the header just locks and there is nothing on screen
                // saying which of these to open — the promo card gets a
                // scroll-and-flash for the same reason.
                const rowRangeInvalid = isInvalidRange(ann.startDate, ann.endDate);
                return (
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
                        const normalizedText = loadAnnouncementIntoSelection(index);
                        // Blur rather than focus: the user clicked the
                        // list, so the caret should not jump into the
                        // editor behind it.
                        if (richEditorRef.current) {
                          richEditorRef.current.innerHTML = normalizedText;
                          richEditorRef.current.blur();
                        }
                        window.getSelection()?.removeAllRanges();
                        detectFormatsForSelectMode(normalizedText);
                      }
                    }}
                    title={rowRangeInvalid ? 'This message ends before it starts — open it and fix or clear the schedule.' : undefined}
                    className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm text-[#5a4138] dark:text-[#dbc1b3] bg-primary/20 group relative cursor-pointer transition-all ${rowRangeInvalid ? 'ring-[1.5px] ring-red-500 dark:ring-red-400' : selectedIndex === index ? 'ring-[1.5px] ring-primary/80 bg-primary/30' : 'hover:bg-primary/25 hover:ring-1 hover:ring-primary/70'} ${draggedIndex === index ? 'opacity-60' : ''}`}>
                    {rowRangeInvalid && (
                      <span aria-hidden="true" className="text-red-600 dark:text-red-400 font-bold">!</span>
                    )}
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
                );
                })}
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
  );
}
