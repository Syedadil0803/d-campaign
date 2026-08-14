'use client';

/**
 * Reusable coach-mark tour engine.
 *
 * Points at REAL controls instead of describing them in a centre-screen modal:
 * each step highlights an element with a pulsing ring and floats a small
 * popover beside it, so the thing being explained is the thing you're looking
 * at. Built generic because this won't be the only tour in the tool.
 *
 * Usage:
 *   1. Mark the target: <button data-tour="promo-save-draft" …>
 *   2. Declare the tour in tours.ts.
 *   3. Render <GuidedTour tour={PROMO_DRAFT_TOUR} enabled={someCondition} />
 *
 * Anchors are looked up by `data-tour`, never by CSS class or DOM position, so
 * restyling a button can't silently break a tour. A step whose anchor never
 * appears (a conditional button, a collapsed panel) is skipped rather than
 * left pointing at nothing.
 *
 * Marks never draw while a modal is open: any element carrying `data-modal`
 * pauses every tour. A ring pulsing behind a dialog points at something the
 * user can't reach, and reads as the page glitching.
 */

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowRight, Check, X } from 'lucide-react';

export type TourPlacement = 'top' | 'bottom' | 'left' | 'right';

export interface TourStep {
  /** Value of the target's `data-tour` attribute. */
  anchor: string;
  title: string;
  body: string;
  /** Preferred side; flips automatically when it would leave the viewport. */
  placement?: TourPlacement;
}

export interface TourDefinition {
  /** Stable id — also the storage key, so don't rename it casually. */
  id: string;
  /** Bump to re-show a tour whose content materially changed. */
  version?: number;
  steps: TourStep[];
}

/**
 * Gap between the highlighted element and the popover.
 *
 * Has to clear the highlight ring too, which itself sits 4px outside the
 * anchor — at 10px the mark looked like it was resting on the card it was
 * pointing at.
 */
const GAP = 20;
/**
 * Wide enough that short hints sit on one or two lines instead of wrapping
 * into a block, but still a mark beside the UI rather than a panel over it.
 */
const POPOVER_WIDTH = 320;
/** Give a late-rendering anchor this long to appear before skipping its step. */
const ANCHOR_TIMEOUT_MS = 1500;

function storageKey(tour: TourDefinition) {
  return `tour:${tour.id}:v${tour.version ?? 1}`;
}

/** True when this browser has never completed/skipped the tour. */
export function shouldShowTour(tour: TourDefinition): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return localStorage.getItem(storageKey(tour)) !== '1';
  } catch {
    // Storage blocked (private mode) — skip rather than nag on every load.
    return false;
  }
}

export function markTourSeen(tour: TourDefinition) {
  try {
    localStorage.setItem(storageKey(tour), '1');
  } catch {
    /* nothing to do */
  }
}

/** Clears the "seen" flag — handy for QA and a "replay tour" menu item. */
export function resetTour(tour: TourDefinition) {
  try {
    localStorage.removeItem(storageKey(tour));
  } catch {
    /* nothing to do */
  }
}

interface Box {
  top: number;
  left: number;
  width: number;
  height: number;
}

function readAnchor(name: string): Box | null {
  const el = document.querySelector<HTMLElement>(`[data-tour="${name}"]`);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  // A zero-size box means hidden/collapsed — treat it as absent.
  if (r.width === 0 && r.height === 0) return null;
  return { top: r.top, left: r.left, width: r.width, height: r.height };
}

