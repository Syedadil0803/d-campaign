/**
 * Tour definitions — the content, kept apart from the engine that draws it.
 *
 * Every `anchor` here must match a `data-tour="…"` attribute on a real
 * element. Add new tours to this file so there's one place to see what the
 * tool explains, and to catch two tours firing on the same screen.
 *
 * Anchor names in use:
 *   promo-save-draft  → PromoSection, the Save/Update draft button
 *   promo-my-draft    → PromoSection, the My Draft chip
 *   header-publish    → Header, the Publish button
 */

import type { TourDefinition } from './GuidedTour';

/**
 * Explains the draft model on the first visit to the promo editor. Kept to
 * three steps, each anchored to the control it describes, because the thing
 * people get wrong is which button does what — not the concept in the
 * abstract.
 */
export const PROMO_DRAFT_TOUR: TourDefinition = {
  id: 'promo-draft',
  version: 1,
  steps: [
    {
      anchor: 'promo-save-draft',
      placement: 'bottom',
      title: 'Park it, finish it later',
      body: 'Not ready to publish? Save the card as it is and come back to it. One slot — saving again replaces it.',
    },
    {
      anchor: 'promo-my-draft',
      placement: 'bottom',
      title: 'Open it from any device',
      body: 'Your draft is stored on your account, not this browser. Teammates see it too — last save wins.',
    },
    {
      anchor: 'header-publish',
      placement: 'bottom',
      title: 'Your live card stays safe',
      body: 'Drafts never reach your website. Visitors see the change only when you publish.',
    },
  ],
};
