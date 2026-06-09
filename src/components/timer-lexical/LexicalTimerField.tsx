/**
 * LexicalTimerField — the timer editor PromoSection mounts.
 *
 * Wraps TimerEditor and exposes an imperative ref API so the app's own toolbar
 * can drive bold/italic/size/color (cell-aware via the chip target). Emits the
 * legacy `timerText` string (for the published render) AND the full Lexical
 * state JSON (`onStateJson`, the source of truth that carries all styling).
 */

'use client';

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
} from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import {
  $getRoot,
  $getNodeByKey,
  $isTextNode,
  $isElementNode,
  $createTextNode,
  $createRangeSelection,
  $setSelection,
  $nodesOfType,
  type EditorState,
  type LexicalEditor,
} from 'lexical';
import { TimerEditor } from './TimerEditor';
import { $isTimerChipNode, TimerChipNode } from './TimerChipNode';
import type { ChipTarget } from './TimerChipTarget';
import { wrapsAtWidth } from './lineMeasure';
import {
  $applyTimerStyle,
  $readActiveFormats,
  timerStylePatch,
  SIZE_REM_TO_LABEL,
  type ActiveFormats,
  type StylePatch,
} from './format-commands';

// ============================================================
// Public contract
// ============================================================

interface Props {
  /** Storage HTML string. Legacy format: `"prefix{timer}suffix"`. Used to
   *  seed the editor when no full state JSON is available. */
  timerText: string;
  endDate: string;
  /** Full Lexical state JSON — when present, seeds the editor with FULL
   *  fidelity (per-char text styles + chip per-cell styles). Takes precedence
   *  over `timerText` for the initial content. */
  initialStateJson?: string;
  /** Fires with the legacy storage string (`prefix{timer}suffix`) on commit,
   *  for the published render + sample templates. */
  onChange: (timerText: string) => void;
  /** Fires with the full Lexical state JSON on commit — the source of truth
   *  for round-tripping all styling. */
  onStateJson?: (json: string) => void;
  /** Called when the editor gains focus. */
  onFocus?: () => void;
  /** Fires when the chip styling target changes (a cell clicked / cleared),
   *  so an external toolbar can refresh its active-format highlighting. */
  onTargetChange?: () => void;
  /** Fires when an edit was reverted for exceeding one line (host warns). */
  onLineOverflow?: () => void;
  /** Render the editor's built-in toolbar (bold/italic/size/color + chip
   *  cell styling). */
  showToolbar?: boolean;
  /** Visual chrome: 'shell' (bordered card) or 'inline' (host-styled). */
  chrome?: 'shell' | 'inline';
  className?: string;
}

export interface LexicalTimerFieldHandle {
  /** Drive a toolbar format action (e.g. `'bold'`, `'italic'`, `'size-xl'`).
   *  Returns the active formats read RIGHT AFTER applying, so the toolbar can
   *  reflect the new state without a stale re-read. */
  applyFormat(format: string): ActiveFormats;
  /** Apply an inline color; returns the resulting active formats. */
  applyColor(color: string): ActiveFormats;
  /** Read the active formats at the current selection — used by the toolbar
   *  to highlight active buttons. */
  getActiveFormats(): ActiveFormats;
  /** True if the timer would wrap to a 2nd line at the given content width.
   *  Used by PromoSection to decide whether the timer needs the card
   *  stretched (wraps at the narrow card but fits at the wide one). */
  wrapsAtContentWidth(width: number): boolean;
  /** Focus the editor (used when the user clicks the surrounding chrome). */
  focus(): void;
}

const TIMER_TOKEN = '{timer}';

// ============================================================
// Component
// ============================================================

export const LexicalTimerField = forwardRef<
  LexicalTimerFieldHandle,
  Props
