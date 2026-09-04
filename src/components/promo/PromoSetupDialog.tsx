'use client';

/**
 * "Set Up Your Campaign" — the one question asked between picking a starting
 * point and getting to work: when does it run, and how do you want to write it.
 *
 * Deliberately a dialog rather than a page: both answers are quick, and asking
 * them inline was turning into a second editor. Skipped for paths that already
 * have their copy (continuing a live card or a saved draft).
 */

import { useMemo, useState } from 'react';
import { isInvalidRange } from '@/lib/dateRange';
import { ArrowRight, CalendarDays, PenLine, Sparkles, X } from 'lucide-react';
import { PromoDatePicker } from '@/components/promo/PromoDatePicker';
import { toLocalISODate } from '@/lib/utils';
import type { PromoCard } from '@/types/campaign';

export type BuildMethod = 'ai' | 'manual';

/**
 * One-click campaign lengths, so most users never open a calendar.
 *
 * Labelled in the unit that's actually set. "1 month" set 30 days, which is
 * only true for four months of the year — and a campaign's length is a count
 * of days, not a calendar unit. Weeks stay: 7 and 14 are exact.
 */
const DURATIONS = [
  { days: 3, label: '3 days' },
  { days: 7, label: '1 week' },
  { days: 14, label: '2 weeks' },
  { days: 30, label: '30 days' },
];

interface PromoSetupDialogProps {
  /**
   * What the card is being built from, as a noun phrase — "the selected
   * template", "a blank card", "your past campaign". Naming it generically
   * keeps the choices honest without repeating the template's name.
   */
  sourceLabel: string;
  /**
   * Set when the build method was already chosen upstream (the start screen's
   * "Generate with AI"). The dialog then only asks for the schedule.
   */
  forcedMethod?: BuildMethod;
  /**
   * Asks the schedule only. Used from the dashboard, where the build method is
   * asked afterwards — in the editor, next to the card it applies to.
   */
  scheduleOnly?: boolean;
  /**
   * Confirm handler for scheduleOnly mode.
   *
   * The answer is passed rather than read back from state: the buttons set it
   * and continue in the same tick, so a caller reading its own state would
   * still see the previous one.
   */
  onContinue?: (answer?: {
    scheduleMode: NonNullable<PromoCard['scheduleMode']>;
    startDate: string;
    endDate: string;
  }) => void;
  startDate: string;
  endDate: string;
  /** 'openEnded' runs from the start date until someone stops it. */
  scheduleMode: PromoCard['scheduleMode'];
  onChangeMode: (mode: NonNullable<PromoCard['scheduleMode']>) => void;
  onChangeStart: (v: string) => void;
  onChangeEnd: (v: string) => void;
  onChoose: (method: BuildMethod) => void;
  onClose: () => void;
}

