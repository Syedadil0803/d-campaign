import type { ReactNode } from 'react';

/**
 * What each consent dialog says when a card is about to be replaced.
 *
 * Copy only. The decision of WHICH dialog to show, and what each button does,
 * stays with the editor — this file just holds the words, so changing how a
 * warning reads is not an edit to the logic that chose it.
 *
 * `incoming` names the replacement as a noun phrase — "this template", "this
 * variant", "a blank canvas" — because the draft branches are shared by every
 * card-replacing action and without it they can only say "the new one".
 */

const MY_DRAFT = <span className="font-semibold text-on-surface">My Draft</span>;

/** The current card has changes made since the last save, and a draft exists. */
export function overwritesDraftCopy(incoming: ReactNode) {
  return {
    title: 'Replace your saved draft?',
    body: (
      <>
        Applying {incoming} will replace your current card. Your current card contains changes
        made after your last save, and continuing will save it to{' '}
        {MY_DRAFT}, replacing the previous
        version.
      </>
    ),
    confirmLabel: 'Save and continue',
  };
}

/** No draft to overwrite — the outgoing card simply gets one. */
export function savesToDraftCopy(incoming: ReactNode) {
  return {
    title: 'Save this card as a draft?',
    body: (
      <>
        Applying {incoming} will replace your current card, which has not been saved. Continuing
        will save it to {MY_DRAFT} so a copy
        is kept.
      </>
    ),
    confirmLabel: 'Save and continue',
  };
}

/** Nothing is at risk — say so rather than asking for permission to do nothing. */
export const REASSURANCE_BODY =
  "This only changes the card you're editing. What's live on your website stays up until you publish again.";

/**
 * Offered beside both save-first dialogs. Saving is the safe default, not the
 * only way through: the draft on disk may be the copy worth keeping, and
 * forcing it to be overwritten to get past the dialog destroys the very thing
 * the dialog protects.
 */
export const CONTINUE_ANYWAY = 'Continue anyway';
