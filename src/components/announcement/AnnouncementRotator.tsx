'use client';

import { useEffect, useState } from 'react';
import type { Announcement, BarMotion } from '@/types/campaign';
import { dwellSeconds } from '@/lib/announcement/barMotion';

/**
 * One message at a time in the centre of the bar, for the Slide, Roll up and
 * Fade motions. The marquee (Scroll) is drawn elsewhere and is untouched.
 *
 * The outgoing message is kept for one change so it can animate out while the
 * next animates in. Hovering holds the current message, the same as hovering
 * the marquee pauses it.
 */
export function AnnouncementRotator({
  messages,
  motion,
  pxPerSec,
}: {
  messages: Announcement[];
  motion: Exclude<BarMotion, 'scroll'>;
  pxPerSec: number;
}) {
  const [index, setIndex] = useState(0);
  const [previous, setPrevious] = useState<number | null>(null);
  const [hovered, setHovered] = useState(false);
  const seconds = dwellSeconds(pxPerSec);
  const count = messages.length;

  // A shorter list (a message deleted) must not leave the index past the end.
  const current = count ? index % count : 0;

  useEffect(() => {
    if (count < 2 || seconds === 0 || hovered) return;
    const t = setTimeout(() => {
      setPrevious(current);
      setIndex((current + 1) % count);
    }, seconds * 1000);
    return () => clearTimeout(t);
  }, [current, count, seconds, hovered]);

  const render = (i: number, cls: string) => {
    const a = messages[i];
    return (
      <span key={`${i}-${cls}`} className={`absolute inset-0 flex items-center justify-center px-4 ${cls}`}>
        {a.url ? (
          <a
            href={a.url}
            target="_blank"
            rel="noopener noreferrer"
            className="animated-underline inline-block truncate"
            dangerouslySetInnerHTML={{ __html: a.text }}
          />
        ) : (
          <span className="truncate" dangerouslySetInnerHTML={{ __html: a.text }} />
        )}
      </span>
    );
  };

  if (!count) return null;
  return (
    <div
      className="relative h-full w-full overflow-hidden"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {previous !== null && previous !== current && previous < count && render(previous, `bar-${motion}-out`)}
      {render(current, previous === null ? '' : `bar-${motion}-in`)}
    </div>
  );
}
