'use client';

import type { RefObject } from 'react';
import { buildMonthDays, formatDateLabel } from '@/lib/calendarDates';
import { toLocalISODate } from '@/lib/utils';

/**
 * A schedule date field: the button showing the chosen date, and the month
 * grid that drops out of it.
 *
 * Lifted out of PromoSection unchanged. It was already fully parameterised —
 * every value it needs arrives through props — so nothing about who owns
 * which piece of state has moved. That was the point of taking this one
 * first: 207 lines leave the editor and the behaviour cannot have changed,
 * because the code is the same code.
 *
 * `open` and `setOpen` are deliberately the caller's. The promo editor has
 * two of these side by side and closes one when the other opens, which it
 * cannot do if each field keeps its own open state. PromoDatePicker.tsx is a
 * second implementation of this same field that does own its state, used by
 * the setup dialog. Merging the two means deciding which of those two
 * arrangements wins, so it is left for its own change.
 */

export function PromoScheduleField(params: {
  mode: "start" | "end";
  value: string;
  viewDate: Date;
  setViewDate: (date: Date) => void;
  open: boolean;
  setOpen: (open: boolean) => void;
  onSelect: (value: string) => void;
  minDate?: string;
  invalid?: boolean;
  /**
   * The caller's ref for this field's wrapper. It holds it because the same
   * element drives the click-outside handling that closes the calendar.
   */
  containerRef: RefObject<HTMLDivElement | null>;
}) {
  const {
    mode,
    value,
    viewDate,
    setViewDate,
    open,
    setOpen,
    onSelect,
    minDate,
    invalid,
    containerRef,
  } = params;
  const days = buildMonthDays(viewDate);
  const month = viewDate.getMonth();
  const selected = value;
  const today = toLocalISODate(new Date());
  // A day is out of range if before minDate (past dates). Cross-field limits
  // are NOT applied here — an invalid range surfaces as an inline error.
  const isOutOfRange = (iso: string) => Boolean(minDate && iso < minDate);
  const todayDisabled = Boolean(isOutOfRange(today));
  return (
    <div
      ref={containerRef}
      className="relative"
    >
      <button
        type="button"
        onMouseDown={(e) => {
          e.preventDefault();
          setOpen(!open);
        }}
        className={`flex h-11 w-full items-center justify-between rounded-md border bg-surface px-3 text-sm text-on-surface transition-colors hover:border-primary/70 ${
          invalid
            ? "border-red-500 dark:border-red-400"
            : "border-border"
        }`}
      >
        <span
          className={selected ? "text-on-surface" : "text-on-surface-variant"}
        >
          {formatDateLabel(value)}
        </span>
        <svg
          className={`h-4 w-4 flex-shrink-0 text-on-surface-variant transition-transform duration-200 ${open ? "rotate-180" : "rotate-0"}`}
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
        >
          <path
            d="M6 8l4 4 4-4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      {open && (
        <div
          className={`absolute z-40 mt-1 w-[260px] rounded-xl border border-border bg-surface-elevated p-2 shadow-2xl ${mode === "end" ? "right-0" : "left-0"}`}
        >
          <div className="mb-2 flex items-center justify-between">
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                setViewDate(
                  new Date(
                    viewDate.getFullYear(),
                    viewDate.getMonth() - 1,
                    1,
                  ),
                );
              }}
              className="h-7 w-7 rounded border border-border text-on-surface-variant hover:border-primary/70 hover:text-primary"
              aria-label="Previous month"
            >
              <svg
                className="mx-auto h-4 w-4"
                viewBox="0 0 20 20"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
              >
                <path
                  d="M12 6l-4 4 4 4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
            <div className="text-xs font-semibold text-on-surface">
              {viewDate.toLocaleDateString(undefined, {
                month: "long",
                year: "numeric",
              })}
            </div>
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                setViewDate(
                  new Date(
                    viewDate.getFullYear(),
                    viewDate.getMonth() + 1,
                    1,
                  ),
                );
              }}
              className="h-7 w-7 rounded border border-border text-on-surface-variant hover:border-primary/70 hover:text-primary"
              aria-label="Next month"
            >
              <svg
                className="mx-auto h-4 w-4"
                viewBox="0 0 20 20"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
              >
                <path
                  d="M8 6l4 4-4 4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </div>
          <div className="mb-1 grid grid-cols-7 gap-1 text-center text-[10px] font-medium text-on-surface-variant">
            {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((day) => (
              <div key={day}>{day}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {days.map((date) => {
              const iso = toLocalISODate(date);
              const inMonth = date.getMonth() === month;
              const isSelected = selected === iso;
              const isToday = today === iso;
              const disabled = Boolean(isOutOfRange(iso));
              return (
                <button
                  key={iso}
                  type="button"
                  disabled={disabled}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    if (disabled) return;
                    onSelect(iso);
                    setOpen(false);
                  }}
                  className={`h-8 rounded text-xs transition-colors ${
                    disabled
                      ? "text-on-surface-variant/30 cursor-not-allowed line-through"
                      : isSelected
                        ? "bg-primary text-on-primary"
                        : inMonth
                          ? "text-on-surface hover:bg-primary/10 hover:text-primary"
                          : "text-on-surface-variant/60 hover:bg-primary/5"
                  } ${isToday && !isSelected && !disabled ? "ring-1 ring-primary/40" : ""}`}
                >
                  {date.getDate()}
                </button>
              );
            })}
          </div>
          <div className="mt-2 flex items-center justify-between border-t border-border pt-2">
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                onSelect("");
                setOpen(false);
              }}
              className="text-xs text-on-surface-variant hover:text-primary"
            >
              Clear
            </button>
            <button
              type="button"
              disabled={todayDisabled}
              onMouseDown={(e) => {
                e.preventDefault();
                if (todayDisabled) return;
                const now = new Date();
                onSelect(toLocalISODate(now));
                setViewDate(new Date(now.getFullYear(), now.getMonth(), 1));
                setOpen(false);
              }}
              className="text-xs font-medium text-primary hover:opacity-80 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              Today
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
