/**
 * The countdown chip's styling, as data.
 *
 * Its own module because the node renders through TimerChipComponent while the
 * component needs these shapes back — the two named each other, which the
 * module graph reports as a cycle even though only types crossed it.
 */

import type { ChipCell } from './TimerChipTarget';

export type Css = Record<string, string>;

export interface ChipStyleModel {
  /** Applies to the whole chip. */
  whole?: Css;
  /** Per-cell overrides (each number, word, and colon). */
  cells?: Partial<Record<ChipCell, Css>>;
}
