import type { CampaignCta } from '@/types/campaign';
import { whatsAppLooksShort, whatsAppUrl } from '@/lib/whatsapp';

/**
 * The CTA rules every widget shares: where its button goes, and what to warn
 * about before it goes live. One copy, so the card and the Video Story can
 * never build or check a button differently.
 */

/**
 * The button's destination as the website should receive it.
 *
 * WhatsApp is rebuilt from the number every time, with the same builder the
 * editor preview uses, so what goes live is exactly what the preview opens —
 * and switching from a link CTA to WhatsApp can't publish the old URL. A text
 * CTA is a styled button with no link. A link is what was typed, with
 * https:// added when the scheme was left off: the preview always did that and
 * the publish did not, so "example.com" opened in the editor and went live as
 * a relative link to a page on the customer's own site.
 */
export function deriveButtonUrl(cta: CampaignCta): string {
  const type = cta.ctaType || 'whatsapp';
  if (type === 'whatsapp') return whatsAppUrl(cta.whatsappCountryCode, cta.whatsappNumber) ?? '';
  if (type === 'text') return '';
  const url = (cta.buttonUrl || '').trim();
  if (!url) return '';
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}

const strip = (html: string) => html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();

/** What is missing or doubtful about the button, when it is shown at all. */
export function ctaWarnings(cta: CampaignCta): string[] {
  if (!cta.showButton) return [];
  const btnText = strip(cta.buttonText || '');
  const ctaType = cta.ctaType || 'whatsapp';
  if (ctaType === 'text') return btnText ? [] : ['Button text is empty'];
  if (ctaType === 'whatsapp') {
    const num = cta.whatsappNumber?.trim() || '';
    const code = cta.whatsappCountryCode || '+44';
    if (!btnText && !num) return ['Button text and WhatsApp number are empty'];
    if (!btnText) return ['Button text is empty'];
    if (!num) return ['WhatsApp number is empty'];
    // The editor links any typed digit on purpose, so this is the last place a
    // half-typed number can be caught before it reaches the site.
    if (whatsAppLooksShort(code, num)) return [`WhatsApp number looks short for ${code}: ${code} ${num}`];
    return [`WhatsApp number: ${code} ${num}`];
  }
  const url = cta.buttonUrl?.trim() || '';
  if (!btnText && !url) return ['Button text and URL are empty'];
  if (!btnText) return ['Button text is empty'];
  if (!url) return ['Button URL is empty'];
  return [];
}

/**
 * The button is shown and leads somewhere — a text CTA needs nowhere to lead.
 * The dashboard's "no call-to-action" check, shared so the card and the Video
 * Story are judged alike.
 */
export function hasCallToAction(cta: CampaignCta): boolean {
  // A missing type is WhatsApp, as everywhere else in this file: cards saved
  // before the type existed have none, and were judged as having no CTA.
  const type = cta.ctaType || 'whatsapp';
  return (
    cta.showButton &&
    ((type === 'whatsapp' && !!cta.whatsappNumber) ||
      (type === 'link' && !!cta.buttonUrl) ||
      type === 'text')
  );
}
