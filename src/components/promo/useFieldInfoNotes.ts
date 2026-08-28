'use client';

import { useState } from 'react';
import { readHiddenFieldInfos, hideFieldInfo } from '@/lib/promo/fieldInfoNotes';

/**
 * The one-off notes explaining what each text field is for.
 *
 * Which note is open, and which the user has already dismissed. Dismissals are
 * seeded from storage on first render rather than in an effect, so a note the
 * user waved away last week never flashes up again on the way to being hidden.
 */
export function useFieldInfoNotes() {
  const [fieldInfoPopup, setFieldInfoPopup] =
    useState<'title' | 'subtitle' | 'description' | null>(null);
  const [hiddenFieldInfos, setHiddenFieldInfos] =
    useState<Set<string>>(readHiddenFieldInfos);

  /** Closes the note and remembers not to offer it again. */
  function dismissFieldInfo(field: string) {
    setFieldInfoPopup(null);
    setHiddenFieldInfos((current) => hideFieldInfo(current, field));
  }

  return { fieldInfoPopup, setFieldInfoPopup, hiddenFieldInfos, dismissFieldInfo };
}
