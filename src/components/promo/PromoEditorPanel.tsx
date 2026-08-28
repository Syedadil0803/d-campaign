'use client';

import { Gift } from 'lucide-react';
import { getBackgroundStyle } from '@/lib/utils';
import { usePromoEditor } from '@/components/promo/PromoEditorContext';
import { PromoCardActionDialog } from '@/components/promo/PromoCardActionDialog';
import { PromoTextField } from '@/components/promo/PromoTextField';
import { PromoScheduleAndTimer } from '@/components/promo/PromoScheduleAndTimer';
import { PromoCtaSettings } from '@/components/promo/PromoCtaSettings';
import { SegmentedToggle } from '@/components/promo/SegmentedToggle';
import { PANEL_TEXT_FIELDS } from '@/components/promo/panelTextFields';

/**
 * The editing panel down the left: what the card says, when it runs, and where
 * its button goes.
 *
 * Reads the editor through context, like the canvas beside it.
 */
export function PromoEditorPanel() {
  const {
    config,
    currentField,
    updateField,
    pushPromoState,
    panelFieldRefs,
    buttonRef,
    timerRef,
    fieldInfoPopup,
    setFieldInfoPopup,
    dismissFieldInfo,
    cardActionConfirm,
    setCardActionConfirm,
    openFieldStylePopup,
    onFieldInput,
    onFieldFocus,
    onPromoEditorKeyDown,
    refreshPromoToolbarFormats,
    smartPaste,
    setConfig,
    markChanged,
    liveCardRef,
    showStartDatePicker,
    setShowStartDatePicker,
    showEndDatePicker,
    setShowEndDatePicker,
    endDateFieldRef,
    promoDateRangeInvalid,
    dateErrorFlash,
    timerLimitReached,
    showCountryCodeDropdown,
    setShowCountryCodeDropdown,
    countryCodePos,
    setCountryCodePos,
    countryCodeBtnRef,
    countryCodeMenuRef,
    closeAllPromoDropdowns,
    getDropdownPosition,
  } = usePromoEditor();

  return (
    <div className="campaign-custom-scrollbar w-[30%] min-h-0 shrink-0 overflow-y-auto overflow-x-hidden pr-4 space-y-5">
      {/* Header + Toggle */}
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <div className="p-1 bg-primary/15 rounded-lg mr-3 border border-primary/60">
            <Gift className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h3 className="text-[1.75rem] leading-9 font-bold text-on-surface">
                Promo Card
            </h3>
            <p className="mt-2 max-w-2xl text-sm text-on-surface-variant">
              Floating widget for special offers.
            </p>
          </div>
        </div>
      </div>

      {/* Quick actions (Clear Canvas / My Published / Template Hub) now live
          in the action-tab strip above the Website Content Area preview. */}

      {/* Consent before a card-replacing action */}
      <PromoCardActionDialog
        action={cardActionConfirm}
        onDismiss={() => setCardActionConfirm(null)}
      />

      {/* More room than the other sections get, because this is the only
          one that follows a heading rather than body text. "Promo Card" at
          28px and "Content" at 24px are close enough in size to compete,
          and the standard gap left them reading as two titles stacked
          rather than a section beneath a page. */}
      <div className="!mt-12">
        <h4 className="text-2xl font-semibold leading-8 text-on-surface">
          Content
        </h4>
        <p className="mt-2 text-sm text-on-surface-variant">
          Main promo copy shown in the card.
        </p>
      </div>

      {/* Three fields, one component.
          An earlier attempt to merge these was reverted on 26 August 2026
          because the per-field line limit stopped working, and the cause
          was not found at the time. It is recorded in PromoTextField now:
          a field whose editor ref is created inside the component leaves
          PromoSection's titleRef / subtitleRef / descRef null, and
          onFieldInput returns before measuring when that ref is null — the
          cap disappears with nothing else changed. The refs stay here and
          are passed down, so that route is closed. If the limit misbehaves
          again, this is the first thing to check. */}
      {PANEL_TEXT_FIELDS.map(({ field, label, placeholder, info, className, headerClassName }) => (
        <PromoTextField
          key={field}
          field={field}
          label={label}
          placeholder={placeholder}
          info={info}
          className={className}
          headerClassName={headerClassName}
          html={config.promoCard[field]}
          editorRef={panelFieldRefs[field]}
          currentField={currentField}
          background={getBackgroundStyle(config.promoCard.style.background)}
          fieldInfoPopup={fieldInfoPopup}
          setFieldInfoPopup={setFieldInfoPopup}
          dismissFieldInfo={dismissFieldInfo}
          openFieldStylePopup={openFieldStylePopup}
          onFieldInput={onFieldInput}
          onFieldFocus={onFieldFocus}
          onPromoEditorKeyDown={onPromoEditorKeyDown}
          refreshPromoToolbarFormats={refreshPromoToolbarFormats}
          smartPaste={smartPaste}
        />
      ))}

      <div className="!mt-8">
        <h4 className="text-2xl font-semibold leading-8 text-on-surface">
          Campaign Schedule &amp; Timing
        </h4>
      </div>

      {/* Sub-section 1 — the system action: when the campaign auto-runs. */}
      <div className="!mt-6">
        <div className="flex items-center gap-2">
          <h5 className="text-base font-semibold text-on-surface">
            Campaign Duration
          </h5>
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
            Required
          </span>
        </div>
        <p className="mt-1 text-sm text-on-surface-variant">
          Set when this campaign will automatically start running and stop running.
        </p>
      </div>

      <PromoScheduleAndTimer
        config={config}
        setConfig={setConfig}
        liveCardRef={liveCardRef}
        markChanged={markChanged}
        pushPromoState={pushPromoState}
        updateField={updateField}
        showStartDatePicker={showStartDatePicker}
        setShowStartDatePicker={setShowStartDatePicker}
        showEndDatePicker={showEndDatePicker}
        setShowEndDatePicker={setShowEndDatePicker}
        endDateFieldRef={endDateFieldRef}
        promoDateRangeInvalid={promoDateRangeInvalid}
        dateErrorFlash={dateErrorFlash}
        timerRef={timerRef}
        timerLimitReached={timerLimitReached}
        openFieldStylePopup={openFieldStylePopup}
      />

      <div className="!mt-8">
        <h4 className="text-2xl font-semibold leading-8 text-on-surface">
          Call To Action
        </h4>
        <p className="mt-2 text-sm text-on-surface-variant">
          Configure button text and destination.
        </p>
      </div>

      <div className="flex items-center justify-between">
        <label className="text-sm font-semibold text-on-surface">
          CTA Button
        </label>
        <SegmentedToggle
          value={config.promoCard.showButton}
          onChange={(v) => updateField("showButton", v)}
        />
      </div>

      <PromoCtaSettings
        config={config}
        currentField={currentField}
        updateField={updateField}
        buttonRef={buttonRef}
        openFieldStylePopup={openFieldStylePopup}
        onFieldInput={onFieldInput}
        onFieldFocus={onFieldFocus}
        onPromoEditorKeyDown={onPromoEditorKeyDown}
        refreshPromoToolbarFormats={refreshPromoToolbarFormats}
        smartPaste={smartPaste}
        showCountryCodeDropdown={showCountryCodeDropdown}
        setShowCountryCodeDropdown={setShowCountryCodeDropdown}
        countryCodePos={countryCodePos}
        setCountryCodePos={setCountryCodePos}
        countryCodeBtnRef={countryCodeBtnRef}
        countryCodeMenuRef={countryCodeMenuRef}
        closeAllPromoDropdowns={closeAllPromoDropdowns}
        getDropdownPosition={getDropdownPosition}
      />
    </div>
  );
}
