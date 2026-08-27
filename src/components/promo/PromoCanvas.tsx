'use client';

import type { PromoField } from '@/types/campaign';
import { getBackgroundStyle } from '@/lib/utils';
import { usePromoEditor } from '@/components/promo/PromoEditorContext';
import { PromoPreviewTextField } from '@/components/promo/PromoPreviewTextField';
import { PromoPreviewTimer } from '@/components/promo/PromoPreviewTimer';
import { PromoPreviewButton } from '@/components/promo/PromoPreviewButton';
import { PromoSkeletonGhosts } from '@/components/promo/PromoSkeletonGhosts';
import { PromoFieldStylePanel } from '@/components/promo/PromoFieldStylePanel';
import { PromoCardBackgroundPopup } from '@/components/promo/PromoCardBackgroundPopup';
import { PREVIEW_TEXT_FIELDS } from '@/components/promo/previewTextFields';

/**
 * The card, as the user sees it, and everything that sits over it.
 *
 * data-promo-canvas: the build panel measures this box and sits inside it, so
 * it never floats over the toolbar above.
 *
 * Reads the editor through context rather than props. Sixty-one values reach
 * this markup; as a prop list that is not a component boundary, just a longer
 * way of writing the same function.
 */
export function PromoCanvas() {
  const {
    config,
    currentField,
    promoCardRef,
    previewFieldRefs,
    previewButtonRef,
    lexicalTimerRef,
    activeEditorRef,
    fieldPopupHeightRef,
    blankStart,
    previewZoom,
    cardWidth,
    setCardWidth,
    computeCardWidth,
    showTimerInPreview,
    showButtonInPreview,
    previewFieldVisible,
    previewFieldHasContent,
    ctaDestination,
    onTimerEdited,
    setConfig,
    markChanged,
    setCurrentField,
    updateField,
    setActiveFormats,
    warnTimerLimit,
    pushPromoStateFromConfig,
    liveCardRef,
    onFieldInput,
    onPromoPreviewKeyDown,
    refreshPromoToolbarFormats,
    handlePromoToolbarFormat,
    handlePromoToolbarColor,
    activeFormats,
    getPreviewFieldBackground,
    getPopupFieldStyle,
    getPopupFieldLabel,
    getPopupPositionStyle,
    setFieldAlignment,
    updateFieldBg,
    updateCardBg,
    setStylePopupAnchor,
    styleWarning,
    setStyleWarning,
    showCardBgPopup,
    setShowCardBgPopup,
    cardBgPopupRef,
    cardBgPopupTop,
    showCardBgTypeDropdown,
    setShowCardBgTypeDropdown,
    cardBgTypeBtnRef,
    cardBgTypeMenuRef,
    cardBgTypePos,
    setCardBgTypePos,
    showFieldBgTypeDropdown,
    setShowFieldBgTypeDropdown,
    fieldBgTypeBtnRef,
    fieldBgTypeMenuRef,
    fieldBgTypePos,
    setFieldBgTypePos,
    closeAllPromoDropdowns,
    getDropdownPosition,
    popupEditableFields,
    configLoadedSignal,
  } = usePromoEditor();

  return (
      <div
        data-promo-canvas
        className="campaign-card-surface rounded-lg px-5 pt-5 pb-2 relative flex-1 min-h-0 border border-gray-200 dark:border-gray-600"
      >
        <div className="absolute inset-x-0 top-4 flex items-center justify-center text-gray-400 text-sm font-medium pointer-events-none">
          Website Content Area
        </div>

        <div className="relative z-10 w-full h-full min-h-[228px] grid">
          {/* Preview popup is ALWAYS rendered (even when the campaign is
              stopped) so editing stays visible; `active` only controls the
              live website output, not this editor preview. */}
          {(
            <div
              ref={promoCardRef}
              className={`promo-live-preview relative rounded-xl shadow-2xl p-5 flex flex-col ${
                config.promoCard.style.position === "bottom-right"
                  ? "justify-self-end self-end"
                  : config.promoCard.style.position === "bottom-left"
                    ? "justify-self-start self-end"
                    : config.promoCard.style.position === "top-right"
                      ? "justify-self-end self-start"
                      : "justify-self-start self-start"
              }`}
              style={{
                width: `${cardWidth}px`,
                /**
                 * Held back until the first load, then faded in.
                 *
                 * The editor paints from defaultConfig — always palette one
                 * — before the real card arrives, so the card appeared in
                 * the wrong colours and swapped a moment later, outlines
                 * arriving after that. Gating the whole tab fixed the swap
                 * and replaced it with a blank page, which is worse: the
                 * panel and controls are correct from the first frame and
                 * have no reason to wait.
                 *
                 * Only the card waits, and it holds its space while it
                 * does, so nothing moves when it appears.
                 */
                opacity: (configLoadedSignal ?? 0) > 0 ? 1 : 0,
                transition: 'opacity 160ms ease-out',
                // Auto-fit: scale the whole card down (layout included, via
                // `zoom`) when it's taller than the frame, so the full card is
                // always visible — no clip, no scroll — at any window/zoom.
                zoom: previewZoom,
                // No max-height: the live widget card grows to fit its content
                // (it's position:fixed on the site), so capping it here clipped
                // the preview and forced a scroll that never happens on the site.
                // Render the preview in the SAME system font the widget uses
                // so line-wrapping is identical (WYSIWYG). The app's Geist is
                // a different, wider cut than the widget could reliably load,
                // which made text wrap differently between tool and site.
                fontFamily:
                  '-apple-system, BlinkMacSystemFont, system-ui, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
                background: getBackgroundStyle(
                  config.promoCard.style.background,
                ),
              }}
            >
              {PREVIEW_TEXT_FIELDS.map(
                ({ field, placeholder, emptyClassName, marginClassName, defaultAlign }) =>
                  previewFieldVisible[field] && (
                    <PromoPreviewTextField
                      key={field}
                      field={field}
                      editorRef={previewFieldRefs[field]}
                      placeholder={placeholder}
                      hasContent={previewFieldHasContent[field]}
                      emptyClassName={emptyClassName}
                      marginClassName={marginClassName}
                      defaultAlign={defaultAlign}
                      config={config}
                      blankStart={blankStart}
                      currentField={currentField}
                      background={getPreviewFieldBackground(field)}
                      activeEditorRef={activeEditorRef}
                      setShowCardBgPopup={setShowCardBgPopup}
                      setStylePopupAnchor={setStylePopupAnchor}
                      setCurrentField={setCurrentField}
                      refreshPromoToolbarFormats={refreshPromoToolbarFormats}
                      onFieldInput={onFieldInput}
                      onPromoPreviewKeyDown={onPromoPreviewKeyDown}
                    />
                  ),
              )}

              {showTimerInPreview && (
                <PromoPreviewTimer
                  pushPromoStateFromConfig={pushPromoStateFromConfig}
                  liveCardRef={liveCardRef}
                  config={config}
                  currentField={currentField}
                  lexicalTimerRef={lexicalTimerRef}
                  setConfig={setConfig}
                  markChanged={markChanged}
                  setCurrentField={setCurrentField}
                  setActiveFormats={setActiveFormats}
                  setShowCardBgPopup={setShowCardBgPopup}
                  setStylePopupAnchor={setStylePopupAnchor}
                  setCardWidth={setCardWidth}
                  computeCardWidth={computeCardWidth}
                  warnTimerLimit={warnTimerLimit}
                  onTimerEdited={onTimerEdited}
                  background={getPreviewFieldBackground("timer")}
                />
              )}

              <PromoSkeletonGhosts
                blankStart={blankStart}
                showTimerInPreview={showTimerInPreview}
                showButtonInPreview={showButtonInPreview}
                textColor={config.promoCard.style.textColor}
                endDate={config.promoCard.endDate}
              />

              {showButtonInPreview && (
                <PromoPreviewButton
                  config={config}
                  currentField={currentField}
                  previewButtonRef={previewButtonRef}
                  setShowCardBgPopup={setShowCardBgPopup}
                  ctaDestination={ctaDestination}
                  background={getPreviewFieldBackground("button")}
                />
              )}

              {popupEditableFields.includes(currentField as PromoField) &&
                !showCardBgPopup && (
                  <PromoFieldStylePanel
                    field={currentField as PromoField}
                    fieldStyle={getPopupFieldStyle(currentField as PromoField)}
                    fieldLabel={getPopupFieldLabel(currentField as PromoField)}
                    positionStyle={getPopupPositionStyle(currentField as PromoField)}
                    config={config}
                    activeFormats={activeFormats}
                    fieldPopupHeightRef={fieldPopupHeightRef}
                    setCurrentField={setCurrentField}
                    handlePromoToolbarFormat={handlePromoToolbarFormat}
                    handlePromoToolbarColor={handlePromoToolbarColor}
                    setFieldAlignment={setFieldAlignment}
                    updateFieldBg={updateFieldBg}
                    updateField={updateField}
                    showFieldBgTypeDropdown={showFieldBgTypeDropdown}
                    setShowFieldBgTypeDropdown={setShowFieldBgTypeDropdown}
                    fieldBgTypePos={fieldBgTypePos}
                    setFieldBgTypePos={setFieldBgTypePos}
                    fieldBgTypeBtnRef={fieldBgTypeBtnRef}
                    fieldBgTypeMenuRef={fieldBgTypeMenuRef}
                    closeAllPromoDropdowns={closeAllPromoDropdowns}
                    getDropdownPosition={getDropdownPosition}
                    styleWarning={styleWarning}
                    setStyleWarning={setStyleWarning}
                  />
                )}
              {showCardBgPopup && (
                <PromoCardBackgroundPopup
                  cardIsOnTheLeft={
                    config.promoCard.style.position === 'bottom-left' ||
                    config.promoCard.style.position === 'top-left'
                  }
                  popupRef={cardBgPopupRef}
                  anchorRef={promoCardRef}
                  top={cardBgPopupTop}
                  background={config.promoCard.style.background}
                  onChange={updateCardBg}
                  onClose={() => setShowCardBgPopup(false)}
                  typeDropdownOpen={showCardBgTypeDropdown}
                  onTypeDropdownOpen={() => {
                    const next = !showCardBgTypeDropdown;
                    closeAllPromoDropdowns();
                    setShowCardBgPopup(true);
                    setShowCardBgTypeDropdown(next);
                    setCardBgTypePos(getDropdownPosition(cardBgTypeBtnRef.current));
                  }}
                  onTypeDropdownClose={() => setShowCardBgTypeDropdown(false)}
                  typeButtonRef={cardBgTypeBtnRef}
                  typeMenuRef={cardBgTypeMenuRef}
                  typeMenuPosition={cardBgTypePos}
                />
              )}
            </div>
          )}
        </div>
      </div>
  );
}
