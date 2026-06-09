/**
 * lineMeasure.ts — shared "does the timer wrap?" measurement.
 *
 * Used by SingleLinePlugin (enforce at the widest card) and PromoSection
 * (decide the card stretch). Measuring at a FIXED width via a momentary resize
 * decouples the check from the live card width, so the two never race.
 */

/** True if `el`'s content occupies more than one line at its CURRENT width.
 *  Compares the vertical top of line fragments (robust against the chip's
 *  inline-block box being taller than the text). */
export function isMultiline(el: HTMLElement): boolean {
  if (typeof document === 'undefined') return false;
  const range = document.createRange();
  range.selectNodeContents(el);
  const rects = Array.from(range.getClientRects()).filter(
    (r) => r.height > 0 && r.width > 0,
  );
  if (rects.length < 2) return false;

  let minTop = Infinity;
  let maxTop = -Infinity;
  let minH = Infinity;
  for (const r of rects) {
    minTop = Math.min(minTop, r.top);
    maxTop = Math.max(maxTop, r.top);
    minH = Math.min(minH, r.height);
  }
  if (!Number.isFinite(minH) || minH === 0) return false;
  return maxTop - minTop > minH * 0.75;
}

/** True if `el`'s content would wrap to a 2nd line at `contentWidth` px.
 *  Momentarily forces the element to that content width, measures, restores —
 *  synchronously, so nothing repaints in between (no flicker). */
export function wrapsAtWidth(el: HTMLElement, contentWidth: number): boolean {
  if (typeof document === 'undefined' || contentWidth <= 0) return false;
  const prevWidth = el.style.width;
  const prevBox = el.style.boxSizing;
  el.style.boxSizing = 'content-box';
  el.style.width = `${contentWidth}px`;
  // Force layout at the new width before measuring.
  void el.offsetHeight;
  const result = isMultiline(el);
  // Restore.
  el.style.width = prevWidth;
  el.style.boxSizing = prevBox;
  void el.offsetHeight;
  return result;
}

/** Card content widths (card width minus card + field chrome). The card
 *  stretches between 400 and 440; the editor's content area is ~56px narrower
 *  (card p-5 + field px-2). Matches PromoSection's MIRROR_MIN/MAX_WIDTH. */
export const TIMER_MIN_CONTENT_WIDTH = 344; // at the 400 (narrow) card
export const TIMER_MAX_CONTENT_WIDTH = 384; // at the 440 (wide) card