/** Places the popover beside the anchor, flipping/clamping to stay on screen. */
function position(anchor: Box, popH: number, preferred: TourPlacement) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const fits = {
    top: anchor.top - GAP - popH > 8,
    bottom: anchor.top + anchor.height + GAP + popH < vh - 8,
    left: anchor.left - GAP - POPOVER_WIDTH > 8,
    right: anchor.left + anchor.width + GAP + POPOVER_WIDTH < vw - 8,
  };
  const order: TourPlacement[] = [preferred, 'bottom', 'top', 'right', 'left'];
  const placement = order.find((p) => fits[p]) ?? 'bottom';

  let top: number;
  let left: number;
  if (placement === 'top') {
    top = anchor.top - GAP - popH;
    left = anchor.left + anchor.width / 2 - POPOVER_WIDTH / 2;
  } else if (placement === 'bottom') {
    top = anchor.top + anchor.height + GAP;
    left = anchor.left + anchor.width / 2 - POPOVER_WIDTH / 2;
  } else if (placement === 'left') {
    top = anchor.top + anchor.height / 2 - popH / 2;
    left = anchor.left - GAP - POPOVER_WIDTH;
  } else {
    top = anchor.top + anchor.height / 2 - popH / 2;
    left = anchor.left + anchor.width + GAP;
  }

  return {
    placement,
    top: Math.min(Math.max(8, top), vh - popH - 8),
    left: Math.min(Math.max(8, left), vw - POPOVER_WIDTH - 8),
  };
}

interface GuidedTourProps {
  tour: TourDefinition;
  /** Gate on the screen being ready — the tour starts when this turns true. */
  enabled: boolean;
  /** Fired once the tour ends (finished, skipped or dismissed). */
  onFinish?: () => void;
  /**
   * Whether ending the tour retires it for good. Default true.
   *
   * False for recurring hints, where dismissing means "not now" rather than "I
   * know this" — the caller decides what actually counts as learned and calls
   * markTourSeen itself.
   */
  persistDismissal?: boolean;
}

