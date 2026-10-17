/**
 * Class strings for the editing panel's fields, shared by the Smart Card and
 * the Video Story so the two stay identical.
 */

/** A rich-text field box (Smart Card title, subtitle, description and button; Video Story title). `active` while its style popup is open. */
export const richFieldBox = (active: boolean) =>
  `rich-editor promo-standard-editor block w-full rounded-md px-2 border min-h-[44px] max-h-[360px] resize-none overflow-y-auto outline-none break-words transition-colors ${
    active ? 'border-primary/70' : 'border-border'
  } focus:ring-primary/60 focus:border-primary/80 hover:border-primary/70`;

/** The palette icon beside a field's label that opens its style popup. */
export const PALETTE_BTN = 'p-1 rounded text-on-surface-variant hover:text-primary hover:bg-primary/10 transition-colors';
