/**
 * CaretAfterChipPlugin — the timer field draws its OWN caret.
 *
 * Chromium's native caret painting is unreliable around the countdown chip
 * (a non-editable inline): logically-correct selections after the chip, at
 * the start of the following text, or at the line end simply never get a
 * blinking bar (typing works — the bar is just not drawn). Chasing each
 * blind spot individually proved endless, so this plugin takes FULL
 * ownership: while the timer editor is focused with a collapsed selection,
 * the native caret is hidden (caret-color: transparent) and a synthetic
 * blinking caret is rendered at the selection's exact position. If a
 * position can't be computed, the native caret is restored — never zero
 * carets.
 */

'use client';

import * as React from 'react';
import { useEffect, useRef, useState } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';

interface CaretPos {
  left: number;
  top: number;
  height: number;
  /** Color of the text at the caret — a native caret takes the color of the
   *  run it sits in, so ours must too (e.g. user recolors the timer text). */
  color: string;
}

/** Zero-width rect at the collapsed selection position, via fallbacks that
 *  cover the cases where the collapsed range itself reports no rect. */
function caretRect(anchor: Node, offset: number, range: Range): DOMRect | null {
  const direct = range.getClientRects()[0];
  if (direct && direct.height > 0) return direct;

  if (anchor.nodeType === 3) {
    const text = anchor.textContent || '';
    const probe = document.createRange();
    if (offset > 0) {
      // Right edge of the character before the caret.
      probe.setStart(anchor, offset - 1);
      probe.setEnd(anchor, offset);
      const r = probe.getClientRects()[0];
      if (r) return new DOMRect(r.right, r.top, 0, r.height);
    }
    if (offset < text.length) {
      // Left edge of the character after the caret (at the caret's actual
      // offset — probing char [0,1) would draw the caret at the run START).
      probe.setStart(anchor, offset);
      probe.setEnd(anchor, offset + 1);
      const r = probe.getClientRects()[0];
      if (r) return new DOMRect(r.left, r.top, 0, r.height);
    }
    const parent = anchor.parentElement;
    if (parent) {
      const pr = parent.getBoundingClientRect();
      return new DOMRect(pr.right, pr.top, 0, pr.height);
    }
    return null;
  }

  if (anchor.nodeType === 1) {
    const el = anchor as HTMLElement;
    const kids = el.childNodes;
    if (kids.length === 0) {
      const r = el.getBoundingClientRect();
      return new DOMRect(r.left, r.top, 0, r.height || 16);
    }
    const after = offset >= kids.length;
    const child = kids[after ? kids.length - 1 : offset];
    if (child.nodeType === 1) {
      const r = (child as HTMLElement).getBoundingClientRect();
      return new DOMRect(after ? r.right : r.left, r.top, 0, r.height || 16);
    }
    const probe = document.createRange();
    probe.selectNodeContents(child);
    const r = probe.getBoundingClientRect();
    return new DOMRect(after ? r.right : r.left, r.top, 0, r.height || 16);
  }

  return null;
}