>(function LexicalTimerField(
  {
    timerText,
    endDate,
    initialStateJson,
    onChange,
    onStateJson,
    onFocus,
    onTargetChange,
    onLineOverflow,
    showToolbar,
    chrome,
    className,
  },
  ref,
) {
  // Parse the incoming storage HTML to get the initial prefix/suffix. Memo'd
  // on the FIRST timerText we see — Lexical initializes its state ONCE from
  // editorState; later changes to `initial` would be ignored anyway, so we
  // avoid recomputing.
  const initial = useMemo(() => parseStorageHtml(timerText), []); // eslint-disable-line react-hooks/exhaustive-deps

  const editorRef = useRef<LexicalEditor | null>(null);
  // Latest timerText prop, mirrored into a ref so handleChange can
  // short-circuit "we just synced this in" without depending on a closure.
  const lastSyncedTextRef = useRef<string>(timerText);
  // The current chip styling target, mirrored out of the editor context so
  // the app's external toolbar (driven through this imperative handle) can
  // route style commands to the targeted cell / whole chip.
  const targetRef = useRef<ChipTarget | null>(null);

  useImperativeHandle(
    ref,
    () => ({
      applyFormat(format: string): ActiveFormats {
        const ed = editorRef.current;
        const fallback: ActiveFormats = { bold: false, italic: false, size: 'md', color: '' };
        if (!ed) return fallback;
        let result = fallback;
        ed.update(() => {
          let patch: StylePatch | null = null;
          if (format === 'bold' || format === 'italic') {
            const cur = $currentFormats(targetRef.current);
            const isOn = format === 'bold' ? cur.bold : cur.italic;
            patch = timerStylePatch({ kind: format, on: !isOn });
          } else if (format.startsWith('size-')) {
            patch = timerStylePatch({ kind: 'size', label: format.replace('size-', '') });
          }
          if (patch) $applyToTarget(targetRef.current, patch);
          // Read the resulting state inside the SAME update (target-based for
          // chips, just-applied selection for text) — reliable, no stale
          // re-read after the toolbar click collapses the selection.
          result = $currentFormats(targetRef.current);
        });
        return result;
      },
      applyColor(value: string): ActiveFormats {
        const ed = editorRef.current;
        const fallback: ActiveFormats = { bold: false, italic: false, size: 'md', color: '' };
        if (!ed) return fallback;
        let result = fallback;
        ed.update(() => {
          $applyToTarget(targetRef.current, timerStylePatch({ kind: 'color', value }));
          result = $currentFormats(targetRef.current);
        });
        return result;
      },
      wrapsAtContentWidth(width: number): boolean {
        const root = editorRef.current?.getRootElement();
        return root ? wrapsAtWidth(root, width) : false;
      },
      getActiveFormats(): ActiveFormats {
        const ed = editorRef.current;
        if (!ed) return { bold: false, italic: false, size: 'md', color: '' };
        let out: ActiveFormats = { bold: false, italic: false, size: 'md', color: '' };
        ed.getEditorState().read(() => {
          out = $currentFormats(targetRef.current);
        });
        return out;
      },
      focus() {
        const ed = editorRef.current;
        if (!ed) return;
        // If the click ALREADY landed a caret inside the editor (e.g. the user
        // clicked in the prefix text), respect it — do NOT yank the caret to
        // the end. Only force a caret position when focus is outside the editor
        // (e.g. the user clicked the wrapper's padding, where the browser has
        // no text to anchor to).
        const root = ed.getRootElement();
        const domSel = typeof window !== 'undefined' ? window.getSelection() : null;
        if (
          root &&
          domSel &&
          domSel.rangeCount > 0 &&
          root.contains(domSel.anchorNode)
        ) {
          ed.focus();
          return;
        }
        // Position the caret OUTSIDE the chip before focusing — at the
        // paragraph-element offset right after the last child. Without this,
        // Lexical's default focus() puts the caret at the END of the
        // document (which recurses into the chip's last text descendant —
        // " mins" — and lands the caret INSIDE the chip).
        ed.update(() => {
          const root = $getRoot();
          const para = root.getLastChild();
          if (!para || !$isElementNode(para)) return;
          const childrenSize = para.getChildrenSize();
          const sel = $createRangeSelection();
          // Element-level anchor at offset === childrenSize positions the
          // caret AFTER the last child (the chip), at the paragraph level,
          // not recursing into any descendant. Typing here creates a new
          // text node as a sibling of the chip — exactly what we want.
          sel.anchor.set(para.getKey(), childrenSize, 'element');
          sel.focus.set(para.getKey(), childrenSize, 'element');
          $setSelection(sel);
        });
        ed.focus();
      },
    }),
    [],
  );

  const handleChange = (state: EditorState, editor: LexicalEditor) => {
    editorRef.current = editor;
    // Full-fidelity state JSON (carries text + chip cell styles).
    if (onStateJson) onStateJson(JSON.stringify(state.toJSON()));
    state.read(() => {
      const html = serializeStorageHtml();
      // Suppress the redundant legacy-string onChange when nothing relevant
      // to it changed (e.g. a chip-cell style edit that doesn't affect the
      // prefix{timer}suffix string).
      if (html === lastSyncedTextRef.current) return;
      lastSyncedTextRef.current = html;
      onChange(html);
    });
  };

  // External text sync: when the panel inputs (or any outside source) change
  // `timerText`, replace the prefix/suffix text nodes in the editor while
  // preserving the chip. Inline styles on prefix/suffix text are dropped on
  // external edits — that's expected: the panel is the plain-text input, the
  // preview is where styles live.
  useEffect(() => {
    const ed = editorRef.current;
    if (!ed) return;
    // If the editor's current serialization already equals this prop, skip —
    // we got here because the editor just emitted this very text via onChange.
    if (lastSyncedTextRef.current === timerText) return;
    const parsed = parseStorageHtml(timerText);
    ed.update(
      () => {
        const root = $getRoot();
        const para = root.getFirstChild() as unknown as {
          getChildren: () => unknown[];
        } | null;
        if (!para) return;
        // Snapshot the chip so we can keep it (and its child structure)
        // intact while we rebuild the surrounding text.
        const children = para.getChildren() as unknown[];
        let chip: unknown = null;
        children.forEach((c) => {
          if ($isTimerChipNode(c as never)) chip = c;
        });
        if (!chip) return;
        // Compare against the editor's current prefix/suffix; only rewrite
        // if the incoming text actually differs.
        let curPrefix = '';
        let curSuffix = '';
        let seen = false;
        children.forEach((c) => {
          if ($isTimerChipNode(c as never)) {
            seen = true;
            return;
          }
          if ($isTextNode(c as never)) {
            const t = (c as { getTextContent: () => string }).getTextContent();
            if (seen) curSuffix += t;
            else curPrefix += t;
          }
        });
        if (curPrefix === parsed.prefix && curSuffix === parsed.suffix) return;
        // Remove every non-chip child, then re-insert: prefix text, chip,
        // suffix text. Lexical's setTextContent on a TextNode preserves its
        // style — but the panel is the plain-text input by design, so we
        // create fresh nodes here (no styles carried over).
        const removeMe: Array<{ remove: () => void }> = [];
        children.forEach((c) => {
          if (!$isTimerChipNode(c as never)) {
            removeMe.push(c as { remove: () => void });
          }
        });
        removeMe.forEach((n) => n.remove());
        // After removal, the chip is the only child. Now wrap with new text.
        if (parsed.prefix) {
          // insertBefore the chip
          // Use lexical's $createTextNode-equivalent via importing it
          const tn = $createTextNode(parsed.prefix);
          (chip as { insertBefore: (n: unknown) => void }).insertBefore(tn);
        }
        if (parsed.suffix) {
          const tn = $createTextNode(parsed.suffix);
          (chip as { insertAfter: (n: unknown) => void }).insertAfter(tn);
        }
        lastSyncedTextRef.current = timerText;
      },
      { tag: 'timer-text-external-sync' },
    );
  }, [timerText]);

  // Sync the chip's endDate whenever the prop changes. The editor was seeded
  // ONCE on mount, so without this, picking a different campaign end date in
  // PromoSection (or having it populated after the editor mounted) leaves the
  // chip stuck on its original value — the live tick keeps reading the stale
  // date and renders all "--". Tagged so the line-cap-style listeners can
  // distinguish this from a user edit.
  useEffect(() => {
    const ed = editorRef.current;
    if (!ed) return;
    ed.update(
      () => {
        $nodesOfType(TimerChipNode).forEach((chip) => {
          if (chip.getEndDate() !== endDate) {
            chip.setEndDate(endDate);
          }
        });
      },
      { tag: 'timer-enddate-sync' },
    );
  }, [endDate]);

  return (
    <TimerEditor
      initialContent={{
        prefixText: initial.prefix,
        suffixText: initial.suffix,
        endDate,
      }}
      // Full-fidelity seed when available (restores text + chip cell styles).
      initialStateJson={initialStateJson}
      showToolbar={showToolbar ?? false}
      chrome={chrome}
      onChange={handleChange}
      onEditorReady={(editor) => {
        editorRef.current = editor;
      }}
      onTargetChange={(t) => {
        targetRef.current = t;
        onTargetChange?.();
      }}
      onLineOverflow={onLineOverflow}
      className={className}
    />
  );
});

