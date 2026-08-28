/**
 * Parking the caret inside a span that was just created.
 *
 * Applying a size or a colour to an empty selection wraps the caret in a new
 * span so the next character inherits the style. The caret has to end up
 * INSIDE that span — left outside it, the styling the user just chose applies
 * to nothing and the next keystroke comes out plain.
 *
 * Shared by both stylers, which is why it is here rather than in either.
 */
/**
 * Drops an empty styled span at the caret and leaves the caret inside it.
 *
 * The zero-width space is load-bearing: an empty span has no position for a
 * caret to sit in, so the browser puts it outside and the next character typed
 * lands unstyled. A single invisible character gives it somewhere to be.
 *
 * setStart and setEnd both use offset 1 — after the zero-width space, not
 * before it — or the character typed next goes in front and misses the span.
 *
 * Written out twice before, in the two places that start styled typing from an
 * empty selection. Both would have to change together.
 */
export function placeCaretInsideNewSpan(
  newSpan: HTMLElement,
  range: Range,
  selection: Selection,
): void {
  const zwsp = document.createTextNode('\u200B');
  newSpan.appendChild(zwsp);
  range.insertNode(newSpan);

  const newRange = document.createRange();
  newRange.setStart(zwsp, 1);
  newRange.setEnd(zwsp, 1);
  selection.removeAllRanges();
  selection.addRange(newRange);
}
