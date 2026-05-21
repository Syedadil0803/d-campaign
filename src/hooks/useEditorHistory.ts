/**
 * useEditorHistory — React hook for editor undo/redo with debounced text input.
 * 
 * Manages two independent stacks:
 * 1. Editor stack (text, formatting, background, schedule)
 * 2. Link stack (URL + openInNewTab)
 * 
 * Text input is debounced (800ms). Style/BG/link changes push immediately.
 * "Add" commits and clears both stacks.
 */

'use client';

import { useRef, useState, useCallback } from 'react';
import { HistoryManager, EditorSnapshot, LinkSnapshot } from '@/lib/historyManager';

export interface UseEditorHistoryReturn {
  // Push states
  pushTextState: (snapshot: EditorSnapshot) => void;       // debounced (call on every input)
  pushImmediateState: (snapshot: EditorSnapshot) => void;  // immediate (format/bg changes)
  pushLinkState: (snapshot: LinkSnapshot) => void;         // link stack

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

  // Flush any pending debounced state
  flushTextDebounce: (snapshot: EditorSnapshot) => void;

  // Cancel pending debounce without pushing
  cancelTextDebounce: () => void;
}

export function useEditorHistory(): UseEditorHistoryReturn {
  const editorHistory = useRef(new HistoryManager<EditorSnapshot>((a, b) => a.html === b.html && a.bgType === b.bgType && a.bgStartColor === b.bgStartColor && a.bgEndColor === b.bgEndColor && a.bgDirection === b.bgDirection && a.bgMidpoint === b.bgMidpoint && a.textColor === b.textColor && a.textSize === b.textSize && a.bold === b.bold && a.italic === b.italic, 'Editor', 30)).current;
  const linkHistory = useRef(new HistoryManager<LinkSnapshot>(undefined, 'Link', 30)).current;
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasPendingText = useRef(false);

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

  // Debounced text push — pushes CURRENT state after 800ms idle
  const pushTextState = useCallback((snapshot: EditorSnapshot) => {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }
    hasPendingText.current = true;
    console.log(`⏱️ [Editor] debounce started (800ms) — text: "${snapshot.html.replace(/<[^>]*>/g, '').substring(0, 40) || '(empty)'}"`);
    debounceTimer.current = setTimeout(() => {
      console.log(`⏱️ [Editor] debounce fired — pushing state`);
      editorHistory.pushState(snapshot);
      hasPendingText.current = false;
      debounceTimer.current = null;
      syncEditorButtons();
    }, 800);
  }, []);

  // Immediate push — call before format/bg/link changes
  const pushImmediateState = useCallback((snapshot: EditorSnapshot) => {
    // Flush any pending text debounce first
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
      debounceTimer.current = null;
      hasPendingText.current = false;
      console.log(`⏱️ [Editor] debounce cancelled (immediate push)`);
    }
    console.log(`⚡ [Editor] immediate push — bold: ${snapshot.bold}, color: ${snapshot.textColor}, size: ${snapshot.textSize}, bg: ${snapshot.bgType}`);
    editorHistory.pushState(snapshot);
    syncEditorButtons();
  }, []);

  // Flush pending debounce (call before format changes to capture text state)
  const flushTextDebounce = useCallback((snapshot: EditorSnapshot) => {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
      debounceTimer.current = null;
    }
    if (hasPendingText.current) {
      console.log(`⏱️ [Editor] debounce flushed — pushing pending state`);
      editorHistory.pushState(snapshot);
      hasPendingText.current = false;
      syncEditorButtons();
    }
  }, []);

  // Cancel pending debounce without pushing
  const cancelTextDebounce = useCallback(() => {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
      debounceTimer.current = null;
      console.log(`⏱️ [Editor] debounce cancelled (no push)`);
    }
    hasPendingText.current = false;
  }, []);

  // Link stack push
  const pushLinkState = useCallback((snapshot: LinkSnapshot) => {
    console.log(`🔗 [Link] push — url: "${snapshot.link}", newTab: ${snapshot.openInNewTab}`);
    linkHistory.pushState(snapshot);
    syncLinkButtons();
  }, []);

  // Undo/Redo editor
  const undoEditor = useCallback((current: EditorSnapshot): EditorSnapshot | null => {
    // Cancel any pending debounce
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
      debounceTimer.current = null;
      hasPendingText.current = false;
      console.log(`⏱️ [Editor] debounce cancelled (undo triggered)`);
    }
    // Push the current live state so it's captured before undoing
    // (ensures we don't lose any unsaved typing since last debounce push)
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
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
      debounceTimer.current = null;
    }
    hasPendingText.current = false;
    console.log(`✅ [Editor] commit — stacks cleared (Add button)`);
    editorHistory.commit();
    linkHistory.commit();
    syncEditorButtons();
    syncLinkButtons();
  }, []);

  return {
    pushTextState,
    pushImmediateState,
    pushLinkState,
    flushTextDebounce,
    cancelTextDebounce,
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
