// A faithful, animated replica of the live announcement bar — same styles, the
// full set of (in-window) messages, continuous loop, and constant scroll speed
// as the Announcement tab's preview. Reuses the shared `.animate-scroll-left`
// marquee CSS (globals.css). Rendered full-width, left-to-right.

'use client';

import { useRef } from 'react';
import type { CampaignConfig } from '@/types/campaign';
import { getBackgroundStyle } from '@/lib/utils';
import { isAnnouncementInWindow } from '@/lib/announcement/announcementWindow';
import { DEFAULT_PX_PER_SEC } from '@/lib/announcement/scrollSpeed';
import { useMarqueeLayout } from '@/hooks/useMarqueeLayout';


export function AnnouncementBarPreview({
  bar,
}: {
  bar: CampaignConfig['announcementBar'];
}): React.ReactElement {
  const containerRef = useRef<HTMLDivElement>(null);

  const isLoopOn = bar.loop !== false;
  const pxPerSec = bar.speed ?? DEFAULT_PX_PER_SEC;
  const visible = bar.announcements.filter((a) => isAnnouncementInWindow(a.startDate, a.endDate));

  const loopCopies = useMarqueeLayout(containerRef, {
    loop: isLoopOn,
    pxPerSec,
    contentKey: visible.map((a) => a.text).join('\u0001'),
  });

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
