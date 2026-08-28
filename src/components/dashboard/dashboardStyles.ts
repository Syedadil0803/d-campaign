export const MICRO = 'text-[11px] font-bold uppercase tracking-[0.08em]';

/**
 * The dashboard's shared control styles.
 *
 * Module scope because they are constants: built inside the component, the
 * three button class strings were reassembled on every render for values that
 * cannot change.
 */
const PILL_BTN =
  'inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium transition-all active:scale-95';
export const PRIMARY_BTN = `${PILL_BTN} bg-primary text-on-primary hover:opacity-90`;
export const GHOST_BTN = `${PILL_BTN} border border-border text-on-surface hover:bg-surface-subtle`;
export const STOP_BTN = `${PILL_BTN} border border-border text-on-surface hover:text-red-600 hover:border-red-300 dark:hover:text-red-400 dark:hover:border-red-500/40`;

/** On-air or not, as a pill. */
export const statusPill = (active: boolean) =>
  `inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 ${MICRO} ${
    active
      ? 'bg-emerald-100/70 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300'
      : 'bg-surface-subtle text-on-surface-variant'
  }`;
