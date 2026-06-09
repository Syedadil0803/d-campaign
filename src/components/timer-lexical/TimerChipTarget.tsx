/**
 * TimerChipTarget — shared "which chip cell is being styled" context.
 *
 * Connects the chip component (sets the target on click) to the toolbar (reads
 * it to route style commands). A cell is any styleable piece — each number,
 * word, or colon; `cell === null` means the whole chip.
 */

'use client';

import * as React from 'react';
import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import {
  $getSelection,
  $isRangeSelection,
  $isTextNode,
  COMMAND_PRIORITY_LOW,
  SELECTION_CHANGE_COMMAND,
} from 'lexical';

/** Stable ids for every styleable piece of the chip, in reading order. */
export type ChipCell =
  | 'days-val'
  | 'days-lab'
  | 'sep-0'
  | 'hours-val'
  | 'hours-lab'
  | 'sep-1'
  | 'mins-val'
  | 'mins-lab';

export interface ChipTarget {
  chipKey: string;
  /** A specific cell, or null for the whole chip. */
  cell: ChipCell | null;
}

interface Ctx {
  target: ChipTarget | null;
  setTarget: (t: ChipTarget | null) => void;
}

const TimerChipTargetContext = createContext<Ctx>({
  target: null,
  setTarget: () => {},
});

export function useTimerChipTarget(): Ctx {
  return useContext(TimerChipTargetContext);
}

/**
 * Reports the current chip target up to a host OUTSIDE the editor (e.g. so the
 * app's own toolbar, which can't read this context, can route style commands
 * to the targeted cell). Render inside the provider.
 */
export function TimerChipTargetBridge({
  onTarget,
}: {
  onTarget?: (t: ChipTarget | null) => void;
}): null {
  const { target } = useTimerChipTarget();
  const ref = useRef(onTarget);
  ref.current = onTarget;
  useEffect(() => {
    ref.current?.(target);
  }, [target]);
  return null;
}

export function TimerChipTargetProvider({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  const [target, setTarget] = useState<ChipTarget | null>(null);
  return (
    <TimerChipTargetContext.Provider value={{ target, setTarget }}>
      {children}
      <ClearTargetOnTextSelection setTarget={setTarget} />
    </TimerChipTargetContext.Provider>
  );
}

/** Clears the chip target when the caret/selection goes into real text, so
 *  the text-styling path takes over. Chip clicks preventDefault their
 *  mousedown, so they don't create a text RangeSelection — target survives. */
function ClearTargetOnTextSelection({
  setTarget,
}: {
  setTarget: (t: ChipTarget | null) => void;
}): null {
  const [editor] = useLexicalComposerContext();
  const setTargetRef = useRef(setTarget);
  setTargetRef.current = setTarget;

  useEffect(() => {
    return editor.registerCommand(
      SELECTION_CHANGE_COMMAND,
      () => {
        const sel = $getSelection();
        if ($isRangeSelection(sel) && $isTextNode(sel.anchor.getNode())) {
          setTargetRef.current(null);
        }
        return false;
      },
      COMMAND_PRIORITY_LOW,
    );
  }, [editor]);

  return null;
}
