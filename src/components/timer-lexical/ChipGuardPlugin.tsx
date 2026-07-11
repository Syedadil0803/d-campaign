/**
 * ChipGuardPlugin — keeps the timer chip undeletable.
 *
 * The chip is a DecoratorNode (caret can't enter it), so the only thing to
 * guard is removal: blocks Backspace/Delete/Cut/paste-over that would remove
 * or replace the chip. Typing before/after, arrow keys, and styling pass through.
 */

'use client';

import { useEffect } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import {
  $getRoot,
  $getSelection,
  $isRangeSelection,
  $isNodeSelection,
  $isTextNode,
  $nodesOfType,
  $createParagraphNode,
  $createTextNode,
  KEY_BACKSPACE_COMMAND,
  KEY_DELETE_COMMAND,
  CUT_COMMAND,
  CONTROLLED_TEXT_INSERTION_COMMAND,
  COMMAND_PRIORITY_HIGH,
  TextNode,
  type LexicalNode,
} from 'lexical';
import { TimerChipNode, $isTimerChipNode, $createTimerChipNode } from './TimerChipNode';

/** Does the selection currently include the chip (as a selected node)? */
function $selectionHasChip(): boolean {
  const sel = $getSelection();
  if (!sel) return false;
  if ($isNodeSelection(sel)) return sel.getNodes().some($isTimerChipNode);
  if ($isRangeSelection(sel) && !sel.isCollapsed()) {
    return sel.getNodes().some($isTimerChipNode);
  }
  return false;
}

/** Collapsed caret with the chip as the immediate sibling on `side`. */
function $caretAdjacentChip(side: 'prev' | 'next'): boolean {
  const sel = $getSelection();
  if (!$isRangeSelection(sel) || !sel.isCollapsed()) return false;
  const node = sel.anchor.getNode();
  const offset = sel.anchor.offset;

  if (node.getType() === 'text') {
    const len = node.getTextContentSize();
    if (side === 'prev' && offset === 0 && $isTimerChipNode(node.getPreviousSibling())) {
      return true;
    }
    if (side === 'next' && offset === len && $isTimerChipNode(node.getNextSibling())) {
      return true;
    }
    return false;
  }

  // Element-anchored caret (e.g. paragraph): inspect the child at the side.
  const children = (node as unknown as { getChildren?: () => LexicalNode[] })
    .getChildren?.();
  if (children) {
    if (side === 'prev' && offset > 0 && $isTimerChipNode(children[offset - 1])) {
      return true;
    }
    if (side === 'next' && offset < children.length && $isTimerChipNode(children[offset])) {
      return true;
    }
  }
  return false;
}

