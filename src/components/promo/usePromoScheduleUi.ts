'use client';

import { useEffect, useRef, useState } from 'react';
import type { CampaignConfig } from '@/types/campaign';
import { isInvalidRange } from '@/lib/dateRange';

interface UsePromoScheduleUiArgs {
  config: CampaignConfig;
  /** Bumped by the page when a save or publish was blocked by the dates. */
  dateErrorPing: number | undefined;
}

/**
 * The schedule's side of the editor: the two calendars, and what happens when
 * the range is wrong.
 *
 * Owns both pickers, the End Date element and the flash that draws the eye to
 * it. The invalid-range rule itself is not here — it is isInvalidRange, shared
 * with the announcement bar, because two editors disagreeing about what counts
 * as a valid range is exactly the kind of split this codebase keeps paying for.
 */
export function usePromoScheduleUi({ config, dateErrorPing }: UsePromoScheduleUiArgs) {
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  const endDateFieldRef = useRef<HTMLDivElement>(null);
  const [dateErrorFlash, setDateErrorFlash] = useState(false);

  // Invalid schedule = both dates set and start is after end. Drives the
  // in-field error, the red End Date border, and the disabled Save/Publish CTA.
  const promoDateRangeInvalid = isInvalidRange(
    config.promoCard.startDate,
    config.promoCard.endDate,
  );

  // Fallback guard: when the page reports a blocked save/publish attempt, scroll
  // the End Date field into view and flash its inline error (no toast).
  useEffect(() => {
    if (!dateErrorPing) return;
    endDateFieldRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setDateErrorFlash(true);
    const t = setTimeout(() => setDateErrorFlash(false), 1200);
    return () => clearTimeout(t);
  }, [dateErrorPing]);

  return {
    showStartDatePicker,
    setShowStartDatePicker,
    showEndDatePicker,
    setShowEndDatePicker,
    endDateFieldRef,
    dateErrorFlash,
    promoDateRangeInvalid,
  };
}
