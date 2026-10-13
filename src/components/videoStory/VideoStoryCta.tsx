'use client';

import { Palette } from 'lucide-react';
import type { ReactNode } from 'react';
import type { CampaignCta } from '@/types/campaign';
import { getBackgroundStyle } from '@/lib/utils';
import { whatsAppLooksShort, maxNationalDigits } from '@/lib/whatsapp';
import { CountryFlag, COUNTRY_CODES } from '@/components/shared/CountryFlag';
import { PopupDropdown } from '@/components/shared/PopupDropdown';
import { usePromoEditor } from '@/components/promo/PromoEditorContext';
import { SegmentedToggle } from '@/components/promo/SegmentedToggle';
import { useVideoStory } from '@/components/videoStory/VideoStoryContext';

/** The card's own icons (PromoCtaSettings), so the two pickers match. */
const CTA_TYPES: { type: NonNullable<CampaignCta['ctaType']>; label: string; icon: ReactNode }[] = [
  {
    type: 'whatsapp',
    label: 'WhatsApp',
    icon: (
      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
      </svg>
    ),
  },
  {
    type: 'link',
    label: 'Link',
    icon: (
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
      </svg>
    ),
  },
  {
    type: 'text',
    label: 'Text',
    icon: (
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 7V4h16v3M9 20h6M12 4v16" />
      </svg>
    ),
  },
];

/**
 * The Video Story's Call To Action section, bound to config.videoStory.
 *
 * Same headings, controls and spacing as the card's (PromoCtaSettings), but
 * the button text is a plain input: the video's button is one line of text
 * styled as a whole from the Button Style popup, with no rich editor behind it.
 */
