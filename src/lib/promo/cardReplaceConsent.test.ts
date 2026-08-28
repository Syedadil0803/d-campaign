import { describe, expect, it } from 'vitest';
import { cardReplaceConsent } from '@/lib/promo/cardReplaceConsent';
import { getFreshPromoCard } from '@/lib/promo/freshPromoCard';
import type { PromoCard } from '@/types/campaign';

/**
 * Whether replacing the card on the canvas should ask, and what it should ask.
 *
 * Every dialog the editor shows before a template, a variant, the draft or a
 * clear comes from this one function. The order of its branches is the whole
 * design and is easy to break by rearranging: several of the register's
 * defects were a check that had drifted above or below another and so became
 * unreachable — most memorably the applied-baseline test, which sat under the
 * dirty flag that applying a template sets, so browsing templates warned on
 * every click after the first.
 *
 * These cases pin the order, not just the outcomes.
 */

const card = (over: Partial<PromoCard> = {}): PromoCard => ({
  ...getFreshPromoCard(),
  title: 'Summer sale',
  ...over,
});

const base = {
  draftExists: false,
  draftUpToDate: false,
  hasUnsavedChanges: true,
  nothingToOfferBack: false,
  offerDraftSave: true,
};

it('says nothing when the card being applied is already the one on screen', () => {
  const c = card();
  expect(cardReplaceConsent({ ...base, current: c, next: { ...c } }).kind).toBe('already-applied');
});

it('says nothing when there is nothing of the user\'s to lose', () => {
  expect(cardReplaceConsent({ ...base, current: card(), nothingToOfferBack: true }).kind).toBe('silent');
});

it('says nothing for an empty canvas', () => {
  expect(cardReplaceConsent({ ...base, current: getFreshPromoCard() }).kind).toBe('silent');
});

it('says nothing while the card still matches what was last applied', () => {
  // Applying a template marks the config changed, so this MUST be checked
  // before the dirty flag or browsing templates warns on every click.
  const c = card();
  expect(
    cardReplaceConsent({ ...base, current: c, appliedBaseline: { ...c }, hasUnsavedChanges: true }).kind,
  ).toBe('silent');
});

it('says nothing when the card is already published — My Published holds it', () => {
  const c = card();
  expect(cardReplaceConsent({ ...base, current: c, live: { ...c } }).kind).toBe('silent');
});

it('says nothing when the card is already the saved draft', () => {
  const c = card();
  expect(cardReplaceConsent({ ...base, current: c, draft: { ...c }, draftExists: true }).kind).toBe('silent');
});

it('warns that a DIFFERENT saved draft would be replaced', () => {
  expect(
    cardReplaceConsent({
      ...base,
      current: card({ title: 'On the canvas' }),
      draft: card({ title: 'Something else' }),
      draftExists: true,
    }).kind,
  ).toBe('overwrites-draft');
});

it('offers to save first when there is unsaved work and no draft yet', () => {
  expect(cardReplaceConsent({ ...base, current: card() }).kind).toBe('save-first');
});

it('reassures rather than warns when the card has content but no pending edits', () => {
  expect(cardReplaceConsent({ ...base, current: card(), hasUnsavedChanges: false }).kind).toBe('reassure');
});

it('treats a clear as destruction, never quietly saving over the draft', () => {
  // offerDraftSave is false for Clear Canvas: the user is throwing the card
  // away, and saving it over their existing draft to "protect" it would
  // destroy the very thing the dialog is for.
  expect(cardReplaceConsent({ ...base, current: card(), offerDraftSave: false }).kind).toBe('destructive');
});

describe('ordering', () => {
  it('checks published before the draft branches', () => {
    // Otherwise replacing an already-safe card offers to overwrite an
    // unrelated draft — pointless and destructive.
    const c = card();
    expect(
      cardReplaceConsent({
        ...base,
        current: c,
        live: { ...c },
        draft: card({ title: 'Unrelated' }),
        draftExists: true,
      }).kind,
    ).toBe('silent');
  });
});
