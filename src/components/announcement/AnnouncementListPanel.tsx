'use client';

import { useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import { Clock, Infinity as InfinityIcon, MoreVertical, Trash2, TriangleAlert } from 'lucide-react';
import type { CampaignConfig } from '@/types/campaign';
import { stripHtml } from '@/lib/utils';
import { isInvalidRange } from '@/lib/dateRange';
import { announcementScheduleState } from '@/lib/announcement/announcementWindow';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';

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
  richEditorRef: RefObject<HTMLDivElement | null>;
}

const ActiveDot = () => (
  <span aria-label="Active now" className="inline-block w-[7px] h-[7px] rounded-full bg-emerald-500 shrink-0" />
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
  const [confirmingClear, setConfirmingClear] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const prevLengthRef = useRef(announcements.length);

  useEffect(() => {
    const prevLength = prevLengthRef.current;
    if (announcements.length > prevLength && scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({
        top: scrollContainerRef.current.scrollHeight,
        behavior: 'smooth',
      });
    }
    prevLengthRef.current = announcements.length;
  }, [announcements.length]);

  const hasInvalid = announcements.some((a) => isInvalidRange(a.startDate, a.endDate));
  const hasNoEnd = announcements.some((a) => ['openEndedCurrent', 'openEndedFuture'].includes(announcementScheduleState(a.startDate, a.endDate)));
  const hasStartsLater = announcements.some((a) => ['future', 'openEndedFuture'].includes(announcementScheduleState(a.startDate, a.endDate)));
  const hasActiveNow = announcements.some((a) => ['current', 'openEndedCurrent'].includes(announcementScheduleState(a.startDate, a.endDate)));

  // Handle inline "Yes" click - shows the popup confirmation
  const handleInlineYes = () => {
    setConfirmingClear(false);
    setShowClearConfirm(true);
  };

  // Handle popup confirm (Yes, clear all button)
  const handlePopupConfirm = () => {
    clearAnnouncements();
    setShowClearConfirm(false);
  };

  // Handle popup cancel
  const handlePopupCancel = () => {
    setShowClearConfirm(false);
  };

  return (
    <div className="relative h-[320px] w-full">
      {/* Outer Container: Fixed 320px with py-[30px] Padding */}
      <div className="absolute inset-0 box-border rounded-2xl border border-border campaign-card-surface px-6 py-[30px] shadow-sm flex flex-col transition-all hover:border-primary/70 hover:shadow-md hover:shadow-primary/20">

        {/* Zone 1: Header Block (52px) */}
        <div className="shrink-0 flex flex-col gap-1">
          <h4 className="text-xl font-bold leading-[28px] text-on-surface">
            Manage Announcements
          </h4>
          <p className="text-sm leading-[20px] text-on-surface-variant">
            View, reorder, and manage your messages.
          </p>
        </div>

        {/* Divider Line & Margins (41px Total - Divider sits exactly at 102px Y-offset) */}
        <div className="my-5 h-[1px] w-full bg-border" />

        {/* Zone 2: Toolbar Row (20px) */}
        <div className="flex h-5 items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-[0.08em] leading-none">
              Message List{announcements.length > 0 ? ` (${announcements.length})` : ''}
            </label>

            {announcements.length > 0 && (
              confirmingClear ? (
                // ── INLINE CONFIRMATION ──
                <span className="flex items-center gap-1.5 text-[11px] leading-none">
                  <span className="text-on-surface-variant/70">Clear all?</span>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={handleInlineYes}
                    className="font-medium text-rose-500 hover:text-rose-600 transition-colors"
                  >
                    Yes
                  </button>
                  <span className="text-on-surface-variant/30">/</span>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => setConfirmingClear(false)}
                    className="font-medium text-on-surface-variant/60 hover:text-on-surface transition-colors"
                  >
                    Cancel
                  </button>
                </span>
              ) : (
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => setConfirmingClear(true)}
                  className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium text-slate-400 hover:text-rose-500 transition-colors cursor-pointer"
                  title="Remove all messages"
                >
                  <Trash2 className="w-3 h-3" />
                  Clear All
                </button>
              )
            )}
          </div>

          {/* Status Legend */}
          <div className="flex items-center gap-3 text-[11px] font-medium text-on-surface-variant/65">
            {hasInvalid && (
              <span className="flex items-center gap-1.5" title="Ends before it starts — fix or clear the schedule.">
                <TriangleAlert className="w-2.5 h-2.5 text-red-500 shrink-0" /> Invalid
              </span>
            )}
            {hasNoEnd && (
              <span className="flex items-center gap-1.5" title="Runs until you switch it off.">
                <InfinityIcon className="w-2.5 h-2.5 text-violet-600 dark:text-violet-400 shrink-0" /> No End Date
              </span>
            )}
            {hasStartsLater && (
              <span className="flex items-center gap-1.5" title="Scheduled to start later.">
                <Clock className="w-2.5 h-2.5 text-amber-600 dark:text-amber-400 shrink-0" /> Starts Later
              </span>
            )}
            {hasActiveNow && (
              <span className="flex items-center gap-1.5" title="Currently active.">
                <ActiveDot /> Active Now
              </span>
            )}
          </div>
        </div>

        {/* Zone 3: Canvas Viewport (Hard Cap: 120px Height Lock = 3 Rows Max) */}
        {announcements.length === 0 ? (
          <div className="mt-4 flex h-[120px] max-h-[120px] w-full items-center justify-center text-center text-sm text-on-surface-variant">
            Added text from the left input box will be displayed here
          </div>
        ) : (
          <div
            ref={scrollContainerRef}
            className="mt-4 flex h-[120px] max-h-[120px] w-full flex-wrap items-center content-start gap-x-[6px] gap-y-3 overflow-y-auto pr-1.5 campaign-custom-scrollbar"
            style={{ scrollbarGutter: 'stable' }}
          >
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
                  className={`inline-flex h-8 max-w-[212px] min-w-[60.77px] shrink-0 items-center rounded-full pl-[10px] pr-[6px] text-xs font-medium text-[#5a4138] dark:text-[#dbc1b3] bg-primary/20 group relative cursor-pointer transition-all ${rowRangeInvalid
                      ? 'border border-red-500 dark:border-red-400'
                      : selectedIndex === index
                        ? 'border border-primary/80 bg-primary/30'
                        : isActiveNow
                          ? 'border border-emerald-500/50 hover:border-emerald-500/80'
                          : 'border border-transparent hover:border-primary/70 hover:bg-primary/25'
                    } ${draggedIndex === index ? 'opacity-60' : ''}`}
                >
                  {rowRangeInvalid ? (
                    <TriangleAlert className="h-[12px] w-[12px] text-red-600 dark:text-red-400 shrink-0" aria-label="Invalid schedule" />
                  ) : (
                    <span className="flex items-center gap-1 shrink-0">
                      {isActiveNow && <ActiveDot />}
                      {isStartsLater && <Clock className="h-[12px] w-[12px] text-amber-600 dark:text-amber-400 shrink-0" aria-label="Starts later" />}
                      {noEnd && <InfinityIcon className="h-[12px] w-[12px] text-violet-600 dark:text-violet-400 shrink-0" aria-label="No end date" />}
                    </span>
                  )}

                  <span className="ml-[6px] max-w-[120px] truncate leading-4" title={stripHtml(ann.text)}>
                    {stripHtml(ann.text)}
                  </span>

                  <button
                    type="button"
                    data-action-btn
                    onClick={(e) => { e.stopPropagation(); openActionMenu(index, e.currentTarget); }}
                    className="ml-[6px] flex h-5 w-5 shrink-0 items-center justify-center rounded text-[#5a4138]/30 dark:text-[#dbc1b3]/30 hover:text-[#5a4138]/80 dark:hover:text-[#dbc1b3]/80 hover:bg-slate-200/60 dark:hover:bg-slate-700 transition-colors"
                    title="More options"
                  >
                    <MoreVertical className="h-[12px] w-[12px]" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── POPUP CONFIRMATION DIALOG ── */}
      <ConfirmDialog
        open={showClearConfirm}
        title="Clear all announcements?"
        confirmLabel="Yes, clear all"
        cancelLabel="Cancel"
        tone="danger"
        onConfirm={handlePopupConfirm}
        onCancel={handlePopupCancel}
      >
        <div className="mt-2 space-y-1">
          <p className="text-sm text-on-surface-variant">
            This will permanently remove all messages from the list. You can undo this action from the toast notification that appears after clearing.
          </p>
        </div>
      </ConfirmDialog>
    </div>
  );
}