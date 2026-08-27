'use client';

import { measureOverflow, type MeasuredField } from '@/lib/promo/promoMeasure';

/**
 * "One more character and this stops fitting."
 *
 * Written out inline three times — title, subtitle, description — and not at
 * all for the button, which is how the CTA ended up as the one field that
 * capped silently.
 *
 * It asks the question by adding a character and measuring: a field is at its
 * limit when the text it holds fits and the same text plus one more does not.
 */
export function FieldLimitNote({
  html,
  field,
}: {
  html: string | undefined;
  field: MeasuredField;
}) {
  if (!html) return null;
  if (!measureOverflow(html + 'x', field)) return null;
  return (
    <p className="mt-1.5 text-[11px] font-semibold text-amber-600 dark:text-amber-400 animate-pulse">
      ⚠️ Field limit reached
    </p>
  );
}