// ============================================================
// Target-aware style helpers (run inside editor.update / .read)
//
// These let the external app toolbar route style commands to the chip cell /
// whole chip when a chip part is targeted, or to the text selection otherwise.
// ============================================================

/** Apply a patch to the targeted chip cell / whole chip, else to the text. */
function $applyToTarget(target: ChipTarget | null, patch: StylePatch): void {
  if (target) {
    const chip = $getNodeByKey(target.chipKey);
    if ($isTimerChipNode(chip)) {
      if (target.cell) chip.setCellStyle(target.cell, patch);
      else chip.setWholeStyle(patch);
      return;
    }
  }
  $applyTimerStyle(patch);
}

/** Read active formats from the targeted chip cell / whole chip, else text. */
function $currentFormats(target: ChipTarget | null): ActiveFormats {
  if (target) {
    const chip = $getNodeByKey(target.chipKey);
    if ($isTimerChipNode(chip)) {
      const css = chip.readStyle(target.cell);
      const fw = css['font-weight'];
      return {
        bold: fw === 'bold' || (parseInt(fw || '', 10) || 0) >= 700,
        italic: css['font-style'] === 'italic',
        size: SIZE_REM_TO_LABEL[css['font-size'] || ''] || 'md',
        color: css['color'] || '',
      };
    }
  }
  return $readActiveFormats();
}

