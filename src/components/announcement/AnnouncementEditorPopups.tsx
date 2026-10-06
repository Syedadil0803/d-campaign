'use client';

import { AnnouncementLinkPopup } from '@/components/announcement/AnnouncementLinkPopup';
import { AnnouncementSchedulePopup } from '@/components/announcement/AnnouncementSchedulePopup';
import { useAnnouncementEditor } from '@/components/announcement/AnnouncementEditorContext';

/**
 * Everything the announcement editor puts on top of itself: the link and
 * schedule popups.
 *
 * Takes no props. It reads the same context the panel does, so lifting it out
 * cost nothing — which is the point of that context being flat and named after
 * the section's own locals.
 */
export function AnnouncementEditorPopups() {
  const {
    annCountryBtnRef,
    annCountryMenuRef,
    annCountryPos,
    applyLinkSnapshot,
    endDateCalendarRef,
    endDateView,
    getLinkSnapshot,
    linkPopupRef,
    linkPos,
    pushLinkState,
    redoLink,
    schedulePopupRef,
    schedulePos,
    selectedCountryCode,
    selectedCtaType,
    selectedEndDate,
    selectedOpenInNewTab,
    selectedStartDate,
    selectedUrl,
    selectedWhatsappNumber,
    setAnnCountryPos,
    setEndDateView,
    setSelectedCountryCode,
    setSelectedCtaType,
    setSelectedEndDate,
    setSelectedOpenInNewTab,
    setSelectedStartDate,
    setSelectedUrl,
    setSelectedWhatsappNumber,
    setShowAnnCountryDropdown,
    setShowEndDateCalendar,
    setShowStartDateCalendar,
    setStartDateView,
    showAnnCountryDropdown,
    showEndDateCalendar,
    showLinkPopup,
    showSchedulePopup,
    showStartDateCalendar,
    startDateCalendarRef,
    startDateView,
    undoLink,
    closePopupAndFocusEditor,
    linkDeletingRef,
    scheduleRangeInvalid,
  } = useAnnouncementEditor();

  return (
    <>
    <AnnouncementLinkPopup
      open={showLinkPopup}
      position={linkPos}
      popupRef={linkPopupRef}
      closePopupAndFocusEditor={closePopupAndFocusEditor}
      selectedCtaType={selectedCtaType}
      setSelectedCtaType={setSelectedCtaType}
      selectedUrl={selectedUrl}
      setSelectedUrl={setSelectedUrl}
      selectedOpenInNewTab={selectedOpenInNewTab}
      setSelectedOpenInNewTab={setSelectedOpenInNewTab}
      selectedCountryCode={selectedCountryCode}
      setSelectedCountryCode={setSelectedCountryCode}
      selectedWhatsappNumber={selectedWhatsappNumber}
      setSelectedWhatsappNumber={setSelectedWhatsappNumber}
      showAnnCountryDropdown={showAnnCountryDropdown}
      setShowAnnCountryDropdown={setShowAnnCountryDropdown}
      annCountryPos={annCountryPos}
      setAnnCountryPos={setAnnCountryPos}
      annCountryBtnRef={annCountryBtnRef}
      annCountryMenuRef={annCountryMenuRef}
      linkDeletingRef={linkDeletingRef}
      getLinkSnapshot={getLinkSnapshot}
      applyLinkSnapshot={applyLinkSnapshot}
      pushLinkState={pushLinkState}
      undoLink={undoLink}
      redoLink={redoLink}
    />

    <AnnouncementSchedulePopup
      open={showSchedulePopup}
      position={schedulePos}
      popupRef={schedulePopupRef}
      closePopupAndFocusEditor={closePopupAndFocusEditor}
      scheduleRangeInvalid={scheduleRangeInvalid}
      selectedStartDate={selectedStartDate}
      setSelectedStartDate={setSelectedStartDate}
      selectedEndDate={selectedEndDate}
      setSelectedEndDate={setSelectedEndDate}
      startDateView={startDateView}
      setStartDateView={setStartDateView}
      endDateView={endDateView}
      setEndDateView={setEndDateView}
      showStartDateCalendar={showStartDateCalendar}
      setShowStartDateCalendar={setShowStartDateCalendar}
      showEndDateCalendar={showEndDateCalendar}
      setShowEndDateCalendar={setShowEndDateCalendar}
      startDateCalendarRef={startDateCalendarRef}
      endDateCalendarRef={endDateCalendarRef}
    />

    </>
  );
}
