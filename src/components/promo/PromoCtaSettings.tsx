'use client';

import type { ClipboardEvent, KeyboardEvent, RefObject } from 'react';
import { Palette } from 'lucide-react';
import type { CampaignConfig, PromoCard, PromoField } from '@/types/campaign';
import type { MeasuredField } from '@/lib/promo/promoMeasure';
import { getBackgroundStyle } from '@/lib/utils';
import { whatsAppLooksShort, maxNationalDigits } from '@/lib/whatsapp';
import { CountryFlag, COUNTRY_CODES } from '@/components/shared/CountryFlag';
import { PopupDropdown } from '@/components/shared/PopupDropdown';
import { FieldLimitNote } from '@/components/promo/FieldLimitNote';

interface PromoCtaSettingsProps {
  config: CampaignConfig;
  currentField: string | null;
  updateField: <K extends keyof PromoCard>(field: K, value: PromoCard[K]) => void;
  buttonRef: RefObject<HTMLDivElement | null>;
  openFieldStylePopup: (field: PromoField, ref: RefObject<HTMLDivElement | null>, trigger?: HTMLElement | null) => void;
  onFieldInput: (field: PromoField) => void;
  onFieldFocus: (field: PromoField, ref: RefObject<HTMLDivElement | null>) => void;
  onPromoEditorKeyDown: (e: KeyboardEvent<HTMLDivElement>) => void;
  refreshPromoToolbarFormats: (editor: HTMLDivElement | null) => void;
  smartPaste: (e: ClipboardEvent<HTMLDivElement>, field: MeasuredField) => void;
  showCountryCodeDropdown: boolean;
  setShowCountryCodeDropdown: (open: boolean | ((prev: boolean) => boolean)) => void;
  countryCodePos: { top: number; left: number; width: number } | null;
  setCountryCodePos: (pos: { top: number; left: number; width: number } | null) => void;
  countryCodeBtnRef: RefObject<HTMLButtonElement | null>;
  countryCodeMenuRef: RefObject<HTMLDivElement | null>;
  closeAllPromoDropdowns: () => void;
  getDropdownPosition: (button: HTMLButtonElement | null) => { top: number; left: number; width: number } | null;
}

/**
 * The call-to-action half of the panel: which kind of destination the button
 * points at, the destination itself, and the button's own label.
 *
 * The label's editor ref belongs to PromoSection and is passed in — see the
 * note in PromoTextField for why that matters to the line limit.
 */
