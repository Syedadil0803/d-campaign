'use client';

import { isValidElement, useEffect, useState, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

/** Seconds between automatic slides. Change this to slow it down or speed it up. */
const AUTO_SLIDE_SECONDS = 3;

/**
 * The dashboard's lifecycle cards in one row: two visible at a time (one on
 * narrow screens), the rest a slide away (Broadcasts, Smart Card, then Video
 * Story). Every card in the
 * row stretches to the tallest one, so they always line up.
 */
export function DashboardCardsCarousel({ cards }: { cards: ReactNode[] }) {
  // Two cards side by side from the md breakpoint, one below it.
  const [wide, setWide] = useState(true);
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)');
    const update = () => setWide(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);
  const visible = wide ? 2 : 1;
  const last = Math.max(0, cards.length - visible);
  const [rawStart, setStart] = useState(0);
  // Going from one-up to two-up can leave the position past the new end.
  const start = Math.min(rawStart, last);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  // Someone who asked the system for less motion gets no auto-slide at all —
  // the arrows and dots still move it on request.
  const [reduceMotion, setReduceMotion] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduceMotion(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  // Moves on by itself every AUTO_SLIDE_SECONDS, back to the start after the last step.
  // Held while the pointer is over the cards or keyboard focus is inside them,
  // so it never slides away from something being read or clicked — a focused
  // button sliding out of view lands in an inert card. Restarts the wait after
  // a manual move.
  useEffect(() => {
    if (last === 0 || hovered || focused || reduceMotion) return;
    const t = setTimeout(() => setStart(start >= last ? 0 : start + 1), AUTO_SLIDE_SECONDS * 1000);
    return () => clearTimeout(t);
  }, [start, last, hovered, focused, reduceMotion]);

  return (
    <section
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      // Focus moving between two controls inside still counts as inside.
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocused(false);
      }}
    >
      <div className="overflow-hidden px-1 pb-2">
        <div
          className="flex items-stretch gap-6 transition-transform duration-300 ease-out"
          // One step = one card plus the gap between cards.
          style={{ transform: `translateX(calc(-${start} * ((100% - ${visible - 1} * 1.5rem) / ${visible} + 1.5rem)))` }}
        >
          {cards.map((card, i) => (
            <div
              // The card's own key where it has one, so a card added or
              // removed does not hand its neighbour's state to another card.
              key={isValidElement(card) && card.key != null ? card.key : i}
              className="flex w-full shrink-0 md:w-[calc((100%-1.5rem)/2)] [&>*]:w-full"
              aria-hidden={i < start || i >= start + visible}
              inert={i < start || i >= start + visible}
            >
              {card}
            </div>
          ))}
        </div>
      </div>

      {last > 0 && (
        <div className="mt-2 flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => setStart(Math.max(0, start - 1))}
            disabled={start === 0}
            aria-label="Previous cards"
            className="grid h-7 w-7 place-items-center rounded-full border border-border text-on-surface-variant transition-colors hover:border-primary/60 hover:text-primary disabled:opacity-30"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          {Array.from({ length: last + 1 }, (_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setStart(i)}
              aria-label={visible === 1 ? `Show card ${i + 1}` : `Show cards ${i + 1} and ${i + 2}`}
              aria-pressed={i === start}
              className={`h-2 rounded-full transition-all ${i === start ? 'w-5 bg-primary' : 'w-2 bg-on-surface-variant/30 hover:bg-on-surface-variant/60'}`}
            />
          ))}
          <button
            type="button"
            onClick={() => setStart(Math.min(last, start + 1))}
            disabled={start === last}
            aria-label="Next cards"
            className="grid h-7 w-7 place-items-center rounded-full border border-border text-on-surface-variant transition-colors hover:border-primary/60 hover:text-primary disabled:opacity-30"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </section>
  );
}