export function ChipGuardPlugin(): null {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    if (!editor.hasNodes([TimerChipNode])) {
      // eslint-disable-next-line no-console
      console.warn('[ChipGuardPlugin] TimerChipNode not registered.');
      return;
    }

    const offs: Array<() => void> = [];

    offs.push(
      editor.registerCommand(
        KEY_BACKSPACE_COMMAND,
        (event) => {
          if ($selectionHasChip() || $caretAdjacentChip('prev')) {
            event?.preventDefault?.();
            return true;
          }
          return false;
        },
        COMMAND_PRIORITY_HIGH,
      ),
    );

    offs.push(
      editor.registerCommand(
        KEY_DELETE_COMMAND,
        (event) => {
          if ($selectionHasChip() || $caretAdjacentChip('next')) {
            event?.preventDefault?.();
            return true;
          }
          return false;
        },
        COMMAND_PRIORITY_HIGH,
      ),
    );

    offs.push(
      editor.registerCommand(
        CUT_COMMAND,
        (event) => {
          if ($selectionHasChip()) {
            event?.preventDefault?.();
            return true;
          }
          return false;
        },
        COMMAND_PRIORITY_HIGH,
      ),
    );

    offs.push(
      editor.registerCommand(
        CONTROLLED_TEXT_INSERTION_COMMAND,
        () => {
          if ($selectionHasChip()) return true; // would replace the chip
          return false;
        },
        COMMAND_PRIORITY_HIGH,
      ),
    );

    // Trailing caret slot — when the chip ends the paragraph, keep a
    // zero-width-space text node after it. Its job is native click
    // HIT-TESTING: the chip is user-select:none, so a click past its right
    // edge would otherwise get remapped to the nearest selectable text (the
    // PREFIX — the wrong side); the slot gives that click real text to land
    // in on the correct side. (Caret PAINTING next to the chip is handled
    // separately by CaretAfterChipPlugin, which draws its own caret.) The
    // slot never leaks: serialization prunes it (LexicalTimerField
    // pruneCaretSlot / serializeStorageHtml) and the line-cap ignores it.
    // Lexical runs a newly-registered transform on already-existing nodes of
    // the type, so the initially-seeded state gets its slot from this same
    // registration — no separate mount pass needed.
    offs.push(
      editor.registerNodeTransform(TimerChipNode, (chip) => {
        if (chip.getNextSibling() === null) {
          const slot = $createTextNode('\u200B');
          // Inherit the visually-adjacent run's styling (the text before the
          // chip): typing at the end extends the slot node, so an unstyled
          // slot would silently reset the user's color/bold/size mid-line.
          const prev = chip.getPreviousSibling();
          if ($isTextNode(prev)) {
            slot.setStyle(prev.getStyle());
            slot.setFormat(prev.getFormat());
          }
          chip.insertAfter(slot);
        }
      }),
    );

    // Continuous slot-style mirror — the slot must ALWAYS carry the styling
    // of the run before the chip, not just at creation: a selection-restyle
    // of the prefix ($patchStyleText) never touches the slot, and keyboard
    // entry into the slot (ArrowRight/End — no click, so focus() never runs)
    // makes Lexical sync the typing style FROM the stale slot. Mirroring here
    // fires whenever the prefix run dirties. Terminates: updating the slot
    // dirties only the slot, whose next sibling is not a chip.
    offs.push(
      editor.registerNodeTransform(TextNode, (tn) => {
        const next = tn.getNextSibling();
        if (!$isTimerChipNode(next)) return;
        const slot = next.getNextSibling();
        if (
          $isTextNode(slot) &&
          /^\u200B+$/.test(slot.getTextContent()) &&
          (slot.getStyle() !== tn.getStyle() ||
            slot.getFormat() !== tn.getFormat())
        ) {
          slot.setStyle(tn.getStyle());
          slot.setFormat(tn.getFormat());
        }
      }),
    );

    // Self-heal backstop — the countdown must NEVER be permanently removable.
    // The key-command guards above cover the normal caret cases, but if ANY edit
    // path still slips a deletion through (odd caret position, IME, drag, a
    // browser quirk), re-insert the chip immediately so it can't be lost. We
    // track the live endDate AND style model so the rebuilt chip keeps counting
    // down with its styling intact, and tag the heal so this listener (and the
    // one-line cap) ignore it. Undo/redo ('historic') is exempt: healing an
    // undone state would create a fresh history entry every Cmd+Z — an undo
    // treadmill — and the chip guards make a chip-less committed state
    // unreachable by normal edits anyway.
    const lastEndDate = { current: '' };
    const lastModel = { current: {} as ReturnType<TimerChipNode['getModel']> };
    let healing = false;
    editor.getEditorState().read(() => {
      const chips = $nodesOfType(TimerChipNode);
      if (chips.length) {
        lastEndDate.current = chips[0].getEndDate();
        lastModel.current = chips[0].getModel();
      }
    });
    offs.push(
      editor.registerUpdateListener(({ editorState, tags }) => {
        if (healing || tags.has('timer-chip-heal') || tags.has('historic')) {
          return;
        }
        let present = false;
        editorState.read(() => {
          const chips = $nodesOfType(TimerChipNode);
          if (chips.length) {
            present = true;
            lastEndDate.current = chips[0].getEndDate();
            lastModel.current = chips[0].getModel();
          }
        });
        if (present) return;
        // Chip vanished — put it back at the caret so typing continues in place.
        // The latch MUST come back down even if the heal throws (e.g. a stale
        // selection whose anchor was removed by the same edit): a stuck latch
        // would disable self-healing for the editor's whole lifetime.
        healing = true;
        try {
          editor.update(
            () => {
              const chip = $createTimerChipNode(
                lastEndDate.current || '',
                lastModel.current,
              );
              const sel = $getSelection();
              if ($isRangeSelection(sel)) {
                sel.insertNodes([chip]);
              } else {
                let para = $getRoot().getFirstChild() as LexicalNode | null;
                if (!para || !('append' in para)) {
                  para = $createParagraphNode();
                  $getRoot().append(para);
                }
                (para as unknown as { append: (n: LexicalNode) => void }).append(chip);
              }
            },
            { tag: 'timer-chip-heal', discrete: true },
          );
        } finally {
          healing = false;
        }
      }),
    );

    return () => offs.forEach((u) => u());
  }, [editor]);

  return null;
}
