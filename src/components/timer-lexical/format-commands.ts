/**
 * format-commands.ts — read/write timer formatting from the active selection.
 *
 * $readActiveFormats / $applyTimerStyle: text styling goes through Lexical's
 * $patchStyleText (handles partial selections), chip styling through the chip
 * node's setters. One pair the toolbar calls regardless of what's selected.
 */

import {
  $getSelection,
  $isRangeSelection,
  $isNodeSelection,
  $isTextNode,
  $isElementNode,
  $getRoot,
  type LexicalNode,
  type TextNode,
} from 'lexical';
import {
  $patchStyleText,
  $getSelectionStyleValueForProperty,
} from '@lexical/selection';
import { $isTimerChipNode, TimerChipNode } from './TimerChipNode';

// ============================================================
// Public types
// ============================================================

/** Toolbar-visible active format state. Empty string means "mixed" / unknown. */
export interface ActiveFormats {
  bold: boolean;
  italic: boolean;
  /** Resolved size label (xs/sm/md/lg/xl/xxl) or '' for mixed. */
  size: string;
  /** Resolved color in #rrggbb form, or '' for mixed. */
  color: string;
}

/** A CSS patch — kebab-case keys, '' value means "remove this property". */
export type StylePatch = Record<string, string>;

// ============================================================
// Size map — shared with the legacy editor so UX feels consistent.
// ============================================================

export const SIZE_LABEL_TO_REM: Record<string, string> = {
  xs: '0.75rem',
  sm: '0.875rem',
  md: '1rem',
  lg: '1.125rem',
  xl: '1.25rem',
  xxl: '1.5rem',
};

export const SIZE_REM_TO_LABEL: Record<string, string> = Object.fromEntries(
  Object.entries(SIZE_LABEL_TO_REM).map(([k, v]) => [v, k]),
);

// ============================================================
// Read
// ============================================================

/**
 * Read the active formats from the current selection.
 *
 *   - Chip selected on its own (NodeSelection) → read the chip's own style.
 *   - Range selection → read from the text via $getSelectionStyleValue…
 *     (chips inside the range don't carry text styles; their whole-chip
 *     style is reflected only when the chip is the sole selection).
 */
export function $readActiveFormats(): ActiveFormats {
  const sel = $getSelection();

  // Chip selected as a node → reflect its whole-chip style on the toolbar.
  if ($isNodeSelection(sel)) {
    const chip = sel.getNodes().find($isTimerChipNode);
    if (chip) {
      const st = chip.readStyle(null);
      return {
        bold: isBoldWeight(st['font-weight']),
        italic: st['font-style'] === 'italic',
        size: SIZE_REM_TO_LABEL[st['font-size'] || ''] || 'md',
        color: st['color'] || '',
      };
    }
  }

  if (!$isRangeSelection(sel)) {
    return { bold: false, italic: false, size: 'md', color: '' };
  }

  const fontWeight = $getSelectionStyleValueForProperty(sel, 'font-weight', '');
  const fontStyle = $getSelectionStyleValueForProperty(sel, 'font-style', '');
  const fontSize = $getSelectionStyleValueForProperty(sel, 'font-size', '');
  const color = $getSelectionStyleValueForProperty(sel, 'color', '');

  // Lexical's FORMAT_TEXT_COMMAND bits — honoured so imported/external text
  // that uses <strong>/<em> instead of inline CSS still highlights.
  const formatBold = sel.hasFormat('bold');
  const formatItalic = sel.hasFormat('italic');

  return {
    bold: isBoldWeight(fontWeight) || formatBold,
    italic: fontStyle === 'italic' || formatItalic,
    size: SIZE_REM_TO_LABEL[fontSize] || (fontSize ? '' : 'md'),
    color: color || '',
  };
}

// ============================================================
// Write
// ============================================================

/**
 * Apply a style patch. Three scopes, picked from the active selection:
 *
 *   1. Chip selected on its own (NodeSelection) → style just the chip via
 *      its typed setter.
 *
 *   2. Non-empty RangeSelection → selection-scoped. Text gets $patchStyleText
 *      (partial selections like "d" of "days" in the prefix style only "d");
 *      any chip the range crosses gets its whole-chip style patched.
 *
 *   3. Collapsed caret / no real selection → BOX-LEVEL. Every text node AND
 *      every chip in the field gets the patch. One uniform paint over the
 *      whole timer.
 *
 * Pass '' for a property's value to REMOVE it (toggle-off path).
 * Must be called inside an editor.update() callback.
 */
