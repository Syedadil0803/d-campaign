'use client';

import { useState } from 'react';
import type { PromoCard } from '@/types/campaign';

/**
 * Which of the editor's content popups is open.
 *
 * Takes nothing, like usePromoDropdowns. These are the popups that hold
 * content rather than a menu — Template Hub, My Published, My Draft — plus the
 * two small pieces of state that belong to the draft one and the flag that
 * tells Template Hub which header to wear.
 */
export function usePromoPopupFlags() {
  const [showVersionsPopup, setShowVersionsPopup] = useState(false);
  const [showTemplatesPopup, setShowTemplatesPopup] = useState(false);
  /**
   * Template Hub opened from the build flow wears a different header. Reset by
   * the toolbar, or it keeps the build-flow header for good once used.
   */
  const [templatesFromBuild, setTemplatesFromBuild] = useState(false);

  const [showDraftPopup, setShowDraftPopup] = useState(false);
  const [draftPopupCard, setDraftPopupCard] = useState<PromoCard | null>(null);
  const [draftPopupLoading, setDraftPopupLoading] = useState(false);
  const [confirmDeleteDraft, setConfirmDeleteDraft] = useState(false);

  return {
    showVersionsPopup,
    setShowVersionsPopup,
    showTemplatesPopup,
    setShowTemplatesPopup,
    templatesFromBuild,
    setTemplatesFromBuild,
    showDraftPopup,
    setShowDraftPopup,
    draftPopupCard,
    setDraftPopupCard,
    draftPopupLoading,
    setDraftPopupLoading,
    confirmDeleteDraft,
    setConfirmDeleteDraft,
  };
}
