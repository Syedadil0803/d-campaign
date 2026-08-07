// A faithful, animated replica of the live announcement bar — same styles, the
// full set of (in-window) messages, continuous loop, and constant scroll speed
// as the Announcement tab's preview. Reuses the shared `.animate-scroll-left`
// marquee CSS (globals.css). Rendered full-width, left-to-right.

'use client';

import { useEffect, useRef, useState } from 'react';
import type { CampaignConfig } from '@/types/campaign';
import { getBackgroundStyle } from '@/lib/utils';

// Constant visual speed regardless of how much content there is.
const SCROLL_SPEED_PX_PER_SEC = 60;

function isInWindow(startDate?: string, endDate?: string): boolean {
  if (!startDate && !endDate) return true;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = startDate ? new Date(startDate) : new Date(0);
  start.setHours(0, 0, 0, 0);
  const end = endDate ? new Date(endDate) : new Date(8640000000000000);
  end.setHours(23, 59, 59, 999);
  return today >= start && today <= end;
}

export function AnnouncementBarPreview({
  bar,
}: {
  bar: CampaignConfig['announcementBar'];
}): React.ReactElement {
  const [loopCopies, setLoopCopies] = useState(1);
  const containerRef = useRef<HTMLDivElement>(null);

  const isLoopOn = bar.loop !== false;
  const visible = bar.announcements.filter((a) => isInWindow(a.startDate, a.endDate));

  // Match the Announcement tab: compute how many copies fill the bar and set a
  // duration proportional to content width so the scroll speed stays constant.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const containerWidth = container.clientWidth;
    if (containerWidth <= 0) return;
    const track = container.querySelector('.animate-scroll-left') as HTMLElement | null;
    if (!track) return;
    const halfWidth = track.scrollWidth / 2;
    if (halfWidth <= 0) return;

    if (isLoopOn) {
      const oneSetWidth = halfWidth / loopCopies;
      if (oneSetWidth > 0) {
        const needed = Math.max(1, Math.ceil(containerWidth / oneSetWidth));
        if (needed !== loopCopies) setLoopCopies(needed);
      }
    } else {
      container.style.setProperty('--set-min-width', `${containerWidth}px`);
    }

    const duration = Math.max(5, halfWidth / SCROLL_SPEED_PX_PER_SEC);
    track.style.setProperty('--scroll-duration', `${duration.toFixed(1)}s`);
  }, [bar.announcements, bar.loop, isLoopOn, loopCopies]);

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
