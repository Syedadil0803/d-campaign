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
import { sampleTemplates } from '@/lib/promo/sampleTemplateCards';
import { INDUSTRIES, withIndustryCopy } from '@/lib/promo/industryCopy';

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

const TEMPLATE_CARDS = sampleTemplates.map((t) => t.promoCard as PromoCard);

/**
 * Every set of words the app hands out.
 *
 * Not just the twelve templates as written: Template Hub offers each one in
 * the chosen trade's wording, so a plumber's "Emergency Call-Out" is as much
 * ours as the template's own copy. Leaving those out meant picking a template
 * with a trade selected produced a card the tool then guarded as the user's
 * own work — every word of which we had written — so Clear Canvas asked
 * permission to throw away something nobody had authored.
 *
 * Built once. Twelve templates across nine trades is a hundred and eight
 * signatures, and it can never change at runtime.
 */
const OUR_WORDS: Set<string> = new Set([
  ...TEMPLATE_CARDS.map(wordsSignature),
  ...sampleTemplates.flatMap((t) =>
    INDUSTRIES.map((industry) =>
      wordsSignature(withIndustryCopy(t.promoCard as PromoCard, t.id, industry.id)),
    ),
  ),
]);

/**
 * Every look the app hands out: the templates, plus the default card's own.
 *
 * The default belongs here for the same reason the templates do — nobody
 * chose it.
 */
export function ourLooks(templates: PromoCard[] = TEMPLATE_CARDS): string[] {
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

/**
 * The countdown wording nobody chose.
 *
 * defaultConfig and getFreshPromoCard capitalise it differently ("Ends in" vs
 * "Ends In"), so the comparison is case-insensitive rather than letting that
 * decide whether a card counts as authored.
 */
const OUR_TIMER_WORDS = new Set(
  // '' covers a card that carries no timerText at all, which is as unwritten
  // as one still carrying ours.
  ['', defaultConfig.promoCard.timerText, 'Ends In {timer}'].map((t) =>
    plain(t).toLowerCase(),
  ),
);

/**
 * Is this countdown still wearing the wording we shipped?
 *
 * Exported because two places ask it. cardIsBlank asks to decide whether a
 * card is worth protecting; the editor asks to decide whether Clear should be
 * enabled. They had their own answers, and the editor's counted the default
 * "Ends In {timer}" as writing — so Clear stayed lit on a canvas nobody had
 * touched.
 */
export function timerWordingIsOurs(timerText?: string): boolean {
  return OUR_TIMER_WORDS.has(plain(timerText).toLowerCase());
}

/**
 * Nothing written, and the default styling still in place.
 *
 * The countdown and the end date count as writing. They were left out, so a
 * card whose only content was a schedule and a countdown read as blank — and
 * because "blank" is what stops the app protecting a card, the crash-recovery
 * copy was cleared and a refresh threw the work away. Typing in the title
 * survived a reload; setting an end date and wording the countdown did not.
 *
 * wordsSignature just below has always counted timerText as content, so the
 * two answers to "has the user written anything?" in this one file disagreed.
 *
 * The START date is deliberately not counted: it is filled in with today for
 * every new card (see withDefaultStartDate), so counting it would make every
 * blank canvas look authored and bring back the guards firing on a card
 * nobody had touched.
 */
export function cardIsBlank(card: PromoCard | null | undefined): boolean {
  if (!card) return true;
  return (
    !plain(card.title) &&
    !plain(card.subtitle) &&
    !plain(card.description) &&
    !plain(card.buttonText) &&
    !card.endDate &&
    timerWordingIsOurs(card.timerText) &&
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
  templates: PromoCard[] = TEMPLATE_CARDS,
): boolean {
  if (!card) return false;
  const wordsAreOurs = OUR_WORDS.has(wordsSignature(card));
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
  templates: PromoCard[] = TEMPLATE_CARDS,
): boolean {
  return cardIsBlank(card) || cardIsUntouchedTemplate(card, templates);
}
