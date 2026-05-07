/**
 * richTextUtils.ts
 * 
 * Editor-agnostic DOM utilities for rich text editing.
 * Used by useRichTextEditor hook and directly by components.
 * 
 * Includes: color conversions, font-size maps, HTML normalization,
 * inline color application, and font-size application.
 */

// ============================================================
// Constants
// ============================================================

export const FONT_SIZE_MAP: Record<string, string> = {
  xs: '0.75rem',
  sm: '0.875rem',
  md: '1rem',
  lg: '1.125rem',
  xl: '1.25rem',
  xxl: '1.5rem',
};

export const FONT_SIZE_LABEL_MAP: Record<string, string> = {
  '0.75rem': 'xs',
  '0.875rem': 'sm',
  '1rem': 'md',
  '1.125rem': 'lg',
  '1.25rem': 'xl',
  '1.5rem': 'xxl',
};

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

// ============================================================
// Color Conversion Utilities
// ============================================================

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

/** Map a CSS font-size value to a label (xs/sm/md/lg/xl/xxl) */
export function fontSizeToLabel(fontSize: string): string {
  return FONT_SIZE_LABEL_MAP[fontSize] || '';
}

// ============================================================
// HTML Normalization
// ============================================================

/**
 * 3-pass HTML normalizer for font-size consistency.
 *   Pass 1: Wrap bare text nodes in default 1rem spans
 *   Pass 2: Flatten nested font-size spans (inner wins)
 *   Pass 3: Remove empty/orphaned font-size spans
 */
export function wrapBareTextWithFontSize(html: string): string {
  if (!html || html.trim() === '' || /^(<br\s*\/?>)+$/i.test(html.trim())) return '';

  const container = document.createElement('div');
  container.innerHTML = html;

  // === PASS 1: Wrap bare text nodes not inside a font-size span ===
  function wrapBareText(parent: HTMLElement) {
    const children = Array.from(parent.childNodes);
    for (const node of children) {
      if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent || '';
        if (!text || text.replace(/\u200B/g, '').trim() === '') continue;

        let hasFontSize = false;
        let ancestor = node.parentElement;
        while (ancestor && ancestor !== container) {
          if (ancestor.style?.fontSize) { hasFontSize = true; break; }
          ancestor = ancestor.parentElement;
        }

        if (!hasFontSize) {
          const span = document.createElement('span');
          span.style.fontSize = '1rem';
          span.textContent = text;
          parent.replaceChild(span, node);
        }
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        const el = node as HTMLElement;
        if (!el.style.fontSize) {
          wrapBareText(el);
        }
      }
    }
  }

  // === PASS 2: Flatten nested font-size spans ===
  function flattenNestedFontSizes(parent: HTMLElement) {
    let changed = true;
    while (changed) {
      changed = false;
      const spans = parent.querySelectorAll('span[style]');
      for (const span of spans) {
        if (!(span instanceof HTMLElement) || !span.style.fontSize) continue;

        const meaningfulChildren = Array.from(span.childNodes).filter(n => {
          if (n.nodeType === Node.TEXT_NODE) {
            return (n.textContent || '').replace(/\u200B/g, '').trim() !== '';
          }
          return true;
        });

        // Outer font-size span wraps ONLY one inner font-size span → unwrap outer
        if (
          meaningfulChildren.length === 1 &&
          meaningfulChildren[0] instanceof HTMLElement &&
          meaningfulChildren[0].style.fontSize
        ) {
          span.parentElement?.replaceChild(meaningfulChildren[0], span);
          changed = true;
          break;
        }

        // Outer font-size span wraps ONLY a b/i/strong/em containing a font-size span
        if (
          meaningfulChildren.length === 1 &&
          meaningfulChildren[0] instanceof HTMLElement &&
          !meaningfulChildren[0].style.fontSize &&
          ['B', 'I', 'STRONG', 'EM'].includes(meaningfulChildren[0].tagName)
        ) {
          const formatEl = meaningfulChildren[0] as HTMLElement;
          const innerMeaningful = Array.from(formatEl.childNodes).filter(n => {
            if (n.nodeType === Node.TEXT_NODE) {
              return (n.textContent || '').replace(/\u200B/g, '').trim() !== '';
            }
            return true;
          });
          if (
            innerMeaningful.length === 1 &&
            innerMeaningful[0] instanceof HTMLElement &&
            innerMeaningful[0].style.fontSize
          ) {
            const innerSpan = innerMeaningful[0] as HTMLElement;
            const newFormatEl = document.createElement(formatEl.tagName);
            while (innerSpan.firstChild) {
              newFormatEl.appendChild(innerSpan.firstChild);
            }
            innerSpan.appendChild(newFormatEl);
            span.parentElement?.replaceChild(innerSpan, span);
            changed = true;
            break;
          }
        }
      }
    }
  }

  // === PASS 3: Remove empty font-size spans ===
  function removeEmptyFontSpans(parent: HTMLElement) {
    const spans = parent.querySelectorAll('span[style]');
    for (const span of spans) {
      if (!(span instanceof HTMLElement) || !span.style.fontSize) continue;
      const text = span.textContent || '';
      if (text.replace(/\u200B/g, '').trim() === '') {
        span.parentElement?.removeChild(span);
      }
    }
  }

  wrapBareText(container);
  flattenNestedFontSizes(container);
  removeEmptyFontSpans(container);

  return container.innerHTML;
}

// ============================================================
// Font Size Application
// ============================================================

/**
 * Apply font size to the current selection or at caret position.
 * 
 * Caret mode: Inserts a styled span with zero-width space for future typing.
 * Selection mode: Uses insertHTML for atomic undo + prevents nesting.
 * 
 * Operates on `window.getSelection()` — caller must verify
 * the selection is within the intended editor.
 */
