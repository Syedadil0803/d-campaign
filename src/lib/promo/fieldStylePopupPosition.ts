/**
 * Where the field style panel opens, relative to the promo card.
 *
 * Geometry only — elements and numbers in, a style object out. It lived inside
 * PromoSection as a 100-line closure over four refs and a piece of state,
 * which made a self-contained piece of layout maths unreadable without the
 * 3,000 lines around it.
 */

const STYLE_POPUP_WIDTH = 280;
const STYLE_POPUP_GAP = 40;

/** Assumed panel height for the very first frame, before it can be measured. */
export const STYLE_POPUP_FALLBACK_HEIGHT = 260;

/**
 * Which side of the card a floating panel opens on.
 *
 * Shared, because getting it wrong is the same bug twice: the card background
 * popup pinned itself to the canvas's left edge unconditionally, so parking the
 * card bottom-left dropped the popup straight on top of the card it was
 * recolouring.
 *
 * From a control on the left, hug the canvas's left edge — but only while the
 * card is on the right, because that is the only time the left is free space.
 * Otherwise open beside the card, on whichever side has room, falling back to
 * its left rather than running off the canvas.
 */
export function popupLeftBesideCard({
  card,
  width,
  anchor,
  cardIsOnTheLeft,
  gap = STYLE_POPUP_GAP,
}: {
  card: HTMLElement;
  width: number;
  anchor: 'card' | 'input';
  cardIsOnTheLeft: boolean;
  gap?: number;
}): string {
  const canvas = card.closest('[data-promo-canvas]') as HTMLElement | null;

  if (anchor === 'input' && !cardIsOnTheLeft && canvas) {
    const cardLeft = card.getBoundingClientRect().left;
    const canvasLeft = canvas.getBoundingClientRect().left;
    return `${Math.round(canvasLeft + 8 - cardLeft)}px`;
  }

  const rightEdge = card.getBoundingClientRect().right;
  const roomOnRight = canvas
    ? canvas.getBoundingClientRect().right - rightEdge
    : 0;

  if (roomOnRight >= width + gap) return `${card.clientWidth + gap}px`;
  return `${-(width + gap)}px`;
}

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

  return {
    ...vertical,
    left: popupLeftBesideCard({
      card,
      width: STYLE_POPUP_WIDTH,
      anchor,
      cardIsOnTheLeft,
    }),
  };
}
