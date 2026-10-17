'use client';

import { useEffect, useState, type RefObject } from 'react';

/**
 * Keeping a preview fully visible in its frame (`.campaign-card-surface`):
 * the zoom that shrinks the element when it is taller than the space it
 * has, never below `min`. Scaling rather than scrolling, so the bottom of the
 * preview is never clipped. Re-measures on frame and window resizes and on
 * browser zoom (visualViewport), which a plain resize listener can miss.
 *
 * Shared by the Smart Card preview and the Video Story preview.
 *
 * @param inset          the frame's vertical padding, taken off its height
 * @param naturalHeight  the element's full height when known in advance (the
 *                       Video Story widget's is fixed); measured otherwise
 * @param deps           values that change the element's natural height
 */
export function useFitZoom(
  ref: RefObject<HTMLElement | null>,
  deps: readonly unknown[],
  { inset = 40, min = 0.5, naturalHeight }: { inset?: number; min?: number; naturalHeight?: number } = {},
): number {
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    const el = ref.current;
    const frame = el?.closest('.campaign-card-surface') as HTMLElement | null;
    if (!el || !frame) return;
    let raf = 0;
    const measure = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        // offsetHeight is the element's own, un-zoomed height. Dividing the
        // zoomed size by the last zoom set drifted whenever a measure ran
        // between a zoom change and its re-render, and settled back on 1.
        const natural = naturalHeight ?? el.offsetHeight;
        const avail = frame.clientHeight - inset;
        let z = 1;
        if (avail > 0 && natural > avail) z = Math.max(min, avail / natural);
        z = Math.round(z * 1000) / 1000;
        setZoom((prev) => (Math.abs(prev - z) > 0.005 ? z : prev));
      });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(frame);
    // An ancestor too, so a layout change that resizes the frame late still re-fits.
    const outer = frame.parentElement;
    if (outer) ro.observe(outer);
    window.addEventListener('resize', measure);
    const vv = window.visualViewport;
    if (vv) vv.addEventListener('resize', measure);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', measure);
      if (vv) vv.removeEventListener('resize', measure);
      cancelAnimationFrame(raf);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return zoom;
}