export function applyFontSize(size: string): void {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return;

  const range = selection.getRangeAt(0);

  // CARET MODE: No text selected
  if (range.collapsed) {
    let existingSpan: HTMLElement | null = null;
    let walkNode: Node | null = range.startContainer;
    while (walkNode && walkNode !== document.body) {
      if (
        walkNode instanceof HTMLElement &&
        walkNode.style.fontSize &&
        walkNode.contentEditable !== 'true'
      ) {
        existingSpan = walkNode;
        break;
      }
      walkNode = walkNode.parentNode;
    }

    if (existingSpan && existingSpan.textContent === '\u200B') {
      // Already inside an empty placeholder span — just update font-size
      existingSpan.style.fontSize = size;
    } else {
      // Create new span with font-size and zero-width space
      const newSpan = document.createElement('span');
      newSpan.style.fontSize = size;
      const zwsp = document.createTextNode('\u200B');
      newSpan.appendChild(zwsp);
      range.insertNode(newSpan);

      const newRange = document.createRange();
      newRange.setStart(zwsp, 1);
      newRange.setEnd(zwsp, 1);
      selection.removeAllRanges();
      selection.addRange(newRange);
    }
    return;
  }

  // SELECTION MODE: Text is selected
  let existingFontSpan: HTMLElement | null = null;
  let walkUp: Node | null = range.commonAncestorContainer;
  if (walkUp.nodeType === Node.TEXT_NODE) walkUp = walkUp.parentElement;
  while (
    walkUp &&
    walkUp instanceof HTMLElement &&
    walkUp.contentEditable !== 'true'
  ) {
    if (walkUp.style.fontSize) {
      if (walkUp.textContent === range.toString()) {
        existingFontSpan = walkUp;
      }
      break;
    }
    walkUp = walkUp.parentElement;
  }

  const markerId = `fs-${Date.now()}`;

  if (existingFontSpan) {
    // Reuse existing span — update its font-size while preserving color and other styles
    existingFontSpan.style.fontSize = size;
    // Re-select the content
    const selectRange = document.createRange();
    selectRange.selectNodeContents(existingFontSpan);
    selection.removeAllRanges();
    selection.addRange(selectRange);
    return;
  } else {
    // Check if selection is inside a color/bold/italic span - need to preserve it
    let colorToPreserve = '';
    let hasBold = false;
    let hasItalic = false;
    let walkForStyle: Node | null = range.commonAncestorContainer;
    if (walkForStyle.nodeType === Node.TEXT_NODE) walkForStyle = walkForStyle.parentElement;
    while (walkForStyle && walkForStyle instanceof HTMLElement && walkForStyle.contentEditable !== 'true') {
      const el = walkForStyle;
      if (el.style.color && !el.style.fontSize) {
        colorToPreserve = el.style.color;
      }
      if (el.tagName === 'B' || el.tagName === 'STRONG' || el.style.fontWeight === 'bold') {
        hasBold = true;
      }
      if (el.tagName === 'I' || el.tagName === 'EM' || el.style.fontStyle === 'italic') {
        hasItalic = true;
      }
      if (el.style.fontSize) break; // Stop at font-size boundary
      walkForStyle = el.parentElement;
    }

    // New: clone selection, unwrap inner font-size spans (keeping color/bold/italic), wrap in new span
    const fragment = range.cloneContents();
    const tempDiv = document.createElement('div');
    tempDiv.appendChild(fragment);

    // Flatten nested font-size spans while preserving color/bold/italic
    const innerFontSpans = tempDiv.querySelectorAll('span[style]');
    for (const fs of innerFontSpans) {
      if (fs instanceof HTMLElement && fs.style.fontSize) {
        const parent = fs.parentElement;
        if (parent) {
          while (fs.firstChild) parent.insertBefore(fs.firstChild, fs);
          parent.removeChild(fs);
        }
      }
    }

    let selectedHtml = tempDiv.innerHTML;

    // Re-add bold/italic wrappers if they were present
    if (hasBold) {
      selectedHtml = `<b>${selectedHtml}</b>`;
    }
    if (hasItalic) {
      selectedHtml = `<i>${selectedHtml}</i>`;
    }

    const markerId = `fs-${Date.now()}`;

    // Include preserved color in the new span if found
    const styleAttr = colorToPreserve
      ? `style="font-size: ${size}; color: ${colorToPreserve}"`
      : `style="font-size: ${size}"`;

    document.execCommand(
      'insertHTML',
      false,
      `<span ${styleAttr} data-fs-marker="${markerId}">${selectedHtml}</span>`
    );

    // Re-select the inserted content via marker
    const insertedSpan = document.querySelector(`[data-fs-marker="${markerId}"]`);
    if (insertedSpan) {
      insertedSpan.removeAttribute('data-fs-marker');
      const selectRange = document.createRange();
      selectRange.selectNodeContents(insertedSpan);
      selection.removeAllRanges();
      selection.addRange(selectRange);
    }
    return;
  }
}

// ============================================================
// Inline Color Application
// ============================================================

/**
 * Apply color to the given Range via DOM manipulation.
 * Does NOT use execCommand('foreColor') — uses spans for cleaner output.
 * 
 * Handles: unwrapping old color spans/font tags, wrapping in new color span,
 * cleaning up empty stale spans, re-selecting the colored content.
 */
export function applyInlineColor(color: string, range: Range): void {
  if (range.collapsed) return;

  // Clone selection, unwrap existing color markup
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

  // Unwrap spans that only have color style (no font-size/weight/style)
  const colorSpans = tempDiv.querySelectorAll('span');
  for (const sp of colorSpans) {
    if (
      sp.style.color &&
      !sp.style.fontSize &&
      !sp.style.fontWeight &&
      !sp.style.fontStyle &&
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
