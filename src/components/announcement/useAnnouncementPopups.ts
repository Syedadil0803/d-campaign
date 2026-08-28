'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { isInvalidRange } from '@/lib/dateRange';

/**
 * The two popups that hang off the editor's toolbar — Add link and Schedule —
 * together with the two calendars inside the second one.
 *
 * Fourteen pieces of state for two arguments: the selected dates, which the
 * schedule popup needs in order to refuse to close on an invalid range. Every
 * trigger, panel element, open flag, position and calendar month belongs to
 * this group and to nothing else, which is what makes it a module rather than
 * a keyhole into the section.
 *
 * Positions are taken in a layout effect rather than on the click, because the
 * measurement has to happen after the popup exists but before the browser
 * paints, or it shows at the previous position for a frame.
 */
export function useAnnouncementPopups({
  selectedStartDate,
  selectedEndDate,
}: {
  selectedStartDate: string;
  selectedEndDate: string;
}) {
  const [showLinkPopup, setShowLinkPopup] = useState(false);
  const [showSchedulePopup, setShowSchedulePopup] = useState(false);
  const [showStartDateCalendar, setShowStartDateCalendar] = useState(false);
  const [showEndDateCalendar, setShowEndDateCalendar] = useState(false);
  const [startDateView, setStartDateView] = useState<Date>(new Date());
  const [endDateView, setEndDateView] = useState<Date>(new Date());
  const [linkPos, setLinkPos] = useState<{ top: number; left: number } | null>(null);
  const [schedulePos, setSchedulePos] = useState<{ top: number; left: number } | null>(null);
  const linkBtnRef = useRef<HTMLButtonElement>(null);
  const scheduleBtnRef = useRef<HTMLButtonElement>(null);
  const linkPopupRef = useRef<HTMLDivElement>(null);
  const schedulePopupRef = useRef<HTMLDivElement>(null);
  const startDateCalendarRef = useRef<HTMLDivElement>(null);
  const endDateCalendarRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    if (showSchedulePopup) return;
    setShowStartDateCalendar(false);
    setShowEndDateCalendar(false);
  }, [showSchedulePopup]);

  /**
   * Dismissal, on its own listener.
   *
   * These were two branches of the section's single mousedown handler, which
   * also served the styling menus and the row menu. The conditions are
   * independent, so a listener of their own behaves identically.
   */
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
        // Don't close on outside-click while the range is invalid — the user
        // must fix it or press Clear (mirrors the blocked Done button).
        !isInvalidRange(selectedStartDate, selectedEndDate) &&
        schedulePopupRef.current && !schedulePopupRef.current.contains(target) &&
        scheduleBtnRef.current && !scheduleBtnRef.current.contains(target)
      ) {
        setShowSchedulePopup(false);
      }
    };
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, [showLinkPopup, showSchedulePopup, selectedStartDate, selectedEndDate]);

  return {
    showLinkPopup,
    setShowLinkPopup,
    showSchedulePopup,
    setShowSchedulePopup,
    showStartDateCalendar,
    setShowStartDateCalendar,
    showEndDateCalendar,
    setShowEndDateCalendar,
    startDateView,
    setStartDateView,
    endDateView,
    setEndDateView,
    linkPos,
    schedulePos,
    linkBtnRef,
    scheduleBtnRef,
    linkPopupRef,
    schedulePopupRef,
    startDateCalendarRef,
    endDateCalendarRef,
  };
}