export function VideoStoryCta() {
  const { videoStory: vs, updateVideoStory } = useVideoStory();
  // The dialling-code menu's state is the editor's, shared with the card's
  // picker — only one of the two panels is ever on screen.
  const {
    currentField,
    setCurrentField,
    showCountryCodeDropdown,
    setShowCountryCodeDropdown,
    countryCodePos,
    setCountryCodePos,
    countryCodeBtnRef,
    countryCodeMenuRef,
    closeAllPromoDropdowns,
    getDropdownPosition,
  } = usePromoEditor();
  const ctaType = vs.ctaType || 'whatsapp';
  const code = vs.whatsappCountryCode || '+44';
  const selected = COUNTRY_CODES.find((c) => c.code === code);
  const inputClass =
    'block w-full rounded-md p-2 border h-[44px] outline-none text-sm transition-colors border-border bg-surface text-on-surface focus:ring-primary/60 focus:border-primary/80 hover:border-primary/70';

  return (
    <>
      <div className="!mt-8">
        <h4 className="text-2xl font-semibold leading-8 text-on-surface">
          Call To Action
        </h4>
        <p className="mt-2 text-sm text-on-surface-variant">
          Configure button text and destination.
        </p>
      </div>

      <div className="flex items-center justify-between">
        {/* Not a <label>: the toggle is two buttons, each already named. */}
        <span className="text-sm font-semibold text-on-surface">
          CTA Button
        </span>
        <SegmentedToggle
          value={vs.showButton}
          onChange={(showButton) => updateVideoStory({ showButton })}
        />
      </div>

      <div className={`space-y-5 ${!vs.showButton ? 'opacity-50 pointer-events-none' : ''}`}>
        <div className="flex items-center gap-2">
          {CTA_TYPES.map(({ type, label, icon }) => (
            <button
              key={type}
              type="button"
              onClick={() => updateVideoStory({ ctaType: type })}
              aria-pressed={ctaType === type}
              className={`flex-1 h-11 rounded-md border text-xs font-semibold transition-colors inline-flex items-center justify-center gap-1.5 ${
                ctaType === type
                  ? 'border-primary/80 bg-primary/10 text-primary'
                  : 'border-border text-on-surface-variant hover:border-primary/70 hover:text-primary'
              }`}
            >
              {icon}
              {label}
            </button>
          ))}
        </div>

        {ctaType === 'whatsapp' && (
          <div>
            <label htmlFor="vs-whatsapp-number" className="block text-sm font-semibold text-on-surface mb-2">
              WhatsApp Number
            </label>
            <div className="flex items-center h-[44px] rounded-md border border-border bg-surface overflow-visible transition-colors hover:border-primary/70 focus-within:border-primary/80">
              <PopupDropdown
                labelClassName="sr-only"
                label="Country dialling code"
                value={code}
                options={COUNTRY_CODES.map(({ code: value, flag, name }) => ({
                  value,
                  label: name,
                  meta: value,
                  searchText: name,
                  icon: <CountryFlag flag={flag} name={name} />,
                }))}
                open={showCountryCodeDropdown}
                onOpen={() => {
                  const next = !showCountryCodeDropdown;
                  closeAllPromoDropdowns();
                  setShowCountryCodeDropdown(next);
                  setCountryCodePos(getDropdownPosition(countryCodeBtnRef.current));
                }}
                onSelect={(whatsappCountryCode) => {
                  updateVideoStory({ whatsappCountryCode });
                  setShowCountryCodeDropdown(false);
                }}
                buttonRef={countryCodeBtnRef}
                menuRef={countryCodeMenuRef}
                menuPosition={countryCodePos}
                menuMaxHeight={200}
                flip
                searchable
                searchPlaceholder="Search country"
                buttonClassName="h-full rounded-l-md px-3 border-r border-border text-on-surface flex items-center gap-1.5 transition-colors hover:text-primary"
                triggerContent={
                  <>
                    <CountryFlag flag={selected?.flag ?? ''} name={selected?.name ?? ''} />
                    <span className="text-sm font-semibold text-on-surface tabular-nums">{code}</span>
                  </>
                }
              />
              <input
                id="vs-whatsapp-number"
                type="tel"
                value={vs.whatsappNumber || ''}
                onChange={(e) =>
                  updateVideoStory({
                    // Capped where E.164 ends once the code is prefixed, as on the card.
                    whatsappNumber: e.target.value.replace(/\D/g, '').slice(0, maxNationalDigits(vs.whatsappCountryCode)),
                  })
                }
                placeholder="7911 123456"
                inputMode="tel"
                className="flex-1 h-full px-3 outline-none text-sm bg-transparent text-on-surface"
              />
            </div>
            {whatsAppLooksShort(vs.whatsappCountryCode, vs.whatsappNumber) && (
              <p className="mt-1 text-[11px] text-amber-600 dark:text-amber-500">
                That looks short for {code}. Double-check it before publishing.
              </p>
            )}
            <p className="mt-1 text-[11px] text-on-surface-variant">Select country code and enter number</p>
            <p className="mt-1 text-[11px] text-on-surface-variant">The button is shown under the video and opens a WhatsApp chat when clicked.</p>
          </div>
        )}

        {ctaType === 'link' && (
          <div>
            <label htmlFor="vs-button-url" className="block text-sm font-semibold text-on-surface mb-2">
              Destination URL
            </label>
            <input
              id="vs-button-url"
              type="url"
              value={vs.buttonUrl}
              onChange={(e) => updateVideoStory({ buttonUrl: e.target.value })}
              onBlur={(e) => updateVideoStory({ buttonUrl: e.target.value.trim() })}
              placeholder="https://example.com/offer"
              inputMode="url"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              className={inputClass}
            />
            <p className="mt-1 text-[11px] text-on-surface-variant">Directions, mail, website — any URL</p>
            <p className="mt-1 text-[11px] text-on-surface-variant">The button is shown under the video and opens this link when clicked.</p>
          </div>
        )}

        {ctaType === 'text' && (
          <p className="text-[11px] text-on-surface-variant">The button is shown under the video but is not clickable (no link).</p>
        )}

        <div>
          <div className="flex items-center justify-between mb-2">
            <label htmlFor="vs-button-text" className="block text-sm font-semibold text-on-surface">
              Button Text
            </label>
            {/* Opens the Button Style popup on the preview. A plain input has
                no rich editor to focus, so selecting the field is all
                openFieldStylePopup would have done. */}
            <button
              type="button"
              // mousedown keeps focus off the button so the field stays
              // selected; click is what a keyboard's Enter / Space sends.
              onMouseDown={(e) => {
                e.preventDefault();
                setCurrentField('button');
              }}
              onClick={() => setCurrentField('button')}
              className="p-1 rounded text-on-surface-variant hover:text-primary hover:bg-primary/10 transition-colors"
              title="Open button style"
              aria-label="Open button style"
            >
              <Palette className="w-3.5 h-3.5" />
            </button>
          </div>
          <input
            id="vs-button-text"
            type="text"
            value={vs.buttonText}
            onChange={(e) => updateVideoStory({ buttonText: e.target.value })}
            placeholder="Your button text"
            className={`${inputClass} ${currentField === 'button' ? '!border-primary/70' : ''}`}
            style={{ background: getBackgroundStyle(vs.buttonStyle.background), color: vs.buttonStyle.textColor }}
          />
        </div>
      </div>
    </>
  );
}
