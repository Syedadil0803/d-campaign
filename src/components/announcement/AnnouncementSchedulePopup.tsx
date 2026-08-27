'use client';

import type { Dispatch, RefObject, SetStateAction } from 'react';
import { createPortal } from 'react-dom';
import type { CampaignConfig } from '@/types/campaign';
import { formatDateLabel } from '@/lib/calendarDates';
import { InlineCalendar } from '@/components/announcement/InlineCalendar';

interface AnnouncementSchedulePopupProps {
  open: boolean;
  position: { top: number; left: number } | null;
  popupRef: RefObject<HTMLDivElement | null>;
  closePopupAndFocusEditor: () => void;
  /** End before start. Blocks Done, the × and outside-click alike. */
  scheduleRangeInvalid: boolean;

  /** Which announcement in the list the popup is editing. */
  selectedIndex: number | null;
  config: CampaignConfig;
  setConfig: (config: CampaignConfig) => void;
  markChanged: () => void;

  selectedStartDate: string;
  setSelectedStartDate: (iso: string) => void;
  selectedEndDate: string;
  setSelectedEndDate: (iso: string) => void;

  startDateView: Date;
  setStartDateView: Dispatch<SetStateAction<Date>>;
  endDateView: Date;
  setEndDateView: Dispatch<SetStateAction<Date>>;
  showStartDateCalendar: boolean;
  setShowStartDateCalendar: Dispatch<SetStateAction<boolean>>;
  showEndDateCalendar: boolean;
  setShowEndDateCalendar: Dispatch<SetStateAction<boolean>>;
  startDateCalendarRef: RefObject<HTMLDivElement | null>;
  endDateCalendarRef: RefObject<HTMLDivElement | null>;
}

