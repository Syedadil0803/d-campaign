'use client';

import type { RefObject } from 'react';
import { Info, Palette } from 'lucide-react';
import type { CampaignConfig, PromoCard } from '@/types/campaign';
import type { PromoField } from '@/types/campaign';
import { toLocalISODate } from '@/lib/utils';
import { isOpenEnded } from '@/lib/promo/promoSchedule';
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
  // No end date and no countdown: both need something to count towards. The
  // mode is switched by the pill above (PromoEditorPanel); this renders the
  // fields that match it.
  const openEnded = isOpenEnded(config.promoCard);
  // A countdown counts towards the end date, so it can only be on when one
  // is set — never auto, never by hand without it.
  const canUseTimer = Boolean(config.promoCard.endDate);

  return (
    <>
      <div
        className="grid gap-4"
        // Inline, not an arbitrary Tailwind class: a running dev server does not
        // always JIT-generate grid-cols-[...] on edit, so it can silently no-op.
        // No-end: narrow date, wide info. Custom: two equal date pickers.
        style={{ gridTemplateColumns: openEnded ? '150px minmax(0, 1fr)' : '1fr 1fr' }}
      >
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
                // Picking a start date does NOT arm the countdown — it needs
                // an end date to count towards, which the end field sets.
              };
              // Moved with the config, not after it: usePromoUndo snapshots
              // this ref, so leaving it behind makes the next step record the
              // card as it was before the date was picked.
              liveCardRef.current = nextPromoCard;
              setConfig({ ...config, promoCard: nextPromoCard });
              markChanged();
            }}
          />
        </div>
        {!openEnded ? (
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
                // Do NOT switch the countdown on here — that would pre-empt the
                // auto-arm effect, which is what fires the card hint. Setting the
                // end date lets that effect enable it and beep. Only force it off
                // when the end date is cleared, to hold the no-end rule.
                ...(nextValue ? {} : { showTimer: false }),
              };
              // Same invariant as Start Date: liveCardRef moves with the
              // config, not after it, or the next edit's undo push snapshots
              // this end date as it was before the change.
              liveCardRef.current = nextPromoCard;
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
        ) : (
          <div>
            {/* Invisible label reserves the same height as "Start Date", so the
                panel top lines up with the picker top in the other column. */}
            <span aria-hidden className="invisible mb-2 block text-sm font-semibold">
              End Date
            </span>
            {/* Same height (h-11) as the date field beside it. No date here —
                the Start Date field right next to it already shows it. */}
            <div className="flex h-11 items-center gap-2 rounded-lg bg-primary/[0.06] px-3 text-[11px] leading-tight text-on-surface-variant">
              <Info className="h-4 w-4 flex-shrink-0 text-primary" />
              <span>
                <b className="font-semibold text-on-surface">No end date.</b> Runs until you take
                it off from the dashboard.
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Sub-section 2 — the optional visual feature: a countdown clock.
          Absent for an open-ended campaign: a countdown needs an end date to
          count towards, and there is none.
          Divider + pt-8 matches the app's section-divider convention. */}
      {!openEnded && (
      <>
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
        {canUseTimer ? (
          <SegmentedToggle
            value={config.promoCard.showTimer}
            onChange={(v) => updateField('showTimer', v)}
          />
        ) : (
          <div className="group relative">
            <SegmentedToggle value={false} onChange={() => {}} />
            <div className="pointer-events-none absolute inset-0 cursor-not-allowed rounded-full bg-surface/40" />
            <div className="pointer-events-none absolute right-0 top-full z-10 mt-2 w-56 rounded-lg border border-border bg-surface-elevated p-2 text-[11px] leading-relaxed text-on-surface opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
              Set an end date first — the countdown needs one to count towards.
            </div>
          </div>
        )}
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
      )}
    </>
  );
}
