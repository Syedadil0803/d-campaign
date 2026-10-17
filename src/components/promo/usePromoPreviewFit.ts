'use client';

import { useEffect, useRef, useState } from 'react';
import { useFitZoom } from '@/hooks/useFitZoom';
import type { CampaignConfig } from '@/types/campaign';

interface UsePromoPreviewFitArgs {
  config: CampaignConfig;
  setConfig: (config: CampaignConfig | ((prev: CampaignConfig) => CampaignConfig)) => void;
}

/**
 * Keeping the whole card visible in its frame.
 *
 * Two numbers with one job between them: the card's own width, and a zoom that
 * shrinks it when it is taller than the space it has. Owns both, plus the
 * element it measures — nothing outside sets them except the editors reporting
 * a new width after a text change.
 *
 * Scaling rather than scrolling is the point. A clipped card is a card whose
 * bottom the user never checks, and this is the only preview of what the site
 * will show.
 */
export function usePromoPreviewFit({ config, setConfig }: UsePromoPreviewFitArgs) {
  const promoCardRef = useRef<HTMLDivElement>(null);
  const [cardWidth, setCardWidth] = useState(config.promoCard.cardWidth || 400);
  // Auto-fit: scale the preview card down so a tall card (or a short/zoomed
  // window) always shows the FULL card in the frame — never clipped or scrolled.
  // The frame's padding is p-5, 20px top and bottom.
  const previewZoom = useFitZoom(promoCardRef, [config.promoCard, cardWidth], { inset: 40 });

  // The preview renders at the local `cardWidth`, but only `config.promoCard.cardWidth`
  // gets persisted and published to R2 (and read by the live widget). Those can drift:
  // the width is recomputed into local state on load / text edits / timer changes, yet
  // it's only written back to config on some of those paths. Mirror the displayed width
  // into config here so publishing always saves the number the user actually sees — and
  // the site matches the tool. No-op (stable) once they already agree.
  useEffect(() => {
    if (cardWidth && cardWidth !== config.promoCard.cardWidth) {
      setConfig({ ...config, promoCard: { ...config.promoCard, cardWidth } });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cardWidth]);

  return { promoCardRef, cardWidth, setCardWidth, previewZoom };
}