export function PromoSetupDialog({
  sourceLabel,
  forcedMethod,
  scheduleOnly,
  onContinue,
  startDate,
  endDate,
  scheduleMode,
  onChangeMode,
  onChangeStart,
  onChangeEnd,
  onChoose,
  onClose,
}: PromoSetupDialogProps) {
  const [showError, setShowError] = useState(false);
  const [customDates, setCustomDates] = useState(false);
  const todayISO = toLocalISODate(new Date());
  // An open-ended campaign has no end to be before, so neither check applies.
  const openEnded = scheduleMode === 'openEnded';
  // The dates below belong to a scheduled campaign, so they follow the answer.
  const scheduled = !openEnded;
  const rangeInvalid = !openEnded && isInvalidRange(startDate, endDate);
  const incomplete = !startDate || (!openEnded && !endDate);
  const scheduleReady = !rangeInvalid && !incomplete;

  /**
   * How many calendar days the campaign runs, counting BOTH ends.
   *
   * The end date is inclusive everywhere else (the dashboard runs a campaign
   * until endDate + 24h), so a range of 14th–16th is three days, not two.
   */
  const runLength = useMemo(() => {
    if (!scheduleReady || openEnded) return null;
    const ms =
      new Date(`${endDate}T00:00:00`).getTime() - new Date(`${startDate}T00:00:00`).getTime();
    return Math.round(ms / 86_400_000) + 1;
  }, [startDate, endDate, scheduleReady, openEnded]);

  const summary = useMemo(() => {
    if (!scheduleReady) return null;
    const fmt = (d: string) =>
      new Date(`${d}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    if (openEnded) return 'Runs from today · until you stop it';
    const when = startDate > todayISO ? 'Scheduled' : 'Runs';
    return `${when} ${fmt(startDate)} → ${fmt(endDate)}${
      runLength ? ` · ${runLength} day${runLength > 1 ? 's' : ''}` : ''
    }`;
  }, [startDate, endDate, scheduleReady, runLength, todayISO, openEnded]);

  function chooseRange() {
    setShowError(false);
    onChangeMode('range');
    if (!startDate) onChangeStart(todayISO);
  }

  function chooseOpenEnded() {
    setShowError(false);
    onChangeMode('openEnded');
    // The end date goes with the mode: a date nothing reads would stay on the card.
    onChangeEnd('');
    if (!startDate) onChangeStart(todayISO);
  }

  function setRunLength(days: number) {
    onChangeMode('range');
    const start = startDate || todayISO;
    const end = new Date(`${start}T00:00:00`);
    // days - 1: the start day counts. "3 days" starting today is today,
    // tomorrow and the day after — not today plus three more.
    end.setDate(end.getDate() + days - 1);
    setShowError(false);
    onChangeStart(start);
    onChangeEnd(toLocalISODate(end));
  }

  function pick(method: BuildMethod) {
    if (!scheduleReady) {
      setShowError(true);
      return;
    }
    onChoose(method);
  }

  const stepBadge = (n: number, done: boolean) => (
    <span
      className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-bold transition-colors ${
        done ? 'bg-primary text-on-primary' : 'bg-border text-on-surface-variant'
      }`}
    >
      {n}
    </span>
  );

  const choiceCard =
    'group flex flex-1 flex-col rounded-xl border p-4 text-left transition-all ' +
    'hover:-translate-y-0.5 hover:border-primary hover:shadow-lg ' +
    'focus:outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/40';

  return (
    <div data-modal className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative z-10 w-full max-w-2xl rounded-xl border border-border bg-surface-elevated text-on-surface shadow-2xl">
        <div className="flex items-center justify-between gap-4 border-b border-border px-6 py-4">
          <h2 className="text-base font-semibold">Set up your campaign</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-on-surface-variant transition-colors hover:bg-primary/10 hover:text-primary"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-6">
          {/* One screen, two options, one Continue.
              Asking "do you want to schedule?" first made the user answer a
              question before they knew what the tool did. This tells them what
              is on offer instead, and a single primary action keeps it obvious
              what to press — two Continues would make them choose twice.

              Each option is a div, not a button: the date pickers inside it are
              buttons of their own, and a button cannot contain a button. Only
              the heading row is clickable. */}
          <p className="text-sm font-semibold text-on-surface">
            Schedule this as per your dates
          </p>
          <p className="mb-3 mt-1 text-xs text-on-surface-variant">
            Choose one of the two ways to run it.
          </p>

          <div
            role="radio"
            aria-checked={scheduled}
            tabIndex={0}
            onClick={chooseRange}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                chooseRange();
              }
            }}
            className={`cursor-pointer rounded-xl border p-4 transition-colors ${
              scheduled
                ? 'border-primary/60 bg-primary/[0.05]'
                : 'border-border hover:border-primary/40'
            }`}
          >
            <p className="flex items-center gap-2 text-sm font-semibold text-on-surface">
              {stepBadge(1, scheduled)}
              Custom dates
            </p>
            <p className="mt-1 pl-8 text-xs text-on-surface-variant">
              It goes live on the start date and comes off on the end date by itself.
            </p>

            <div className="mt-3 flex flex-wrap gap-1.5 pl-8">
              {DURATIONS.map((d) => {
                const on = scheduled && !customDates && runLength === d.days;
                return (
                  <button
                    key={d.days}
                    type="button"
                    onClick={() => {
                      setCustomDates(false);
                      setRunLength(d.days);
                    }}
                    className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-all ${
                      on
                        ? 'border-primary bg-primary text-on-primary shadow-sm'
                        : 'border-border text-on-surface-variant hover:border-primary/70 hover:text-primary'
                    }`}
                  >
                    {d.label}
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => {
                  onChangeMode('range');
                  setCustomDates(true);
                }}
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-all ${
                  customDates && scheduled
                    ? 'border-primary bg-primary text-on-primary shadow-sm'
                    : 'border-border text-on-surface-variant hover:border-primary/70 hover:text-primary'
                }`}
              >
                Pick dates
              </button>
            </div>

            {scheduled && customDates && (
              <div className="mt-3 grid grid-cols-2 gap-3 pl-8">
                <div>
                  <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-on-surface-variant">
                    Start date
                  </label>
                  <PromoDatePicker
                    value={startDate}
                    onChange={(v) => {
                      setShowError(false);
                      onChangeStart(v);
                    }}
                    minDate={todayISO}
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-on-surface-variant">
                    End date
                  </label>
                  <PromoDatePicker
                    value={endDate}
                    onChange={(v) => {
                      setShowError(false);
                      onChangeEnd(v);
                    }}
                    align="right"
                    minDate={todayISO}
                    invalid={rangeInvalid}
                  />
                </div>
              </div>
            )}
          </div>

          <div className="h-3" />

          <div
            role="radio"
            aria-checked={openEnded}
            tabIndex={0}
            onClick={chooseOpenEnded}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                chooseOpenEnded();
              }
            }}
            className={`cursor-pointer rounded-xl border p-4 transition-colors ${
              openEnded
                ? 'border-primary/60 bg-primary/[0.05]'
                : 'border-border hover:border-primary/40'
            }`}
          >
            <p className="flex items-center gap-2 text-sm font-semibold text-on-surface">
              {stepBadge(2, openEnded)}
              Open-ended
            </p>
            <p className="mt-1 pl-8 text-xs text-on-surface-variant">
              Starts today with no end date. You can always change the start date later.
            </p>

            {openEnded && (
              <p className="mt-3 ml-8 rounded-lg bg-amber-500/10 px-3 py-2 text-[11px] text-amber-700 dark:text-amber-400">
                Note: this campaign will keep running until you take it off the site
                yourself from the dashboard.
              </p>
            )}
          </div>


          {/* A backwards range is reported immediately: it blurs step 2, so
              waiting for a click that can't happen left the user stuck with no
              explanation. The "set both dates" nudge still waits for an
              attempt, since an unfinished range isn't an error yet. */}
          {rangeInvalid ? (
            <p className="mt-2 text-xs font-medium text-red-500">
              End date must be on or after the start date.
            </p>
          ) : showError && incomplete ? (
            <p className="mt-2 text-xs font-medium text-red-500">
              {openEnded ? 'Set a start date to continue.' : 'Set a start and end date to continue.'}
            </p>
          ) : (
            summary && (
              <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-on-surface-variant">
                <CalendarDays className="h-3.5 w-3.5" /> {summary}
              </p>
            )
          )}

          {!forcedMethod && !scheduleOnly && <div className="my-5 border-t border-border" />}

          {scheduleOnly ? (
            /* Schedule only — the build method is asked in the editor, where
               the card it applies to is actually on screen. */
            <div className="mt-5 flex items-center justify-between gap-4">
              <p className="text-xs text-on-surface-variant">
                Next: choose how to build it.
              </p>
              <button
                type="button"
                onClick={() => {
                  if (!scheduleReady) {
                    setShowError(true);
                    return;
                  }
                  onContinue?.({ scheduleMode: scheduleMode ?? 'range', startDate, endDate });
                }}
                disabled={!scheduleReady}
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-on-primary shadow-sm transition-opacity hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Continue <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          ) : forcedMethod ? (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => pick(forcedMethod)}
                disabled={!scheduleReady}
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-on-primary shadow-sm transition-opacity hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Continue <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          ) : (
          <>
          {/* 2 — how the copy gets written. Blurred until the schedule is set,
              so the dialog reads as one question at a time. */}
          <div
            className={`transition-all duration-300 ${
              scheduleReady
                ? 'opacity-100 blur-0'
                : 'pointer-events-none select-none opacity-40 blur-[3px]'
            }`}
            aria-hidden={!scheduleReady}
          >
          <div className="mb-3 flex items-center gap-2">
            {stepBadge(2, scheduleReady)}
            <p className="text-sm font-semibold text-on-surface">
              How do you want to write the content?
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={() => pick('ai')}
              className={`${choiceCard} border-primary/40 bg-primary/[0.06]`}
            >
              <Sparkles className="mb-2 h-5 w-5 text-primary" />
              <span className="text-sm font-semibold text-on-surface">Generate with AI</span>
              <span className="mt-0.5 text-xs text-on-surface-variant">
                Describe your campaign, take the prepared prompt to your AI tool, and paste
                the reply into {sourceLabel}.
              </span>
              <span className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-primary">
                Start
                <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
              </span>
            </button>

            <button
              type="button"
              onClick={() => pick('manual')}
              className={`${choiceCard} border-border bg-surface`}
            >
              <PenLine className="mb-2 h-5 w-5 text-on-surface-variant" />
              <span className="text-sm font-semibold text-on-surface">Write myself</span>
              <span className="mt-0.5 text-xs text-on-surface-variant">
                Open {sourceLabel} in the editor and write it yourself.
              </span>
              <span className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-on-surface-variant transition-colors group-hover:text-primary">
                Open editor
                <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
              </span>
            </button>
          </div>
          </div>

          {!scheduleReady && (
            <p className="mt-3 text-center text-xs text-on-surface-variant">
              {rangeInvalid
                ? 'Fix the dates to continue.'
                : openEnded
                  ? 'Pick a start date to continue.'
                  : 'Pick how long it runs to continue.'}
            </p>
          )}
          </>
          )}
        </div>
      </div>
    </div>
  );
}
