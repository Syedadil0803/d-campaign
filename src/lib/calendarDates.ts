/**
 * Calendar arithmetic and date labels, shared by every date picker.
 *
 * These four were written three times over — once in PromoSection, once in
 * PromoDatePicker and once in AnnouncementSection — byte-identical apart from
 * indentation. Three copies of a date calculation is three chances for them to
 * disagree about what a month looks like, and the one nobody remembers to fix
 * is always the third.
 *
 * Nothing here touches React or component state. It takes dates and returns
 * dates and strings.
 */

/** `2026-08-26` — the form the config stores and the API expects. */
export function toISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * The 42 cells of a month grid — six rows of seven, starting on the Sunday
 * on or before the 1st.
 *
 * Always 42 rather than the number the month needs, so the picker does not
 * change height as you page through it.
 */
export function buildMonthDays(viewDate: Date): Date[] {
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const first = new Date(year, month, 1);
  const startOffset = first.getDay();
  const gridStart = new Date(year, month, 1 - startOffset);
  return Array.from(
    { length: 42 },
    (_, i) =>
      new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i),
  );
}

/**
 * A stored date as the user reads it, or the prompt when there is none.
 *
 * The `T00:00:00` matters: parsing a bare `2026-08-26` is treated as UTC and
 * can land on the previous day once the browser converts it back to local
 * time. Naming the time makes it local from the start.
 */
export function formatDateLabel(value: string): string {
  if (!value) return 'Select date';
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return 'Select date';
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/** "12 Aug → 19 Aug", or whichever end exists, or nothing. */
export function formatScheduleRange(start?: string, end?: string): string {
  const fmt = (d?: string) => {
    if (!d) return '';
    const dt = new Date(`${d}T00:00:00`);
    if (Number.isNaN(dt.getTime())) return '';
    return dt.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };
  const s = fmt(start);
  const e = fmt(end);
  if (s && e) return `${s} → ${e}`;
  return s || e || '';
}
