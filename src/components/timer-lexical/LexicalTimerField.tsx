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
import {
  $getRoot,
  $getNodeByKey,
  $getSelection,
  $isRangeSelection,
  $isTextNode,
  $isElementNode,
  $createTextNode,
  $createRangeSelection,
  $setSelection,
  $nodesOfType,
  type EditorState,
  type LexicalEditor,
  type TextNode,
} from 'lexical';
import { HISTORIC_TAG } from 'lexical';
import { TimerEditor } from './TimerEditor';
import {
  parseStorageHtml,
  serializeStorageHtml,
} from './timerStorageHtml';
import { $isTimerChipNode, TimerChipNode } from './TimerChipNode';
import type { ChipCell, ChipTarget } from './TimerChipTarget';
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
  /**
   * Replace the editor's contents with a previously serialized state.
   *
   * `initialStateJson` reaches createEditor and is therefore read once, at
   * creation. Without this there was no way to put a different state back, so
   * restoring an undo snapshot changed the stored card and left the countdown
   * on screen untouched — the countdown simply could not be undone.
   */
  loadStateJson(json: string): void;
  /**
   * The editor's state right now, for the undo stack to hold.
   *
   * An EditorState, not the serialized JSON. Three reasons, and each is a bug
   * the JSON caused: it is available SYNCHRONOUSLY, so a push records the
   * moment it happens rather than whatever onStateJson last reported; it
   * carries the selection, so a restore puts the caret back where it was; and
   * it is the same object Lexical restores, so nothing is re-parsed.
   */
  getEditorState(): EditorState | null;
  /**
   * The state as it was BEFORE the most recent change.
   *
   * The countdown reports a change only once the change is already in it, so a
   * step recorded from that callback has to reach one further back — the same
   * reason pushPromoStateFromConfig reads the config rather than the editor.
   */
  getPreviousEditorState(): EditorState | null;
  /**
   * Put a state back, atomically, tagged as history so the change it provokes
   * is recognised as an echo rather than an edit.
   */
  restoreEditorState(state: EditorState): void;
  /**
   * Strip every inline style from the countdown — text and chip alike.
   *
   * The counterpart of loadStateJson for a snapshot taken before the countdown
   * was ever styled. Such a card has no state JSON to load, so loadStateJson
   * had nothing to do and the styling simply stayed on screen: undo stepped
   * back past a colour or a bold and the countdown kept it.
   */
  clearStyles(): void;
  /** Focus the editor (used when the user clicks the surrounding chrome).
   *  Pass the click's clientX so a click next to the chip lands the caret on
   *  the correct side of the countdown. */
  focus(clientX?: number): void;
}


/** Every styleable cell of the chip, for the whole-chip checks below. */
const CHIP_CELLS: ChipCell[] = [
  'days-val',
  'days-lab',
  'sep-0',
  'hours-val',
  'hours-lab',
  'sep-1',
  'mins-val',
  'mins-lab',
];

/** Minimal shape of a serialized Lexical node for pruning. */
interface PrunableNode {
  type?: string;
  text?: string;
  children?: PrunableNode[];
}

/** Remove the ZWSP caret-slot from a serialized editor state, in place.
 *  Strips ​ from text nodes and drops nodes that become empty — so the
 *  slot (editor presentation chrome) never leaks into stored timerStateJson. */
