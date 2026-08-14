/**
 * Tour definitions — the content, kept apart from the engine that draws it.
 *
 * Every `anchor` here must match a `data-tour="…"` attribute on a real
 * element. Add new tours to this file so there's one place to see what the
 * tool explains, and to catch two tours firing on the same screen.
 *
 * Anchor names in use:
 *   promo-timer       → PromoSection, the countdown inside the card preview
 *   promo-save-draft  → PromoSection, the Save/Update draft button
 *   promo-my-draft    → PromoSection, the My Draft chip
 *   header-publish    → Header, the Publish button
 */

import type { TourDefinition } from './GuidedTour';

/**
 * The first-run walkthrough of the promo editor.
 *
 * Every step is anchored to the control it describes, because what people get
 * wrong is which control does what — not the concept in the abstract. Covers
 * the draft model and publishing; the countdown hint is separate, because it
 * repeats (see PROMO_TIMER_TOUR).
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

/**
 * Where the countdown is edited — shown EVERY time a new card lands in the
 * editor, not once per browser.
 *
 * It's contextual, not onboarding: the moment a fresh card appears is when the
 * question "where do I change the timer?" actually arises, and that moment
 * recurs. Dismissing it doesn't retire it. What retires it is editing the
 * timer once — proof the lesson landed, and the only honest stopping
 * condition. Nagging someone who already knows is what a "seen 3 times"
 * counter would do instead.
 *
 * 'left' puts it in the empty space beside the card; the engine flips it when
 * the card's position leaves no room there.
 */
export const PROMO_TIMER_TOUR: TourDefinition = {
  id: 'promo-timer-hint',
  version: 1,
  steps: [
    {
      anchor: 'promo-timer',
      placement: 'left',
      // "Timer Text" is what the editor's own panel calls this field, and it's
      // the accurate name: the countdown itself is generated from the dates —
      // only the wording around it is editable.
      title: 'Edit the timer text here',
      body:
        'Title, subtitle and description are edited on the left. The countdown is edited on the ' +
        'card itself — click it to change the wording around the timer.',
    },
  ],
};
