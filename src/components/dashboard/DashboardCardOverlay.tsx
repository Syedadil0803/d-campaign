'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';

interface DashboardCardOverlayProps {
  /** The summary tile: the card grows out of it, shrinks back into it, and focus returns to it. */
  tile: HTMLElement;
  /** The card's name, read out as the dialog's label. */
  title: string;
  /**
   * A popup (confirm, preview, schedule) stands on top. Esc, outside clicks
   * and the Tab loop belong to that popup then, not to this overlay.
   */
  suspended: boolean;
  onClosed: () => void;
  children: ReactNode;
}

const OPEN_MS = 250;
// Leaving is faster than arriving: the user has already decided to go.
const CLOSE_MS = 170;

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * The full card, shown over the dashboard when its summary tile is clicked.
 *
 * FLIP: the panel is laid out at its final place, then transformed back onto
 * the tile's rectangle and animated to none — so it grows out of the tile
 * instead of appearing from nowhere, and shrinks back into it on close.
 * z-40, one below DashboardPopups' z-50, so a Stop / Go on air confirm opened
 * from inside the card stacks above it.
 */
export function DashboardCardOverlay({ tile, title, suspended, onClosed, children }: DashboardCardOverlayProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const scrimRef = useRef<HTMLDivElement>(null);
  const closing = useRef(false);

  const tileTransform = useCallback(() => {
    // Measure the panel's real resting place: a running animation would
    // otherwise be measured as the start point (StrictMode's second effect
    // run, or closing mid-open, both hit this).
    panelRef.current!.getAnimations().forEach((a) => a.cancel());
    const from = tile.getBoundingClientRect();
    const to = panelRef.current!.getBoundingClientRect();
    return `translate(${from.left - to.left}px, ${from.top - to.top}px) scale(${from.width / to.width}, ${from.height / to.height})`;
  }, [tile]);

  // Layout effect: measure and start the animation before the first paint, so
  // the card is never seen at full size for a frame.
  useLayoutEffect(() => {
    panelRef.current!.focus();
    if (reducedMotion()) return;
    const easing = 'cubic-bezier(0.2, 0, 0, 1)';
    panelRef.current!.animate([{ transform: tileTransform(), opacity: 0.4 }, { transform: 'none', opacity: 1 }], {
      duration: OPEN_MS,
      easing,
    });
    scrimRef.current!.animate([{ opacity: 0 }, { opacity: 1 }], { duration: OPEN_MS, easing });
  }, [tileTransform]);

  const close = useCallback(() => {
    if (closing.current) return;
    closing.current = true;
    const done = () => {
      onClosed();
      tile.focus();
    };
    const panel = panelRef.current;
    if (!panel || reducedMotion()) return done();
    const opts = { duration: CLOSE_MS, easing: 'ease-in', fill: 'forwards' } as const;
    scrimRef.current?.animate([{ opacity: 1 }, { opacity: 0 }], opts);
    panel.animate([{ transform: 'none', opacity: 1 }, { transform: tileTransform(), opacity: 0 }], opts).finished.then(done, done);
  }, [onClosed, tile, tileTransform]);

  // The page behind must not scroll while the card is up.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  useEffect(() => {
    if (suspended) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        close();
        return;
      }
      // Keep Tab inside the dialog — aria-modal says the page behind is out of reach.
      if (e.key !== 'Tab' || !panelRef.current) return;
      const focusable = panelRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || active === panelRef.current)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [suspended, close]);

  return (
    <div className="fixed inset-0 z-40">
      <div ref={scrimRef} className="absolute inset-0 bg-black/40 backdrop-blur-sm" aria-hidden />
      <div
        className="relative flex h-full justify-center overflow-y-auto p-4"
        // Only a click on the empty space around the card closes it.
        onClick={(e) => {
          if (e.target === e.currentTarget && !suspended) close();
        }}
      >
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-label={title}
          tabIndex={-1}
          className="relative my-auto w-full max-w-[560px] origin-top-left outline-none"
        >
          <div className="mb-2 flex justify-end">
            <button
              type="button"
              onClick={close}
              aria-label={`Close ${title}`}
              className="grid h-8 w-8 place-items-center rounded-full border border-border bg-surface-elevated text-on-surface-variant shadow-sm transition-colors hover:text-on-surface"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
