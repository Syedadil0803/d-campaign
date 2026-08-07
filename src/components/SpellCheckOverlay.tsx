// Draws wavy underlines under Harper's issues (red spelling / blue grammar) and
// a suggestions popup on click. The squiggle layer is a fixed, pointer-events:
// none overlay keyed off live client rects, so it never mutates the editor.
// Replacements go through execCommand so the host editor's input handler runs.

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { RefObject } from 'react';
import { isSpellingKind, type Issue, type Suggestion } from '@/lib/spellcheck/types';

function wave(colorHex: string): string {
  const c = colorHex.replace('#', '%23');
  return `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='6' height='4'%3E%3Cpath d='M0 3 Q1.5 0 3 3 T6 3' stroke='${c}' fill='none' stroke-width='1'/%3E%3C/svg%3E")`;
}
const RED = wave('#e24b4a');
const BLUE = wave('#3b82f6');

interface Entry {
  issue: Issue;
  rects: DOMRect[];
  spelling: boolean;
}

interface PopupState {
  issue: Issue;
  x: number;
  y: number;
}

interface Props {
  editorRef: RefObject<HTMLElement | null>;
  issues: Issue[];
  enabled: boolean;
  onAfterChange: () => void; // re-scan after a replacement
}

// Re-locate the flagged substring in the current text (offsets drift as the
// user edits between scans), or null if it's gone.
function resolveSpan(text: string, issue: Issue): { start: number; end: number } | null {
  if (text.slice(issue.start, issue.end) === issue.problem) {
    return { start: issue.start, end: issue.end };
  }
  const i = issue.problem ? text.indexOf(issue.problem) : -1;
  if (i < 0) return null;
  return { start: i, end: i + issue.problem.length };
}

// Map a char span in the editor's flattened text back to a live DOM Range.
function rangeForSpan(editor: HTMLElement, start: number, end: number): Range | null {
  const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT);
  let acc = 0;
  let startNode: Text | null = null;
  let startOffset = 0;
  let endNode: Text | null = null;
  let endOffset = 0;
  let node = walker.nextNode() as Text | null;
  while (node) {
    const len = node.textContent?.length ?? 0;
    if (!startNode && start <= acc + len) {
      startNode = node;
      startOffset = start - acc;
    }
    if (startNode && end <= acc + len) {
      endNode = node;
      endOffset = end - acc;
      break;
    }
    acc += len;
    node = walker.nextNode() as Text | null;
  }
  if (!startNode || !endNode) return null;
  const range = document.createRange();
  range.setStart(startNode, startOffset);
  range.setEnd(endNode, endOffset);
  return range;
}

