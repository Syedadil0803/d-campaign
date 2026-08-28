'use client';

import {
  $getNodeByKey,
  $getRoot,
  $isTextNode,
  $isElementNode,
  $createTextNode,
  $createRangeSelection,
  $setSelection,
  $getSelection,
  $isRangeSelection,
  $nodesOfType,
  HISTORIC_TAG,
  type EditorState,
  type LexicalEditor,
  type TextNode,
} from 'lexical';
import type { RefObject } from 'react';
import { $isTimerChipNode, TimerChipNode } from './TimerChipNode';
import type { ChipTarget, ChipCell } from './TimerChipTarget';
import { wrapsAtWidth } from './lineMeasure';
import {
  $applyTimerStyle,
  $readActiveFormats,
  timerStylePatch,
  SIZE_REM_TO_LABEL,
  type ActiveFormats,
  type StylePatch,
} from './format-commands';

/**
 * Everything the host can ask of the countdown from outside: apply a format or
 * a colour, read what is active, take and put back an editor state, strip the
 * styling, measure, and park the caret.
 *
 * Three refs for two hundred and seventy lines. It is imperative by nature —
 * the host drives the editor rather than rendering it — so it belongs beside
 * the component rather than inside it.
 */
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

export function useTimerFieldHandle({
  editorRef,
  targetRef,
  previousStateRef,
}: {
  editorRef: RefObject<LexicalEditor | null>;
  targetRef: RefObject<ChipTarget | null>;
  previousStateRef: RefObject<EditorState | null>;
}) {
  return {
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
      };
}
