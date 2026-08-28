
/**
 * The cards Template Hub offers, as data.
 *
 * In lib rather than beside the component that draws them, because a page, a
 * hook and three other components read this list to answer "did the user
 * write this, or did we hand it to them?" — and a hook importing from a
 * component to find that out had the layering upside down.
 *
 * Each entry is a design plus sample copy. The copy is only an example:
 * withIndustryCopy swaps it for the chosen trade's wording, and the design
 * stays.
 */

import { DEEP_MODERN_TEMPLATES } from '@/lib/promo/templatesDeepModern';
import { WARM_LOUD_TEMPLATES } from '@/lib/promo/templatesWarmLoud';
import { LIGHT_TEMPLATES } from '@/lib/promo/templatesLightBackgrounds';

/**
 * The twelve cards Template Hub offers, in the order it shows them.
 *
 * Concatenated rather than sorted: the order is the browse experience, and the
 * three groups are contiguous in it.
 */
export const sampleTemplates = [
  ...DEEP_MODERN_TEMPLATES,
  ...WARM_LOUD_TEMPLATES,
  ...LIGHT_TEMPLATES,
];
