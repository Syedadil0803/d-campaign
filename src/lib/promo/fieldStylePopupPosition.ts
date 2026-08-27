/**
 * Where the field style panel opens, relative to the promo card.
 *
 * Geometry only — elements and numbers in, a style object out. It lived inside
 * PromoSection as a 100-line closure over four refs and a piece of state,
 * which made a self-contained piece of layout maths unreadable without the
 * 3,000 lines around it.
 */

export const STYLE_POPUP_WIDTH = 280;
export const STYLE_POPUP_GAP = 40;

/** Assumed panel height for the very first frame, before it can be measured. */
export const STYLE_POPUP_FALLBACK_HEIGHT = 260;

export interface FieldStylePopupPositionArgs {
  /** The promo card element the panel is positioned against. */
  card: HTMLElement | null;
  /**
   * The previewed field being styled. May be absent: during a blank start the
   * preview only draws what has been written, so styling a field before typing
   * in it means there is nothing to line up with.
   */
  field: HTMLElement | null;
  /** Measured panel height once rendered; the constant covers the first frame. */
  height: number;
  /** Opened from a field on the card, or from the style icon beside an input. */
  anchor: 'card' | 'input';
  /** Whether the card is parked on the left of the canvas. */
  cardIsOnTheLeft: boolean;
}

export function fieldStylePopupPosition({
  card,
  field,
  height,
  anchor,
  cardIsOnTheLeft,
}: FieldStylePopupPositionArgs): { top?: string; bottom?: string; left?: string } {
  if (!card) return { bottom: '8px' };

  /**
   * Line the panel up with the field it edits, then keep it inside the canvas.
   *
   * It used to ask whether the panel fitted below the field and pin it to the
   * card's bottom when it did not. The height it asked with was a hardcoded
   * 320 against a panel that is nearer 250, so the test almost always failed —
   * and pinning the bottom of a ~250px panel inside a ~244px card pushed it up
   * past the card entirely. Editing the timer, at the bottom of the card,
   * opened its panel at the top of the preview.
   */
  const canvas = card.closest('[data-promo-canvas]') as HTMLElement | null;
  const cardTop = card.getBoundingClientRect().top;

  // The card's own top stands in when the field has not been drawn yet.
  // Bailing out here instead returned a vertical offset and no horizontal one,
  // which left the panel at the card's left edge — sitting on top of the card
  // it was meant to sit beside.
  let desiredTop = (field ?? card).getBoundingClientRect().top;
  if (canvas) {
    const canvasRect = canvas.getBoundingClientRect();
    const lowest = canvasRect.bottom - height - 8;
    desiredTop = Math.min(
      Math.max(desiredTop, canvasRect.top + 8),
      Math.max(canvasRect.top + 8, lowest),
    );
  }
  const vertical = { top: `${Math.round(desiredTop - cardTop)}px` };

  /**
   * Horizontal: open beside whatever was clicked.
   *
   * From a field in the card, the popup sits next to the card, on whichever
   * side has room — the canvas is ~838px, the card 400px and the popup 280px,
   * so they only fit side by side, never both on the same side.
   *
   * From the style icon beside an input on the left, it instead hugs the
   * canvas's left edge, next to the input that opened it. It can't go further
   * left and sit truly beside the inputs: an ancestor of the preview column
   * sets overflow-x: hidden, so anything past the canvas edge is clipped
   * rather than floating over the panel.
   *
   * Unless the card is parked there. The left of the canvas is only free real
   * estate while the card sits on the right — move the card to bottom-left and
   * that same placement drops the panel straight on top of the thing it is
   * restyling, hiding the preview the user is watching. In that case it falls
   * through to the card-relative placement below, which opens on whichever
   * side the card actually leaves open.
   */
  if (anchor === 'input' && !cardIsOnTheLeft && canvas) {
    const cardLeft = card.getBoundingClientRect().left;
    const canvasLeft = canvas.getBoundingClientRect().left;
    return { ...vertical, left: `${Math.round(canvasLeft + 8 - cardLeft)}px` };
  }

  // Clicked a field in the card: open to its right, so the panel lands on the
  // opposite side from the two left-hand routes and it stays obvious which one
  // opened it. A card parked bottom-right leaves no room there, so that case
  // falls back to the left rather than running off the canvas.
  const rightEdge = card.getBoundingClientRect().right;
  const roomOnRight = canvas
    ? canvas.getBoundingClientRect().right - rightEdge
    : 0;

  if (roomOnRight >= STYLE_POPUP_WIDTH + STYLE_POPUP_GAP) {
    return { ...vertical, left: `${card.clientWidth + STYLE_POPUP_GAP}px` };
  }
  return { ...vertical, left: `${-(STYLE_POPUP_WIDTH + STYLE_POPUP_GAP)}px` };
}
