import { PromoCard } from '@/types/campaign';
import type { CopyTable } from '@/lib/promo/industryCopy/copyTypes';
import { SEASONAL_COPY } from '@/lib/promo/industryCopy/seasonalCopy';
import { EVERGREEN_COPY } from '@/lib/promo/industryCopy/evergreenCopy';

/**
 * Sample wording for every template, in every trade the tool is sold to.
 *
 * Template Hub is where someone picks a LOOK, and the words on those cards are
 * only examples. But generic examples make the tool feel like it has never met
 * the person using it, and leave them staring at a card with no idea what a
 * good one says. A plumber who sees "Emergency Call-Out" has a shape to edit;
 * one who sees "Special Offer" has a blank page.
 *
 * Each entry is a template's occasion crossed with a trade — Christmas for a
 * garage is a winter check, for a restaurant a festive menu, for an accountant
 * a year-end review. The template keeps its own mood, emoji and type sizes; only
 * the trade changes.
 *
 * The markup is generated from each template's own copy rather than written out
 * here, so a headline can never lose the font-size span or bold that its design
 * depends on.
 */
export interface IndustryOption {
  id: string;
  label: string;
}

export const INDUSTRIES: IndustryOption[] = [
  { id: 'home-trades', label: 'Home & Local Trades' },
  { id: 'retail', label: 'Retail & E-commerce' },
  { id: 'professional', label: 'Professional Services' },
  { id: 'hospitality', label: 'Hospitality & Food' },
  { id: 'wellness', label: 'Health, Beauty & Wellness' },
  { id: 'automotive', label: 'Automotive & Garages' },
  { id: 'creative', label: 'Creative & Freelance' },
  { id: 'education', label: 'Classes & Kids\' Activities' },
  { id: 'property', label: 'Property & Venues' },
];

/**
 * One table, assembled from the two halves it is kept in.
 *
 * Split by occasion rather than alphabetically: a seasonal template's words
 * are written against a date in the year, an evergreen one's against a trade's
 * standing reason to run a campaign, and the two are edited at different times
 * for different reasons.
 */
const COPY: CopyTable = { ...SEASONAL_COPY, ...EVERGREEN_COPY };

/**
 * A template's look, wearing a trade's words.
 *
 * Only the five text fields move. Style, width, button width, schedule and
 * every toggle stay as the template defines them, which is what stops choosing
 * a trade from quietly restyling the card.
 */
export function withIndustryCopy(
  template: PromoCard,
  templateId: string,
  industryId: string | null,
): PromoCard {
  if (!industryId) return template;
  const copy = COPY[templateId]?.[industryId];
  if (!copy) return template;
  return { ...template, ...copy };
}
