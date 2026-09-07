// A faithful, animated replica of the live announcement bar — same styles, the
// full set of (in-window) messages, continuous loop, and constant scroll speed
// as the Announcement tab's preview. Reuses the shared `.animate-scroll-left`
// marquee CSS (globals.css). Rendered full-width, left-to-right.

'use client';

import { useEffect, useRef, useState } from 'react';
import type { CampaignConfig } from '@/types/campaign';
import { getBackgroundStyle } from '@/lib/utils';
import { isAnnouncementInWindow } from '@/lib/announcement/announcementWindow';
import { marqueeDurationSeconds, DEFAULT_PX_PER_SEC } from '@/lib/announcement/scrollSpeed';


export function AnnouncementBarPreview({
  bar,
}: {
  bar: CampaignConfig['announcementBar'];
}): React.ReactElement {
  const [loopCopies, setLoopCopies] = useState(1);
  const [resizeTick, setResizeTick] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const isLoopOn = bar.loop !== false;
  const pxPerSec = bar.speed ?? DEFAULT_PX_PER_SEC;
  const visible = bar.announcements.filter((a) => isAnnouncementInWindow(a.startDate, a.endDate));

  // Recompute on resize: the derived duration tracks the bar's width.
  useEffect(() => {
    let frame = 0;
    const onResize = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => setResizeTick((t) => t + 1));
    };
    window.addEventListener('resize', onResize);
    return () => { window.removeEventListener('resize', onResize); cancelAnimationFrame(frame); };
  }, []);

  // Match the Announcement tab: compute how many copies fill the bar and set a
  // duration that keeps the scroll speed constant (see scrollSpeed.ts).
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const containerWidth = container.clientWidth;
    if (containerWidth <= 0) return;
    const track = container.querySelector('.animate-scroll-left') as HTMLElement | null;
    if (!track) return;

    // Set the paused/playing DOM state before measuring: paused hides all but one
    // copy, so a width read while paused would be too small and resume would race.
    const paused = pxPerSec <= 0;
    container.classList.toggle('announcement-paused', paused);
    track.dataset.pxPerSec = String(pxPerSec); // inspectable in DevTools Elements

    const halfWidth = track.scrollWidth / 2;
    if (halfWidth <= 0) return;

    if (paused) {
      const firstSet = track.firstElementChild as HTMLElement | null;
      const contentWidth = firstSet ? firstSet.scrollWidth : 0;
      container.classList.toggle('paused-fits', contentWidth > 0 && contentWidth <= containerWidth);
      return;
    }
    container.classList.remove('paused-fits');

    if (isLoopOn) {
      const oneSetWidth = halfWidth / loopCopies;
      if (oneSetWidth > 0) {
        const needed = Math.max(1, Math.ceil(containerWidth / oneSetWidth));
        if (needed !== loopCopies) setLoopCopies(needed);
      }
    } else {
      container.style.setProperty('--set-min-width', `${containerWidth}px`);
    }

    const duration = marqueeDurationSeconds(halfWidth, pxPerSec);
    track.style.setProperty('--scroll-duration', `${duration.toFixed(1)}s`);
  }, [bar.announcements, bar.loop, isLoopOn, pxPerSec, loopCopies, resizeTick]);

  if (visible.length === 0) {
    return (
      <div
        className="flex h-10 items-center justify-center text-sm font-medium"
        style={{ background: getBackgroundStyle(bar.style.background), color: bar.style.textColor }}
      >
        <span className="opacity-60">Your announcement will appear here</span>
      </div>
    );
  }

  const totalSets = isLoopOn ? loopCopies * 2 : 2;

  return (
    <div
      ref={containerRef}
      className="announcement-bar-container flex h-10 items-center overflow-hidden text-sm font-medium"
      style={{ background: getBackgroundStyle(bar.style.background), color: bar.style.textColor }}
    >
      <div className="animate-scroll-left">
        {[...Array(totalSets)].map((_, setIndex) => (
          <span
            key={setIndex}
            className="inline-flex items-center justify-center"
            style={!isLoopOn ? { minWidth: 'var(--set-min-width, 100%)' } : undefined}
          >
            {visible.map((a, i) => (
              <span key={`${setIndex}-${i}`} className="inline-block px-4">
                {a.url ? (
                  <a
                    href={a.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="animated-underline inline-block"
                    dangerouslySetInnerHTML={{ __html: a.text }}
                  />
                ) : (
                  <span dangerouslySetInnerHTML={{ __html: a.text }} />
                )}
              </span>
            ))}
          </span>
        ))}
      </div>
    </div>
  );
}
