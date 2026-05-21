/**
 * useEditorHistory — React hook for editor undo/redo with intention-based snapshots.
 * 
 * Manages two independent stacks:
 * 1. Editor stack (text, formatting, background, schedule)
 * 2. Link stack (URL + openInNewTab)
 * 
 * Snapshots are pushed on intention signals (focus, selection overwrite, word boundary, blur).
 * "Add" commits and clears both stacks.
 */

'use client';

import { useRef, useState, useCallback } from 'react';
import { HistoryManager, EditorSnapshot, LinkSnapshot } from '@/lib/historyManager';

export interface UseEditorHistoryReturn {
  // Push states
  pushImmediateState: (snapshot: EditorSnapshot) => void;
  pushLinkState: (snapshot: LinkSnapshot) => void;

  // Undo/Redo
  undoEditor: (current: EditorSnapshot) => EditorSnapshot | null;
  redoEditor: (current: EditorSnapshot) => EditorSnapshot | null;
  undoLink: (current: LinkSnapshot) => LinkSnapshot | null;
  redoLink: (current: LinkSnapshot) => LinkSnapshot | null;

  // Commit (on Add)
  commit: () => void;

  // State for button rendering
  canUndoEditor: boolean;
  canRedoEditor: boolean;
  canUndoLink: boolean;
  canRedoLink: boolean;
}

export function useEditorHistory(): UseEditorHistoryReturn {
  const editorHistory = useRef(new HistoryManager<EditorSnapshot>((a, b) => a.html === b.html && a.bgType === b.bgType && a.bgStartColor === b.bgStartColor && a.bgEndColor === b.bgEndColor && a.bgDirection === b.bgDirection && a.bgMidpoint === b.bgMidpoint, 'Editor', 30)).current;
  const linkHistory = useRef(new HistoryManager<LinkSnapshot>(undefined, 'Link', 30)).current;

  // State for re-rendering buttons
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

  // Immediate push — the only push function needed now
  const pushImmediateState = useCallback((snapshot: EditorSnapshot) => {
    console.log(`⚡ [Editor] immediate push — bold: ${snapshot.bold}, color: ${snapshot.textColor}, size: ${snapshot.textSize}, bg: ${snapshot.bgType}`);
    editorHistory.pushState(snapshot);
    syncEditorButtons();
  }, []);

  // Link stack push
  const pushLinkState = useCallback((snapshot: LinkSnapshot) => {
    console.log(`🔗 [Link] push — url: "${snapshot.link}", newTab: ${snapshot.openInNewTab}`);
    linkHistory.pushState(snapshot);
    syncLinkButtons();
  }, []);

  // Undo/Redo editor
  const undoEditor = useCallback((current: EditorSnapshot): EditorSnapshot | null => {
    // Push the current live state so it's captured before undoing
    editorHistory.pushState(current);
    const result = editorHistory.undo();
    syncEditorButtons();
    return result;
  }, []);

  const redoEditor = useCallback((current: EditorSnapshot): EditorSnapshot | null => {
    const result = editorHistory.redo();
    syncEditorButtons();
    return result;
  }, []);

  // Undo/Redo link
  const undoLink = useCallback((current: LinkSnapshot): LinkSnapshot | null => {
    // Push the current live state so it's captured before undoing
    linkHistory.pushState(current);
    const result = linkHistory.undo();
    syncLinkButtons();
    return result;
  }, []);

  const redoLink = useCallback((current: LinkSnapshot): LinkSnapshot | null => {
    const result = linkHistory.redo();
    syncLinkButtons();
    return result;
  }, []);

  // Commit (Add button)
  const commit = useCallback(() => {
    console.log(`✅ [Editor] commit — stacks cleared (Add button)`);
    editorHistory.commit();
    linkHistory.commit();
    syncEditorButtons();
    syncLinkButtons();
  }, []);

  return {
    pushImmediateState,
    pushLinkState,
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
