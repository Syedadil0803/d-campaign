'use client';

/**
 * The app's own date picker — never the browser's native one.
 *
 * Markup, styling and rules are the same as the editor's calendar: past dates
 * are struck through and unselectable, today is ringed, Clear/Today sit in the
 * footer, and an invalid range is shown by a red border rather than by
 * disabling days (cross-field limits stay as an inline error).
 *
 * Self-contained: it owns its open state, its visible month, and closing on an
 * outside click, so callers only pass a value and a change handler.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { formatDateLabel, buildMonthDays } from '@/lib/calendarDates';
import { toLocalISODate } from '@/lib/utils';

interface PromoDatePickerProps {
  value: string;
  onChange: (value: string) => void;
  /** Anchors the popup left or right, matching the editor's two fields. */
  align?: 'left' | 'right';
  /** Earliest selectable day (ISO). Anything before it is blocked. */
  minDate?: string;
  /** Red border, used when the range is backwards. */
  invalid?: boolean;
  /**
   * Optional: let the caller own whether the calendar is open.
   *
   * The promo editor has two of these side by side and closes one when the
   * other opens, which it cannot do if each field keeps that state to itself.
   * Passing `open` and `onOpenChange` hands that decision over; omitting them
   * leaves the field managing itself, which is what the setup dialog wants.
   */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}




export function PromoDatePicker({
  value,
  onChange,
  align = 'left',
  minDate,
  invalid,
  open: controlledOpen,
  onOpenChange,
}: PromoDatePickerProps) {
  // Kept regardless, so the field still works when the caller does not care.
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : uncontrolledOpen;

  /**
   * Latest values, read at call time.
   *
   * The promo editor passes an inline arrow for onOpenChange, so its identity
   * changes on every render. Reading it through a ref keeps setOpen stable,
   * which keeps the click-outside listener below from being torn down and
   * re-attached on each render.
   */
  const onOpenChangeRef = useRef(onOpenChange);
  onOpenChangeRef.current = onOpenChange;
  const isControlledRef = useRef(isControlled);
  isControlledRef.current = isControlled;

  const setOpen = useCallback((next: boolean) => {
    if (isControlledRef.current) onOpenChangeRef.current?.(next);
    else setUncontrolledOpen(next);
  }, []);
  const [viewDate, setViewDate] = useState<Date>(() => {
    const base = value ? new Date(`${value}T00:00:00`) : new Date();
    return new Date(base.getFullYear(), base.getMonth(), 1);
  });
  const rootRef = useRef<HTMLDivElement>(null);

  // Close when clicking anywhere else.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open, setOpen]);

  // Follow the value when it changes from outside (e.g. duration presets).
  useEffect(() => {
    if (!value) return;
    const d = new Date(`${value}T00:00:00`);
    if (!Number.isNaN(d.getTime())) setViewDate(new Date(d.getFullYear(), d.getMonth(), 1));
  }, [value]);

  const days = buildMonthDays(viewDate);
  const month = viewDate.getMonth();
  const today = toLocalISODate(new Date());
  const isOutOfRange = (iso: string) => Boolean(minDate && iso < minDate);
  const todayDisabled = Boolean(isOutOfRange(today));

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onMouseDown={(e) => {
          e.preventDefault();
          setOpen(!open);
        }}
        className={`flex h-11 w-full items-center justify-between rounded-md border bg-surface px-3 text-sm text-on-surface transition-colors hover:border-primary/70 ${
          invalid ? 'border-red-500 dark:border-red-400' : 'border-border'
        }`}
      >
        <span className={value ? 'text-on-surface' : 'text-on-surface-variant'}>
          {formatDateLabel(value)}
        </span>
        <svg
          className={`h-4 w-4 flex-shrink-0 text-on-surface-variant transition-transform duration-200 ${
            open ? 'rotate-180' : 'rotate-0'
          }`}
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
        >
          <path d="M6 8l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div
          className={`absolute z-40 mt-1 w-[260px] rounded-xl border border-border bg-surface-elevated p-2 shadow-2xl ${
            align === 'right' ? 'right-0' : 'left-0'
          }`}
        >
          <div className="mb-2 flex items-center justify-between">
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1));
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
                <path d="M12 6l-4 4 4 4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <div className="text-xs font-semibold text-on-surface">
              {viewDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
            </div>
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1));
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
                <path d="M8 6l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>

          <div className="mb-1 grid grid-cols-7 gap-1 text-center text-[10px] font-medium text-on-surface-variant">
            {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((day) => (
              <div key={day}>{day}</div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {days.map((date) => {
              const iso = toLocalISODate(date);
              const inMonth = date.getMonth() === month;
              const isSelected = value === iso;
              const isToday = today === iso;
              const disabled = isOutOfRange(iso);
              return (
                <button
                  key={iso}
                  type="button"
                  disabled={disabled}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    if (disabled) return;
                    onChange(iso);
                    setOpen(false);
                  }}
                  className={`h-8 rounded text-xs transition-colors ${
                    disabled
                      ? 'cursor-not-allowed text-on-surface-variant/30 line-through'
                      : isSelected
                        ? 'bg-primary text-on-primary'
                        : inMonth
                          ? 'text-on-surface hover:bg-primary/10 hover:text-primary'
                          : 'text-on-surface-variant/60 hover:bg-primary/5'
                  } ${isToday && !isSelected && !disabled ? 'ring-1 ring-primary/40' : ''}`}
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
                onChange('');
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
                onChange(toLocalISODate(now));
                setViewDate(new Date(now.getFullYear(), now.getMonth(), 1));
                setOpen(false);
              }}
              className="text-xs font-medium text-primary hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-30"
            >
              Today
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
