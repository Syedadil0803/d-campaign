import type { BarMotion } from '@/types/campaign';

/** The motion choices shown in the preview bar, in order. */
export const BAR_MOTIONS: { value: BarMotion; label: string; hint: string }[] = [
  { value: 'scroll', label: 'Scroll', hint: 'Messages scroll across the bar' },
  { value: 'slide', label: 'Slide', hint: 'Each message slides in from the right to the centre' },
  { value: 'rollup', label: 'Roll up', hint: 'Messages roll up, one at a time, in the centre' },
  { value: 'fade', label: 'Fade', hint: 'Messages switch with a quick fade in the centre' },
];

/**
 * Seconds each message stays for Slide, Roll up and Fade, from the same Speed
 * presets the marquee uses (Slow 40, Normal 60, Fast 90 px/s). 0 = paused.
 */
export function dwellSeconds(pxPerSec: number): number {
  if (pxPerSec <= 0) return 0;
  if (pxPerSec <= 45) return 5;
  if (pxPerSec <= 75) return 4;
  return 3;
}