/** The month a calendar should open on when the field has no date yet. */
function currentMonth(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

/**
 * When an announcement starts and stops showing.
 *
 * Rendered into document.body: it is positioned against the announcement's row
 * in a scrolling list.
 */
export function AnnouncementSchedulePopup({
  open,
  position,
  popupRef,
  closePopupAndFocusEditor,
  scheduleRangeInvalid,
  selectedIndex,
  config,
  setConfig,
  markChanged,
  selectedStartDate,
  setSelectedStartDate,
  selectedEndDate,
  setSelectedEndDate,
  startDateView,
  setStartDateView,
  endDateView,
  setEndDateView,
  showStartDateCalendar,
  setShowStartDateCalendar,
  showEndDateCalendar,
  setShowEndDateCalendar,
  startDateCalendarRef,
  endDateCalendarRef,
}: AnnouncementSchedulePopupProps) {
  if (!open || !position || typeof document === 'undefined') return null;

  /** Write one scheduling field back to the announcement being edited. */
  function updateSelected(patch: { startDate?: string; endDate?: string }) {
    if (selectedIndex === null) return;
    const updated = [...config.announcementBar.announcements];
    updated[selectedIndex] = {
      ...updated[selectedIndex],
      startDate: 'startDate' in patch ? patch.startDate || undefined : updated[selectedIndex].startDate,
      endDate: 'endDate' in patch ? patch.endDate || undefined : updated[selectedIndex].endDate,
      richText: true,
    };
    setConfig({
      ...config,
      announcementBar: { ...config.announcementBar, announcements: updated },
    });
    markChanged();
  }

  return createPortal(
    <div
      ref={popupRef}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      style={{ position: 'absolute', top: position.top, left: position.left, zIndex: 9999 }}
      className="bg-black/10 backdrop-blur-md border border-white/10 rounded-xl shadow-2xl p-3 w-[260px]">
      <button
        onMouseDown={(e) => { e.stopPropagation(); e.preventDefault(); if (scheduleRangeInvalid) return; closePopupAndFocusEditor(); }}
        aria-label="Close"
        title={scheduleRangeInvalid ? 'Fix invalid date range to close.' : undefined}
        className={`absolute top-0 right-2 p-1 rounded text-xl ${scheduleRangeInvalid ? 'text-on-surface-variant/40 cursor-not-allowed' : 'text-on-surface-variant hover:text-on-surface'}`}
      >
        ×
      </button>
      <p className="text-xs font-medium text-on-surface mb-2">Schedule (optional)</p>
      <div className="space-y-2">
        <div>
          <label className="block text-[11px] text-on-surface-variant mb-0.5">Start Date</label>
          <div ref={startDateCalendarRef} className="relative">
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                // The view is component state shared by every announcement in
                // the list, so without the else it kept the month of whichever
                // announcement was opened last: pick a date on one, then open
                // an undated one, and its calendar opened on that other date's
                // month rather than today.
                if (selectedStartDate) {
                  const date = new Date(`${selectedStartDate}T00:00:00`);
                  if (!Number.isNaN(date.getTime())) setStartDateView(new Date(date.getFullYear(), date.getMonth(), 1));
                } else {
                  setStartDateView(currentMonth());
                }
                setShowStartDateCalendar((prev) => !prev);
                setShowEndDateCalendar(false);
              }}
              className="flex w-full items-center justify-between rounded-xl border border-white/10 bg-black/10 p-1.5 text-sm text-on-surface backdrop-blur-md"
            >
              <span className={selectedStartDate ? 'text-on-surface' : 'text-on-surface-variant'}>
                {formatDateLabel(selectedStartDate)}
              </span>
              <svg
                className={`h-4 w-4 flex-shrink-0 text-on-surface-variant transition-transform duration-200 ${showStartDateCalendar ? 'rotate-180' : 'rotate-0'}`}
                viewBox="0 0 20 20"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
              >
                <path d="M6 8l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            {showStartDateCalendar && (
              <InlineCalendar
                viewDate={startDateView}
                onViewDateChange={setStartDateView}
                selected={selectedStartDate}
                keyPrefix="start"
                onSelect={(iso) => {
                  setSelectedStartDate(iso);
                  updateSelected({ startDate: iso });
                  setShowStartDateCalendar(false);
                }}
              />
            )}
          </div>
        </div>
        <div>
          <label className="block text-[11px] text-on-surface-variant mb-0.5">End Date</label>
          <div ref={endDateCalendarRef} className="relative">
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                if (selectedEndDate) {
                  const date = new Date(`${selectedEndDate}T00:00:00`);
                  if (!Number.isNaN(date.getTime())) setEndDateView(new Date(date.getFullYear(), date.getMonth(), 1));
                } else {
                  setEndDateView(currentMonth());
                }
                setShowEndDateCalendar((prev) => !prev);
                setShowStartDateCalendar(false);
              }}
              className={`flex w-full items-center justify-between rounded-xl border bg-black/10 p-1.5 text-sm text-on-surface backdrop-blur-md ${
                scheduleRangeInvalid ? 'border-red-500 dark:border-red-400' : 'border-white/10'
              }`}
            >
              <span className={selectedEndDate ? 'text-on-surface' : 'text-on-surface-variant'}>
                {formatDateLabel(selectedEndDate)}
              </span>
              <svg
                className={`h-4 w-4 flex-shrink-0 text-on-surface-variant transition-transform duration-200 ${showEndDateCalendar ? 'rotate-180' : 'rotate-0'}`}
                viewBox="0 0 20 20"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
              >
                <path d="M6 8l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            {showEndDateCalendar && (
              <InlineCalendar
                viewDate={endDateView}
                onViewDateChange={setEndDateView}
                selected={selectedEndDate}
                keyPrefix="end"
                onSelect={(iso) => {
                  setSelectedEndDate(iso);
                  updateSelected({ endDate: iso });
                  setShowEndDateCalendar(false);
                }}
              />
            )}
          </div>
        </div>
        {scheduleRangeInvalid && (
          <p className="text-[11px] font-medium text-red-600 dark:text-red-400">
            End date must be on or after the start date.
          </p>
        )}
        <p className="text-[10px] text-on-surface-variant">Leave empty to always show when bar is active.</p>
      </div>
      <div className="flex justify-between items-center mt-2">
        {(selectedStartDate || selectedEndDate) && (
          <button
            onMouseDown={(e) => {
              e.preventDefault();
              setSelectedStartDate('');
              setSelectedEndDate('');
              updateSelected({ startDate: '', endDate: '' });
            }}
            className="text-xs text-primary hover:opacity-80"
          >
            Clear
          </button>
        )}
        <button
          onMouseDown={(e) => {
            e.preventDefault();
            if (scheduleRangeInvalid) return;
            closePopupAndFocusEditor();
          }}
          disabled={scheduleRangeInvalid}
          title={scheduleRangeInvalid ? 'Fix invalid date range to save.' : undefined}
          className="ml-auto text-xs bg-primary text-on-primary px-3 py-1 rounded hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Done
        </button>
      </div>
    </div>,
    document.body,
  );
}
