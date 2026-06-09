/**
 * SingleLinePlugin — keeps the timer on one line.
 *
 * A line-cap is an editor-state invariant, so it lives in the editor: it holds
 * the last-good EditorState snapshot and reverts to it when an edit makes the
 * content WIDER (typing OR sizing up) while it wraps to a 2nd line. Edits that
 * shrink the footprint (deletions, sizing down) are always allowed, so a
 * pre-existing 2-line timer can be edited back down. Skips tick/sync updates
 * via tags. Calls `onOverflow` so the host can show its limit warning.
 */

'use client';

import { useEffect, useRef } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { type EditorState } from 'lexical';
import { wrapsAtWidth, contentWidth, TIMER_MAX_CONTENT_WIDTH } from './lineMeasure';

export function SingleLinePlugin({
  onOverflow,
  maxContentWidth = TIMER_MAX_CONTENT_WIDTH,
}: {
  onOverflow?: () => void;
  /** Enforce against the WIDEST the card can get, so a long timer can stretch
   *  the card before being blocked (PromoSection does the actual stretch). */
  maxContentWidth?: number;
} = {}): null {
  const [editor] = useLexicalComposerContext();
  const lastGoodState = useRef<EditorState | null>(null);
  // The last-good footprint, tracked two ways: WIDTH (px) catches a size-up
  // that wraps; LENGTH (chars) catches typed whitespace, whose width collapses
  // in measurement but still wraps in the real editor. An edit "grew" if EITHER
  // increased — so both are blocked; deletions/size-downs shrink both → allowed.
  const lastGoodWidth = useRef<number>(-1);
  const lastGoodLen = useRef<number>(-1);
  const reverting = useRef(false);
  const onOverflowRef = useRef(onOverflow);
  onOverflowRef.current = onOverflow;

  useEffect(() => {
    lastGoodState.current = editor.getEditorState();
    // Baseline on mount so the very first user edit is compared against the
    // initial content (otherwise the first size-up/space would slip).
    const initRoot = editor.getRootElement();
    if (initRoot) {
      lastGoodWidth.current = contentWidth(initRoot);
      lastGoodLen.current = (initRoot.textContent || '').length;
    }

    return editor.registerUpdateListener(({ editorState, tags }) => {
      // Our own revert re-fires this listener — ignore it.
      if (reverting.current) return;

      // Tick / programmatic syncs are not user edits → never cap them, but DO
      // re-baseline (e.g. an end-date sync changes the chip's digits → its
      // width/length) so later user edits compare correctly.
      if (
        tags.has('timer-tick') ||
        tags.has('timer-text-external-sync') ||
        tags.has('timer-enddate-sync')
      ) {
        lastGoodState.current = editorState;
        const root = editor.getRootElement();
        if (root) {
          lastGoodWidth.current = contentWidth(root);
          lastGoodLen.current = (root.textContent || '').length;
        }
        return;
      }

      // Measure next frame so the DOM reflects the new content.
      requestAnimationFrame(() => {
        const root = editor.getRootElement();
        if (!root) return;

        const width = contentWidth(root);
        const len = (root.textContent || '').length;
        const grew =
          (lastGoodWidth.current >= 0 && width > lastGoodWidth.current + 0.5) ||
          (lastGoodLen.current >= 0 && len > lastGoodLen.current);

        // Enforce at the WIDEST card width — only block if it would wrap even
        // when the card is fully stretched. PromoSection does the stretching.
        if (grew && wrapsAtWidth(root, maxContentWidth) && lastGoodState.current) {
          // Reject: this edit grew the footprint onto a 2nd line → revert.
          reverting.current = true;
          editor.setEditorState(lastGoodState.current);
          reverting.current = false;
          onOverflowRef.current?.();
          return;
        }

        // Accept (fits, or shrank): this is the new good state.
        lastGoodWidth.current = width;
        lastGoodLen.current = len;
        lastGoodState.current = editorState;
      });
    });
  }, [editor, maxContentWidth]);

  return null;
}
