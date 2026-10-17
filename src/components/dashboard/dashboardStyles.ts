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
/**
 * A card's action buttons: side by side, each at least as wide as its label,
 * dropping onto two rows when the card is too narrow, so a label never wraps.
 */
export const ACTION_ROW = 'flex flex-wrap gap-2.5 [&>*]:h-[42px] [&>*]:min-w-max';
