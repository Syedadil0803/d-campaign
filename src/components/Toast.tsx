import { useEffect, useState } from 'react';
import { CheckCircle, AlertCircle } from 'lucide-react';

export interface ToastAction {
  label: string;
  onClick: () => void;
}

interface ToastProps {
  show: boolean;
  message: string;
  isError: boolean;
  /**
   * One-tap recovery for actions that replace the whole card (template,
   * variant, AI reply, start fresh) or delete something. Present only while the
   * toast is up, so the offer expires with it.
   */
  action?: ToastAction | null;
  /**
   * How long the action stays on offer. Drives the countdown ring, so it must
   * match the timer the owner set — otherwise the ring lies about the deadline.
   */
  actionDurationMs?: number;
}

/** How long an Undo offer stays up. The dismiss timer and the ring share it. */
export const TOAST_ACTION_MS = 5000;

const RING_RADIUS = 7;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

/**
 * A ring that drains as the offer runs out, with the seconds left inside it.
 *
 * Without it the toast simply disappears, so "tap Undo quickly" is a guess —
 * you can't tell whether you have four seconds or half of one. The ring is the
 * clock; the digit is there because a sweeping arc alone doesn't tell you how
 * much time that is.
 */
function CountdownRing({ durationMs }: { durationMs: number }) {
  // One clock drives both the arc and the digit. An earlier version animated the
  // arc in CSS and ticked the digit in JS, which left two things that could
  // disagree — and the keyframes silently never bound, so the ring sat full
  // while the number counted down.
  const [remaining, setRemaining] = useState(durationMs);

  useEffect(() => {
    setRemaining(durationMs);
    const started = Date.now();
    // An interval rather than requestAnimationFrame: rAF is paused in a
    // background tab, so the ring would sit still while the dismiss timer kept
    // running and the offer expired behind a full circle. 60ms is smooth
    // enough for a five-second sweep.
    const id = setInterval(() => {
      const left = durationMs - (Date.now() - started);
      setRemaining(left > 0 ? left : 0);
      if (left <= 0) clearInterval(id);
    }, 60);
    return () => clearInterval(id);
  }, [durationMs]);

  const fractionLeft = durationMs > 0 ? remaining / durationMs : 0;
  const secondsLeft = Math.ceil(remaining / 1000);

  return (
    <span className="relative grid h-5 w-5 shrink-0 place-items-center">
      <svg viewBox="0 0 18 18" className="absolute inset-0 h-5 w-5 -rotate-90">
        <circle
          cx="9"
          cy="9"
          r={RING_RADIUS}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          className="opacity-20"
        />
        <circle
          cx="9"
          cy="9"
          r={RING_RADIUS}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeDasharray={RING_CIRCUMFERENCE}
          strokeDashoffset={RING_CIRCUMFERENCE * (1 - fractionLeft)}
        />
      </svg>
      <span className="relative text-[9px] font-semibold tabular-nums leading-none">
        {secondsLeft}
      </span>
    </span>
  );
}

export function Toast({
  show,
  message,
  isError,
  action,
  actionDurationMs = TOAST_ACTION_MS,
}: ToastProps) {
  if (!show) return null;
  return (
    <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50">
      <div className="inline-flex items-center gap-3 px-5 py-2 rounded-full shadow-lg bg-surface-elevated border border-border text-on-surface animate-bounce-in">
        {isError ? (
          <AlertCircle className="w-5 h-5 text-red-400" />
        ) : (
          <CheckCircle className="w-5 h-5 text-primary" />
        )}
        <span className="font-medium text-sm">{message}</span>
        {action && (
          <button
            type="button"
            onClick={action.onClick}
            className="ml-1 -mr-2 flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold text-primary transition-colors hover:bg-primary/10"
          >
            {action.label}
            {/* Keyed on the message so a second toast restarts the ring rather
                than inheriting the first one's sweep mid-drain. */}
            <CountdownRing key={message} durationMs={actionDurationMs} />
          </button>
        )}
      </div>
    </div>
  );
}
