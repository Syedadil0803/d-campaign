/**
 * Reading and restoring what is selected inside a contenteditable field.
 *
 * Browser selection work rather than React work — these ask the document what
 * the caret is doing and put it back afterwards. Every one takes the editor
 * element it should act on, so none of them needs the component's state.
 */
import { rgbToHex } from '@/lib/editor/colorUtils';

/** What an unstyled editor shows, so a colour swatch has something to report. */
export const PROMO_EDITOR_DEFAULT_COLOR = '#ffffff';

export interface PromoSelectionSnapshot {
  start: number;
  end: number;
}

export function selectionIsInsideEditor(editor: HTMLDivElement): boolean {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed)
    return false;
  const range = selection.getRangeAt(0);
  return (
    editor.contains(range.commonAncestorContainer) ||
    editor.contains(selection.anchorNode)
  );
}

export function hasVisibleContent(html: string | undefined): boolean {
  if (!html) return false;
  const plainText = html
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/[\u200B\u200C\u200D\uFEFF]/g, "")
    .trim();
  return plainText.length > 0;
}

export function getEditorFallbackColor(editor: HTMLDivElement): string {
  if (typeof window === "undefined") return PROMO_EDITOR_DEFAULT_COLOR;
  const color = window.getComputedStyle(editor).color;
  return color.startsWith("rgb")
    ? rgbToHex(color)
    : color || PROMO_EDITOR_DEFAULT_COLOR;
}

export function unwrapInlineTags(
  editor: HTMLDivElement,
  selector: "b,strong" | "i,em",
) {
  const nodes = Array.from(editor.querySelectorAll(selector));
  nodes.forEach((node) => {
    const parent = node.parentNode;
    if (!parent) return;
    while (node.firstChild) {
      parent.insertBefore(node.firstChild, node);
    }
    parent.removeChild(node);
  });
}



export function getPromoSelectionSnapshot(
  editor: HTMLDivElement,
): PromoSelectionSnapshot | null {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return null;
  const range = selection.getRangeAt(0);
  if (
    !editor.contains(range.commonAncestorContainer) &&
    !editor.contains(selection.anchorNode)
  )
    return null;

  const preStartRange = document.createRange();
  preStartRange.selectNodeContents(editor);
  preStartRange.setEnd(range.startContainer, range.startOffset);

  const preEndRange = document.createRange();
  preEndRange.selectNodeContents(editor);
  preEndRange.setEnd(range.endContainer, range.endOffset);

  return {
    start: preStartRange.toString().length,
    end: preEndRange.toString().length,
  };
}

export function restorePromoSelection(
  editor: HTMLDivElement,
  selectionSnapshot: PromoSelectionSnapshot | null,
) {
  if (!selectionSnapshot || typeof window === "undefined") return;
  const textLength = editor.textContent?.length || 0;
  const start = Math.max(0, Math.min(selectionSnapshot.start, textLength));
  const end = Math.max(start, Math.min(selectionSnapshot.end, textLength));
  const range = document.createRange();
  const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT);
  let currentOffset = 0;
  let startSet = false;
  let endSet = false;
  let node = walker.nextNode();

  while (node) {
    const nodeLength = node.textContent?.length || 0;
    const nextOffset = currentOffset + nodeLength;

    if (!startSet && start <= nextOffset) {
      range.setStart(node, Math.max(0, start - currentOffset));
      startSet = true;
    }
    if (!endSet && end <= nextOffset) {
      range.setEnd(node, Math.max(0, end - currentOffset));
      endSet = true;
      break;
    }

    currentOffset = nextOffset;
    node = walker.nextNode();
  }

  if (!startSet) {
    range.selectNodeContents(editor);
    range.collapse(false);
  } else if (!endSet) {
    range.setEnd(range.startContainer, range.startOffset);
  }

  editor.focus();
  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
}


