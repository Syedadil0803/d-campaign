'use client';

/**
 * useRichTextEditor — React hook for contenteditable rich text editing.
 *
 * Encapsulates: Bold/Italic (execCommand), Font-size (XS–XXL),
 * Inline color, Format detection via DOM walking, and
 * Selection save/restore for focus-stealing UI (color pickers).
 *
 * Usage:
 *   const editorRef = useRef<HTMLDivElement>(null);
 *   const { activeFormats, formatText, ... } = useRichTextEditor(editorRef);
 *
 *   <div
 *     ref={editorRef}
 *     contentEditable
 *     suppressContentEditableWarning
 *     onInput={handleInput}
 *     onMouseUp={detectFormats}
 *     onKeyUp={detectFormats}
 *   />
 */

import { useState, useRef, useCallback, Dispatch, SetStateAction } from 'react';
import { applyInlineColor, rgbToHex } from '@/lib/editor/colorUtils';
import { FONT_SIZE_MAP, fontSizeToLabel, applyFontSize, wrapBareTextWithFontSize } from '@/lib/editor/fontSizeUtils';
import { collectTextNodes } from '@/lib/editor/textNodes';

// ============================================================
// Types
// ============================================================

export interface ActiveFormats {
  bold: boolean;
  italic: boolean;
  /** 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'xxl' | '' */
  size: string;
  /** Hex color string, e.g. '#ff0000' */
  color: string;
}

export interface UseRichTextEditorOptions {
  /**
   * Default color when no inline color is detected at cursor.
   * Announcement editors typically use '#000000',
   * Promo editors typically use '#ffffff'.
   */
  defaultColor?: string;
}

export interface UseRichTextEditorReturn {
  /** Current formatting state at the cursor position */
  activeFormats: ActiveFormats;

  /** Directly set the active formats state */
  setActiveFormats: Dispatch<SetStateAction<ActiveFormats>>;

  /**
   * Apply a formatting command.
   * Supported formats: 'bold', 'italic',
   * 'size-xs', 'size-sm', 'size-md', 'size-lg', 'size-xl', 'size-xxl'
   *
   * Does nothing if the current selection is outside the editor.
   */
  formatText: (format: string) => void;

  /**
   * Apply an inline text color using the saved selection range.
   * Call saveSelection() before opening a color picker that steals focus.
   */
  applyColor: (color: string) => void;

  /**
   * Re-detect formatting at the current cursor/selection position.
   * Call on mouseup, keyup, and after formatting operations.
   */
  detectFormats: () => void;

  /**
   * Ensure the cursor is inside a font-size span.
   * If not, inserts a default 1rem span at caret.
   * Call on editor focus to guarantee all typed text gets explicit font-size.
   */
  ensureDefaultFontSize: () => void;

  /**
   * Save the current selection range (before a focus-stealing action).
   * The saved range is used by applyColor().
   */
  saveSelection: () => void;

  /**
   * Restore a previously saved selection range.
   */
  restoreSelection: () => void;

  /**
   * Get the current editor innerHTML, normalized with wrapBareTextWithFontSize.
   * Returns empty string if editor ref is null or editor is empty.
   */
  getNormalizedHTML: () => string;

  /**
   * Get raw editor innerHTML without normalization.
   */
  getRawHTML: () => string;
}

// ============================================================
// Hook Implementation
// ============================================================

