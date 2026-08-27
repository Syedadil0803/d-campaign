/**
 * Is a promo card the user's own work, or is it still just what we handed them?
 *
 * The distinction decides whether the app protects a card: consent dialogs,
 * the offer to spend the single draft slot, the Undo countdown, and the
 * dashboard's "you have unsaved changes" guard should all fire for work
 * somebody authored, and stay quiet for a card they merely picked.
 *
 * It lives here because those callers sit in different components and each
 * grew its own copy of the comparison. They then disagreed: the editor stopped
 * guarding a blank canvas while the dashboard still warned about one.
 */

import { PromoCard, defaultConfig } from '@/types/campaign';
import { lookSignature } from '@/lib/promo/lookSignature';

export { lookSignature };
import { blankLookSignatures, isBlankLook } from '@/lib/promo/lookSignature';

/** Text with the markup taken off, for asking whether anything was written. */
function plain(html?: string): string {
  return String(html ?? '')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/[​‌‍﻿]/g, '')
    .trim();
}



/** Everything the card says, with the look left out. */
function wordsSignature(card: PromoCard): string {
  return JSON.stringify({
    title: plain(card.title),
    subtitle: plain(card.subtitle),
    description: plain(card.description),
    buttonText: plain(card.buttonText),
    timerText: plain(card.timerText),
    showTimer: card.showTimer,
    showButton: card.showButton,
    ctaType: card.ctaType,
    buttonUrl: card.buttonUrl,
    whatsappNumber: card.whatsappNumber,
  });
}

/**
 * Every look the app hands out: the templates, plus the default card's own.
 *
 * The default belongs here for the same reason the templates do — nobody
 * chose it.
 */
export function ourLooks(templates: PromoCard[]): string[] {
  return [
    ...templates.map((t) => lookSignature(t.style)),
    lookSignature(defaultConfig.promoCard.style),
    // Every blank palette, not only the one this visit happens to use. A card
    // cleared last week wears last week's colours; if that stopped counting as
    // blank, the tool would decide the user had designed it and start guarding
    // a card nobody has touched.
    ...blankLookSignatures(),
  ];
}

/** Nothing written, and the default styling still in place. */
export function cardIsBlank(card: PromoCard | null | undefined): boolean {
  if (!card) return true;
  return (
    !plain(card.title) &&
    !plain(card.subtitle) &&
    !plain(card.description) &&
    !plain(card.buttonText) &&
    (lookSignature(card.style) === lookSignature(defaultConfig.promoCard.style) ||
      isBlankLook(card.style))
  );
}

/**
 * Still exactly as we ship it — the words from a template, and a look that is
 * one of ours.
 *
 * Words and look are checked apart on purpose: applying a theme to a template
 * changes only the look, and the result is still entirely ours. Comparing
 * whole cards would call that combination authored and start guarding it.
 */
export function cardIsUntouchedTemplate(
  card: PromoCard | null | undefined,
  templates: PromoCard[],
): boolean {
  if (!card) return false;
  const words = wordsSignature(card);
  const wordsAreOurs = templates.some((t) => wordsSignature(t) === words);
  if (!wordsAreOurs) return false;
  return ourLooks(templates).includes(lookSignature(card.style));
}

/**
 * True when losing this card would cost the user nothing they made.
 *
 * Deliberately says nothing about whether the card is stored somewhere —
 * callers know their own sources (what is live, the draft, saved variants) and
 * add that themselves.
 */
export function cardIsNotUserWork(
  card: PromoCard | null | undefined,
  templates: PromoCard[],
): boolean {
  return cardIsBlank(card) || cardIsUntouchedTemplate(card, templates);
}
