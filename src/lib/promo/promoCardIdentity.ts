/**
 * What a promo card IS, and how to copy or compare one.
 *
 * None of this needs a component around it: each takes a card and returns a
 * card, a string or a boolean. cardSignature is the one that matters — every
 * "is this the same card?" question in the editor goes through it, and a raw
 * compare gets the answer wrong twice over.
 */
import { PromoCard } from '@/types/campaign';
import { getISODateWithOffset } from '@/lib/utils';

export function clonePromoCard(card: PromoCard): PromoCard {
  return JSON.parse(JSON.stringify(card)) as PromoCard;
}

export function promoCardsEqual(a: PromoCard, b: PromoCard): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

// Ask for consent before a replacing action — but only when there's actually
// content to lose (no point confirming on a blank card). Undo still works after.
/** Visible words only — immune to the HTML normalisation editors apply. */
export function stripHtmlText(html?: string): string {
  return String(html ?? '')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/[\u200B\u200C\u200D\uFEFF]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Fill default start/end dates if missing. Must be applied BEFORE a card's
// baseline is captured — otherwise the date-defaulting effect mutates the
// card after the baseline, making it look "edited" and wrongly enabling Reset.
/**
 * A card with no start date starts today.
 *
 * "From today" is the safe assumption — a campaign being built now is one
 * meant to run now — and it is the only date the app can honestly guess. The
 * END is deliberately untouched: it is a real decision nobody can make for the
 * user, and it is also the trigger that switches the countdown on once the
 * schedule is complete, so filling it in would turn on a timer they never
 * asked for.
 *
 * getFreshPromoCard already assumed this, but blankPromoCard — the card a
 * refresh lands on — cloned defaultConfig and did not, so the default the
 * editor opened with survived only until the page was reloaded and the field
 * came back reading "Select".
 */
export function withDefaultStartDate(card: PromoCard): PromoCard {
  if (card?.startDate) return card;
  return { ...card, startDate: getISODateWithOffset(0) };
}

export function withDefaultDates(card: PromoCard): PromoCard {
  if (card.startDate && card.endDate) return card;
  return {
    ...card,
    startDate: card.startDate || getISODateWithOffset(0),
    endDate: card.endDate || getISODateWithOffset(1),
  };
}

/** True when this saved variant is the card currently on the website. */
/**
 * What a card IS, ignoring noise the app rewrites by itself and the on-air
 * flags that belong to the website rather than the design.
 *
 * Shared by every "same card?" question in here. A raw compare fails on two
 * counts: a saved variant stores active:false while the live card is
 * active:true, and the editors re-serialise their own HTML constantly.
 */
export function cardSignature(c: PromoCard): string {
  return JSON.stringify({
    title: stripHtmlText(c.title),
    subtitle: stripHtmlText(c.subtitle),
    description: stripHtmlText(c.description),
    buttonText: stripHtmlText(c.buttonText),
    timerText: stripHtmlText(c.timerText),
    showTimer: c.showTimer,
    showButton: c.showButton,
    ctaType: c.ctaType,
    buttonUrl: c.buttonUrl,
    whatsappNumber: c.whatsappNumber,
    style: c.style,
  });
}
