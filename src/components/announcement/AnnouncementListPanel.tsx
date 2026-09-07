'use client';

import type { RefObject } from 'react';
import { Clock, Infinity as InfinityIcon, MoreVertical, Trash2, TriangleAlert } from 'lucide-react';
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

const ActiveDot = () => (
  <span aria-label="Active now" className="inline-block w-[7px] h-[7px] rounded-full bg-emerald-600 dark:bg-emerald-400 shrink-0" />
);

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
  const announcements = config.announcementBar.announcements;

  const hasInvalid = announcements.some((a) => isInvalidRange(a.startDate, a.endDate));
  const hasNoEnd = announcements.some((a) => ['openEndedCurrent', 'openEndedFuture'].includes(announcementScheduleState(a.startDate, a.endDate)));
  const hasStartsLater = announcements.some((a) => ['future', 'openEndedFuture'].includes(announcementScheduleState(a.startDate, a.endDate)));
  const hasActiveNow = announcements.some((a) => ['current', 'openEndedCurrent'].includes(announcementScheduleState(a.startDate, a.endDate)));

  return (
    <div className="relative min-h-0">
      <div className="absolute inset-0 rounded-2xl border border-border campaign-card-surface p-6 shadow-sm flex flex-col overflow-hidden transition-all hover:border-primary/70 hover:shadow-md hover:shadow-primary/20">

        <div className="flex items-start justify-between gap-3 border-b border-border pb-4 mb-4 shrink-0">
          <div className="min-w-0">
            <h4 className="text-xl font-semibold leading-7 text-on-surface">Manage Announcements</h4>
            <p className="mt-0.5 text-sm text-on-surface-variant">View, reorder, and manage your messages.</p>
          </div>
          <button
            onMouseDown={(e) => e.preventDefault()}
            onClick={clearAnnouncements}
            disabled={announcements.length === 0}
            className="flex items-center gap-1 shrink-0 rounded px-2 py-1 text-[11px] font-medium text-on-surface-variant/60 hover:text-red-500 hover:bg-red-500/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed mt-0.5"
            title="Remove all messages (Undo to restore)"
          >
            <Trash2 className="w-3 h-3" />
            Clear All
          </button>
        </div>

        <div className="min-h-0 flex flex-col">
          <div className="flex items-center justify-between h-5 mb-3 shrink-0">
            <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-[0.08em] leading-none">
              Message List
            </label>
            <div className="flex items-center gap-2.5 text-[10px] text-on-surface-variant/65 leading-none">
              {hasInvalid && (
                <span className="flex items-center gap-0.5" title="Ends before it starts — fix or clear the schedule.">
                  <TriangleAlert className="w-2.5 h-2.5 text-red-500 shrink-0" /> Invalid
                </span>
              )}
              {hasNoEnd && (
                <span className="flex items-center gap-0.5" title="Runs until you switch it off.">
                  <InfinityIcon className="w-2.5 h-2.5 text-violet-600 dark:text-violet-400 shrink-0" /> No End Date
                </span>
              )}
              {hasStartsLater && (
                <span className="flex items-center gap-0.5" title="Scheduled to start later.">
                  <Clock className="w-2.5 h-2.5 text-amber-600 dark:text-amber-400 shrink-0" /> Starts Later
                </span>
              )}
              {hasActiveNow && (
                <span className="flex items-center gap-0.5" title="Currently active.">
                  <ActiveDot /> Active Now
                </span>
              )}
            </div>
          </div>

          {announcements.length === 0 ? (
            <div className="flex items-center justify-center text-center text-sm text-on-surface-variant min-h-[116px]">
              Added text from the left input box will be displayed here
            </div>
          ) : (
            <div className="campaign-custom-scrollbar overflow-y-auto overflow-x-hidden min-h-[116px] max-h-[116px]">
              <div className="flex flex-wrap gap-2 p-0.5 content-start">
                {announcements.map((ann, index) => {
                  const rowRangeInvalid = isInvalidRange(ann.startDate, ann.endDate);
                  const schedState = announcementScheduleState(ann.startDate, ann.endDate);
                  const isActiveNow = schedState === 'current' || schedState === 'openEndedCurrent';
                  const isStartsLater = schedState === 'future' || schedState === 'openEndedFuture';
                  const noEnd = schedState === 'openEndedCurrent' || schedState === 'openEndedFuture';

                  return (
                    <div
                      key={index}
                      draggable
                      onDragStart={(e) => { setDraggedIndex(index); e.dataTransfer.effectAllowed = 'move'; }}
                      onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }}
                      onDrop={(e) => { e.preventDefault(); if (draggedIndex !== null) reorderAnnouncements(draggedIndex, index); setDraggedIndex(null); }}
                      onDragEnd={() => setDraggedIndex(null)}
                      onMouseEnter={(e) => {
                        cancelCloseActionMenu();
                        const btn = e.currentTarget.querySelector('[data-action-btn]') as HTMLButtonElement;
                        if (btn) openActionMenu(index, btn);
                      }}
                      onMouseLeave={scheduleCloseActionMenu}
                      onClick={() => {
                        if (selectedIndex === index) return clearSelection();
                        const normalizedText = loadAnnouncementIntoSelection(index);
                        if (richEditorRef.current) {
                          richEditorRef.current.innerHTML = normalizedText;
                          richEditorRef.current.blur();
                        }
                        window.getSelection()?.removeAllRanges();
                        detectFormatsForSelectMode(normalizedText);
                      }}
                      title={rowRangeInvalid ? 'This message ends before it starts — open it and fix or clear the schedule.' : undefined}
                      className={`inline-flex items-center gap-1.5 px-3 py-[6px] rounded-full text-sm text-[#5a4138] dark:text-[#dbc1b3] bg-primary/20 group relative cursor-pointer transition-all ${
                        rowRangeInvalid
                          ? 'ring-[1.5px] ring-red-500 dark:ring-red-400'
                          : selectedIndex === index
                          ? 'ring-[1.5px] ring-primary/80 bg-primary/30'
                          : isActiveNow
                          ? 'ring-1 ring-emerald-500/50 hover:ring-emerald-500/80'
                          : 'hover:bg-primary/25 hover:ring-1 hover:ring-primary/70'
                      } ${draggedIndex === index ? 'opacity-60' : ''}`}
                    >
                      {rowRangeInvalid ? (
                        <TriangleAlert className="w-3 h-3 text-red-600 dark:text-red-400 shrink-0" aria-label="Invalid schedule" />
                      ) : (
                        <span className="flex items-center gap-1 shrink-0">
                          {isActiveNow && <ActiveDot />}
                          {isStartsLater && <Clock className="w-3 h-3 text-amber-600 dark:text-amber-400 shrink-0" aria-label="Starts later" />}
                          {noEnd && <InfinityIcon className="w-3 h-3 text-violet-600 dark:text-violet-400 shrink-0" aria-label="No end date" />}
                        </span>
                      )}

                      <span className="flex-1 truncate max-w-[180px]" title={stripHtml(ann.text)}>
                        {stripHtml(ann.text)}
                      </span>

                      <button
                        type="button"
                        data-action-btn
                        onClick={(e) => { e.stopPropagation(); openActionMenu(index, e.currentTarget); }}
                        className="w-4 flex items-center justify-center shrink-0 text-[#5a4138]/30 dark:text-[#dbc1b3]/30 group-hover:text-[#5a4138]/80 dark:group-hover:text-[#dbc1b3]/80 transition-colors"
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