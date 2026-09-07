// Speed is pixels per second — the reading velocity, the same on every screen.
// The CSS duration is derived from it (distance ÷ px-per-sec), so wider content
// scrolls for longer, not faster. A hardcoded duration would race on big screens.

/** Pace when a bar has no saved speed. */
export const DEFAULT_PX_PER_SEC = 60;

/**
 * Speeds offered in the preview pill, in the comfortable ticker band (~40–90).
 * `pxPerSec` drives the animation and is stored; `hint` is the on-screen text.
 * Pause (speed 0) is a separate toggle, not a row here.
 */
export const SPEED_PRESETS = [
  { pxPerSec: 40, label: 'Slow', hint: 'A relaxed pace, easiest to read' },
  { pxPerSec: 60, label: 'Normal', hint: 'The standard reading pace' },
  { pxPerSec: 90, label: 'Fast', hint: 'A brisk pace for short messages' },
] as const;

/** Seconds to scroll `distancePx` at `pxPerSec`; 0 when paused, floored at 5s. */
export function marqueeDurationSeconds(distancePx: number, pxPerSec: number): number {
  if (pxPerSec <= 0) return 0;
  return Math.max(5, distancePx / pxPerSec);
}
