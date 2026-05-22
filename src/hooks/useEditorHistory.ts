/**
 * useEditorHistory — React hook for 1-level undo/redo.
 * 
 * Push before any destructive/style change.
 * Undo = restore previous. Redo = restore what was undone from.
 * Each new push overwrites the previous.
 */

'use client';

import { useRef, useState, useCallback } from 'react';
import { HistoryManager, EditorSnapshot, LinkSnapshot } from '@/lib/historyManager';

export interface UseEditorHistoryReturn {
  pushImmediateState: (snapshot: EditorSnapshot) => void;
  pushLinkState: (snapshot: LinkSnapshot) => void;
  unlockEditor: () => void;
  undoEditor: (current: EditorSnapshot) => EditorSnapshot | null;
  redoEditor: (current: EditorSnapshot) => EditorSnapshot | null;
  undoLink: (current: LinkSnapshot) => LinkSnapshot | null;
  redoLink: (current: LinkSnapshot) => LinkSnapshot | null;
  commit: () => void;
  canUndoEditor: boolean;
  canRedoEditor: boolean;
  canUndoLink: boolean;
  canRedoLink: boolean;
}

export function useEditorHistory(): UseEditorHistoryReturn {
  const editorHistory = useRef(new HistoryManager<EditorSnapshot>('Editor')).current;
  const linkHistory = useRef(new HistoryManager<LinkSnapshot>('Link')).current;

  const [canUndoEditor, setCanUndoEditor] = useState(false);
  const [canRedoEditor, setCanRedoEditor] = useState(false);
  const [canUndoLink, setCanUndoLink] = useState(false);
  const [canRedoLink, setCanRedoLink] = useState(false);

  function syncEditorButtons() {
    setCanUndoEditor(editorHistory.canUndo());
    setCanRedoEditor(editorHistory.canRedo());
  }

  function syncLinkButtons() {
    setCanUndoLink(linkHistory.canUndo());
    setCanRedoLink(linkHistory.canRedo());
  }

  const pushImmediateState = useCallback((snapshot: EditorSnapshot) => {
    editorHistory.pushState(snapshot);
    syncEditorButtons();
  }, []);

  const pushLinkState = useCallback((snapshot: LinkSnapshot) => {
    linkHistory.pushState(snapshot);
    syncLinkButtons();
  }, []);

  const unlockEditor = useCallback(() => {
    editorHistory.unlock();
    syncEditorButtons();
  }, []);

  const undoEditor = useCallback((current: EditorSnapshot): EditorSnapshot | null => {
    const result = editorHistory.undo(current);
    syncEditorButtons();
    return result;
  }, []);

  const redoEditor = useCallback((current: EditorSnapshot): EditorSnapshot | null => {
    const result = editorHistory.redo(current);
    syncEditorButtons();
    return result;
  }, []);

  const undoLink = useCallback((current: LinkSnapshot): LinkSnapshot | null => {
    const result = linkHistory.undo(current);
    syncLinkButtons();
    return result;
  }, []);

  const redoLink = useCallback((current: LinkSnapshot): LinkSnapshot | null => {
    const result = linkHistory.redo(current);
    syncLinkButtons();
    return result;
  }, []);

  const commit = useCallback(() => {
    editorHistory.commit();
    linkHistory.commit();
    syncEditorButtons();
    syncLinkButtons();
  }, []);

  return {
    pushImmediateState,
    pushLinkState,
    unlockEditor,
    undoEditor,
    redoEditor,
    undoLink,
    redoLink,
    commit,
    canUndoEditor,
    canRedoEditor,
    canUndoLink,
    canRedoLink,
  };
}