export function CaretAfterChipPlugin(): React.ReactElement | null {
  const [editor] = useLexicalComposerContext();
  const [pos, setPos] = useState<CaretPos | null>(null);
  const lastPosRef = useRef<CaretPos | null>(null);

  useEffect(() => {
    let currentRoot: HTMLElement | null = null;

    const clear = () => {
      if (currentRoot) currentRoot.style.caretColor = '';
      lastPosRef.current = null;
      setPos(null);
    };

    const update = () => {
      const root = editor.getRootElement();
      currentRoot = root;
      // The chrome div (TimerEditor) is position:relative — our offset parent.
      const host = root?.parentElement;
      const sel = typeof window !== 'undefined' ? window.getSelection() : null;
      if (
        !root ||
        !host ||
        !sel ||
        sel.rangeCount === 0 ||
        !sel.isCollapsed ||
        document.activeElement !== root ||
        !document.hasFocus()
      ) {
        clear();
        return;
      }
      const anchor = sel.anchorNode;
      if (!anchor || !root.contains(anchor)) {
        clear();
        return;
      }
      const rect = caretRect(anchor, sel.anchorOffset, sel.getRangeAt(0));
      if (!rect || rect.height === 0) {
        clear();
        return;
      }
      // We can draw — hide the native caret so there's exactly one.
      root.style.caretColor = 'transparent';
      const hostR = host.getBoundingClientRect();
      // Match the native caret's rules. COLOR comes from the caret's own run:
      // the anchor span's computed color is right even in the ZWSP slot (the
      // slot inherits the adjacent run's inline style — sampling a SIBLING
      // for color would hit the chip WRAPPER, which carries no user color).
      // HEIGHT for slot/element anchors comes from the neighboring run's box —
      // the slot's own box is the default 16px even beside an XL countdown.
      const anchorEl: HTMLElement | null =
        anchor.nodeType === 3
          ? anchor.parentElement
          : (anchor as HTMLElement);
      const color = getComputedStyle(anchorEl || root).color;
      const isSlot =
        anchor.nodeType === 3 && /^\u200B+$/.test(anchor.textContent || '');
      let top = rect.top;
      let height = rect.height;
      if ((isSlot || anchor.nodeType === 1) && anchorEl) {
        const boxEl =
          (anchorEl.previousElementSibling as HTMLElement | null) ??
          (anchorEl.nextElementSibling as HTMLElement | null) ??
          anchorEl;
        const sr = boxEl.getBoundingClientRect();
        if (sr.height > 0) {
          top = sr.top;
          height = sr.height;
        }
      }
      // Skip the render when nothing moved — update() runs several times per
      // keystroke (editor update + selectionchange).
      const next: CaretPos = {
        left: rect.left - hostR.left,
        top: top - hostR.top,
        height,
        color,
      };
      const prev = lastPosRef.current;
      if (
        prev &&
        prev.left === next.left &&
        prev.top === next.top &&
        prev.height === next.height &&
        prev.color === next.color
      ) {
        return;
      }
      lastPosRef.current = next;
      setPos(next);
    };

    // Focus can leave WITHOUT a selectionchange (Tab to a button, window
    // blur — where activeElement even stays on the editor), so listen to
    // those directly or the caret keeps blinking in an unfocused field.
    const onWindowBlur = () => clear();
    const onFocusChange = () => {
      // activeElement updates after focusout/focusin finish dispatching.
      setTimeout(update, 0);
    };
    document.addEventListener('selectionchange', update);
    window.addEventListener('blur', onWindowBlur);
    window.addEventListener('focus', onFocusChange);
    const offRoot = editor.registerRootListener((rootElement, prevRootElement) => {
      prevRootElement?.removeEventListener('focusout', onFocusChange);
      prevRootElement?.removeEventListener('focusin', onFocusChange);
      rootElement?.addEventListener('focusout', onFocusChange);
      rootElement?.addEventListener('focusin', onFocusChange);
    });
    const offUpdate = editor.registerUpdateListener(() => {
      // Wait a frame so the DOM reflects the new state before measuring.
      setTimeout(update, 0);
    });
    return () => {
      document.removeEventListener('selectionchange', update);
      window.removeEventListener('blur', onWindowBlur);
      window.removeEventListener('focus', onFocusChange);
      offRoot();
      offUpdate();
      clear();
    };
  }, [editor]);

  if (!pos) return null;
  return (
    <>
      <style>{'@keyframes cw-caret-blink { 50% { opacity: 0; } }'}</style>
      <span
        aria-hidden
        style={{
          position: 'absolute',
          left: pos.left,
          top: pos.top,
          width: '1.5px',
          height: pos.height,
          background: pos.color,
          pointerEvents: 'none',
          animation: 'cw-caret-blink 1.06s steps(2, start) infinite',
        }}
      />
    </>
  );
}
