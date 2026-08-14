/**
 * Template helpers for the guided promo flow.
 *
 * A template is two separable things: a LOOK (colors, gradients, alignment,
 * card width, position) and sample COPY. The old flow applied both at once, so
 * trying a different look destroyed whatever the user had written. Here the two
 * are split, so "change template" restyles the card and leaves the words alone.
 */

import { PromoCard } from '@/types/campaign';

/** Fields that carry the card's look. Everything else is content or scheduling. */
type PromoStyle = PromoCard['style'];

/**
 * Apply a template's look to the card the user is editing, keeping their copy,
 * links, dates and timer settings exactly as they are.
 */
export function applyTemplateLook(current: PromoCard, template: PromoCard): PromoCard {
  return {
    ...current,
    // Look only.
    style: JSON.parse(JSON.stringify(template.style)) as PromoStyle,
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
export function isCardEmpty(card: PromoCard): boolean {
  const blank = (html?: string) =>
    !String(html ?? '')
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/[​‌‍﻿]/g, '')
      .trim();
  return (
    blank(card.title) &&
    blank(card.subtitle) &&
    blank(card.description) &&
    blank(card.buttonText)
  );
}
