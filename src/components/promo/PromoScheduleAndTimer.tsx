'use client';

import type { RefObject } from 'react';
import { Palette } from 'lucide-react';
import type { CampaignConfig, PromoCard } from '@/types/campaign';
import type { PromoField } from '@/types/campaign';
import { toLocalISODate } from '@/lib/utils';
import { PromoDatePicker } from '@/components/promo/PromoDatePicker';
import { SegmentedToggle } from '@/components/promo/SegmentedToggle';

interface PromoScheduleAndTimerProps {
  config: CampaignConfig;
  setConfig: (
    config: CampaignConfig | ((prev: CampaignConfig) => CampaignConfig),
  ) => void;
  markChanged: () => void;
  pushPromoState: (options?: { replace?: boolean }) => void;
  updateField: <K extends keyof PromoCard>(field: K, value: PromoCard[K]) => void;

  /** The two calendars, which are mutually exclusive. */
  showStartDatePicker: boolean;
  setShowStartDatePicker: (open: boolean) => void;
  showEndDatePicker: boolean;
  setShowEndDatePicker: (open: boolean) => void;
  endDateFieldRef: RefObject<HTMLDivElement | null>;
  /** The card ahead of React — see usePromoUndo.getPromoSnapshot. */
  liveCardRef: RefObject<PromoCard>;
  promoDateRangeInvalid: boolean;
  dateErrorFlash: boolean;

  /** Countdown timer. The editor itself lives in the preview, not here. */
  timerRef: RefObject<HTMLDivElement | null>;
  timerLimitReached: boolean;
  openFieldStylePopup: (
    field: PromoField,
    ref: RefObject<HTMLDivElement | null>,
    trigger?: HTMLElement | null,
  ) => void;
}

/**
 * When the campaign runs, and the optional countdown that counts towards its
 * end date.
 *
 * Note that the timer's editor is NOT here — only its label, style button and
 * limit warning are. The countdown is typed directly on the preview card,
 * unlike the title, subtitle and description, which are edited in this panel.
 */
