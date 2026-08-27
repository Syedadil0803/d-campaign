// Type-only, so types/campaign.ts can import FIRST_BLANK_LOOK back from here
// without a runtime circular import. Type imports are erased at compile time.
import type { PromoCard } from '@/types/campaign';

type PromoStyle = PromoCard['style'];

/* ------------------------------------------------------------------ *
 *  THE BLANK CANVAS PALETTES — edit these by hand
 * ------------------------------------------------------------------ *
 *
 *  A blank card wears one of these. The rotation moves on when the canvas is
 *  cleared, and once each time the tool is opened, wrapping round at the end.
 *
 *  TO CHANGE A COLOUR
 *    Edit the hex values below. `from` and `to` are the two ends of the
 *    background gradient; `title`, `subtitle` and `body` are the three text
 *    colours, darkest at the top.
 *
 *  TO ADD ONE
 *    Copy any block, change the values, and give it a new `name`. Nothing
 *    else needs updating — the rotation, the authorship checks and the
 *    "is this card blank?" test all read this list.
 *
 *  TO REMOVE ONE
 *    Delete its block. Do NOT delete the first one: it must stay in step
 *    with defaultConfig.promoCard.style in types/campaign.ts, which is what
 *    a brand-new card starts from.
 *
 *  TO STOP THE ROTATION ALTOGETHER
 *    Leave a single palette in the list. Everything then behaves as it did
 *    before the rotation existed.
 * ------------------------------------------------------------------ */

interface BlankPalette {
  name: string;
  from: string;
  to: string;
  title: string;
  subtitle: string;
  body: string;
  button: string;
}

const PALETTES: BlankPalette[] = [
  {
    name: 'Periwinkle → orchid',
    from: '#a5b4fc',
    to: '#f0abfc',
    title: '#312e81',
    subtitle: '#4c1d95',
    body: '#581c87',
    button: '#6d28d9',
  },
  {
    name: 'Lilac → blush',
    from: '#ddd6fe',
    to: '#fbcfe8',
    title: '#4c1d95',
    subtitle: '#9d174d',
    body: '#52525b',
    button: '#9d174d',
  },
  {
    name: 'Mint → sky',
    from: '#a7f3d0',
    to: '#bae6fd',
    title: '#064e3b',
    subtitle: '#0f766e',
    body: '#334155',
    button: '#0f766e',
  },
  {
    name: 'Peach → rose',
    from: '#fed7aa',
    to: '#fecdd3',
    title: '#7c2d12',
    subtitle: '#9f1239',
    body: '#57534e',
    button: '#9f1239',
  },
  {
    name: 'Aqua → lime',
    from: '#99f6e4',
    to: '#d9f99d',
    title: '#134e4a',
    subtitle: '#3f6212',
    body: '#3f3f46',
    button: '#3f6212',
  },
];

/** Fields carry no background of their own — the card's gradient shows through. */
const CLEAR = {
  type: 'solid' as const,
  startColor: 'transparent',
  endColor: 'transparent',
  direction: 'to right' as const,
  midpoint: 50,
};

function toStyle(p: BlankPalette): PromoStyle {
  return {
    position: 'bottom-right',
    background: {
      type: 'linear',
      startColor: p.from,
      endColor: p.to,
      direction: 'to bottom right',
      midpoint: 50,
    },
    textColor: p.body,
    titleStyle: { background: CLEAR, textColor: p.title, textAlign: 'left' },
    subheadingStyle: { background: CLEAR, textColor: p.subtitle, textAlign: 'left' },
    descriptionStyle: { background: CLEAR, textColor: p.body, textAlign: 'left' },
    // Body colour, not the subtitle's. defaultConfig uses the body colour here,
    // and the two must produce byte-identical styles — isBlankLook compares
    // whole signatures, so a single mismatched hex means a freshly loaded card
    // matches no palette at all and the skeleton loses its outlines.
    dateStyle: { background: CLEAR, textColor: p.body, textAlign: 'left' },
    buttonStyle: {
      background: { type: 'solid', startColor: p.button, endColor: p.button, direction: 'to right', midpoint: 50 },
      textColor: '#ffffff',
      textAlign: 'center',
    },
  } as PromoStyle;
}

export const BLANK_LOOKS: PromoStyle[] = PALETTES.map(toStyle);

/** The one a brand-new card starts from, and the one types/campaign.ts mirrors. */
export const FIRST_BLANK_LOOK: PromoStyle = BLANK_LOOKS[0];

const COUNT_KEY = 'campaign-admin:blank-count';
const VISIT_KEY = 'campaign-admin:blank-visit-counted';

function paletteAt(n: number) {
  return BLANK_LOOKS[((n % BLANK_LOOKS.length) + BLANK_LOOKS.length) % BLANK_LOOKS.length];
}

function readCount(): number {
  try {
    return Number(localStorage.getItem(COUNT_KEY)) || 0;
  } catch {
    return 0;
  }
}

/**
 * The palette a blank card should wear right now.
 *
 * Read, not advanced. Every route that rebuilds a blank card — opening the
 * tool, creating a campaign, the reset after saving or publishing — uses this,
 * so they all agree with each other within a session.
 */
export function currentBlankLook(): PromoStyle {
  if (typeof window === 'undefined') return BLANK_LOOKS[0];
  return paletteAt(readCount());
}

/**
 * Move to the next palette. Called when the user clears the canvas.
 *
 * Clearing twice in a row gives two different colours, which is the only way
 * the rotation is visible without closing the tool.
 */
export function advanceBlankLook(): PromoStyle {
  if (typeof window === 'undefined') return BLANK_LOOKS[0];
  const next = readCount() + 1;
  try {
    localStorage.setItem(COUNT_KEY, String(next));
  } catch {
    return BLANK_LOOKS[0];
  }
  return paletteAt(next);
}

/**
 * Move on once per visit, then hand back the palette for it.
 *
 * Called when the tool loads. Without this the rotation only ever moved on a
 * clear, so closing the tool and coming back showed the same colour every
 * time — indistinguishable from it being broken.
 *
 * The sessionStorage guard is what keeps a refresh from advancing it, which
 * would change the canvas colour under someone mid-edit.
 */
export function blankLookForVisit(): PromoStyle {
  if (typeof window === 'undefined') return BLANK_LOOKS[0];
  try {
    if (!sessionStorage.getItem(VISIT_KEY)) {
      sessionStorage.setItem(VISIT_KEY, '1');
      return advanceBlankLook();
    }
  } catch {
    return BLANK_LOOKS[0];
  }
  return currentBlankLook();
}

/**
 * Forget that this visit has been counted.
 *
 * Called when signing out. sessionStorage survives a logout — same tab, same
 * session — so without this, signing out and back in kept the palette it
 * already had, and the one moment a user most expects a fresh start looked
 * like nothing had happened.
 */
export function forgetVisit(): void {
  try {
    sessionStorage.removeItem(VISIT_KEY);
  } catch {
    // Nothing to do; the next new tab advances it anyway.
  }
}