export function $applyTimerStyle(patch: StylePatch): void {
  const sel = $getSelection();

  // Scope 1 — chip-only selection → whole chip.
  if ($isNodeSelection(sel)) {
    sel
      .getNodes()
      .filter($isTimerChipNode)
      .forEach((chip) => chip.setWholeStyle(patch));
    return;
  }

  // Scope 2 — non-empty range. Text via $patchStyleText; chips → whole chip.
  if ($isRangeSelection(sel) && !sel.isCollapsed()) {
    $patchStyleText(sel, patch);
    sel
      .getNodes()
      .filter($isTimerChipNode)
      .forEach((chip) => chip.setWholeStyle(patch));
    return;
  }

  // Scope 3 — box-level. Every text node + every chip (whole) in the document.
  const root = $getRoot();
  $collectAllTextNodes(root).forEach((tn) => applyPatchToTextNode(tn, patch));
  root
    .getChildren()
    .flatMap((c) => ($isElementNode(c) ? c.getChildren() : [c]))
    .filter($isTimerChipNode)
    .forEach((chip) => (chip as TimerChipNode).setWholeStyle(patch));
}

// ============================================================
// Box-level text-node helpers
// ============================================================

function $collectAllTextNodes(root: LexicalNode): TextNode[] {
  const out: TextNode[] = [];
  const walk = (n: LexicalNode): void => {
    if ($isTextNode(n)) {
      out.push(n);
      return;
    }
    if ($isElementNode(n)) {
      n.getChildren().forEach(walk);
    }
    // Decorator nodes (e.g. the chip) are skipped — their styling lives on
    // the node itself, handled separately via setChipStyle.
  };
  walk(root);
  return out;
}

/** Merge a CSS patch into a TextNode's inline style string. Empty-value entries
 *  remove the property (toggle-off path). */
function applyPatchToTextNode(node: TextNode, patch: StylePatch): void {
  const current = parseInlineStyle(node.getStyle());
  Object.entries(patch).forEach(([k, v]) => {
    if (v === '' || v == null) delete current[k];
    else current[k] = v;
  });
  node.setStyle(serializeInlineStyle(current));
}

function parseInlineStyle(style: string): Record<string, string> {
  const out: Record<string, string> = {};
  if (!style) return out;
  style.split(';').forEach((part) => {
    const i = part.indexOf(':');
    if (i < 0) return;
    const k = part.slice(0, i).trim();
    const v = part.slice(i + 1).trim();
    if (k && v) out[k] = v;
  });
  return out;
}

function serializeInlineStyle(props: Record<string, string>): string {
  return Object.entries(props)
    .filter(([, v]) => v)
    .map(([k, v]) => `${k}: ${v}`)
    .join('; ');
}

/**
 * Build a style patch for a toolbar action.
 *
 * Bold/italic toggling is handled by the toolbar BEFORE calling this — the
 * toolbar decides on→off vs off→on by reading the current state, then passes
 * '' to remove or the value to set.
 */
export function timerStylePatch(
  action:
    | { kind: 'bold'; on: boolean }
    | { kind: 'italic'; on: boolean }
    | { kind: 'size'; label: string }
    | { kind: 'color'; value: string },
): StylePatch {
  switch (action.kind) {
    case 'bold':
      return { 'font-weight': action.on ? 'bold' : '' };
    case 'italic':
      return { 'font-style': action.on ? 'italic' : '' };
    case 'size':
      return { 'font-size': SIZE_LABEL_TO_REM[action.label] || '' };
    case 'color':
      return { color: action.value || '' };
  }
}

// ============================================================
// Internal helpers
// ============================================================

function isBoldWeight(fw: string | undefined): boolean {
  if (!fw) return false;
  if (fw === 'bold') return true;
  const n = parseInt(fw, 10);
  return Number.isFinite(n) && n >= 700;
}
