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
  const prevWS = el.style.getPropertyValue('white-space');
  const prevWSPrio = el.style.getPropertyPriority('white-space');
  el.style.boxSizing = 'content-box';
  el.style.width = `${contentWidth}px`;
  // The editor renders nowrap (one-line display), but to DETECT overflow we must
  // let it wrap here — otherwise it never shows a 2nd line and the cap can never
  // fire. `!important` beats the editor's nowrap class; restored right after.
  el.style.setProperty('white-space', 'normal', 'important');
  // Force layout at the new width before measuring.
  void el.offsetHeight;
  const result = isMultiline(el);
  // Restore.
  el.style.width = prevWidth;
  el.style.boxSizing = prevBox;
  if (prevWS) el.style.setProperty('white-space', prevWS, prevWSPrio);
  else el.style.removeProperty('white-space');
  void el.offsetHeight;
  return result;
}

/** The content's single-line width in px (how much horizontal room it needs).
 *  Collapses the editor to a shrink-to-fit inline-block with nowrap, so its box
 *  hugs the actual content (NOT the line-box, which would span the full forced
 *  width). Lets the line-cap catch ANY edit that grows the footprint — typing
 *  OR sizing up — not just edits that add characters. */
export function contentWidth(el: HTMLElement): number {
  if (typeof document === 'undefined') return 0;
  const s = el.style;
  const prev = {
    display: s.display,
    width: s.width,
    maxWidth: s.maxWidth,
    whiteSpace: s.whiteSpace,
  };
  s.display = 'inline-block';
  s.width = 'auto';
  s.maxWidth = 'none';
  s.whiteSpace = 'nowrap';
  void el.offsetHeight;
  const w = el.getBoundingClientRect().width;
  s.display = prev.display;
  s.width = prev.width;
  s.maxWidth = prev.maxWidth;
  s.whiteSpace = prev.whiteSpace;
  void el.offsetHeight;
  return w;
}

/** Card content widths (card width minus card + field chrome). The card
 *  stretches between 400 and 440; the editor's content area is ~56px narrower
 *  (card p-5 + field px-2). Matches PromoSection's MIRROR_MIN/MAX_WIDTH. */
export const TIMER_MIN_CONTENT_WIDTH = 344; // at the 400 (narrow) card
export const TIMER_MAX_CONTENT_WIDTH = 384; // at the 440 (wide) card
