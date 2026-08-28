/**
 * The editor's own overflow measurement — the "virtual mirror".
 *
 * Renders a field's HTML into a hidden element at the card's content width and
 * asks whether it is too wide. Used to refuse a style that would break the
 * card, and to decide whether the card needs its wider 440 layout.
 *
 * ── WARNING: this is not the only overflow check ──
 *
 * lib/promoFit.ts has fieldOverflows(), used by page.tsx. The two answer the
 * same question differently and CAN DISAGREE:
 *
 *   promoFit    measures HEIGHT, allows wrapping, fails past a line allowance
 *   this file   measures WIDTH with nowrap, fails if it will not fit one line
 *
 * A subtitle allowed two lines passes promoFit and fails here. Neither is
 * wrong alone; having both is. Choosing one changes what the editor accepts —
 * a product decision. Until it is made, build nothing on top of either.
 */

export type MeasuredField = 'title' | 'subtitle' | 'description' | 'button';

// Virtual Mirror: max lines per field
const FIELD_MAX_LINES: Record<string, number> = {
  title: 1,
  subtitle: 2,
  description: 3,
  // The CTA was absent here AND from the caller's overflow list, so the button
  // label was the one field with no cap at all — it wrapped to as many lines as
  // you cared to type while every other field stopped you.
  button: 1,
};

/**
 * Horizontal space the field's own chrome takes, so the mirror measures the
 * width the words actually get. The three text fields sit flush in the card;
 * the button carries px-4 either side.
 */
const FIELD_INSET: Record<string, number> = {
  button: 32,
};


// Mirror widths: min (400px card - 56px padding) to max (440px card - 56px padding)
const MIRROR_MIN_WIDTH = 344;
const MIRROR_MAX_WIDTH = 384;

/**
 * Virtual Mirror measurement.
 * Checks if html overflows at a given width against the field's max lines.
 */
function measureOverflowAtWidth(html: string, field: MeasuredField, width: number): boolean {
  if (!html || typeof document === 'undefined') return false;
  const plainText = html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/\u200B/g, '').trim();
  if (!plainText) return false;

  const maxLines = FIELD_MAX_LINES[field] || 1;
  const usableWidth = width - (FIELD_INSET[field] ?? 0);

  const ghost = document.createElement('div');
  ghost.style.cssText = `
    position:absolute;visibility:hidden;pointer-events:none;
    width:${usableWidth}px;padding:0;
    font-family:inherit;line-height:1.5;letter-spacing:normal;
    word-break:break-word;overflow-wrap:break-word;
    white-space:nowrap;
  `;
  ghost.innerHTML = html;
  // Letter-spacing is not a supported concept and the live preview strips it
  // (.promo-live-preview reset). Old configs still carry inline letter-spacing,
  // which would make this ghost measure WIDER than the text actually renders —
  // reading the field as "full" with visible room left. Neutralize it so the
  // check matches what the user sees.
  ghost.querySelectorAll('*').forEach((el) => {
    (el as HTMLElement).style.letterSpacing = 'normal';
  });
  document.body.appendChild(ghost);
  const singleLineHeight = ghost.offsetHeight;

  ghost.style.whiteSpace = 'normal';
  const contentHeight = ghost.offsetHeight;
  document.body.removeChild(ghost);

  if (singleLineHeight === 0) return false;
  return contentHeight > singleLineHeight * maxLines;
}

/**
 * Dynamic mirror: tries min width first, then max width.
 * Returns true only if content overflows at max width (384px).
 */
export function measureOverflow(html: string, field: MeasuredField): boolean {
  return measureOverflowAtWidth(html, field, MIRROR_MAX_WIDTH);
}

/**
 * Returns the required card width (400–440) based on content across all fields.
 */
/**
 * Does the countdown line exceed the card's content width?
 *
 * It needs its own measurement because it renders `white-space: pre` — the
 * numbers must never break mid-chip — so the usual test, "does this need a
 * second line?", answers no however long it grows. It simply runs off the
 * edge instead, which is what "Private window closes in 3 days : 5 hours :
 * 7 mins" does at 400px.
 */
function timerOverflowsAtWidth(html: string, width: number): boolean {
  if (!html || typeof document === 'undefined') return false;
  const plain = html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/\u200B/g, '').trim();
  if (!plain) return false;

  const ghost = document.createElement('div');
  ghost.style.cssText = `
    position:absolute;visibility:hidden;pointer-events:none;
    white-space:pre;padding:0;
    font-family:inherit;line-height:1.5;letter-spacing:normal;
  `;
  ghost.innerHTML = html;
  // Same reason as the wrapping measurement: old configs carry inline
  // letter-spacing the live preview strips, which would measure too wide.
  ghost.querySelectorAll('*').forEach((el) => {
    (el as HTMLElement).style.letterSpacing = 'normal';
  });
  document.body.appendChild(ghost);
  const lineWidth = ghost.offsetWidth;
  document.body.removeChild(ghost);

  return lineWidth > width;
}

export function getRequiredCardWidth(
  fields: { html: string; field: 'title' | 'subtitle' | 'description' }[],
  timerHtml = '',
): number {
  for (const { html, field } of fields) {
    if (!html) continue;
    if (measureOverflowAtWidth(html, field, MIRROR_MIN_WIDTH)) {
      return 440;
    }
  }
  // The countdown was never measured, so a card whose only long line was the
  // timer stayed at 400 and let it run off the edge. Templates with wordy
  // timer text — "Private window closes in", "Countdown to midnight:" — were
  // broken from the moment they were applied; switching between templates hid
  // it, because a previous long title had already pushed the card to 440.
  if (timerHtml && timerOverflowsAtWidth(timerHtml, MIRROR_MIN_WIDTH)) {
    return 440;
  }
  return 400;
}
