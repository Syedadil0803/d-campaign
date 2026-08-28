'use client';

import { createPortal } from 'react-dom';
import { AnnouncementLinkPopup } from '@/components/announcement/AnnouncementLinkPopup';
import { AnnouncementSchedulePopup } from '@/components/announcement/AnnouncementSchedulePopup';
import { AnnouncementStylePanel } from '@/components/announcement/AnnouncementStylePanel';
import { useAnnouncementEditor } from '@/components/announcement/AnnouncementEditorContext';

/**
 * Everything the announcement editor puts on top of itself: the link and
 * schedule popups, the row menu, and the styling panel.
 *
 * Takes no props. It reads the same context the panel does, so lifting it out
 * cost nothing — which is the point of that context being flat and named after
 * the section's own locals.
 */
export function AnnouncementEditorPopups() {
  const {
    actionMenuIndex,
    actionMenuPos,
    actionMenuRef,
    annCountryBtnRef,
    annCountryMenuRef,
    annCountryPos,
    applyLinkSnapshot,
    backgroundTypeBtnRef,
    backgroundTypeMenuRef,
    backgroundTypePos,
    cancelCloseActionMenu,
    directionBtnRef,
    directionMenuRef,
    directionPos,
    endDateCalendarRef,
    endDateView,
    getEditorSnapshot,
    getLinkSnapshot,
    handleMenuAddLink,
    handleMenuDelete,
    handleMenuSchedule,
    linkPopupRef,
    linkPos,
    pushImmediateState,
    pushLinkState,
    redoLink,
    scheduleCloseActionMenu,
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
    setShowBackgroundTypeDropdown,
    setShowDirectionDropdown,
    setShowEndDateCalendar,
    setShowStartDateCalendar,
    setStartDateView,
    showAnnCountryDropdown,
    showBackgroundTypeDropdown,
    showDirectionDropdown,
    showEndDateCalendar,
    showLinkPopup,
    showSchedulePopup,
    showStartDateCalendar,
    startDateCalendarRef,
    startDateView,
    undoLink,
    bg,
    closePopupAndFocusEditor,
    linkDeletingRef,
    scheduleRangeInvalid,
    setPreviewDirection,
    updateBg,
    updateBgWithHistory,
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

    {actionMenuIndex !== null && actionMenuPos && typeof document !== 'undefined' && createPortal(
      <div
        ref={actionMenuRef}
        onMouseDown={(e) => e.stopPropagation()}
        onMouseEnter={() => cancelCloseActionMenu()}
        onMouseLeave={() => scheduleCloseActionMenu()}
        style={{ position: 'absolute', top: actionMenuPos.top, left: actionMenuPos.left, zIndex: 9999 }}
        className="bg-black/10 backdrop-blur-md border border-white/10 rounded-xl shadow-2xl py-1 w-[180px]"
      >
        <button
          type="button"
          onMouseDown={(e) => { e.preventDefault(); handleMenuAddLink(actionMenuIndex); }}
          className="w-full text-left px-3 py-2 text-sm text-on-surface hover:bg-surface-subtle"
        >
          Add link
        </button>
        <button
          type="button"
          onMouseDown={(e) => { e.preventDefault(); handleMenuSchedule(actionMenuIndex); }}
          className="w-full text-left px-3 py-2 text-sm text-on-surface hover:bg-surface-subtle"
        >
          Schedule
        </button>
        <div className="my-1 h-px bg-border" />
        <button
          type="button"
          onMouseDown={(e) => { e.preventDefault(); handleMenuDelete(actionMenuIndex); }}
          className="w-full text-left px-3 py-2 text-sm text-primary hover:bg-primary/10"
        >
          Delete
        </button>
      </div>,
      document.body
    )}

    <AnnouncementStylePanel
      bg={bg}
      updateBg={updateBg}
      updateBgWithHistory={updateBgWithHistory}
      pushImmediateState={pushImmediateState}
      getEditorSnapshot={getEditorSnapshot}
      showBackgroundTypeDropdown={showBackgroundTypeDropdown}
      setShowBackgroundTypeDropdown={setShowBackgroundTypeDropdown}
      backgroundTypeBtnRef={backgroundTypeBtnRef}
      backgroundTypeMenuRef={backgroundTypeMenuRef}
      backgroundTypePos={backgroundTypePos}
      showDirectionDropdown={showDirectionDropdown}
      setShowDirectionDropdown={setShowDirectionDropdown}
      directionBtnRef={directionBtnRef}
      directionMenuRef={directionMenuRef}
      directionPos={directionPos}
      setPreviewDirection={setPreviewDirection}
    />    </>
  );
}
