import { rgbToHex } from '@/lib/editor/colorUtils';
import { fontSizeToLabel } from '@/lib/editor/fontSizeUtils';
import type { ActiveFormats } from '@/hooks/useRichTextEditor';
import { collectTextNodes } from '@/lib/editor/textNodes';

/**
 * What the toolbar should show for a whole block of editor HTML.
 *
 * Walks every text node up to its ancestors and reports a format only when
 * EVERY run agrees on it: mixed sizes or colours report as empty, which is how
 * the toolbar shows "no single value". Bold and italic are all-or-nothing for
 * the same reason.
 *
 * Pure — it reads a string and returns a value. It lived in the section as a
 * seventy-line function ending in a setState, which made a piece of analysis
 * look like a piece of the component.
 */
export function readFormatsFromHtml(html: string, defaultColor: string): ActiveFormats {
  const container = document.createElement('div');
  container.innerHTML = html;

  // Collect all text nodes with actual content
  const textNodes = collectTextNodes(container);

  if (textNodes.length === 0) {
    return { bold: false, italic: false, size: 'md', color: defaultColor };
  }

  const sizes = new Set<string>();
  const colors = new Set<string>();
  let allBold = true;
  let allItalic = true;

  textNodes.forEach((textNode) => {
    let foundSize = false;
    let foundColor = false;
    let isBold = false;
    let isItalic = false;

    // Walk up from text node to find effective styles
    let node: HTMLElement | null = textNode.parentElement;
    while (node && node !== container) {
      if (!foundSize && node.style.fontSize) {
        const label = fontSizeToLabel(node.style.fontSize);
        if (label) { sizes.add(label); foundSize = true; }
      }
      if (!foundColor && node.style.color) {
        const c = node.style.color;
        colors.add(c.startsWith('rgb') ? rgbToHex(c) : c);
        foundColor = true;
      }
      const tag = node.tagName;
      if (tag === 'B' || tag === 'STRONG') isBold = true;
      if (tag === 'I' || tag === 'EM') isItalic = true;
      node = node.parentElement;
    }

    if (!isBold) allBold = false;
    if (!isItalic) allItalic = false;
  });

  return {
    bold: allBold,
    italic: allItalic,
    size: sizes.size === 1 ? [...sizes][0] : (sizes.size === 0 ? 'md' : ''),
    color: colors.size === 1 ? [...colors][0] : (colors.size === 0 ? defaultColor : ''),
  };
}
