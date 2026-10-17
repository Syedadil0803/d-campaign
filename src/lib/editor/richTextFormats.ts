import { unwrapInlineTags } from '@/lib/promo/promoEditorSelection';

/**
 * Rich-text helpers shared by every field edited with useRichTextEditor and
 * the Smart Card's style popup: the Smart Card's own fields and the Video
 * Story title. One copy, so both format the same way.
 */

/**
 * Bold or italic for a whole field. Turning it on uses the browser command;
 * turning it off unwraps every <b>/<strong> (or <i>/<em>), because the
 * command toggles a half-bold field the wrong way.
 */
export function toggleWholeStyle(
  editor: HTMLDivElement,
  format: 'bold' | 'italic',
  enable: boolean,
  formatText: (format: string) => void,
): void {
  if (enable) {
    formatText(format);
    return;
  }
  unwrapInlineTags(editor, format === 'bold' ? 'b,strong' : 'i,em');
}

/**
 * Runs a format on the whole field: selects everything, runs `action`, then
 * `commit` (save the field), and clears the selection, leaving focus as it
 * was. Returns false, doing nothing, on a field with no text.
 */
export function applyToWholeField(
  editor: HTMLDivElement,
  saveSelection: () => void,
  action: () => void,
  commit: () => void,
): boolean {
  if (!editor.textContent?.replace(/\u200B/g, '').trim()) return false;
  const wasFocused = document.activeElement === editor;
  editor.focus();
  const selection = window.getSelection();
  if (selection) {
    selection.removeAllRanges();
    const range = document.createRange();
    range.selectNodeContents(editor);
    selection.addRange(range);
    saveSelection();
  }
  action();
  commit();
  window.getSelection()?.removeAllRanges();
  if (!wasFocused) editor.blur();
  return true;
}

/** How many characters from the start of `text` still pass `fits`: the most a paste can keep. */
export function longestFittingPrefix(text: string, fits: (prefix: string) => boolean): number {
  let low = 0;
  let high = text.length;
  let best = 0;
  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    if (fits(text.slice(0, mid))) {
      best = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }
  return best;
}
