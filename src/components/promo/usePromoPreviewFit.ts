'use client';

import { useEffect, useRef, useState } from 'react';
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
  const [previewZoom, setPreviewZoom] = useState(1);
  const previewZoomRef = useRef(1);
  useEffect(() => { previewZoomRef.current = previewZoom; }, [previewZoom]);

  useEffect(() => {
    const card = promoCardRef.current;
    const frame = card?.closest('.campaign-card-surface') as HTMLElement | null;
    if (!card || !frame) return;
    let raf = 0;
    const measure = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const applied = previewZoomRef.current || 1;
        // getBoundingClientRect reflects the applied zoom; divide it out to get
        // the card's natural (un-zoomed) height.
        const natural = card.getBoundingClientRect().height / applied;
        const avail = frame.clientHeight - 40; // frame padding (p-5 = 20px each)
        let z = 1;
        if (avail > 0 && natural > avail) z = Math.max(0.5, avail / natural);
        z = Math.round(z * 1000) / 1000;
        setPreviewZoom((prev) => (Math.abs(prev - z) > 0.005 ? z : prev));
      });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(frame);
    // Observe an ancestor too so a window/zoom change that resizes the layout
    // (but not the frame's own box synchronously) still triggers a re-fit.
    const outer = frame.parentElement;
    if (outer) ro.observe(outer);
    window.addEventListener('resize', measure);
    // visualViewport fires on browser zoom (Cmd +/-), which a plain resize
    // listener can miss — this is the case that left the card overflowing.
    const vv = window.visualViewport;
    if (vv) vv.addEventListener('resize', measure);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', measure);
      if (vv) vv.removeEventListener('resize', measure);
      cancelAnimationFrame(raf);
    };

  }, [config.promoCard, cardWidth]);

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
