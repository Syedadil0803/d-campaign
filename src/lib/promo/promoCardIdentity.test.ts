import { describe, expect, it } from 'vitest';
import { withDefaultStartDate, withDefaultDates, cardSignature } from '@/lib/promo/promoCardIdentity';
import { getFreshPromoCard } from '@/lib/promo/freshPromoCard';
import { toLocalISODate } from '@/lib/utils';

/**
 * What a card IS, and what it starts as.
 */
describe('withDefaultStartDate', () => {
  it("gives a card with no start date today's", () => {
    const card = { ...getFreshPromoCard(), startDate: '' };
    expect(withDefaultStartDate(card).startDate).toBe(toLocalISODate(new Date()));
  });

  it('leaves a chosen start date alone', () => {
    const card = { ...getFreshPromoCard(), startDate: '2027-03-04' };
    expect(withDefaultStartDate(card).startDate).toBe('2027-03-04');
  });

  it('never fills in the END date — that is the user\'s decision, and it arms the countdown', () => {
    const card = { ...getFreshPromoCard(), startDate: '', endDate: '' };
    expect(withDefaultStartDate(card).endDate).toBe('');
  });
});

describe('withDefaultDates', () => {
  it('fills both ends when a card arrives with neither', () => {
    const card = { ...getFreshPromoCard(), startDate: '', endDate: '' };
    const out = withDefaultDates(card);
    expect(out.startDate).toBeTruthy();
    expect(out.endDate).toBeTruthy();
    expect(out.startDate <= out.endDate).toBe(true);
  });

  it('returns the card untouched when it already has a schedule', () => {
    const card = { ...getFreshPromoCard(), startDate: '2027-01-01', endDate: '2027-01-05' };
    expect(withDefaultDates(card)).toBe(card);
  });
});

describe('cardSignature', () => {
  it('ignores the on-air flags, which belong to the website rather than the design', () => {
    const a = { ...getFreshPromoCard(), title: 'Sale', active: true };
    const b = { ...getFreshPromoCard(), title: 'Sale', active: false };
    expect(cardSignature(a)).toBe(cardSignature(b));
  });

  it('ignores markup the editors rewrite on their own', () => {
    const a = { ...getFreshPromoCard(), title: '<b>Sale</b>' };
    const b = { ...getFreshPromoCard(), title: '<strong>Sale</strong>' };
    expect(cardSignature(a)).toBe(cardSignature(b));
  });

  it('sees a genuine change of words', () => {
    const a = { ...getFreshPromoCard(), title: 'Sale' };
    const b = { ...getFreshPromoCard(), title: 'Clearance' };
    expect(cardSignature(a)).not.toBe(cardSignature(b));
  });
});
