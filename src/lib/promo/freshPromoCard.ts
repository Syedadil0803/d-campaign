import type { PromoCard } from '@/types/campaign';
import { defaultConfig } from '@/types/campaign';
import { clonePromoCard } from '@/lib/promo/promoCardIdentity';
import { advanceBlankLook } from '@/lib/promo/blankLooks';
import { getISODateWithOffset } from '@/lib/utils';

/**
 * The card a cleared or brand-new canvas starts from.
 *
 * Lived in PromoSection but reads none of its state — every value comes from
 * defaultConfig, the blank-palette rotation and the clock.
 */
export function getFreshPromoCard(): PromoCard {
  return {
    ...clonePromoCard(defaultConfig.promoCard),
    // No design either. Keeping the default gradient meant "clear" cleared
    // the words and left a look nobody had chosen, which then had to be
    // undone before any other could be picked.
    // The next palette in the rotation — see src/lib/blankLooks.ts.
    style: JSON.parse(JSON.stringify(advanceBlankLook())) as PromoCard["style"],
    active: false,
    title: "",
    subtitle: "",
    description: "",
    buttonText: "",
    buttonUrl: "",
    /**
     * Both switches off, not just hidden.
     *
     * A countdown with no dates behind it is a number nobody can act on,
     * and a CTA with no words on it is a coloured bar. Leaving the toggles
     * on and suppressing the output would have made the panel disagree with
     * the card — the switch saying the card has a button while the card
     * shows none. Off is the honest state, and turning either on is then a
     * decision the user makes rather than one they have to undo.
     */
    showTimer: false,
    showButton: false,
    /**
     * Starts today, ends whenever the user decides.
     *
     * "From today" is the safe assumption — a campaign being built now is
     * one meant to run now — while the end is a real decision nobody can
     * make on the user's behalf. Leaving it blank is also what keeps the
     * countdown off: it switches on once the schedule is complete, so the
     * end date is both the missing fact and the trigger.
     */
    startDate: getISODateWithOffset(0),
    endDate: "",
    timerText: "Ends In {timer}",
  };
}
