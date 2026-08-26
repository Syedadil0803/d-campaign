'use client';

import { buildMonthDays } from '@/lib/calendarDates';
import { toLocalISODate } from '@/lib/utils';

/**
 * The month grid that drops out of a date field.
 *
 * Written out twice in the announcement editor — once for the start date and
 * once for the end — eighty lines each, identical apart from which piece of
 * state they read and which field they wrote. Two copies of a calendar is two
 * places to fix when a day stops being clickable.
 *
 * It renders and reports; it does not decide. The caller owns the selected
 * date and the month being viewed, and `onSelect` is where the caller writes
 * the choice and closes the popup. That keeps every piece of campaign state
 * where it already lived.
 *
 * `onMouseDown` with preventDefault rather than `onClick`, throughout: the
 * field that opens this closes on blur, and a click would blur it before the
 * day was registered.
 */
export function InlineCalendar({
  viewDate,
  onViewDateChange,
  selected,
  onSelect,
  /** Distinguishes the two calendars' React keys when both are on the page. */
  keyPrefix,
}: {
  viewDate: Date;
  onViewDateChange: (next: Date) => void;
  selected: string;
  onSelect: (iso: string) => void;
  keyPrefix: string;
}) {
  const today = toLocalISODate(new Date());

  const step = (months: number) =>
    onViewDateChange(new Date(viewDate.getFullYear(), viewDate.getMonth() + months, 1));

  return (
    <div className="absolute z-50 mt-1 w-[260px] rounded-xl border border-border bg-surface-elevated p-2 shadow-2xl">
      <div className="mb-2 flex items-center justify-between">
        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            step(-1);
          }}
          className="h-7 w-7 rounded border border-border text-on-surface-variant hover:border-primary/70 hover:text-primary"
        >
          <svg className="mx-auto h-4 w-4" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8">
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
            step(1);
          }}
          className="h-7 w-7 rounded border border-border text-on-surface-variant hover:border-primary/70 hover:text-primary"
        >
          <svg className="mx-auto h-4 w-4" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M8 6l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      <div className="mb-1 grid grid-cols-7 gap-1 text-center text-[10px] font-medium text-on-surface-variant">
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((label, idx) => (
          <span key={`${keyPrefix}-h-${label}-${idx}`}>{label}</span>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {buildMonthDays(viewDate).map((day) => {
          const iso = toLocalISODate(day);
          const inMonth = day.getMonth() === viewDate.getMonth();
          const isSelected = selected === iso;
          const isToday = iso === today;
          // A campaign date cannot be in the past. Neither end is capped by the
          // other — an end before a start shows an inline error rather than
          // blocking days, so the two fields stay independently editable.
          const disabled = iso < today;
          return (
            <button
              key={`${keyPrefix}-${iso}`}
              type="button"
              disabled={disabled}
              onMouseDown={(e) => {
                e.preventDefault();
                if (disabled) return;
                onSelect(iso);
              }}
              className={`h-7 rounded text-[11px] transition-colors ${
                disabled
                  ? 'text-on-surface-variant/30 cursor-not-allowed line-through'
                  : isSelected
                  ? 'bg-primary/20 text-primary border border-primary/60'
                  : isToday
                  ? 'border border-primary/50 text-primary hover:bg-primary/10'
                  : inMonth
                  ? 'text-on-surface hover:bg-primary/10'
                  : 'text-on-surface-variant/60 hover:bg-primary/5'
              }`}
            >
              {day.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}