export function PromoCtaSettings({
  config,
  currentField,
  updateField,
  buttonRef,
  openFieldStylePopup,
  onFieldInput,
  onFieldFocus,
  onPromoEditorKeyDown,
  refreshPromoToolbarFormats,
  smartPaste,
  showCountryCodeDropdown,
  setShowCountryCodeDropdown,
  countryCodePos,
  setCountryCodePos,
  countryCodeBtnRef,
  countryCodeMenuRef,
  closeAllPromoDropdowns,
  getDropdownPosition,
}: PromoCtaSettingsProps) {
  return (
      <div className={`space-y-5 ${!config.promoCard.showButton ? "opacity-50 pointer-events-none" : ""}`}>
          {/* CTA Type Selector */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => updateField("ctaType", "whatsapp")}
              className={`flex-1 h-11 rounded-md border text-xs font-semibold transition-colors inline-flex items-center justify-center gap-1.5 ${
                (config.promoCard.ctaType || 'whatsapp') === 'whatsapp'
                  ? 'border-primary/80 bg-primary/10 text-primary'
                  : 'border-border text-on-surface-variant hover:border-primary/70 hover:text-primary'
              }`}
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
              WhatsApp
            </button>
            <button
              type="button"
              onClick={() => updateField("ctaType", "link")}
              className={`flex-1 h-11 rounded-md border text-xs font-semibold transition-colors inline-flex items-center justify-center gap-1.5 ${
                config.promoCard.ctaType === 'link'
                  ? 'border-primary/80 bg-primary/10 text-primary'
                  : 'border-border text-on-surface-variant hover:border-primary/70 hover:text-primary'
              }`}
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
              Link
            </button>
            <button
              type="button"
              onClick={() => updateField("ctaType", "text")}
              className={`flex-1 h-11 rounded-md border text-xs font-semibold transition-colors inline-flex items-center justify-center gap-1.5 ${
                config.promoCard.ctaType === 'text'
                  ? 'border-primary/80 bg-primary/10 text-primary'
                  : 'border-border text-on-surface-variant hover:border-primary/70 hover:text-primary'
              }`}
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 7V4h16v3M9 20h6M12 4v16" />
              </svg>
              Text
            </button>
          </div>

          {/* WhatsApp Input */}
          {(config.promoCard.ctaType || 'whatsapp') === 'whatsapp' && (
            <div>
              <label className="block text-sm font-semibold text-on-surface mb-2">
                WhatsApp Number
              </label>
              {/* The dial-code trigger sits inside this field rather than
                  beside it, so it takes no background of its own on hover:
                  any fill reads as a band laid across the field, whatever
                  the colour. The chevron and label shifting to the accent
                  is enough to show it is live, and the shell already
                  answers the pointer with its own border. */}
              <div className="flex items-center h-[44px] rounded-md border border-border bg-surface overflow-visible transition-colors hover:border-primary/70 focus-within:border-primary/80">
                {/* The shared dropdown, not a second one built by hand.
                    This picker used to roll its own absolute panel: it was
                    the only list in the app that didn't portal, so it could
                    be clipped, and it drifted from the others in width,
                    row height and hover colour. */}
                <PopupDropdown
                  labelClassName="sr-only"
                  label="Country dialling code"
                  value={config.promoCard.whatsappCountryCode || '+44'}
                  options={COUNTRY_CODES.map(({ code, flag, name }) => ({
                    value: code,
                    label: name,
                    meta: code,
                    // The name as shown, and nothing else — see below.
                    searchText: name,
                    icon: <CountryFlag flag={flag} name={name} />,
                  }))}
                  open={showCountryCodeDropdown}
                  onOpen={() => {
                    const next = !showCountryCodeDropdown;
                    closeAllPromoDropdowns();
                    setShowCountryCodeDropdown(next);
                    setCountryCodePos(
                      getDropdownPosition(countryCodeBtnRef.current),
                    );
                  }}
                  onSelect={(v) => {
                    updateField('whatsappCountryCode', v);
                    setShowCountryCodeDropdown(false);
                  }}
                  buttonRef={countryCodeBtnRef}
                  menuRef={countryCodeMenuRef}
                  menuPosition={countryCodePos}
                  // 66 rows have to scroll, and near the bottom of this
                  // column the menu has to open upward.
                  // Five rows and the search box. Sixty-six countries behind a tall
                  // menu is a wall of names to read past; five is enough to show the
                  // list scrolls and that typing is the faster way through it.
                  menuMaxHeight={200}
                  flip
                  searchable
                  searchPlaceholder="Search country"
                  buttonClassName="h-full rounded-l-md px-3 border-r border-border text-on-surface flex items-center gap-1.5 transition-colors hover:text-primary"
                  triggerContent={(() => {
                    const selectedCode = config.promoCard.whatsappCountryCode || '+44';
                    const selected = COUNTRY_CODES.find((c) => c.code === selectedCode);
                    return (
                      <>
                        <CountryFlag
                          flag={selected?.flag ?? ''}
                          name={selected?.name ?? ''}
                        />
                        <span className="text-sm font-semibold text-on-surface tabular-nums">
                          {selectedCode}
                        </span>
                      </>
                    );
                  })()}
                />
                <input
                  type="tel"
                  value={config.promoCard.whatsappNumber || ''}
                  onChange={(e) =>
                    updateField(
                      "whatsappNumber",
                      // Capped at what still fits E.164 once the dialling
                      // code is prefixed — past that the link is invalid
                      // however it's built.
                      e.target.value
                        .replace(/\D/g, '')
                        .slice(0, maxNationalDigits(config.promoCard.whatsappCountryCode)),
                    )
                  }
                  placeholder="7911 123456"
                  inputMode="tel"
                  className="flex-1 h-full px-3 outline-none text-sm bg-transparent text-on-surface"
                />
              </div>
              {/* Same warning the announcement bar shows, and the same one
                  the publish check raises — surfaced while typing so a
                  short number is caught before you reach for Publish. */}
              {whatsAppLooksShort(
                config.promoCard.whatsappCountryCode,
                config.promoCard.whatsappNumber,
              ) && (
                <p className="mt-1 text-[11px] text-amber-600 dark:text-amber-500">
                  That looks short for{' '}
                  {config.promoCard.whatsappCountryCode || '+44'}. Double-check
                  it before publishing.
                </p>
              )}
              <p className="mt-1 text-[11px] text-on-surface-variant">Select country code and enter number</p>
              <p className="mt-1 text-[11px] text-on-surface-variant">The button is shown on the card and opens a WhatsApp chat when clicked.</p>
            </div>
          )}

          {/* Link Input */}
          {config.promoCard.ctaType === 'link' && (
            <div>
              <label className="block text-sm font-semibold text-on-surface mb-2">
                Destination URL
              </label>
              <input
                type="url"
                value={config.promoCard.buttonUrl}
                onChange={(e) => updateField("buttonUrl", e.target.value)}
                onBlur={(e) => updateField("buttonUrl", e.target.value.trim())}
                placeholder="https://example.com/offer"
                inputMode="url"
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
                className="block w-full rounded-md p-2 border h-[44px] outline-none text-sm transition-colors border-border bg-surface text-on-surface focus:ring-primary/60 focus:border-primary/80 hover:border-primary/70"
              />
              <p className="mt-1 text-[11px] text-on-surface-variant">Directions, mail, website — any URL</p>
              <p className="mt-1 text-[11px] text-on-surface-variant">The button is shown on the card and opens this link when clicked.</p>
            </div>
          )}

          {/* Plain Text (no link) */}
          {config.promoCard.ctaType === 'text' && (
            <p className="text-[11px] text-on-surface-variant">The button is shown on the card but is not clickable (no link).</p>
          )}

          {/* Button Text */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-semibold text-on-surface">
                Button Text
              </label>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  openFieldStylePopup("button", buttonRef, e.currentTarget as HTMLElement);
                }}
                className="p-1 rounded text-on-surface-variant hover:text-primary hover:bg-primary/10 transition-colors"
                title="Open button style"
                aria-label="Open button style"
              >
                <Palette className="w-3.5 h-3.5" />
              </button>
            </div>
            <div
              ref={buttonRef}
              contentEditable
              spellCheck={true}
              suppressContentEditableWarning
              data-placeholder="Your button text"
              onInput={() => onFieldInput("button")}
              onFocus={() => onFieldFocus("button", buttonRef)}
              onKeyDown={onPromoEditorKeyDown}
              onMouseUp={() =>
                refreshPromoToolbarFormats(buttonRef.current)
              }
              onKeyUp={() => refreshPromoToolbarFormats(buttonRef.current)}
              // Was a plain insert with no cap, so pasting was the one way
              // to get more than a line into the button.
              onPaste={(e) => smartPaste(e, 'button')}
              className={`rich-editor promo-standard-editor block w-full rounded-md px-2 border min-h-[44px] max-h-[360px] resize-none overflow-y-auto outline-none break-words transition-colors ${
                currentField === "button"
                  ? "border-primary/70"
                  : "border-border"
              } focus:ring-primary/60 focus:border-primary/80 hover:border-primary/70`}
              style={{
                background: getBackgroundStyle(
                  config.promoCard.style.buttonStyle?.background ||
                    config.promoCard.style.background,
                ),
                paddingTop: '10px',
                paddingBottom: '10px',
              }}
            />
            <FieldLimitNote html={config.promoCard.buttonText} field="button" />
          </div>
        </div>
  );
}