export function PromoScheduleAndTimer({
  config,
  setConfig,
  markChanged,
  pushPromoState,
  updateField,
  showStartDatePicker,
  setShowStartDatePicker,
  showEndDatePicker,
  setShowEndDatePicker,
  endDateFieldRef,
  liveCardRef,
  promoDateRangeInvalid,
  dateErrorFlash,
  timerRef,
  timerLimitReached,
  openFieldStylePopup,
}: PromoScheduleAndTimerProps) {
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-semibold text-on-surface mb-2">
            Start Date
          </label>
          <PromoDatePicker
            value={config.promoCard.startDate}
            minDate={toLocalISODate(new Date())}
            open={showStartDatePicker}
            onOpenChange={(next) => {
              setShowStartDatePicker(next);
              // Only one calendar at a time — opening this closes the other.
              if (next) setShowEndDatePicker(false);
            }}
            onChange={(nextValue: string) => {
              pushPromoState();
              const nextPromoCard = {
                ...config.promoCard,
                startDate: nextValue,
                ...(nextValue ? { showTimer: true } : {}),
              };
              // Moved with the config, not after it: usePromoUndo snapshots
              // this ref, so leaving it behind makes the next step record the
              // card as it was before the date was picked.
              liveCardRef.current = nextPromoCard;
              // Moved with the config, not after it: usePromoUndo snapshots
              // this ref, so leaving it behind makes the next step record the
              // card as it was before the date was picked.
              liveCardRef.current = nextPromoCard;
              setConfig({ ...config, promoCard: nextPromoCard });
              markChanged();
            }}
          />
        </div>
        <div ref={endDateFieldRef}>
          <label className="block text-sm font-semibold text-on-surface mb-2">
            End Date
          </label>
          <PromoDatePicker
            value={config.promoCard.endDate}
            minDate={toLocalISODate(new Date())}
            // The end field sits at the right edge of the panel, so its popup
            // is anchored right or it runs off the side.
            align="right"
            invalid={promoDateRangeInvalid}
            open={showEndDatePicker}
            onOpenChange={(next) => {
              setShowEndDatePicker(next);
              // Only one calendar at a time — opening this closes the other.
              if (next) setShowStartDatePicker(false);
            }}
            onChange={(nextValue: string) => {
              pushPromoState();
              const nextPromoCard = {
                ...config.promoCard,
                endDate: nextValue,
                ...(nextValue ? { showTimer: true } : {}),
              };
              setConfig({ ...config, promoCard: nextPromoCard });
              markChanged();
            }}
          />
          {promoDateRangeInvalid && (
            <p
              className={`mt-1.5 text-[11px] font-semibold text-red-600 dark:text-red-400 ${
                dateErrorFlash ? 'animate-pulse' : ''
              }`}
            >
              End date must be on or after the start date.
            </p>
          )}
        </div>
      </div>

      {/* Sub-section 2 — the optional visual feature: a countdown clock.
          Divider + pt-8 matches the app's section-divider convention. */}
      <div className="!mt-8 flex items-center justify-between gap-4 border-t border-border pt-8">
        <div>
          <div className="flex items-center gap-2">
            <h5 className="text-base font-semibold text-on-surface">
              Countdown Timer Display
            </h5>
            <span className="rounded-full bg-on-surface-variant/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-on-surface-variant">
              Optional
            </span>
          </div>
          <p className="mt-1 text-sm text-on-surface-variant">
            Show a dynamic countdown clock on the promo card to create urgency.
          </p>
        </div>
        <SegmentedToggle
          value={config.promoCard.showTimer}
          onChange={(v) => updateField('showTimer', v)}
        />
      </div>

      {/* Timer Text — unlike title / subtitle / description, the editor is NOT
          in this panel. What sits here is the label, the style button and the
          limit warning; the countdown itself is typed on the preview card,
          which is what the arrow below points at. */}
      <div
        className={`ml-1 border-l-2 border-border pl-4 ${
          !config.promoCard.showTimer ? 'opacity-50 pointer-events-none' : ''
        }`}
      >
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <label className="block text-sm font-semibold text-on-surface">
              Timer Text
            </label>
            <div className="relative group">
              <div className="flex items-center justify-center w-4 h-4 rounded-full bg-on-surface-variant/25 text-[9px] font-bold text-on-surface-variant cursor-help select-none">
                i
              </div>
              <div className="absolute bottom-full left-0 mb-1.5 w-56 p-2 bg-surface-elevated border border-border text-on-surface text-[11px] leading-relaxed rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 pointer-events-none">
                Type text before/after the countdown. The countdown can&apos;t be edited but can&apos;t be deleted. Select text to style it; click a number, word, or colon in the chip to style just that part.
                <div className="absolute top-full left-3 w-0 h-0 border-l-[5px] border-r-[5px] border-t-[5px] border-l-transparent border-r-transparent border-t-surface-elevated"></div>
              </div>
            </div>
          </div>
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              openFieldStylePopup('timer', timerRef, e.currentTarget as HTMLElement);
            }}
            className="p-1 rounded text-on-surface-variant hover:text-primary hover:bg-primary/10 transition-colors"
            title="Open timer style"
            aria-label="Open timer style"
          >
            <Palette className="w-3.5 h-3.5" />
          </button>
        </div>
        <p className="text-[11px] text-on-surface-variant leading-relaxed">
          ↪ Edit the timer in the preview card on the right: type the text
          before/after the countdown, select text or click a number, word, or
          colon in the countdown to style it.
        </p>
        {timerLimitReached && (
          <p className="mt-1.5 text-[11px] font-semibold text-amber-600 dark:text-amber-400 animate-pulse">
            ⚠️ Field limit reached — shorten the timer text so it fits one line
          </p>
        )}
      </div>
    </>
  );
}
