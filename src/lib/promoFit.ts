/**
 * Card fit measurement.
 *
 * The publish-time validator already measured whether a field's text overflows
 * the card, using a hidden ghost element at the card's real content width. The
 * guided flow needs the same answer live, as the user types, so that logic
 * lives here and both callers share it — one source of truth for "does this
 * fit", rather than two checks that can disagree.
 */

/** Lines each field is allowed before it overflows the card layout. */
export const FIELD_MAX_LINES: Record<PromoFitField, number> = {
  title: 1,
  subtitle: 2,
  description: 3,
};

export type PromoFitField = 'title' | 'subtitle' | 'description';

export const FIELD_LABELS: Record<PromoFitField, string> = {
  title: 'Title',
  subtitle: 'Subtitle',
  description: 'Description',
};

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
}

/**
 * True when the field's rendered text is taller than the lines it's allowed.
 * Returns false during SSR and for empty fields.
 *
 * Measured at the card's ACTUAL content width (the card auto-widens 400→440),
 * with letter-spacing neutralised because the live preview strips it —
 * otherwise text that actually fits gets flagged.
 */
export function fieldOverflows(
  html: string | undefined,
  field: PromoFitField,
  cardWidth?: number,
): boolean {
  if (typeof document === 'undefined') return false;
  if (!html || !stripHtml(html)) return false;

  const contentWidth = (cardWidth || 400) - 56; // card padding (40) + field padding (16)
  const ghost = document.createElement('div');
  ghost.style.cssText = `
    position:absolute;visibility:hidden;pointer-events:none;
    width:${contentWidth}px;padding:0;font-family:inherit;line-height:24px;letter-spacing:normal;
    word-break:break-word;overflow-wrap:break-word;
  `;
  ghost.innerHTML = '<span style="font-size:1rem">&nbsp;</span>';
  document.body.appendChild(ghost);
  const singleLineHeight = ghost.offsetHeight;
  ghost.innerHTML = html;
  ghost.querySelectorAll('*').forEach((el) => {
    (el as HTMLElement).style.letterSpacing = 'normal';
  });
  const contentHeight = ghost.offsetHeight;
  document.body.removeChild(ghost);

  const maxHeight = singleLineHeight * FIELD_MAX_LINES[field] + singleLineHeight * 0.5;
  return contentHeight > maxHeight;
}

// The card stretches between these two widths depending on how much copy it
// has to hold. Content widths are the card width minus 56px of padding.
export const CARD_MIN_WIDTH = 400;
export const CARD_MAX_WIDTH = 440;
const MIRROR_MIN_CONTENT_WIDTH = CARD_MIN_WIDTH - 56;

/** True when html needs more than its allowed lines at the given content width. */
function overflowsAtWidth(html: string, field: PromoFitField, width: number): boolean {
  if (!html || typeof document === 'undefined') return false;
  if (!stripHtml(html)) return false;

  const ghost = document.createElement('div');
  ghost.style.cssText = `
    position:absolute;visibility:hidden;pointer-events:none;
    width:${width}px;padding:0;
    font-family:inherit;line-height:1.5;letter-spacing:normal;
    word-break:break-word;overflow-wrap:break-word;
    white-space:nowrap;
  `;
  ghost.innerHTML = html;
  ghost.querySelectorAll('*').forEach((el) => {
    (el as HTMLElement).style.letterSpacing = 'normal';
  });
  document.body.appendChild(ghost);
  const singleLineHeight = ghost.offsetHeight;
  ghost.style.whiteSpace = 'normal';
  const contentHeight = ghost.offsetHeight;
  document.body.removeChild(ghost);

  if (singleLineHeight === 0) return false;
  return contentHeight > singleLineHeight * FIELD_MAX_LINES[field];
}

/**
 * The width the card needs for its current copy — 400 normally, 440 when any
 * field would wrap past its line limit at the narrow width. Mirrors the
 * editor's own auto-stretch so previews outside the editor match it.
 */
export function requiredCardWidth(card: {
  title?: string;
  subtitle?: string;
  description?: string;
}): number {
  const fields: PromoFitField[] = ['title', 'subtitle', 'description'];
  for (const field of fields) {
    if (overflowsAtWidth(card[field] ?? '', field, MIRROR_MIN_CONTENT_WIDTH)) {
      return CARD_MAX_WIDTH;
    }
  }
  return CARD_MIN_WIDTH;
}

/** Human-readable nudge for an overflowing field, or null when it fits. */
export function fitWarning(
  html: string | undefined,
  field: PromoFitField,
  cardWidth?: number,
): string | null {
  if (!fieldOverflows(html, field, cardWidth)) return null;
  const lines = FIELD_MAX_LINES[field];
  return `${FIELD_LABELS[field]} runs past ${lines} line${lines > 1 ? 's' : ''} — shorten it, or reduce its text size.`;
}
