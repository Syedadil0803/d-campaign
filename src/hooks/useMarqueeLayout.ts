'use client';

import { useEffect, useState, type RefObject } from 'react';
import { marqueeDurationSeconds } from '@/lib/announcement/scrollSpeed';

/**
 * Lays out an announcement marquee inside `containerRef`: how many copies fill
 * the bar when looping, a full-width single pass otherwise, and the scroll
 * duration for the chosen px/sec (0 = paused). Shared by the editor preview and
 * the dashboard bar so the two can't drift apart.
 *
 * `contentKey` must change whenever what the bar shows changes; the layout is
 * re-measured then, and on window resize. Returns the number of copies to draw.
 */
export function useMarqueeLayout(
  containerRef: RefObject<HTMLDivElement | null>,
  { loop, pxPerSec, contentKey }: { loop: boolean; pxPerSec: number; contentKey: string },
): number {
  const [loopCopies, setLoopCopies] = useState(1);
  const [resizeTick, setResizeTick] = useState(0);

  useEffect(() => {
    let frame = 0;
    const onResize = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => setResizeTick((t) => t + 1));
    };
    window.addEventListener('resize', onResize);
    return () => { window.removeEventListener('resize', onResize); cancelAnimationFrame(frame); };
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const containerWidth = container.clientWidth;
    if (containerWidth <= 0) return;
    const track = container.querySelector('.animate-scroll-left') as HTMLElement | null;
    if (!track) return;

    // Set the paused/playing state before measuring: paused hides all but one
    // copy, so a width read while still paused would be too small.
    const paused = pxPerSec <= 0;
    container.classList.toggle('announcement-paused', paused);
    track.dataset.pxPerSec = String(pxPerSec); // inspectable in DevTools

    const halfWidth = track.scrollWidth / 2;
    if (halfWidth <= 0) return;

    if (paused) {
      const firstSet = track.firstElementChild as HTMLElement | null;
      const contentWidth = firstSet ? firstSet.scrollWidth : 0;
      container.classList.toggle('paused-fits', contentWidth > 0 && contentWidth <= containerWidth);
      return;
    }
    container.classList.remove('paused-fits');

    if (loop) {
      const oneSetWidth = halfWidth / loopCopies;
      if (oneSetWidth <= 0) return;
      const needed = Math.max(1, Math.ceil(containerWidth / oneSetWidth));
      if (needed !== loopCopies) setLoopCopies(needed);
    } else {
      container.style.setProperty('--set-min-width', `${containerWidth}px`);
      setLoopCopies(1);
    }

    const duration = marqueeDurationSeconds(halfWidth, pxPerSec);
    track.style.setProperty('--scroll-duration', `${duration.toFixed(1)}s`);
  }, [containerRef, contentKey, loop, pxPerSec, loopCopies, resizeTick]);

  return loopCopies;
}