export function GuidedTour({
  tour,
  enabled,
  onFinish,
  persistDismissal = true,
}: GuidedTourProps) {
  const [index, setIndex] = useState(0);
  const [anchor, setAnchor] = useState<Box | null>(null);
  const [popH, setPopH] = useState(150);
  const [done, setDone] = useState(false);
  const popRef = useRef<HTMLDivElement | null>(null);
  const waitingSince = useRef<number | null>(null);

  const step = tour.steps[index];
  /**
   * Paused while a dialog is open. Tracked in state rather than read during
   * render so it re-evaluates as dialogs come and go — the tour resumes by
   * itself once the screen is clear.
   */
  const [modalOpen, setModalOpen] = useState(false);
  const running = enabled && !done && !modalOpen && !!step;

  const finish = useCallback(() => {
    if (persistDismissal) markTourSeen(tour);
    setDone(true);
    onFinish?.();
  }, [tour, onFinish, persistDismissal]);

  // Track the anchor's box continuously: the page scrolls, panels resize, and
  // a ring that lags behind its button is worse than no ring.
  useEffect(() => {
    if (!running) return;
    let frame = 0;
    waitingSince.current = performance.now();

    const tick = () => {
      const box = readAnchor(step.anchor);
      if (box) {
        waitingSince.current = null;
        setAnchor((prev) =>
          prev &&
          prev.top === box.top &&
          prev.left === box.left &&
          prev.width === box.width &&
          prev.height === box.height
            ? prev
            : box,
        );
      } else {
        setAnchor(null);
        // Anchor never showed up — skip the step instead of stalling the tour.
        const since = waitingSince.current;
        if (since !== null && performance.now() - since > ANCHOR_TIMEOUT_MS) {
          waitingSince.current = null;
          if (index < tour.steps.length - 1) setIndex((i) => i + 1);
          else finish();
        }
      }
      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [running, step?.anchor, index, tour.steps.length, finish]);

  // A dialog can open at any moment, so this watches continuously rather than
  // checking once when the tour starts.
  useEffect(() => {
    if (!enabled || done) return;
    let frame = 0;
    const tick = () => {
      const open = !!document.querySelector('[data-modal]');
      setModalOpen((prev) => (prev === open ? prev : open));
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [enabled, done]);

  // Bring an off-screen target into view before pointing at it.
  useEffect(() => {
    if (!running) return;
    const el = document.querySelector<HTMLElement>(`[data-tour="${step.anchor}"]`);
    el?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
  }, [running, step?.anchor]);

  useLayoutEffect(() => {
    const h = popRef.current?.getBoundingClientRect().height;
    if (h && Math.abs(h - popH) > 1) setPopH(h);
  }, [index, anchor, popH]);

  useEffect(() => {
    if (!running) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') finish();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [running, finish]);

  if (!running || !anchor || typeof document === 'undefined') return null;

  const { placement, top, left } = position(anchor, popH, step.placement ?? 'bottom');
  const isLast = index === tour.steps.length - 1;

  return createPortal(
    <div className="pointer-events-none fixed inset-0 z-[80]">
      {/* Ring around the real control. Two layers: a steady outline so the
          element stays readable, and a pulsing halo that draws the eye. */}
      <div
        className="absolute rounded-lg ring-2 ring-primary transition-all duration-200"
        style={{
          top: anchor.top - 4,
          left: anchor.left - 4,
          width: anchor.width + 8,
          height: anchor.height + 8,
        }}
      />
      <div
        className="absolute animate-ping rounded-lg bg-primary/20"
        style={{
          top: anchor.top - 4,
          left: anchor.left - 4,
          width: anchor.width + 8,
          height: anchor.height + 8,
        }}
      />

      <div
        ref={popRef}
        role="dialog"
        aria-label={step.title}
        className="pointer-events-auto absolute rounded-lg border border-border bg-surface-elevated px-3.5 py-2.5 text-on-surface shadow-xl"
        style={{ top, left, width: POPOVER_WIDTH }}
      >
        {/* Caret pointing back at the control. */}
        <span
          className="absolute h-2.5 w-2.5 rotate-45 border border-border bg-surface-elevated"
          style={{
            ...(placement === 'bottom' && {
              top: -6,
              left: '50%',
              marginLeft: -5,
              borderRight: 'none',
              borderBottom: 'none',
            }),
            ...(placement === 'top' && {
              bottom: -6,
              left: '50%',
              marginLeft: -5,
              borderLeft: 'none',
              borderTop: 'none',
            }),
            ...(placement === 'right' && {
              left: -6,
              top: '50%',
              marginTop: -5,
              borderRight: 'none',
              borderTop: 'none',
            }),
            ...(placement === 'left' && {
              right: -6,
              top: '50%',
              marginTop: -5,
              borderLeft: 'none',
              borderBottom: 'none',
            }),
          }}
        />

        {/* Leaving lives in the corner, not the footer — it's the one action
            that isn't "move through the tour", and mixing it in made three
            same-sized controls compete for the same corner. */}
        <button
          type="button"
          onClick={finish}
          aria-label="Dismiss"
          className="absolute right-2 top-2 inline-flex h-5 w-5 items-center justify-center rounded text-on-surface-variant transition-colors hover:text-primary"
        >
          <X className="h-3.5 w-3.5" />
        </button>

        <p className="pr-5 text-[13px] font-semibold leading-tight">{step.title}</p>
        <p className="mt-1 text-[11px] leading-snug text-on-surface-variant">{step.body}</p>

        <div className="mt-3 flex items-center justify-between gap-2 border-t border-border pt-2.5">
          {/* Position as a plain count. Dots this small read as decoration and
              stop being countable past three steps; a number never does.
              Hidden for a single step — "1 of 1" tells you nothing and makes a
              standalone hint look like a truncated tour. */}
          {tour.steps.length > 1 ? (
            <span className="text-[10px] font-medium tabular-nums text-on-surface-variant">
              {index + 1} of {tour.steps.length}
            </span>
          ) : (
            <span />
          )}

          <div className="flex items-center gap-1">
            {index > 0 && (
              <button
                type="button"
                onClick={() => setIndex((i) => i - 1)}
                className="rounded-md px-2 py-1 text-[11px] font-medium text-on-surface-variant transition-colors hover:text-primary"
              >
                Back
              </button>
            )}
            <button
              type="button"
              onClick={() => (isLast ? finish() : setIndex((i) => i + 1))}
              className="inline-flex items-center gap-1 rounded-md bg-primary px-2.5 py-1 text-[11px] font-semibold text-on-primary shadow-sm transition-opacity hover:opacity-95"
            >
              {isLast ? (
                <>
                  Got it <Check className="h-3 w-3" />
                </>
              ) : (
                <>
                  Next <ArrowRight className="h-3 w-3" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
