import { placeCaretInsideNewSpan } from '@/lib/editor/caretPlacement';

/**
 * Font size: the sizes offered, reading one back off an element, and applying
 * one to a selection.
 *
 * Sizes are written as inline styles on spans rather than classes, because the
 * same HTML is rendered by the live widget, which does not ship this app's
 * stylesheet.
 */

export const FONT_SIZE_MAP: Record<string, string> = {
  xs: '0.75rem',
  sm: '0.875rem',
  md: '1rem',
  lg: '1.125rem',
  xl: '1.25rem',
  xxl: '1.5rem',
};

/**
 * What the size control shows the user. One map so the trigger and the menu
 * can't drift; the internal keys stay as-is because the stored markup and the
 * format commands are keyed on them.
 */
export const FONT_SIZE_DISPLAY_MAP: Record<string, string> = {
  xs: 'XS',
  sm: 'SM',
  md: 'MD',
  lg: 'LG',
  xl: 'XL',
  xxl: '2XL',
};

export const FONT_SIZE_LABEL_MAP: Record<string, string> = {
  '0.75rem': 'xs',
  '0.875rem': 'sm',
  '1rem': 'md',
  '1.125rem': 'lg',
  '1.25rem': 'xl',
  '1.5rem': 'xxl',
};

/**
 * Map a CSS font-size to a label (xs/sm/md/lg/xl/xxl).
 *
 * Templates use sizes outside the six presets (1.6rem, 0.8rem, 1.35rem…), and
 * an exact-match lookup returned nothing for those — so the toolbar reported
 * "md" for text that was clearly much larger. Anything without an exact match
 * snaps to the closest preset instead.
 */
export function fontSizeToLabel(fontSize: string): string {
  if (!fontSize) return '';
  const exact = FONT_SIZE_LABEL_MAP[fontSize];
  if (exact) return exact;

  // Accept rem or px (browsers report computed styles in px).
  const match = fontSize.trim().match(/^(-?\d*\.?\d+)(rem|em|px)?$/);
  if (!match) return '';
  const value = Number(match[1]);
  if (!Number.isFinite(value)) return '';
  const rem = match[2] === 'px' ? value / 16 : value;

  let closest = '';
  let smallestGap = Infinity;
  Object.entries(FONT_SIZE_MAP).forEach(([label, css]) => {
    const gap = Math.abs(parseFloat(css) - rem);
    if (gap < smallestGap) {
      smallestGap = gap;
      closest = label;
    }
  });
  return closest;
}

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
      placeCaretInsideNewSpan(newSpan, range, selection);
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
    /**
     * The colour has to be carried onto the new span explicitly, because
     * execCommand('insertHTML') does not leave the inserted node where the
     * selection was: it SPLITS the enclosing inline spans and drops the new
     * one between the halves, as a sibling. Verified in the browser — resizing
     * "wonderful" inside
     *   <span style="color:red"><span style="font-size:1.25rem">…</span></span>
     * leaves the new span outside the colour span, so the text falls back to
     * the field's base colour.
     */
    let colorToPreserve = '';
    let hasBold = false;
    let hasItalic = false;
    let walkForStyle: Node | null = range.commonAncestorContainer;
    if (walkForStyle.nodeType === Node.TEXT_NODE) walkForStyle = walkForStyle.parentElement;
    while (walkForStyle && walkForStyle instanceof HTMLElement && walkForStyle.contentEditable !== 'true') {
      const el = walkForStyle;
      if (el.style.color && !colorToPreserve) {
        colorToPreserve = el.style.color;
      }
      if (el.tagName === 'B' || el.tagName === 'STRONG' || el.style.fontWeight === 'bold') {
        hasBold = true;
      }
      if (el.tagName === 'I' || el.tagName === 'EM' || el.style.fontStyle === 'italic') {
        hasItalic = true;
      }
      // Stopping at the nearest font-size ancestor was wrong. Applying a
      // colour to a whole field wraps it in a span OUTSIDE the size span, so
      // this found no colour at all and the resized text lost it. Everything
      // gathered here has to be re-applied for the same reason — insertHTML
      // splits every enclosing inline element, so an outer <b> is lost too.
      if (el.style.fontSize && colorToPreserve) break;
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
        const inlineColor = fs.style.color;
        const parent = fs.parentElement;
        if (parent) {
          if (inlineColor) {
            // Wrap children in a color-only span to preserve color
            const colorWrap = document.createElement('span');
            colorWrap.style.color = inlineColor;
            while (fs.firstChild) colorWrap.appendChild(fs.firstChild);
            parent.insertBefore(colorWrap, fs);
          } else {
            while (fs.firstChild) parent.insertBefore(fs.firstChild, fs);
          }
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
