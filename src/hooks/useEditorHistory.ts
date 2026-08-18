/**
 * useEditorHistory — bounded multi-step undo/redo for the announcement editor.
 *
 * Was a single-level history: one push locked "the previous state" and every
 * later push was dropped until an undo unlocked it, so Ctrl+Z could only ever
 * step back once. It now runs on the same UndoStack the promo editor uses —
 * about 30 actions, newest-first, with typing bursts collapsed into one step.
 *
 * Two stacks, because the link popup is a separate editing surface with its own
 * field: undo inside it should step back the URL, not the announcement text.
 */

'use client';

import { useRef, useCallback } from 'react';
import { UndoStack } from '@/lib/undoStack';
import { EditorSnapshot, LinkSnapshot } from '@/lib/historyManager';

export interface UseEditorHistoryReturn {
  /** A discrete action (color, format, delete run) — always its own step. */
  pushImmediateState: (snapshot: EditorSnapshot) => void;
  /** Ordinary typing — collapses into one step for the length of the burst. */
  pushTypingState: (snapshot: EditorSnapshot) => void;
  pushLinkState: (snapshot: LinkSnapshot) => void;
  undoEditor: (current: EditorSnapshot) => EditorSnapshot | null;
  redoEditor: (current: EditorSnapshot) => EditorSnapshot | null;
  undoLink: (current: LinkSnapshot) => LinkSnapshot | null;
  redoLink: (current: LinkSnapshot) => LinkSnapshot | null;
  /** Drop both histories — used when the editor moves to a different message. */
  commit: () => void;
}

export function useEditorHistory(): UseEditorHistoryReturn {
  const editorHistory = useRef(new UndoStack<EditorSnapshot>()).current;
  const linkHistory = useRef(new UndoStack<LinkSnapshot>()).current;

  const pushImmediateState = useCallback((snapshot: EditorSnapshot) => {
    editorHistory.push(snapshot, { force: true });
  }, []);

  const pushTypingState = useCallback((snapshot: EditorSnapshot) => {
    editorHistory.push(snapshot);
  }, []);

  const pushLinkState = useCallback((snapshot: LinkSnapshot) => {
    linkHistory.push(snapshot, { force: true });
  }, []);

  const undoEditor = useCallback(
    (current: EditorSnapshot) => editorHistory.undo(current),
    [],
  );

  const redoEditor = useCallback(
    (current: EditorSnapshot) => editorHistory.redo(current),
    [],
  );

  const undoLink = useCallback(
    (current: LinkSnapshot) => linkHistory.undo(current),
    [],
  );

  const redoLink = useCallback(
    (current: LinkSnapshot) => linkHistory.redo(current),
    [],
  );

  const commit = useCallback(() => {
    editorHistory.clear();
    linkHistory.clear();
  }, []);

  return {
    pushImmediateState,
    pushTypingState,
    pushLinkState,
    undoEditor,
    redoEditor,
    undoLink,
    redoLink,
    commit,
  };
}
