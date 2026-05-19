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
import {
  FONT_SIZE_MAP,
  FONT_SIZE_LABEL_MAP,
  applyFontSize,
  applyInlineColor,
  wrapBareTextWithFontSize,
  rgbToHex,
} from '@/lib/richTextUtils';

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

      const textNodes: Node[] = [];
      function findTextNodes(node: Node) {
        if (node.nodeType === Node.TEXT_NODE) {
          const text = node.textContent?.replace(/\u200B/g, '').trim();
          if (text) textNodes.push(node);
        } else {
          node.childNodes.forEach(findTextNodes);
        }
      }
      findTextNodes(tempDiv);

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

    // Font-size: Walk up the DOM from the anchor node to find the nearest
    // element with an explicit font-size style. Default to 'md' (1rem).
    let size = 'md';
    if (selection?.anchorNode) {
      let node: Node | null = selection.anchorNode;
      while (node && node !== document.body) {
        if (node instanceof HTMLElement && node.style.fontSize) {
          const label = FONT_SIZE_LABEL_MAP[node.style.fontSize];
          if (label) size = label;
          break;
        }
        node = node.parentNode;
      }
    }

    // Color: Walk up the DOM to find the nearest element with an
    // explicit color style. Normalize rgb() to hex.
    let color = defaultColor;
    if (selection?.anchorNode) {
      let cNode: Node | null = selection.anchorNode;
      while (cNode && cNode !== document.body) {
        if (cNode instanceof HTMLElement && cNode.style.color) {
          const raw = cNode.style.color;
          color = raw.startsWith('rgb') ? rgbToHex(raw) : raw;
          break;
        }
        cNode = cNode.parentNode;
      }
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
            const label = FONT_SIZE_LABEL_MAP[node.style.fontSize];
            if (label) detectedSize = label;
            break;
          }
          node = node.parentNode;
        }
        setActiveFormats(prev => ({ ...prev, size: detectedSize }));
      }
    },
    [editorRef, isSelectionInEditor, detectFormats]
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