function pruneCaretSlot(node: PrunableNode): void {
  if (!Array.isArray(node.children)) return;
  node.children = node.children.filter((child) => {
    if (child.type === 'text' && typeof child.text === 'string') {
      child.text = child.text.replace(/\u200B/g, '');
      if (child.text === '') return false;
    }
    return true;
  });
  node.children.forEach(pruneCaretSlot);
}

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
    // DEFECT, recorded rather than silenced: PromoSection passes this and
    // nothing here ever calls it. The plugin written to register it on the
    // editor root was never rendered and has since been deleted. Wiring it up
    // changes behaviour, so it belongs in its own change rather than in a
    // restructuring pass.
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
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
  /** The state before the most recent change — see getPreviousEditorState. */
  const previousStateRef = useRef<EditorState | null>(null);
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
      getEditorState(): EditorState | null {
        return editorRef.current?.getEditorState() ?? null;
      },
      getPreviousEditorState(): EditorState | null {
        return previousStateRef.current;
      },
      restoreEditorState(state: EditorState) {
        editorRef.current?.setEditorState(state, { tag: HISTORIC_TAG });
      },
      loadStateJson(json: string) {
        const ed = editorRef.current;
        if (!ed || !json) return;
        try {
          ed.setEditorState(ed.parseEditorState(json));
          // The change this provokes is an echo of what was just loaded. It is
          // left to reach the host, which compares it against the card it just
          // restored and records no step for it — see PromoPreviewTimer.
        } catch {
          // A state this build cannot parse (an older shape, say). Leaving the
          // editor as it is beats clearing the user's countdown.
        }
      },
      clearStyles() {
        const ed = editorRef.current;
        if (!ed) return;
        /**
         * Read before writing. This runs on every restore, including the one
         * that seeds the editors when a card is first loaded, and an editor
         * update reports a new state to the host — which would mark a card
         * unsaved the moment it appeared. Nothing to strip, nothing to do.
         */
        let dirty = false;
        ed.getEditorState().read(() => {
          dirty =
            $getRoot()
              .getAllTextNodes()
              .some((node) => node.getStyle() !== '' || node.getFormat() !== 0) ||
            $nodesOfType(TimerChipNode).some((chip) =>
              // Whole-chip styling and every cell — a colour applied to just
              // the hours is as much styling as one applied to all of it.
              CHIP_CELLS.some(
                (cell) => Object.keys(chip.readStyle(cell)).length > 0,
              ),
            );
        });
        if (!dirty) return;
        ed.update(() => {
          // An empty value deletes the property rather than setting it — see
          // applyPatchToTextNode in format-commands.
          const reset: StylePatch = {
            'font-weight': '',
            'font-style': '',
            'font-size': '',
            color: '',
          };
          $getRoot()
            .getAllTextNodes()
            .forEach((node) => {
              node.setStyle('');
              node.setFormat(0);
            });
          $nodesOfType(TimerChipNode).forEach((chip) => {
            chip.setWholeStyle(reset);
            CHIP_CELLS.forEach((cell) => chip.setCellStyle(cell, reset));
          });
        });
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
      focus(clientX?: number) {
        const ed = editorRef.current;
        if (!ed) return;
        // If the click ALREADY landed a caret inside the editor (e.g. the user
        // clicked in the prefix text), respect it — do NOT yank the caret to
        // the end. Only force a caret position when focus is outside the editor
        // (e.g. the user clicked the wrapper's padding, where the browser has
        // no text to anchor to).
        const root = ed.getRootElement();
        const domSel = typeof window !== 'undefined' ? window.getSelection() : null;
        const anchor =
          domSel && domSel.rangeCount > 0 ? domSel.anchorNode : null;
        // A NON-collapsed selection is a deliberate drag (e.g. selecting
        // across the countdown to style the whole line) — never reposition
        // it, or the selection collapses on mouseup and toolbar styling
        // targets nothing.
        if (
          domSel &&
          !domSel.isCollapsed &&
          anchor &&
          root &&
          root.contains(anchor)
        ) {
          ed.focus();
          return;
        }
        // Is the click's anchor INSIDE the chip's own (non-editable) text?
        // Clicking on/near the countdown ("… 34 mins") lands the browser caret
        // in the chip's " mins" span — a text node, but one the caret can't
        // usefully sit in. Detect that so we DON'T respect it below.
        const anchorEl: HTMLElement | null =
          anchor && anchor.nodeType === 3
            ? anchor.parentElement
            : (anchor as HTMLElement | null);
        const insideChip = !!(
          anchorEl &&
          root &&
          root.contains(anchorEl) &&
          anchorEl.closest('[data-timer-chip]')
        );
        // Which side of the chip did the click fall on? The browser's own
        // hit-test is UNTRUSTWORTHY around the chip: the countdown is
        // user-select:none, so a click past its right edge gets remapped to
        // the nearest selectable text — the PREFIX, on the wrong side. (That
        // was the bug: click at the end → caret silently lands at the start.)
        // The pointer X vs the chip's box is the ground truth for intent.
        const chipEl = root
          ? (root.querySelector('[data-timer-chip]') as HTMLElement | null)
          : null;
        const haveX = typeof clientX === 'number' && !!chipEl;
        let clickedStart = false;
        if (haveX && chipEl) {
          const r = chipEl.getBoundingClientRect();
          clickedStart = (clientX as number) < r.left + r.width / 2;
        }
        // Which side of the chip did the browser's caret land on?
        let anchorAfterChip = false;
        let anchorBeforeChip = false;
        if (chipEl && anchor && root && root.contains(anchor)) {
          const rel = chipEl.compareDocumentPosition(anchor);
          anchorAfterChip = !!(rel & Node.DOCUMENT_POSITION_FOLLOWING);
          anchorBeforeChip = !!(rel & Node.DOCUMENT_POSITION_PRECEDING);
        }
        // Clicked one side but the caret landed on the other → the hit-test
        // lied; do NOT respect it.
        const sideMismatch =
          haveX &&
          ((clickedStart && anchorAfterChip) ||
            (!clickedStart && anchorBeforeChip));
        // Respect the click's caret ONLY if it landed inside a real TEXT node
        // that is NOT part of the chip AND agrees with the clicked side — that
        // renders a usable, visible caret exactly where the user aimed.
        const inText = !!(
          root &&
          anchor &&
          root.contains(anchor) &&
          anchor.nodeType === 3 &&
          !insideChip &&
          !sideMismatch
        );
        if (inText) {
          ed.focus();
          return;
        }
        // A chip with no text node beside it can't show a caret. Insert a text
        // node on the clicked side and select it. A LEADING caret renders fine
        // in an empty node (the chip follows it), but a TRAILING empty node
        // after an inline decorator gets NO rendered caret — so it needs a
        // zero-width space to give the caret a real position. The ZWSP is
        // stripped on serialize, so it never reaches storage.
        ed.update(() => {
          const rootN = $getRoot();
          const para = rootN.getLastChild();
          if (!para || !$isElementNode(para)) return;
          const first = para.getFirstChild();
          const last = para.getLastChild();
          // After parking the caret, carry the landing run's styling into the
          // selection's "next typing" state \u2014 a programmatic select() resets
          // it to default, which made typing after a styled run (or in the
          // unstyled ZWSP slot) silently drop the user's color/bold/size.
          const syncTypingStyle = (node: TextNode) => {
            let src: unknown = node;
            // The slot itself carries no user styling \u2014 inherit from the run
            // before the chip (the text the caret is visually attached to),
            // and refresh the slot so keyboard entry inherits too.
            if (/^\u200B+$/.test(node.getTextContent())) {
              let prev = node.getPreviousSibling();
              if ($isTimerChipNode(prev)) prev = prev.getPreviousSibling();
              if ($isTextNode(prev)) {
                src = prev;
                node.setStyle(prev.getStyle());
                node.setFormat(prev.getFormat());
              }
            }
            const s = $getSelection();
            if ($isRangeSelection(s) && $isTextNode(src as never)) {
              s.style = (src as TextNode).getStyle();
              s.format = (src as TextNode).getFormat();
            }
          };
          if (clickedStart && first && $isTimerChipNode(first)) {
            // No prefix: bracket the chip with an empty head node, inheriting
            // the styling of the run AFTER the chip (the text the new prefix
            // will visually join) so typing here doesn't reset to default.
            const head = $createTextNode('');
            const after = first.getNextSibling();
            if ($isTextNode(after)) {
              head.setStyle(after.getStyle());
              head.setFormat(after.getFormat());
            }
            first.insertBefore(head);
            head.select();
          } else if (clickedStart && first && $isTextNode(first)) {
            first.select(0, 0);
            syncTypingStyle(first);
          } else if (last && $isTextNode(last)) {
            // ChipGuardPlugin maintains a zero-width-space slot after a
            // trailing chip, so the end is always REAL text \u2014 land the caret
            // at its end, where the browser can actually paint it. (The slot
            // is guaranteed by the chip transform, so no create-fallback is
            // needed here; the element-level branch below covers any truly
            // empty paragraph.)
            const len = last.getTextContentSize();
            last.select(len, len);
            syncTypingStyle(last);
          } else {
            const childrenSize = para.getChildrenSize();
            const sel = $createRangeSelection();
            sel.anchor.set(para.getKey(), childrenSize, 'element');
            sel.focus.set(para.getKey(), childrenSize, 'element');
            $setSelection(sel);
          }
        });
        ed.focus();
      },
    }),
    [],
  );

  const handleChange = (
    state: EditorState,
    editor: LexicalEditor,
    tags: Set<string>,
  ) => {
    editorRef.current = editor;
    /**
     * A restore, not an edit.
     *
     * Recognised by the tag the restore carried rather than by a flag on a
     * timer, which the callback could outrun — the flag was cleared on a
     * setTimeout and this fires whenever Lexical commits.
     */
    if (tags.has(HISTORIC_TAG)) {
      // Still record it: the next edit's "before" is this restored state.
      previousStateRef.current = state;
      return;
    }
    // Full-fidelity state JSON (carries text + chip cell styles). The ZWSP
    // caret slot ChipGuardPlugin maintains is presentation chrome and must
    // NOT reach storage: if it did, merely opening the editor would emit a
    // stateJson that differs from the saved one → phantom "unsaved changes",
    // draft banners, and duplicate saved variants. Strip it; the guard
    // re-creates it when the state is seeded back in.
    if (onStateJson) {
      const json = state.toJSON();
      pruneCaretSlot(json.root as unknown as PrunableNode);
      onStateJson(JSON.stringify(json));
    }
    state.read(() => {
      const html = serializeStorageHtml();
      // Suppress the redundant legacy-string onChange when nothing relevant
      // to it changed (e.g. a chip-cell style edit that doesn't affect the
      // prefix{timer}suffix string).
      if (html === lastSyncedTextRef.current) return;
      lastSyncedTextRef.current = html;
      onChange(html);
    });
    // Last, so everything above still sees the state this change replaced.
    previousStateRef.current = state;
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
            // Strip the ZWSP caret slot — parseStorageHtml never produces it,
            // so leaving it in would make this equality check always FAIL for
            // a trailing chip and the "no-op" echo below would destructively
            // rebuild the text (dropping the user's styling) on every sync.
            const t = (c as { getTextContent: () => string })
              .getTextContent()
              .replace(/\u200B/g, '');
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






