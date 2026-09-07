'use client';

import type { RefObject } from 'react';
import { CalendarCheck, Clock, Infinity as InfinityIcon, MoreVertical, Trash2, TriangleAlert } from 'lucide-react';
import type { CampaignConfig } from '@/types/campaign';
import { stripHtml } from '@/lib/utils';
import { isInvalidRange } from '@/lib/dateRange';
import { announcementScheduleState } from '@/lib/announcement/announcementWindow';

interface AnnouncementListPanelProps {
  config: CampaignConfig;
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
 * The right-hand card: the message list (select, reorder, per-row menu) with the
 * loop toggle pinned below. Editing lives in the left panel; the bar's look is
 * set in the Bar Appearance section.
 */
export function AnnouncementListPanel({
  config,
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
    // The card fills this cell absolutely, so its messages scroll inside rather
    // than growing the row — the left (editor) card sets the shared height.
    <div className="relative min-h-0">
      <div className="absolute inset-0 rounded-2xl border border-border campaign-card-surface p-4 shadow-sm flex flex-col overflow-hidden transition-all hover:border-primary/70 hover:shadow-md hover:shadow-primary/20">
        {/* Header */}
        <div className="border-b border-border pb-4 mb-5 shrink-0">
          <h4 className="text-2xl font-semibold leading-8 text-on-surface">Manage Announcements</h4>
          <p className="mt-2 text-sm text-on-surface-variant">View, reorder, and style your announcement messages.</p>
        </div>
        {/* Section 1: Message List */}
        <div className="flex-1 min-h-0 flex flex-col pr-1">
          {/* Legend + Clear: what the row glyphs mean, and the destructive action, live together
              so both sit right above the list they act on rather than up in the card header. */}
          <div className="flex items-center justify-between gap-2 mb-2 shrink-0 flex-wrap">
            <div className="flex items-center gap-3 text-[11px] text-on-surface-variant">
              <span className="flex items-center gap-1" title="This message ends before it starts — open it and fix or clear the schedule.">
                <TriangleAlert className="w-3 h-3 text-red-500" />
                Invalid range
              </span>
              <span className="flex items-center gap-1" title="Runs until you switch it off — colour shows live (emerald) vs starts later (amber).">
                <InfinityIcon className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                No end date
              </span>
              <span className="flex items-center gap-1" title="Scheduled to start later">
                <Clock className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                Starts later
              </span>
              <span className="flex items-center gap-1" title="Live now — ends on its date">
                <CalendarCheck className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                Live, has end date
              </span>
            </div>
            <button
              onMouseDown={(e) => e.preventDefault()}
              onClick={clearAnnouncements}
              disabled={config.announcementBar.announcements.length === 0}
              className="flex items-center gap-1 rounded px-1.5 py-1 text-[11px] font-medium text-on-surface-variant hover:text-red-500 hover:bg-red-500/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed shrink-0"
              title="Remove all messages (Undo to restore)"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Clear
            </button>
          </div>
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
                // One glyph per row — colour = on air (emerald live / amber
                // queued), shape = does it end (∞ never / calendar-clock bounded),
                // plus an emerald ring while live. The reasoning behind the
                // standard lives on AnnouncementScheduleState in announcementWindow.
                const schedState = announcementScheduleState(ann.startDate, ann.endDate);
                const isGreen = schedState === 'current' || schedState === 'openEndedCurrent';
                const neverEnds = schedState === 'openEndedCurrent' || schedState === 'openEndedFuture';
                const startsLater = schedState === 'future' || schedState === 'openEndedFuture';
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
                    className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm text-[#5a4138] dark:text-[#dbc1b3] bg-primary/20 group relative cursor-pointer transition-all ${rowRangeInvalid ? 'ring-[1.5px] ring-red-500 dark:ring-red-400' : selectedIndex === index ? 'ring-[1.5px] ring-primary/80 bg-primary/30' : isGreen ? 'ring-1 ring-emerald-500/50 hover:ring-emerald-500/80' : 'hover:bg-primary/25 hover:ring-1 hover:ring-primary/70'} ${draggedIndex === index ? 'opacity-60' : ''}`}>
                    {rowRangeInvalid && (
                      <span aria-hidden="true" className="text-red-600 dark:text-red-400 font-bold">!</span>
                    )}
                    {neverEnds ? (
                      <span
                        title={startsLater ? 'Starts later, then runs until you switch it off' : 'Live now — runs until you switch it off'}
                        className={`flex shrink-0 ${startsLater ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}`}
                      >
                        <InfinityIcon className="w-3 h-3" aria-label="No end date" />
                      </span>
                    ) : schedState === 'future' ? (
                      <span title="Scheduled to start later" className="flex shrink-0 text-amber-600 dark:text-amber-400">
                        <Clock className="w-3 h-3" aria-label="Starts later" />
                      </span>
                    ) : schedState === 'current' ? (
                      <span title="Live now — ends on its date" className="flex shrink-0 text-emerald-600 dark:text-emerald-400">
                        <CalendarCheck className="w-3 h-3" aria-label="Live now, ends on its date" />
                      </span>
                    ) : null}
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
      </div>
    </div>
  );
}