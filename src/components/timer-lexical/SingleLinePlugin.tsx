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

/** Length of the user-visible text — the ZWSP caret slot ChipGuardPlugin
 *  maintains after a trailing chip must never count as typed growth. */
function visibleLen(el: HTMLElement): number {
  return (el.textContent || '').replace(/\u200B/g, '').length;
}

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
  // The last-good footprint, tracked two ways: WIDTH (px) catches a size-up;
  // LENGTH (chars) catches typed whitespace, whose width can collapse during
  // the wrap measurement. An edit "grew" if EITHER increased — so both are
  // blocked; deletions/size-downs shrink both → allowed.
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
      lastGoodLen.current = visibleLen(initRoot);
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
        tags.has('timer-enddate-sync') ||
        tags.has('timer-chip-heal')
      ) {
        lastGoodState.current = editorState;
        const root = editor.getRootElement();
        if (root) {
          lastGoodWidth.current = contentWidth(root);
          lastGoodLen.current = visibleLen(root);
        }
        return;
      }

      // Measure next frame so the DOM reflects the new content.
      requestAnimationFrame(() => {
        const root = editor.getRootElement();
        if (!root) return;

        const width = contentWidth(root);
        const len = visibleLen(root);
        const grew =
          (lastGoodWidth.current >= 0 && width > lastGoodWidth.current + 0.5) ||
          (lastGoodLen.current >= 0 && len > lastGoodLen.current);

        // Enforce at the WIDEST card width — only block if it would overflow
        // even when the card is fully stretched (PromoSection stretches it).
        // TWO overflow signals are needed: wrapsAtWidth catches normal text
        // (would wrap onto a 2nd line), and the direct width check catches
        // pure-whitespace growth — the editor renders white-space:pre where
        // spaces keep real width, but the wrap measurement runs under
        // 'normal' where trailing spaces collapse and never wrap, so a held
        // spacebar would otherwise march past the card edge uncapped.
        const overflows =
          wrapsAtWidth(root, maxContentWidth) || width > maxContentWidth + 0.5;
        if (grew && overflows && lastGoodState.current) {
          // Reject: this edit grew the footprint past the limit → revert.
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