export function SpellCheckOverlay({
  editorRef,
  issues,
  enabled,
  onAfterChange,
}: Props): React.ReactElement | null {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [popup, setPopup] = useState<PopupState | null>(null);
  const popupRef = useRef<HTMLDivElement>(null);

  const recompute = useCallback(() => {
    const el = editorRef.current;
    if (!enabled || !el) {
      setEntries([]);
      return;
    }
    const text = el.textContent ?? '';
    // Clip rects to the editor box — getClientRects() emits stray fragments for
    // ranges scrolled out of view, which would otherwise float outside it.
    const box = el.getBoundingClientRect();
    const inBox = (r: DOMRect) =>
      r.width > 0 &&
      r.height > 0 &&
      r.left >= box.left - 1 &&
      r.right <= box.right + 1 &&
      r.top >= box.top - 1 &&
      r.bottom <= box.bottom + 1;
    const next: Entry[] = [];
    for (const issue of issues) {
      const span = resolveSpan(text, issue);
      if (!span) continue;
      const range = rangeForSpan(el, span.start, span.end);
      if (!range) continue;
      const rects = Array.from(range.getClientRects()).filter(inBox);
      if (rects.length === 0) continue;
      next.push({ issue, rects, spelling: isSpellingKind(issue.kind) });
    }
    setEntries(next);
  }, [issues, enabled, editorRef]);

  // Reposition on scroll/resize as well as when issues change.
  useEffect(() => {
    recompute();
    if (!enabled) return;
    const onMove = () => recompute();
    window.addEventListener('scroll', onMove, true);
    window.addEventListener('resize', onMove);
    return () => {
      window.removeEventListener('scroll', onMove, true);
      window.removeEventListener('resize', onMove);
    };
  }, [recompute, enabled]);

  useEffect(() => {
    const el = editorRef.current;
    if (!enabled || !el) return;
    const onClick = (e: MouseEvent) => {
      const hit = entries.find((entry) =>
        entry.rects.some(
          (r) =>
            e.clientX >= r.left &&
            e.clientX <= r.right &&
            e.clientY >= r.top &&
            e.clientY <= r.bottom,
        ),
      );
      if (!hit) return;
      // Highlight-only issues (no suggestions) don't open a popup — just underline.
      if (hit.issue.suggestions.length === 0) return;
      const anchor = hit.rects[0];
      setPopup({ issue: hit.issue, x: anchor.left, y: anchor.bottom + 4 });
    };
    el.addEventListener('click', onClick);
    return () => el.removeEventListener('click', onClick);
  }, [editorRef, entries, enabled]);

  // Any edit invalidates the popup's stored position.
  useEffect(() => {
    const el = editorRef.current;
    if (!enabled || !el) return;
    const onInput = () => setPopup(null);
    el.addEventListener('input', onInput);
    return () => el.removeEventListener('input', onInput);
  }, [editorRef, enabled]);

  useEffect(() => {
    if (!popup) return;
    const onDown = (e: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        setPopup(null);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPopup(null);
    };
    const onScroll = () => setPopup(null);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    window.addEventListener('scroll', onScroll, true);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [popup]);

  const applySuggestion = useCallback(
    (issue: Issue, suggestion: Suggestion) => {
      const el = editorRef.current;
      if (!el) return;
      const text = el.textContent ?? '';
      const span = resolveSpan(text, issue);
      if (!span) return; // flagged text is gone — bail rather than corrupt
      const range = rangeForSpan(el, span.start, span.end);
      if (!range) return;
      const sel = window.getSelection();
      if (!sel) return;
      el.focus();
      sel.removeAllRanges();
      sel.addRange(range);
      if (suggestion.kind === 'InsertAfter') {
        sel.collapseToEnd();
        document.execCommand('insertText', false, suggestion.text);
      } else if (!suggestion.text) {
        document.execCommand('delete');
      } else {
        document.execCommand('insertText', false, suggestion.text);
      }
      setPopup(null);
      onAfterChange();
    },
    [editorRef, onAfterChange],
  );

  if (!enabled) return null;

  return (
    <>
      {createPortal(
        <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 40 }}>
          {entries.flatMap((entry, ei) =>
            entry.rects.map((r, ri) => (
              <span
                key={`${ei}-${ri}`}
                style={{
                  position: 'fixed',
                  left: r.left,
                  top: r.bottom - 3,
                  width: r.width,
                  height: 4,
                  backgroundImage: entry.spelling ? RED : BLUE,
                  backgroundRepeat: 'repeat-x',
                  backgroundPosition: 'left bottom',
                  // halo keeps it legible on dark editor backgrounds
                  filter: 'drop-shadow(0 0 0.5px rgba(255,255,255,0.9))',
                }}
              />
            )),
          )}
        </div>,
        document.body,
      )}

      {popup &&
        createPortal(
          <div
            ref={popupRef}
            style={{
              position: 'fixed',
              left: Math.min(popup.x, window.innerWidth - 240),
              top: popup.y,
              zIndex: 50,
              width: 'max-content',
              minWidth: 120,
              maxWidth: 240,
            }}
            className="overflow-hidden rounded-lg border border-border bg-surface-elevated shadow-xl"
          >
            {/* grammar needs the explanation for context; spelling doesn't */}
            {!isSpellingKind(popup.issue.kind) && (
              <div className="border-b border-border px-3 py-2 text-xs text-on-surface-variant">
                {popup.issue.message}
              </div>
            )}
            <div className="max-h-56 overflow-y-auto py-1">
              {popup.issue.suggestions.length === 0 ? (
                <div className="px-3 py-2 text-sm text-on-surface-variant">No suggestions</div>
              ) : (
                popup.issue.suggestions.slice(0, 6).map((s, i) => (
                  <button
                    key={`${s.kind}-${s.text}-${i}`}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => applySuggestion(popup.issue, s)}
                    className="block w-full px-3 py-1.5 text-left text-sm font-medium text-on-surface transition-colors hover:bg-primary/10 hover:text-primary"
                  >
                    {s.kind === 'Remove' || !s.text ? (
                      <span className="italic text-on-surface-variant">Remove</span>
                    ) : (
                      s.text
                    )}
                  </button>
                ))
              )}
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
