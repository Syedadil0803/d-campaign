/**
 * NOTE — this file is now one function.
 *
 * It used to carry a second overflow implementation as well: requiredCardWidth
 * and fitWarning, with their own card-width constants. Nothing imported any of
 * it. The editor measures overflow its own way in lib/promoMeasure.ts, by
 * width with white-space:nowrap, where this measures by height and allows
 * wrapping. Two implementations that can disagree, one of them dead.
 *
 * The dead one is gone. fieldOverflows stays because page.tsx uses it, and the
 * disagreement it can have with promoMeasure is still real and still a product
 * decision — see the note at the top of that file.
 */

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
const FIELD_MAX_LINES: Record<PromoFitField, number> = {
  title: 1,
  subtitle: 2,
  description: 3,
};

export type PromoFitField = 'title' | 'subtitle' | 'description';


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




