import { Palette, Type, Wand2 } from 'lucide-react';
import type { PromoCard } from '@/types/campaign';
import type { AiMode, PromoBrief } from '@/lib/promo/promoAiPrompt';

/**
 * The guided brief: the questions AI is asked on the user's behalf, the modes
 * that decide what it may touch, and the rules for the answer chips.
 *
 * Data and pure functions, so they sat in PromoBuildPanel only because that is
 * where they are read. None of it touches component state.
 */

/** Does the card already carry the user's own copy? */
export function hasCopy(card: PromoCard): boolean {
  const plain = (h?: string) => String(h ?? '').replace(/<[^>]*>/g, '').trim();
  return Boolean(plain(card.title) || plain(card.subtitle) || plain(card.description));
}

/**
 * The first thing asked, not a setting buried under the brief: deciding what
 * AI may touch is the reason someone opens this panel, and it changes what the
 * brief should even say.
 */
export const MODES: {
  value: AiMode;
  label: string;
  /**
   * Two hints per mode: one for a card that already has the user's content and
   * a chosen design, one for a brand-new card that has neither. "Keeps the
   * design you picked" is a lie on a first card — nothing has been picked yet.
   */
  hint: string;
  newCardHint: string;
  icon: typeof Palette;
}[] = [
  {
    value: 'design',
    label: 'Colors only',
    hint: 'Your content stays exactly as written.',
    newCardHint: 'Sets a palette now; you write the content yourself.',
    icon: Palette,
  },
  {
    // Not "Copy only": this panel has a "Copy prompt" button, and the two
    // readings collide. "Content" is also what the editor calls this column.
    value: 'copy',
    label: 'Content only',
    hint: 'Keeps the design you picked.',
    newCardHint: "Keeps the card's current look.",
    icon: Type,
  },
  {
    value: 'both',
    label: 'Content and colors',
    hint: 'AI writes the content and proposes a palette.',
    newCardHint: 'AI writes the content and proposes a palette.',
    icon: Wand2,
  },
];

/**
 * One question per step. `chips` are one-tap answers that fill the field —
 * most campaigns can be briefed without typing a word, and the field stays
 * editable for anything the chips don't cover.
 */
export interface BriefQuestion {
  key: keyof PromoBrief;
  title: string;
  /** What a good answer contains — a vague question produces a vague brief. */
  help: string;
  placeholder: string;
  chips?: string[];
  /**
   * 'multi' lets the answers stack — "Bold, Premium, Urgent" describes a voice
   * far better than any single word, and a brief that says all three gets copy
   * that reads that way. 'single' is for questions with one true answer (is
   * there a countdown, where does the button go), where a second pick replaces
   * the first rather than contradicting it.
   */
  chipMode?: 'single' | 'multi';
  /**
   * Multi-select chips that mean "and nothing else" — picking one clears the
   * rest, and picking another chip clears it. "You choose" alongside "Warm
   * tones" is an instruction that argues with itself.
   */
  exclusiveChips?: string[];
  optional?: boolean;
}

export const CONTENT_QUESTIONS: BriefQuestion[] = [
  {
    key: 'offer',
    title: 'What’s the offer, and what’s it on?',
    help: 'The product or collection, plus the deal — a discount, a bundle, free delivery, a code. Tap what applies, then add your own detail.',
    placeholder: '20% off all handwoven rugs, plus free UK delivery. Code RUGS20.',
    chipMode: 'multi',
    chips: [
      'Percentage off',
      'Buy one get one',
      'Free delivery',
      'Clearance',
      'New arrivals',
      'Members only',
      'Discount code',
    ],
  },
  {
    key: 'tone',
    title: 'Who are you selling to, and how should it read?',
    help: 'Your shoppers, and the voice. Pick as many words as fit — “Bold, Premium, Urgent” shapes the copy more than any one of them alone.',
    placeholder: 'Returning customers who bought last winter. Warm, confident, not pushy.',
    chipMode: 'multi',
    // Eight, not ten: a tenth chip wrapped to another row and pushed the step
    // past the panel's height, and this panel never scrolls. 'Warm' and
    // 'Confident' went — the nearest neighbours of 'Friendly' and 'Bold'.
    chips: [
      'Bold',
      'Elegant',
      'Playful',
      'Urgent',
      'Friendly',
      'Premium',
      'Minimal',
      'No hard sell',
    ],
  },
  {
    key: 'timer',
    title: 'Should the card show a countdown?',
    help: 'Your dates are already set — this is only the wording that sits around the timer.',
    placeholder: 'Yes, with “Offer ends in”',
    chips: [
      'Yes — “Ends in”',
      'Yes — “Hurry, ends in”',
      'Yes — “Only … left”',
      'No countdown',
    ],
  },
  {
    key: 'cta',
    title: 'Where should the button send people?',
    help: 'A shop link, a WhatsApp number, or plain text with no link. It can be left off.',
    placeholder: 'My sale page: example.com/sale',
    chips: ['Link to my shop', 'WhatsApp me', 'Text only, no link', 'No button'],
  },
];

export const COLOR_QUESTION: BriefQuestion = {
  key: 'colors',
  title: 'Which colors should it use?',
  help: 'Brand colors (hex codes help), a season or a mood — or hand the palette to AI. Stack as many as you like.',
  placeholder: 'Brand green #0f766e with warm cream, dark text',
  chipMode: 'multi',
  exclusiveChips: ['You choose', 'Match my template'],
  chips: [
    'You choose',
    'Match my template',
    'Warm tones',
    'Cool tones',
    'High contrast',
    'Dark background',
    'Light background',
    'Gradient',
    'Festive',
  ],
};

export const EXTRA_QUESTION: BriefQuestion = {
  key: 'extra',
  title: 'Anything it must say — or must avoid?',
  help: 'Optional. Claims you can’t make, words to steer clear of, a phrase you want included.',
  placeholder: 'Don’t say “cheap”. Do mention free 30-day returns.',
  optional: true,
  chipMode: 'multi',
  chips: [
    'Mention free returns',
    'Avoid the word “cheap”',
    'No pushy language',
    'Keep it very short',
    'Include the code',
    'Mention limited stock',
  ],
};

/** Answers are stored as one readable phrase — chips are just a fast way to build it. */
export function answerParts(answer: string | undefined): string[] {
  return (answer ?? '')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
}

export function sameChip(a: string, b: string): boolean {
  return a.toLowerCase() === b.toLowerCase();
}

export function chipIsOn(answer: string | undefined, chip: string, q: BriefQuestion): boolean {
  if ((q.chipMode ?? 'single') === 'single') return (answer ?? '').trim() === chip;
  return answerParts(answer).some((part) => sameChip(part, chip));
}

/**
 * What the answer becomes when a chip is tapped.
 *
 * Chips used to overwrite the whole answer, so a second tap threw the first one
 * away — you could say "Bold" or "Premium" but never both, and anything typed
 * was wiped by the next tap. Multi questions now add and remove instead, and
 * keep whatever was typed alongside them.
 */
export function toggleChip(answer: string | undefined, chip: string, q: BriefQuestion): string {
  const on = chipIsOn(answer, chip, q);
  if ((q.chipMode ?? 'single') === 'single') return on ? '' : chip;
  if (q.exclusiveChips?.some((x) => sameChip(x, chip))) {
    // "You choose" means exactly that — it replaces the rest.
    return on ? '' : chip;
  }
  const kept = answerParts(answer).filter(
    (part) => !q.exclusiveChips?.some((x) => sameChip(x, part)),
  );
  const next = on
    ? kept.filter((part) => !sameChip(part, chip))
    : [...kept, chip];
  return next.join(', ');
}