export function useRichTextEditor(
  editorRef: React.RefObject<HTMLDivElement | null>,
  options: UseRichTextEditorOptions = {}
): UseRichTextEditorReturn {
  const { defaultColor = '#000000' } = options;

  const [activeFormats, setActiveFormats] = useState<ActiveFormats>({
    bold: false,
    italic: false,
    size: 'md',
    color: defaultColor,
  });

  /**
   * Mutable ref for the saved selection range.
   * Used by the color picker flow (which steals focus from the editor).
   * Not in state because changes should NOT trigger re-renders.
   */
  const savedRangeRef = useRef<Range | null>(null);

  // --------------------------------------------------------
  // Internal: check if the current selection is within our editor
  // --------------------------------------------------------
  const isSelectionInEditor = useCallback((): boolean => {
    const editor = editorRef.current;
    if (!editor) return false;
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return false;
    const anchorNode = selection.anchorNode;
    return !!anchorNode && editor.contains(anchorNode);
  }, [editorRef]);

  // --------------------------------------------------------
  // detectFormats: Read formatting at the current cursor position
  // --------------------------------------------------------
  const detectFormats = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) return;

    const selection = window.getSelection();

    // Also save the range whenever we detect formats — this keeps
    // savedRangeRef fresh for the color picker workflow.
    if (selection && selection.rangeCount > 0 && editor.contains(selection.anchorNode)) {
      savedRangeRef.current = selection.getRangeAt(0).cloneRange();
    }

    // Bold & Italic: For collapsed selection, use queryCommandState.
    // For range selection, check all text nodes in the range.
    let bold = false;
    let italic = false;

    if (selection && selection.rangeCount > 0 && !selection.isCollapsed) {
      const range = selection.getRangeAt(0);
      const fragment = range.cloneContents();
      const tempDiv = document.createElement('div');
      tempDiv.appendChild(fragment);

      const textNodes = collectTextNodes(tempDiv);

      if (textNodes.length > 0) {
        let allBold = true;
        let allItalic = true;
        textNodes.forEach((tn) => {
          let isBold = false;
          let isItalic = false;
          let n: HTMLElement | null = tn.parentElement;
          while (n && n !== tempDiv) {
            const tag = n.tagName;
            if (tag === 'B' || tag === 'STRONG') isBold = true;
            if (tag === 'I' || tag === 'EM') isItalic = true;
            n = n.parentElement;
          }
          if (!isBold) allBold = false;
          if (!isItalic) allItalic = false;
        });
        bold = allBold;
        italic = allItalic;
      }

      // Also check ancestors of the range's common ancestor in the live DOM
      if (!bold || !italic) {
        let ancestor: Node | null = range.commonAncestorContainer;
        if (ancestor.nodeType === Node.TEXT_NODE) ancestor = ancestor.parentNode;
        while (ancestor && ancestor !== editor) {
          if (ancestor instanceof HTMLElement) {
            const tag = ancestor.tagName;
            if (tag === 'B' || tag === 'STRONG') bold = true;
            if (tag === 'I' || tag === 'EM') italic = true;
          }
          ancestor = ancestor.parentNode;
        }
      }
    } else {
      bold = document.queryCommandState('bold');
      italic = document.queryCommandState('italic');
    }

    // Size and color describe the WHOLE selection, the same way bold and
    // italic already do above.
    //
    // Both used to walk up from the anchor node alone, which reports the
    // FIRST character's value. Select red text and blue text together and the
    // swatch showed red, as though red applied throughout — then picking a
    // size re-applied that red to the lot. Every text node in the range has
    // to agree; when they disagree the control shows nothing ('') rather than
    // one arbitrary member of the set.
    const nearest = (from: Node, read: (el: HTMLElement) => string): string => {
      let node: Node | null = from;
      while (node && node !== document.body) {
        if (node instanceof HTMLElement) {
          const value = read(node);
          if (value) return value;
        }
        node = node.parentNode;
      }
      return '';
    };
    const sizeAt = (node: Node): string =>
      fontSizeToLabel(nearest(node, (el) => el.style.fontSize)) || 'md';
    const colorAt = (node: Node): string => {
      const raw = nearest(node, (el) => el.style.color);
      if (!raw) return defaultColor;
      return raw.startsWith('rgb') ? rgbToHex(raw) : raw;
    };

    let size = 'md';
    let color = defaultColor;
    const spanned =
      selection && selection.rangeCount > 0 && !selection.isCollapsed
        ? collectTextNodes(editor).filter((node) =>
            selection.getRangeAt(0).intersectsNode(node),
          )
        : [];

    if (spanned.length > 0) {
      const sizes = new Set(spanned.map(sizeAt));
      const colors = new Set(spanned.map(colorAt));
      size = sizes.size === 1 ? [...sizes][0] : '';
      color = colors.size === 1 ? [...colors][0] : '';
    } else if (selection?.anchorNode) {
      // Collapsed caret, or a range holding no text: report where it sits.
      size = sizeAt(selection.anchorNode);
      color = colorAt(selection.anchorNode);
    }

    setActiveFormats({ bold, italic, size, color });
  }, [editorRef, defaultColor]);

  // --------------------------------------------------------
  // formatText: Apply bold/italic/size formatting
  // --------------------------------------------------------
  const formatText = useCallback(
    (format: string) => {
      const editor = editorRef.current;
      if (!editor) return;
      if (!isSelectionInEditor()) return;

      switch (format) {
        case 'bold':
          document.execCommand('bold', false);
          break;
        case 'italic':
          document.execCommand('italic', false);
          break;
        case 'size-xs':
        case 'size-sm':
        case 'size-md':
        case 'size-lg':
        case 'size-xl':
        case 'size-xxl': {
          const label = format.replace('size-', '');
          const remValue = FONT_SIZE_MAP[label];
          if (remValue) applyFontSize(remValue);
          break;
        }
        default:
          console.warn(`useRichTextEditor: Unknown format "${format}"`);
          return;
      }

      // Only update size from DOM, preserve other formats set by user
      const selection = window.getSelection();
      if (selection?.anchorNode) {
        let node: Node | null = selection.anchorNode;
        let detectedSize = 'md';
        while (node && node !== document.body) {
          if (node instanceof HTMLElement && node.style.fontSize) {
            const label = fontSizeToLabel(node.style.fontSize);
            if (label) detectedSize = label;
            break;
          }
          node = node.parentNode;
        }
        setActiveFormats(prev => ({ ...prev, size: detectedSize }));
      }
    },
    [editorRef, isSelectionInEditor]
  );

  // --------------------------------------------------------
  // applyColor: Apply inline color using saved range
  // --------------------------------------------------------
  const applyColor = useCallback(
    (color: string) => {
      const editor = editorRef.current;
      if (!editor || !savedRangeRef.current) return;

      // Verify the saved range is still within the current editor
      const range = savedRangeRef.current;
      const container = range.commonAncestorContainer;
      if (!editor.contains(container)) return;

      applyInlineColor(color, range);

      // Update the saved range to the newly-selected content
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0) {
        savedRangeRef.current = sel.getRangeAt(0).cloneRange();
      }

      // Update active format color
      setActiveFormats(prev => ({ ...prev, color }));
    },
    [editorRef]
  );

  // --------------------------------------------------------
  // saveSelection / restoreSelection
  // --------------------------------------------------------
  const saveSelection = useCallback(() => {
    const editor = editorRef.current;
    const sel = window.getSelection();
    if (
      sel &&
      sel.rangeCount > 0 &&
      editor &&
      editor.contains(sel.anchorNode)
    ) {
      savedRangeRef.current = sel.getRangeAt(0).cloneRange();
    }
  }, [editorRef]);

  const restoreSelection = useCallback(() => {
    const range = savedRangeRef.current;
    if (!range) return;
    const sel = window.getSelection();
    if (sel) {
      sel.removeAllRanges();
      sel.addRange(range);
    }
  }, []);

  // --------------------------------------------------------
  // ensureDefaultFontSize: Guarantee cursor is inside a font-size span
  // --------------------------------------------------------
  const ensureDefaultFontSize = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) return;

    // Don't inject a font-size span into an empty editor — that adds a node and
    // breaks the `:empty` placeholder (it would vanish on focus and never
    // return). The default size is applied once the user actually types.
    const text = (editor.textContent || '')
      .replace(/[\u200B\u200C\u200D\uFEFF]/g, '')
      .trim();
    if (!text) return;

    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;
    if (!editor.contains(selection.anchorNode)) return;

    // Walk up from cursor to check if already inside a font-size span
    let node: Node | null = selection.anchorNode;
    while (node && node !== document.body) {
      if (
        node instanceof HTMLElement &&
        node.style.fontSize &&
        node.contentEditable !== 'true'
      ) {
        return; // Already inside a font-size span
      }
      node = node.parentNode;
    }

    // Not inside one — insert default 1rem at caret
    applyFontSize('1rem');
  }, [editorRef]);

  // --------------------------------------------------------
  // getNormalizedHTML / getRawHTML
  // --------------------------------------------------------
  const getNormalizedHTML = useCallback((): string => {
    const editor = editorRef.current;
    if (!editor) return '';
    return wrapBareTextWithFontSize(editor.innerHTML);
  }, [editorRef]);

  const getRawHTML = useCallback((): string => {
    const editor = editorRef.current;
    if (!editor) return '';
    return editor.innerHTML;
  }, [editorRef]);

  // --------------------------------------------------------
  // Return
  // --------------------------------------------------------
  return {
    activeFormats,
    setActiveFormats,
    formatText,
    applyColor,
    detectFormats,
    ensureDefaultFontSize,
    saveSelection,
    restoreSelection,
    getNormalizedHTML,
    getRawHTML,
  };
}
