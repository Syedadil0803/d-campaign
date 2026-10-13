import type { PromoCard } from '@/types/campaign';
import { ctaWarnings } from '@/lib/campaignCta';
import { fieldOverflows } from '@/lib/promo/promoFit';
import { isOpenEnded, scheduleWarnings } from '@/lib/promo/promoSchedule';

/**
 * What the user should know before a promo card goes live.
 *
 * A pure reading of the card — it took nothing from the page but the card
 * itself, which is why it belongs here and can be checked without rendering
 * anything.
 */
export function validatePromo(promoCard: PromoCard): string[] {
  const warnings: string[] = [];
  const pc = promoCard;
  const strip = (html: string) => html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();

  // 1. Content fields
  if (!strip(pc.title || '')) warnings.push('Title is empty');
  if (!strip(pc.subtitle || '')) warnings.push('Subtitle is empty');
  if (!strip(pc.description || '')) warnings.push('Description is empty');

  // 1b. DOM overflow check — shared with the guided flow's live fit warnings
  // so the publish gate and the inline hints can never disagree.
  (['title', 'subtitle', 'description'] as const).forEach((field) => {
    if (fieldOverflows(pc[field], field, pc.cardWidth)) {
      warnings.push(`${field.charAt(0).toUpperCase() + field.slice(1)} text may overflow the card layout`);
    }
  });

  // 2. Schedule — publishing turns the card On Air, so it will run.
  const openEnded = isOpenEnded(pc);
  warnings.push(...scheduleWarnings(pc, { describe: true }));

  // 3. Timer text
  if (pc.showTimer && !openEnded) {
    const timerPlain = strip(pc.timerText || '').replace(/\{timer\}/gi, '').trim();
    if (!timerPlain) warnings.push('Timer has no prefix or suffix — you can add text like "Ends in" or "Hurry!" around the countdown');
  }

  // 4. CTA — the rules the Video Story shares.
  warnings.push(...ctaWarnings(pc));

  return warnings;
}
