/**
 * The one rule for "this schedule is back to front".
 *
 * Written out six times across the promo editor, the announcement editor, the
 * setup dialog and the page — the same `start && end && start > end`, once
 * negated, once as a Boolean(), once as !!(). A rule copied six times is a rule
 * that gets changed in five places.
 *
 * Both dates are ISO yyyy-mm-dd, which compares correctly as a string. A range
 * missing either end is not invalid — it is simply open, which is allowed.
 */
export function isInvalidRange(
  start: string | undefined | null,
  end: string | undefined | null,
): boolean {
  return !!(start && end && start > end);
}

/** True when any announcement in the list carries a back-to-front schedule. */
export function anyInvalidRange(
  items: ReadonlyArray<{ startDate?: string; endDate?: string }>,
): boolean {
  return items.some((item) => isInvalidRange(item.startDate, item.endDate));
}
