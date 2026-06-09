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
  $getSelection,
  $isRangeSelection,
  $isNodeSelection,
  KEY_BACKSPACE_COMMAND,
  KEY_DELETE_COMMAND,
  CUT_COMMAND,
  CONTROLLED_TEXT_INSERTION_COMMAND,
  COMMAND_PRIORITY_HIGH,
  type LexicalNode,
} from 'lexical';
import { TimerChipNode, $isTimerChipNode } from './TimerChipNode';

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

    return () => offs.forEach((u) => u());
  }, [editor]);

  return null;
}
