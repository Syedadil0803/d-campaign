/**
 * Template helpers for the guided promo flow.
 *
 * A template is two separable things: a LOOK (colors, gradients, alignment,
 * card width, position) and sample COPY. The old flow applied both at once, so
 * trying a different look destroyed whatever the user had written. Here the two
 * are split, so "change template" restyles the card and leaves the words alone.
 */

import { PromoCard } from '@/types/campaign';
import { FIELD_STYLE_KEYS } from '@/lib/promo/promoStyleKeys';

/** Fields that carry the card's look. Everything else is content or scheduling. */
type PromoStyle = PromoCard['style'];

/**
 * Apply a template's look to the card the user is editing, keeping their copy,
 * links, dates and timer settings exactly as they are.
 */
/**
 * The current card's per-field alignment, shaped to spread over a template's
 * style. Fields the current card has no alignment for are left as the
 * template has them.
 */
function carryAlignment(
  current: PromoStyle,
  template: PromoStyle,
): Partial<PromoStyle> {
  const out: Record<string, unknown> = {};
  for (const key of FIELD_STYLE_KEYS) {
    const mine = current[key];
    const theirs = template[key];
    if (!theirs) continue;
    out[key] = { ...theirs, textAlign: mine?.textAlign };
  }
  return out as Partial<PromoStyle>;
}

export function applyTemplateLook(current: PromoCard, template: PromoCard): PromoCard {
  return {
    ...current,
    // Look only.
    style: {
      ...(JSON.parse(JSON.stringify(template.style)) as PromoStyle),
      // Where the card sits on the site is a placement choice, not a look, so
      // trying a theme must not move it. `lookSignature` already drops
      // `position` when deciding whether two designs match; copying it here
      // meant a theme authored bottom-left silently relocated the user's card,
      // and the swatch still read as applied because the signature ignored the
      // one thing that had changed.
      position: current.style.position,
      // Alignment travels with position, and for the same reason: where the
      // words sit is the user's layout choice, not part of the look being
      // tried on. Copying the template's textAlign meant sampling a theme
      // silently re-centred a title the user had left-aligned, and
      // lookSignature — which ignores textAlign — still reported the theme as
      // applied, so nothing on screen said it had happened.
      ...carryAlignment(current.style, template.style),
    },
    cardWidth: template.cardWidth ?? current.cardWidth,
    buttonFullWidth: template.buttonFullWidth ?? current.buttonFullWidth,
  };
}

/**
 * Apply a template wholesale — look AND its sample copy. Used when starting a
 * new campaign from a template, where there's no user writing to preserve.
 */
export function applyTemplateFull(current: PromoCard, template: PromoCard): PromoCard {
  return {
    ...JSON.parse(JSON.stringify(template)) as PromoCard,
    // Never let a template switch the campaign on; publishing does that.
    active: current.active,
    stoppedByUser: current.stoppedByUser,
    // Keep the user's own schedule rather than the template's sample dates.
    startDate: current.startDate || template.startDate,
    endDate: current.endDate || template.endDate,
  };
}

/**
 * True when the user hasn't written anything on the card yet.
 *
 * Includes `buttonText`: nothing ships pre-filled any more, so a CTA on the
 * card is text somebody typed. This now agrees with PromoSection's
 * `canvasIsEmpty` — the two disagreeing is what made Clear Canvas offer to
 * clear a card that looked blank.
 */

/**
 * The look a card wears before anyone has chosen one.
 *
 * Clear Canvas used to leave the default template's teal gradient behind, so
 * "clear" cleared the words and kept the design — and the card that came back
 * looked like a decision somebody had made. This is the absence of a choice:
 * plain surface, readable text, no gradient, nothing to un-pick.
 *
 * Exported rather than inlined because two things must agree on it. The editor
 * applies it, and the authorship check has to recognise it as one of ours —
 * otherwise a freshly cleared canvas would count as the user's own design and
 * bring back every consent dialog it is supposed to be free of.
 */
/**
 * The look a card wears before anyone has chosen one.
 *
 * The same object the default card ships with, not a second copy of it. They
 * were maintained separately and the authorship checks compare against both —
 * so the moment they drifted, a freshly created card and a cleared one would
 * have counted differently, and one of them would have started asking to be
 * saved as though the user had designed it.
 *
 * Cloned rather than aliased so a caller mutating a card's style cannot reach
 * back and rewrite what "blank" means for everyone else.
 */







