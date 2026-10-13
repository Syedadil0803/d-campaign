import { describe, it, expect } from 'vitest';
import { deriveButtonUrl, hasCallToAction } from '@/lib/campaignCta';
import type { CampaignCta } from '@/types/campaign';

// The destination the website receives. Shared by the card and the Video Story,
// so this must keep producing exactly what the card has always published.

const cta = (changes: Partial<CampaignCta>): CampaignCta => ({
  buttonText: 'Order',
  buttonUrl: 'https://example.com',
  showButton: true,
  ...changes,
});

describe('Button destination', () => {
  it('rebuilds a WhatsApp link from the number, ignoring any stale URL', () => {
    expect(deriveButtonUrl(cta({ ctaType: 'whatsapp', whatsappCountryCode: '+44', whatsappNumber: '07911 123456' })))
      .toBe('https://wa.me/447911123456');
  });

  it('treats a missing type as WhatsApp, and no number as no link', () => {
    expect(deriveButtonUrl(cta({ whatsappNumber: '' }))).toBe('');
  });

  it('gives a text button no link and keeps a typed link', () => {
    expect(deriveButtonUrl(cta({ ctaType: 'text' }))).toBe('');
    expect(deriveButtonUrl(cta({ ctaType: 'link' }))).toBe('https://example.com');
  });

  it('adds https:// to a link typed without it, as the preview opens it', () => {
    expect(deriveButtonUrl(cta({ ctaType: 'link', buttonUrl: ' example.com/shop ' }))).toBe('https://example.com/shop');
    expect(deriveButtonUrl(cta({ ctaType: 'link', buttonUrl: 'HTTP://example.com' }))).toBe('HTTP://example.com');
    expect(deriveButtonUrl(cta({ ctaType: 'link', buttonUrl: '  ' }))).toBe('');
  });
});

describe('hasCallToAction', () => {
  it('needs the button shown and somewhere to send people', () => {
    expect(hasCallToAction(cta({ ctaType: 'link' }))).toBe(true);
    expect(hasCallToAction(cta({ ctaType: 'link', buttonUrl: '' }))).toBe(false);
    expect(hasCallToAction(cta({ ctaType: 'whatsapp' }))).toBe(false);
    expect(hasCallToAction(cta({ ctaType: 'text' }))).toBe(true);
    expect(hasCallToAction(cta({ ctaType: 'text', showButton: false }))).toBe(false);
  });

  it('treats a missing type as WhatsApp', () => {
    expect(hasCallToAction(cta({ whatsappNumber: '7911 123456' }))).toBe(true);
    expect(hasCallToAction(cta({ whatsappNumber: '' }))).toBe(false);
  });
});
