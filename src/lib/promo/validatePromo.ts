import type { PromoCard } from '@/types/campaign';
import { toLocalISODate } from '@/lib/utils';
import { whatsAppLooksShort } from '@/lib/whatsapp';
import { fieldOverflows } from '@/lib/promo/promoFit';

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
  const formatDate = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

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
  if (!pc.startDate || !pc.endDate) {
    warnings.push('Start date or end date is not set');
  } else {
    // Local, not UTC: east of Greenwich a UTC "today" is still yesterday
    // for the first hours of the day, which would flag a campaign ending
    // today as already expired.
    const today = toLocalISODate(new Date());
    if (pc.endDate < today) {
      warnings.push('End date is in the past');
    } else if (pc.startDate <= today) {
      warnings.push(`Campaign will run from ${formatDate(pc.startDate)} – ${formatDate(pc.endDate)} (starts immediately)`);
    } else {
      warnings.push(`Campaign is scheduled for ${formatDate(pc.startDate)} – ${formatDate(pc.endDate)}`);
    }
  }

  // 3. Timer text
  if (pc.showTimer) {
    const timerPlain = strip(pc.timerText || '').replace(/\{timer\}/gi, '').trim();
    if (!timerPlain) warnings.push('Timer has no prefix or suffix — you can add text like "Ends in" or "Hurry!" around the countdown');
  }

  // 4. CTA
  if (pc.showButton) {
    const btnText = strip(pc.buttonText || '');
    const ctaType = pc.ctaType || 'whatsapp';
    if (ctaType === 'text') {
      if (!btnText) warnings.push('Button text is empty');
    } else if (ctaType === 'whatsapp') {
      const num = pc.whatsappNumber?.trim() || '';
      const code = pc.whatsappCountryCode || '+44';
      if (!btnText && !num) {
        warnings.push('Button text and WhatsApp number are empty');
      } else if (!btnText) {
        warnings.push('Button text is empty');
      } else if (!num) {
        warnings.push('WhatsApp number is empty');
      } else if (whatsAppLooksShort(code, num)) {
        // The editor links any typed digit on purpose, so this is the last
        // place a half-typed number can be caught before it reaches the site.
        warnings.push(
          `WhatsApp number looks short for ${code}: ${code} ${num}`,
        );
      } else {
        warnings.push(`WhatsApp number: ${code} ${num}`);
      }
    } else {
      const url = pc.buttonUrl?.trim() || '';
      if (!btnText && !url) {
        warnings.push('Button text and URL are empty');
      } else if (!btnText) {
        warnings.push('Button text is empty');
      } else if (!url) {
        warnings.push('Button URL is empty');
      }
    }
  }

  return warnings;
}