// ============================================================
// Legacy HTML <-> Lexical adapter
//
// Storage formats this can parse:
//   - "prefix{timer}suffix"                 (TIMER_FIXED_TOKEN marker)
//   - "prefix<span data-timer-fixed>...</span>suffix"   (rendered chip span)
//   - free text → all of it is treated as prefix, suffix empty
//
// Storage format this emits:
//   - "prefix{timer}suffix"                 (token form; PromoSection's
//                                            buildTimerDisplayHtml expands it)
// ============================================================

function parseStorageHtml(html: string): { prefix: string; suffix: string } {
  if (!html) return { prefix: '', suffix: '' };

  if (html.includes(TIMER_TOKEN)) {
    const i = html.indexOf(TIMER_TOKEN);
    return {
      prefix: stripTags(html.slice(0, i)),
      suffix: stripTags(html.slice(i + TIMER_TOKEN.length)),
    };
  }

  const chipMatch = html.match(
    /^([\s\S]*?)<span\b[^>]*\bdata-timer-fixed\b[\s\S]*?<\/span>([\s\S]*)$/,
  );
  if (chipMatch) {
    return {
      prefix: stripTags(chipMatch[1]),
      suffix: stripTags(chipMatch[2]),
    };
  }

  return { prefix: stripTags(html), suffix: '' };
}

function stripTags(s: string): string {
  return s
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function serializeStorageHtml(): string {
  const root = $getRoot();
  const para = root.getFirstChild();
  if (!para || !('getChildren' in para)) return TIMER_TOKEN;

  let prefix = '';
  let suffix = '';
  let seenChip = false;
  (para as unknown as { getChildren: () => unknown[] })
    .getChildren()
    .forEach((c: unknown) => {
      if ($isTimerChipNode(c as never)) {
        seenChip = true;
        return;
      }
      if ($isTextNode(c as never)) {
        const tn = c as {
          getTextContent: () => string;
          getStyle: () => string;
        };
        const text = escapeHtml(tn.getTextContent());
        const style = tn.getStyle();
        // Emit a styled span so the preview's buildTimerDisplayHtml can
        // render the user's prefix/suffix styling. Plain text without
        // inline styles is emitted as raw text to keep storage small.
        const piece = style
          ? `<span style="${escapeAttr(style)}">${text}</span>`
          : text;
        if (seenChip) suffix += piece;
        else prefix += piece;
      }
    });

  return `${prefix}${TIMER_TOKEN}${suffix}`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeAttr(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}

// ============================================================
// Internal: a focus-event capture plugin (optional). Currently unused but
// kept for future hookup if PromoSection needs Lexical-focus → currentField
// integration. The empty hook avoids a "no exports" tree-shake issue.
// ============================================================

export function _FocusCapturePlugin({
  onEditorFocus,
}: {
  onEditorFocus?: () => void;
}): null {
  const [editor] = useLexicalComposerContext();
  useEffect(() => {
    if (!onEditorFocus) return;
    return editor.registerRootListener((rootElement, prevRootElement) => {
      if (prevRootElement) prevRootElement.removeEventListener('focus', onEditorFocus);
      if (rootElement) rootElement.addEventListener('focus', onEditorFocus);
    });
  }, [editor, onEditorFocus]);
  return null;
}
