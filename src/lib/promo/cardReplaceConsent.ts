import type { PromoCard } from '@/types/campaign';
import { cardSignature, stripHtmlText } from '@/lib/promo/promoCardIdentity';
import { hasVisibleContent } from '@/lib/promo/promoEditorSelection';

/**
 * What consent replacing the card on the canvas needs.
 *
 * Nine branches of policy that lived inside the editor, interleaved with the
 * copy for each dialog and the state each one sets. The rules are about the
 * cards alone — what is on the canvas, what is published, what is in the draft
 * — so they are decided here and the editor is left holding only the wording
 * and the wiring.
 *
 * Consent is for protecting work. Every "silent" verdict below is a case where
 * there is provably nothing to lose, and asking anyway made picking a second
 * template feel like a commitment.
 */
export type CardReplaceVerdict =
  /** Already the card on the canvas — applying it changes nothing. */
  | { kind: 'already-applied' }
  /** Nothing at risk: replace without asking. */
  | { kind: 'silent' }
  /** A draft exists and the editor has moved on; continuing overwrites it. */
  | { kind: 'overwrites-draft' }
  /** Real content, but no pending edits — confirm gently, promise nothing lost. */
  | { kind: 'reassure' }
  /** Destructive by intent (Clear Canvas): warn, offer no save. */
  | { kind: 'destructive' }
  /** Unsaved work with no draft behind it — offer to save on the way through. */
  | { kind: 'save-first' };

export interface CardReplaceInput {
  /** The card currently on the canvas. */
  current: PromoCard;
  /** What would replace it, when the caller knows it. */
  next?: PromoCard;
  /** The card that is live on the website, if any. */
  live?: PromoCard | null;
  /** The card sitting in the single draft slot, if any. */
  draft?: PromoCard | null;
  draftExists: boolean;
  draftUpToDate: boolean;
  hasUnsavedChanges: boolean;
  /** The card as it was when last applied, for telling edits from arrivals. */
  appliedBaseline?: PromoCard | null;
  /**
   * True when nothing of the user's own is on the canvas — blank, already
   * stored, or an untouched template Template Hub will hand straight back.
   */
  nothingToOfferBack: boolean;
  /**
   * Whether the draft branches apply. False for deliberate destruction (Clear
   * Canvas): the user is throwing the card away, so quietly saving it over
   * their existing draft would destroy the draft to preserve something they
   * just discarded.
   */
  offerDraftSave: boolean;
}

/**
 * Only what represents the USER'S work: the words and the styling.
 *
 * A whole-object compare fails on things the app changes by itself right after
 * applying — cardWidth is recomputed 400↔440, the timer HTML is re-serialised,
 * editors normalise font-size spans — so it reported "edited" for a card
 * nobody had touched, and every template click warned.
 */
function workSignature(c: PromoCard): string {
  return JSON.stringify({
    title: hasVisibleContent(c.title) ? stripHtmlText(c.title) : '',
    subtitle: hasVisibleContent(c.subtitle) ? stripHtmlText(c.subtitle) : '',
    description: hasVisibleContent(c.description) ? stripHtmlText(c.description) : '',
    buttonText: hasVisibleContent(c.buttonText) ? stripHtmlText(c.buttonText) : '',
    style: c.style,
  });
}

export function cardReplaceConsent(input: CardReplaceInput): CardReplaceVerdict {
  const { current, next, live, draft, appliedBaseline, offerDraftSave } = input;

  // Applying what's already on the canvas is a no-op: don't ask, don't apply
  // (applying would mark the card changed for no visible reason).
  if (next && cardSignature(next) === cardSignature(current)) {
    return { kind: 'already-applied' };
  }

  if (input.nothingToOfferBack) return { kind: 'silent' };

  // A blank/fresh card has nothing to lose (this also covers the dirty flag
  // being set right after a previous Start Fresh).
  const hasContent =
    hasVisibleContent(current.title) ||
    hasVisibleContent(current.subtitle) ||
    hasVisibleContent(current.description) ||
    hasVisibleContent(current.buttonText);
  if (!hasContent) return { kind: 'silent' };

  // Still identical to whatever was last applied, so the user hasn't written
  // anything into it. Checked BEFORE the dirty flag on purpose: applying a
  // template calls markChanged(), so hasUnsavedChanges is always true straight
  // afterwards and this branch was unreachable — which made browsing templates
  // warn on every click after the first.
  if (appliedBaseline && workSignature(appliedBaseline) === workSignature(current)) {
    return { kind: 'silent' };
  }

  /**
   * Already published — the card can be fetched back from My Published, so
   * nothing is at risk and no save is worth offering.
   *
   * Checked BEFORE the draft branches on purpose: with a draft lying around
   * from other work, replacing a published card used to prompt "Replace your
   * saved draft?" — offering to overwrite the draft with a card that was
   * already safe, which is both pointless and destructive.
   */
  const cardIsPublished = !!live && cardSignature(current) === cardSignature(live);

  /**
   * Already in the draft. Uses the card comparison, not `draftUpToDate`: that
   * flag is a whole-config signature, so switching tabs and coming back made an
   * unchanged card look edited and prompted to re-save it.
   */
  const cardIsInDraft = !!draft && cardSignature(current) === cardSignature(draft);

  if (offerDraftSave && (cardIsPublished || cardIsInDraft || input.draftUpToDate)) {
    return { kind: 'silent' };
  }

  if (offerDraftSave && input.draftExists && !input.draftUpToDate && !cardIsInDraft) {
    return { kind: 'overwrites-draft' };
  }

  // Content with no pending edits — typically their published card, loaded on
  // landing. Confirmed so it never vanishes unannounced, but without implying
  // work will be lost.
  if (!input.hasUnsavedChanges) return { kind: 'reassure' };

  if (!offerDraftSave) return { kind: 'destructive' };

  return { kind: 'save-first' };
}
