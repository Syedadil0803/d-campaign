import { describe, it, expect } from 'vitest';
import { validatePromo } from '@/lib/promo/validatePromo';
import { defaultConfig } from '@/types/campaign';
import { getISODateWithOffset } from '@/lib/utils';
import type { PromoCard } from '@/types/campaign';

// What the user is told before a card goes live. Every rule here is the last
// thing standing between a half-finished card and the website.

/** A card that raises nothing, so each test can break one thing at a time. */
const goodCard = (changes: Partial<PromoCard> = {}): PromoCard => ({
  ...defaultConfig.promoCard,
  title: 'Winter Sale',
  subtitle: 'Ends Sunday',
  description: 'Up to 40% off everything in store.',
  startDate: getISODateWithOffset(1),
  endDate: getISODateWithOffset(8),
  showButton: false,
  showTimer: false,
  ...changes,
});

const warningsFor = (changes: Partial<PromoCard> = {}) => validatePromo(goodCard(changes));

/** Matches a warning by its opening words, so wording tweaks do not break tests. */
const raised = (changes: Partial<PromoCard>, opening: string) =>
  warningsFor(changes).some((w) => w.startsWith(opening));

describe('Publishing checks', () => {
  it('PRO-14 raises nothing but the schedule for a finished card', () => {
    const warnings = warningsFor();

    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatch(/^Campaign is scheduled for/);
  });

  it('PRO-15 reports each empty word field', () => {
    expect(raised({ title: '' }, 'Title is empty')).toBe(true);
    expect(raised({ subtitle: '' }, 'Subtitle is empty')).toBe(true);
    expect(raised({ description: '' }, 'Description is empty')).toBe(true);
  });

  it('PRO-16 treats markup with no words in it as empty', () => {
    // The editors write HTML, so a "filled" field can hold nothing readable.
    expect(raised({ title: '<p><br></p>' }, 'Title is empty')).toBe(true);
    expect(raised({ subtitle: '&nbsp;' }, 'Subtitle is empty')).toBe(true);
  });

  it('PRO-17 reports a card with no campaign dates', () => {
    expect(raised({ startDate: '', endDate: '' }, 'Start date or end date is not set')).toBe(true);
    expect(raised({ endDate: '' }, 'Start date or end date is not set')).toBe(true);
  });

  it('PRO-18 reports an end date already in the past', () => {
    const past = { startDate: getISODateWithOffset(-9), endDate: getISODateWithOffset(-2) };

    expect(raised(past, 'End date is in the past')).toBe(true);
  });

  it('PRO-19 says so when the campaign starts the moment it is published', () => {
    const today = { startDate: getISODateWithOffset(0), endDate: getISODateWithOffset(5) };

    expect(warningsFor(today).some((w) => w.includes('starts immediately'))).toBe(true);
  });

  it('PRO-20 counts a campaign ending today as still running', () => {
    // Dates are compared in local time. Comparing in UTC would call a campaign
    // ending today expired for anyone west of Greenwich.
    const endsToday = { startDate: getISODateWithOffset(-3), endDate: getISODateWithOffset(0) };
    const warnings = warningsFor(endsToday);

    expect(warnings.some((w) => w.startsWith('End date is in the past'))).toBe(false);
    expect(warnings.some((w) => w.includes('starts immediately'))).toBe(true);
  });

  it('PRO-21 reports a countdown with no words around it', () => {
    expect(raised({ showTimer: true, timerText: '{timer}' }, 'Timer has no prefix')).toBe(true);
    expect(raised({ showTimer: true, timerText: 'Ends in {timer}' }, 'Timer has no prefix')).toBe(
      false,
    );
  });

  it('PRO-22 leaves the countdown alone while it is switched off', () => {
    expect(raised({ showTimer: false, timerText: '' }, 'Timer has no prefix')).toBe(false);
  });

  it('PRO-23 reports a WhatsApp button that is missing its number', () => {
    const button = { showButton: true, ctaType: 'whatsapp' as const, buttonText: 'Chat to us' };

    expect(raised({ ...button, whatsappNumber: '' }, 'WhatsApp number is empty')).toBe(true);
  });

  it('PRO-24 reports a WhatsApp number too short for its country', () => {
    // The editor links any typed digit, so this is the last chance to catch
    // a number someone stopped typing halfway through.
    const halfTyped = {
      showButton: true,
      ctaType: 'whatsapp' as const,
      buttonText: 'Chat to us',
      whatsappCountryCode: '+44',
      whatsappNumber: '7911',
    };

    expect(raised(halfTyped, 'WhatsApp number looks short')).toBe(true);
  });

  it('PRO-25 reports a link button that points nowhere', () => {
    const link = { showButton: true, ctaType: 'link' as const, buttonText: 'Shop now' };

    expect(raised({ ...link, buttonUrl: '' }, 'Button URL is empty')).toBe(true);
    expect(raised({ ...link, buttonUrl: '   ' }, 'Button URL is empty')).toBe(true);
  });

  it('PRO-26 reports a button with no words on it', () => {
    const noText = { showButton: true, ctaType: 'text' as const, buttonText: '' };

    expect(raised(noText, 'Button text is empty')).toBe(true);
  });

  it('PRO-27 leaves the button alone while it is switched off', () => {
    expect(warningsFor({ showButton: false, buttonText: '', buttonUrl: '' })).toHaveLength(1);
  });
});

// A campaign that runs from its start date until someone stops it. It carries
// no end date on purpose, which is not the same as one nobody finished setting.
describe('Publishing checks, open-ended campaign', () => {
  const openEnded = (changes: Partial<PromoCard> = {}) =>
    warningsFor({ scheduleMode: 'openEnded', endDate: '', ...changes });

  it('PRO-28 accepts a card with a start date and no end date', () => {
    const warnings = openEnded({ startDate: getISODateWithOffset(1) });

    expect(warnings.some((w) => w.includes('is not set'))).toBe(false);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatch(/until you stop it$/);
  });

  it('PRO-29 still reports a card with no start date', () => {
    expect(openEnded({ startDate: '' }).some((w) => w.startsWith('Start date is not set'))).toBe(true);
  });

  it('PRO-30 says so when the campaign starts the moment it is published', () => {
    const warnings = openEnded({ startDate: getISODateWithOffset(0) });

    expect(warnings.some((w) => w.includes('starts immediately'))).toBe(true);
  });

  it('PRO-31 never calls an open-ended campaign expired', () => {
    // There is no end to be past, however old the start date is.
    const warnings = openEnded({ startDate: getISODateWithOffset(-400) });

    expect(warnings.some((w) => w.startsWith('End date is in the past'))).toBe(false);
  });

  it('PRO-32 does not ask about a countdown it cannot run', () => {
    // A countdown counts towards an end date, and there is none.
    const warnings = openEnded({ startDate: getISODateWithOffset(1), showTimer: true, timerText: '' });

    expect(warnings.some((w) => w.startsWith('Timer has no prefix'))).toBe(false);
  });

  it('PRO-33 still checks the words and the button', () => {
    expect(openEnded({ title: '' }).some((w) => w.startsWith('Title is empty'))).toBe(true);
    expect(
      openEnded({ showButton: true, ctaType: 'link', buttonText: 'Shop now', buttonUrl: '' }).some(
        (w) => w.startsWith('Button URL is empty'),
      ),
    ).toBe(true);
  });
});
