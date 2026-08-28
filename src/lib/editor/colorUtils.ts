import { placeCaretInsideNewSpan } from '@/lib/editor/caretPlacement';

/**
 * Colour: the swatches offered, the conversions between the three notations a
 * browser hands back, and applying a colour to a selection.
 *
 * Split from the font-size half of the old richTextUtils. They shared a file
 * because both are "text styling", which is a category rather than a reason —
 * nothing here reads anything there.
 */

export const PRESET_COLORS = [
  // Row 1 — dark
  '#000000', '#434343', '#666666', '#999999', '#b7b7b7',
  '#cccccc', '#d9d9d9', '#efefef', '#f3f3f3', '#ffffff',
  // Row 2 — vivid
  '#980000', '#ff0000', '#ff9900', '#ffff00', '#00ff00',
  '#00ffff', '#4a86e8', '#0000ff', '#9900ff', '#ff00ff',
  // Row 3 — light
  '#e6b8af', '#f4cccc', '#fce5cd', '#fff2cc', '#d9ead3',
  '#d0e0e3', '#c9daf8', '#cfe2f3', '#d9d2e9', '#ead1dc',
  // Row 4 — medium-light
  '#dd7e6b', '#ea9999', '#f9cb9c', '#ffe599', '#b6d7a8',
  '#a2c4c9', '#a4c2f4', '#9fc5e8', '#b4a7d6', '#d5a6bd',
  // Row 5 — medium
  '#cc4125', '#e06666', '#f6b26b', '#ffd966', '#93c47d',
  '#76a5af', '#6d9eeb', '#6fa8dc', '#8e7cc3', '#c27ba0',
  // Row 6 — dark-medium
  '#a61c00', '#cc0000', '#e69138', '#f1c232', '#6aa84f',
  '#45818e', '#3c78d8', '#3d85c6', '#674ea7', '#a64d79',
  // Row 7 — dark
  '#85200c', '#990000', '#b45f06', '#bf9000', '#38761d',
  '#134f5c', '#1155cc', '#0b5394', '#351c75', '#741b47',
  // Row 8 — very dark
  '#5b0f00', '#660000', '#783f04', '#7f6000', '#274e13',
  '#0c343d', '#1c4587', '#073763', '#20124d', '#4c1130',
];

/** Convert 'rgb(r, g, b)' string or hex to '#rrggbb' */
export function rgbToHex(color: string): string {
  if (color.startsWith('#')) return color;
  const match = color.match(/rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/);
  if (match) {
    const r = parseInt(match[1]).toString(16).padStart(2, '0');
    const g = parseInt(match[2]).toString(16).padStart(2, '0');
    const b = parseInt(match[3]).toString(16).padStart(2, '0');
    return `#${r}${g}${b}`;
  }
  return color;
}

/** Parse hex color to { r, g, b } values */
export function hexToRgbValues(hex: string): { r: number; g: number; b: number } {
  hex = hex.replace('#', '');
  if (hex.length === 3) hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
  return {
    r: parseInt(hex.substring(0, 2), 16),
    g: parseInt(hex.substring(2, 4), 16),
    b: parseInt(hex.substring(4, 6), 16),
  };
}

/** Convert RGB to HSV color space */
export function rgbToHsv(r: number, g: number, b: number): { h: number; s: number; v: number } {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  const s = max === 0 ? 0 : (d / max) * 100;
  const v = max * 100;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) * 60;
    else if (max === g) h = ((b - r) / d + 2) * 60;
    else h = ((r - g) / d + 4) * 60;
  }
  return { h: Math.round(h), s: Math.round(s), v: Math.round(v) };
}

/** Convert HSV to RGB color space */
export function hsvToRgb(h: number, s: number, v: number): { r: number; g: number; b: number } {
  s /= 100; v /= 100;
  const c = v * s;
  const x = c * (1 - Math.abs((h / 60) % 2 - 1));
  const m = v - c;
  let r = 0, g = 0, b = 0;
  if (h < 60)       { r = c; g = x; b = 0; }
  else if (h < 120) { r = x; g = c; b = 0; }
  else if (h < 180) { r = 0; g = c; b = x; }
  else if (h < 240) { r = 0; g = x; b = c; }
  else if (h < 300) { r = x; g = 0; b = c; }
  else              { r = c; g = 0; b = x; }
  return {
    r: Math.round((r + m) * 255),
    g: Math.round((g + m) * 255),
    b: Math.round((b + m) * 255),
  };
}

