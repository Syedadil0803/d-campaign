import { describe, expect, it } from 'vitest';
import {
  cardIsBlank,
  cardIsNotUserWork,
  cardIsUntouchedTemplate,
  timerWordingIsOurs,
} from '@/lib/promo/promoAuthorship';
import { getFreshPromoCard } from '@/lib/promo/freshPromoCard';
import { applyTemplateFull, applyTemplateLook } from '@/lib/promo/promoTemplate';
import { withDefaultDates } from '@/lib/promo/promoCardIdentity';
import { sampleTemplates } from '@/lib/promo/sampleTemplateCards';
import { INDUSTRIES, withIndustryCopy } from '@/lib/promo/industryCopy';
import type { PromoCard } from '@/types/campaign';

/**
 * "Did the user write this, or did we hand it to them?"
 *
 * The single most consequential question in the editor: it decides whether
 * Clear is enabled, whether replacing a card asks permission, whether the undo
 * toast offers a way back, and whether a crash-recovery copy is kept. Getting
 * it wrong in either direction is a bug the user feels — a guard that nags
 * about a card nobody touched, or work thrown away without a word.
 *
 * Seven of the register's defects came from this rule alone, always the same
 * way: a second copy of it somewhere that had not learned what the first one
 * had. These cases are the ones that were wrong at some point.
 */

const TEMPLATES = sampleTemplates.map((t) => t.promoCard as PromoCard);
const fresh = () => getFreshPromoCard();
const applied = (card: PromoCard) => withDefaultDates(applyTemplateFull(fresh(), card));

describe('timerWordingIsOurs', () => {
  it('accepts the wording a new card ships with', () => {
    expect(timerWordingIsOurs(getFreshPromoCard().timerText)).toBe(true);
  });

  it('accepts a card carrying no countdown wording at all', () => {
    expect(timerWordingIsOurs('')).toBe(true);
    expect(timerWordingIsOurs(undefined)).toBe(true);
  });

  it('ignores capitalisation, which two defaults disagree about', () => {
    expect(timerWordingIsOurs('ENDS IN {timer}')).toBe(true);
  });

  it('rejects wording the user typed', () => {
    expect(timerWordingIsOurs('Hurry {timer}')).toBe(false);
  });
});

describe('cardIsBlank', () => {
  it('is true for a brand-new card', () => {
    expect(cardIsBlank(fresh())).toBe(true);
  });

  it('is true for a card with only the start date we fill in ourselves', () => {
    // withDefaultStartDate gives every new card today's date, so counting it
    // would make an untouched canvas look authored.
    expect(cardIsBlank({ ...fresh(), startDate: '2026-01-01' })).toBe(true);
  });

  it('is false once an END date is chosen — nobody fills that in but the user', () => {
    expect(cardIsBlank({ ...fresh(), endDate: '2026-01-09' })).toBe(false);
  });

  it('is false once the countdown is worded', () => {
    expect(cardIsBlank({ ...fresh(), timerText: 'Hurry {timer}' })).toBe(false);
  });

  it('is false once any field carries text', () => {
    expect(cardIsBlank({ ...fresh(), title: 'Summer sale' })).toBe(false);
  });

  it('ignores markup, so an empty styled paragraph is still blank', () => {
    expect(cardIsBlank({ ...fresh(), title: '<span style="color:red"></span>' })).toBe(true);
  });
});

describe('cardIsUntouchedTemplate', () => {
  it('recognises a template applied as it ships', () => {
    expect(cardIsUntouchedTemplate(applied(TEMPLATES[0]), TEMPLATES)).toBe(true);
  });

  it("recognises a template wearing a trade's wording", () => {
    // Template Hub offers every template in the chosen trade's words. Those
    // are ours too — missing that made Clear ask permission to throw away a
    // card the user had not written a word of.
    const t = sampleTemplates[0];
    const traded = withIndustryCopy(t.promoCard as PromoCard, t.id, INDUSTRIES[0].id);
    expect(cardIsUntouchedTemplate(applied(traded), TEMPLATES)).toBe(true);
  });

  it('recognises a template wearing one of our own themes', () => {
    const themed = applyTemplateLook(applied(TEMPLATES[0]), TEMPLATES[4]);
    expect(cardIsUntouchedTemplate(themed, TEMPLATES)).toBe(true);
  });

  it('stops recognising it once a word is changed', () => {
    const edited = { ...applied(TEMPLATES[0]), title: 'My own headline' };
    expect(cardIsUntouchedTemplate(edited, TEMPLATES)).toBe(false);
  });
});

describe('cardIsNotUserWork', () => {
  it.each([
    ['a blank canvas', () => fresh()],
    ['an untouched template', () => applied(TEMPLATES[0])],
  ])('protects nothing for %s', (_label, build) => {
    expect(cardIsNotUserWork(build(), TEMPLATES)).toBe(true);
  });

  it.each([
    ['an edited title', () => ({ ...applied(TEMPLATES[0]), title: 'Mine' })],
    ['an edited countdown', () => ({ ...applied(TEMPLATES[0]), timerText: 'Hurry {timer}' })],
    ['a button link', () => ({ ...applied(TEMPLATES[0]), buttonUrl: 'https://example.com' })],
  ])('protects %s', (_label, build) => {
    expect(cardIsNotUserWork(build(), TEMPLATES)).toBe(false);
  });
});
