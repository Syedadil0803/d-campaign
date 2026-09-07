import { describe, expect, it } from 'vitest';
import { withDefaultStartDate, withDefaultDates, cardSignature } from '@/lib/promo/promoCardIdentity';
import { getFreshPromoCard } from '@/lib/promo/freshPromoCard';
import { toLocalISODate } from '@/lib/utils';

/**
 * What a card IS, and what it starts as.
 */
describe('Campaign dates', () => {
  it("PRO-06 gives a card with no start date today's", () => {
    const card = { ...getFreshPromoCard(), startDate: '' };
    expect(withDefaultStartDate(card).startDate).toBe(toLocalISODate(new Date()));
  });

  it('PRO-07 leaves a chosen start date alone', () => {
    const card = { ...getFreshPromoCard(), startDate: '2027-03-04' };
    expect(withDefaultStartDate(card).startDate).toBe('2027-03-04');
  });

  it('PRO-08 never fills in the END date — that is the user\'s decision, and it arms the countdown', () => {
    const card = { ...getFreshPromoCard(), startDate: '', endDate: '' };
    expect(withDefaultStartDate(card).endDate).toBe('');
  });
});

describe('Campaign dates', () => {
  it('PRO-09 fills both ends when a card arrives with neither', () => {
    const card = { ...getFreshPromoCard(), startDate: '', endDate: '' };
    const out = withDefaultDates(card);
    expect(out.startDate).toBeTruthy();
    expect(out.endDate).toBeTruthy();
    expect(out.startDate <= out.endDate).toBe(true);
  });

  it('PRO-10 returns the card untouched when it already has a schedule', () => {
    const card = { ...getFreshPromoCard(), startDate: '2027-01-01', endDate: '2027-01-05' };
    expect(withDefaultDates(card)).toBe(card);
  });

  it('PRO-35 keeps the schedule kind through a cleared canvas', () => {
    // Clearing throws away the words and the design. How the campaign runs is
    // neither, and losing it put the end date and the countdown back.
    const cleared = getFreshPromoCard('openEnded');

    expect(cleared.scheduleMode).toBe('openEnded');
    expect(cleared.endDate).toBe('');
    expect(cleared.showTimer).toBe(false);
  });

  it('PRO-34 never gives an open-ended campaign an end date', () => {
    // It has no end by choice, and an end date would arm the countdown too.
    const card = {
      ...getFreshPromoCard(),
      scheduleMode: 'openEnded' as const,
      startDate: '',
      endDate: '',
    };
    const out = withDefaultDates(card);

    expect(out.startDate).toBeTruthy();
    expect(out.endDate).toBe('');
  });
});

describe('Unsaved changes', () => {
  it('PRO-11 ignores the on-air flags, which belong to the website rather than the design', () => {
    const a = { ...getFreshPromoCard(), title: 'Sale', active: true };
    const b = { ...getFreshPromoCard(), title: 'Sale', active: false };
    expect(cardSignature(a)).toBe(cardSignature(b));
  });

  it('PRO-12 ignores markup the editors rewrite on their own', () => {
    const a = { ...getFreshPromoCard(), title: '<b>Sale</b>' };
    const b = { ...getFreshPromoCard(), title: '<strong>Sale</strong>' };
    expect(cardSignature(a)).toBe(cardSignature(b));
  });

  it('PRO-13 sees a genuine change of words', () => {
    const a = { ...getFreshPromoCard(), title: 'Sale' };
    const b = { ...getFreshPromoCard(), title: 'Clearance' };
    expect(cardSignature(a)).not.toBe(cardSignature(b));
  });
});
