import type { PromoCard } from '@/types/campaign';
import { FIELD_STYLE_KEYS } from '@/lib/promo/promoStyleKeys';
import { BLANK_LOOKS } from '@/lib/promo/blankLooks';

/**
 * What makes two card designs "the same look".
 *
 * Type-only imports, so the blank-palette list can use it without the runtime
 * cycle it was written to avoid — which is why it had its own private copy of
 * this before, and why the two drifted: `position` was dropped in both, but
 * `textAlign` only in one. `isBlankLook` then disagreed with `lookSignature`
 * about whether aligning a title changed the design.
 *
 * Excluded from the comparison:
 *  - `position`, where the card sits on the site — placement, not a look.
 *  - each field's `textAlign` — where the words sit is layout, not a look.
 */
export function lookSignature(style: PromoCard['style']): string {
  const { position: _position, ...look } = style;
  for (const key of FIELD_STYLE_KEYS) {
    const fieldStyle = look[key];
    if (fieldStyle) {
      const { textAlign: _textAlign, ...rest } = fieldStyle;
      look[key] = rest as typeof fieldStyle;
    }
  }
  return JSON.stringify(look);
}

/** Every blank palette's signature, for the "is this card blank?" test. */
export function blankLookSignatures(): string[] {
  return BLANK_LOOKS.map((look) => lookSignature(look));
}

/** Nothing designed yet — the card still wears one of the blank palettes. */
export function isBlankLook(style: PromoCard['style']): boolean {
  return blankLookSignatures().includes(lookSignature(style));
}
