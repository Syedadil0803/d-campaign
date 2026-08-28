'use client';

/**
 * The promo editor's global CSS.
 *
 * Global rather than scoped because two of the things it styles are not
 * rendered by React at all: the countdown chip and its prefix/suffix slots are
 * written into contentEditable elements as HTML strings, so a CSS-module class
 * would never reach them.
 *
 * Lifted out of PromoSection unchanged — fifty lines of stylesheet inside a
 * component's return made the markup harder to read than the rules are.
 */
export function PromoEditorStyles() {
  return (
    <style jsx global>{`
      /* Letter-spacing is not a supported styling concept (no control for it).
         A few sample templates hard-coded it; neutralize it in the live preview
         so the tool renders plain — matching the widget, which also drops it. */
      .promo-live-preview,
      .promo-live-preview * {
        letter-spacing: normal !important;
      }
      .promo-standard-editor,
      .promo-standard-editor * {
        color: rgb(var(--on-surface)) !important;
        font-size: 14px !important;
        font-weight: 400 !important;
        font-style: normal !important;
        letter-spacing: normal !important;
        line-height: 1.5 !important;
        text-decoration: none !important;
        text-transform: none !important;
        text-align: left !important;
        background: transparent !important;
      }
      /* Per-side "Enter text here" placeholders around the fixed countdown.
         Scoped to the panel editor only — never shown in the live preview.
         inline-block so the empty slot is a focusable box (caret can land at
         the very start, before the countdown). */
      [data-timer-prefix],
      [data-timer-suffix] {
        display: inline-block;
        vertical-align: baseline;
        min-width: 1px;
      }
      .promo-standard-editor [data-timer-prefix]:empty::before {
        content: "Enter text here ";
        color: #dbc1b2;
        opacity: 0.6;
        pointer-events: none;
        user-select: none;
      }
      .promo-standard-editor [data-timer-suffix]:empty::after {
        content: " Enter text here";
        color: #dbc1b2;
        opacity: 0.6;
        pointer-events: none;
        user-select: none;
      }
      /* Dim the fixed (non-editable) countdown in the INPUT BOX only, so it
         reads as locked. Preview is untouched (real styling shown there). */
      .promo-standard-editor [data-timer-fixed] {
        opacity: 0.55;
      }
    `}</style>
  );
}