/** Convert RGB values to hex string */
export function rgbToHexString(r: number, g: number, b: number): string {
  return '#' + [r, g, b]
    .map(c => Math.max(0, Math.min(255, c)).toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Apply color to the given Range via DOM manipulation.
 * Does NOT use execCommand('foreColor') — uses spans for cleaner output.
 * 
 * Handles: unwrapping old color spans/font tags, wrapping in new color span,
 * cleaning up empty stale spans, re-selecting the colored content.
 */
export function applyInlineColor(color: string, range: Range): void {
  // CARET MODE: No text selected — insert a colored span for future typing
  if (range.collapsed) {
    const selection = window.getSelection();
    if (!selection) return;

    // Check if already inside a color-only span with zero-width space
    let existingColorSpan: HTMLElement | null = null;
    let walkNode: Node | null = range.startContainer;
    while (walkNode && walkNode !== document.body) {
      if (
        walkNode instanceof HTMLElement &&
        walkNode.tagName === 'SPAN' &&
        walkNode.style.color &&
        walkNode.contentEditable !== 'true'
      ) {
        if (walkNode.textContent === '\u200B') {
          existingColorSpan = walkNode;
        }
        break;
      }
      walkNode = walkNode.parentNode;
    }

    if (existingColorSpan) {
      // Update existing placeholder span color
      existingColorSpan.style.color = color;
    } else {
      // Create new colored span with zero-width space
      const newSpan = document.createElement('span');
      newSpan.style.color = color;
      // Preserve font-size from parent
      let parentNode: Node | null = range.startContainer;
      while (parentNode && parentNode !== document.body) {
        if (parentNode instanceof HTMLElement && parentNode.style.fontSize) {
          newSpan.style.fontSize = parentNode.style.fontSize;
          break;
        }
        parentNode = parentNode.parentNode;
      }
      placeCaretInsideNewSpan(newSpan, range, selection);
    }
    return;
  }

  // SELECTION MODE: Text is selected
  const fragment = range.cloneContents();
  const tempDiv = document.createElement('div');
  tempDiv.appendChild(fragment);

  // Unwrap <font color> tags (from execCommand('foreColor'))
  const fontTags = tempDiv.querySelectorAll('font[color]');
  for (const ft of fontTags) {
    const parent = ft.parentElement;
    if (parent) {
      while (ft.firstChild) parent.insertBefore(ft.firstChild, ft);
      parent.removeChild(ft);
    }
  }

  // Remove color from ALL spans (we're applying a new color to everything)
  const allSpans = tempDiv.querySelectorAll('span');
  for (const sp of allSpans) {
    if (sp instanceof HTMLElement && sp.style.color) {
      sp.style.removeProperty('color');
    }
  }

  // Unwrap spans that now have no meaningful styles left
  const emptyStyleSpans = tempDiv.querySelectorAll('span');
  for (const sp of emptyStyleSpans) {
    if (
      sp instanceof HTMLElement &&
      !sp.style.fontSize &&
      !sp.style.fontWeight &&
      !sp.style.fontStyle &&
      !sp.style.color &&
      !sp.getAttribute('data-timer-placeholder') &&
      !sp.getAttribute('data-timer-separator')
    ) {
      const parent = sp.parentElement;
      if (parent) {
        while (sp.firstChild) parent.insertBefore(sp.firstChild, sp);
        parent.removeChild(sp);
      }
    }
  }

  // Wrap in new color span
  const colorSpan = document.createElement('span');
  colorSpan.style.color = color;
  colorSpan.innerHTML = tempDiv.innerHTML;

  // Replace original selection with colored version
  range.deleteContents();
  range.insertNode(colorSpan);

  // Clean up stale/empty color-only parent spans
  let parent = colorSpan.parentElement;
  while (parent && parent.contentEditable !== 'true' && parent !== document.body) {
    const isColorOnlySpan =
      parent.tagName === 'SPAN' &&
      parent.style.color &&
      !parent.style.fontSize &&
      !parent.style.fontWeight &&
      !parent.style.fontStyle &&
      !parent.getAttribute('data-timer-placeholder') &&
      !parent.getAttribute('data-timer-separator');

    if (isColorOnlySpan) {
      const hasOtherContent = Array.from(parent.childNodes).some(
        n => n !== colorSpan && !(n.nodeType === Node.TEXT_NODE && !n.textContent?.trim())
      );
      if (!hasOtherContent) {
        const grandparent = parent.parentElement;
        if (grandparent) {
          grandparent.insertBefore(colorSpan, parent);
          grandparent.removeChild(parent);
          parent = colorSpan.parentElement;
          continue;
        }
      }
    }
    break;
  }

  // General cleanup: remove empty spans in the editor
  const editor = colorSpan.closest('[contenteditable="true"]');
  if (editor) {
    const allSpans = editor.querySelectorAll('span');
    for (const sp of allSpans) {
      if (
        !sp.textContent?.trim() &&
        !sp.querySelector('img, br') &&
        !sp.getAttribute('data-timer-placeholder') &&
        !sp.getAttribute('data-timer-separator')
      ) {
        sp.remove();
      }
    }
  }

  colorSpan.normalize();

  // Re-select the inserted content
  const sel = window.getSelection();
  if (sel) {
    const newRange = document.createRange();
    newRange.selectNodeContents(colorSpan);
    sel.removeAllRanges();
    sel.addRange(newRange);
  }
}
