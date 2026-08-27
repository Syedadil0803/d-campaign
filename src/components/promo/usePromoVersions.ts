'use client';

import { useEffect, useState } from 'react';
import type { PromoCard } from '@/types/campaign';
import { listVersions, type PromoVersion } from '@/lib/promo/promoVersions';
import { promoCardsEqual } from '@/lib/promo/promoCardIdentity';

interface UsePromoVersionsArgs {
  /** The card on the canvas — decides which saved variant reads as Live. */
  promoCard: PromoCard;
  onSelectedVersionChange?: (versionId: string | null) => void;
  /** Opening the list refreshes it; closing it cancels a pending delete. */
  showVersionsPopup: boolean;
}

/**
 * The saved variants: the list, which one the editor is holding, and the one
 * queued for deletion.
 *
 * All three exist for this and nothing else, and the effects below only
 * maintain them, so this is a boundary rather than a pile of arguments.
 */
export function usePromoVersions({
  promoCard,
  onSelectedVersionChange,
  showVersionsPopup,
}: UsePromoVersionsArgs) {
  const [versions, setVersions] = useState<PromoVersion[]>([]);
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  // On mount: load saved versions. The saved config remains the source of truth.
  useEffect(() => {
    listVersions().then((list) => {
      setVersions(list);
    });
  }, []);

  /**
   * Keeps the "Live" marker pointed at the variant the editor is actually
   * holding — including when that's none of them.
   *
   * This used to `return` early on no match, so the marker stayed on whatever
   * it last matched. Edit the card away from the published one and a variant
   * still claimed to be Live, which then fed real damage: deleting that variant
   * checks `selectedVersionId === id && active` to decide whether to pull the
   * campaign off the website, so a stale marker could take the site down (or
   * fail to) for the wrong card.
   */
  useEffect(() => {
    const matchingVersion = [...versions]
      .reverse()
      .find((version) => promoCardsEqual(version.promoCard, promoCard));
    const nextId = matchingVersion?.id ?? null;
    setSelectedVersionId((prev) => (prev === nextId ? prev : nextId));
    onSelectedVersionChange?.(nextId);
  }, [promoCard, versions, onSelectedVersionChange]);

  // Refresh the list whenever the popup is opened (keeps it current).
  useEffect(() => {
    if (!showVersionsPopup) {
      setPendingDeleteId(null);
      return;
    }
    let active = true;
    listVersions().then((list) => {
      if (active) setVersions(list);
    });
    return () => {
      active = false;
    };
  }, [showVersionsPopup]);

  return {
    versions,
    setVersions,
    selectedVersionId,
    setSelectedVersionId,
    pendingDeleteId,
    setPendingDeleteId,
  };
}
