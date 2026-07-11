/**
 * TimerEditor — composes the Lexical editor for the timer field.
 *
 * Wires RichText + History + ChipGuardPlugin (undeletable chip) +
 * SingleLinePlugin (1-line cap) + the chip-target context, and optionally its
 * own TimerToolbar. The countdown ticks inside the chip component, not via
 * editor updates, so the caret/selection are never disturbed.
 */

'use client';

import * as React from 'react';
import { useCallback, useEffect } from 'react';
import { LexicalComposer } from '@lexical/react/LexicalComposer';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin';
import { ContentEditable } from '@lexical/react/LexicalContentEditable';
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary';
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin';
import { OnChangePlugin } from '@lexical/react/LexicalOnChangePlugin';
import {
  $getRoot,
  $createParagraphNode,
  $createTextNode,
  type EditorState,
  type LexicalEditor,
} from 'lexical';
import { TimerChipNode, $createTimerChipNode } from './TimerChipNode';
import { ChipGuardPlugin } from './ChipGuardPlugin';
import { SingleLinePlugin } from './SingleLinePlugin';
import { TimerToolbar } from './TimerToolbar';
import {
  TimerChipTargetProvider,
  TimerChipTargetBridge,
  type ChipTarget,
} from './TimerChipTarget';

// ============================================================
// Public props
// ============================================================

export interface TimerEditorInitialContent {
  prefixText?: string;
  suffixText?: string;
  endDate: string;
}

interface TimerEditorProps {
  initialContent: TimerEditorInitialContent;
  /** When set, seed the editor from this serialized Lexical state (full
   *  fidelity) instead of building fresh from initialContent. */
  initialStateJson?: string;
  /** Fires on every editor state change with the serialized JSON document. */
  onChange?: (state: EditorState, editor: LexicalEditor) => void;
  /** Fires ONCE on mount with the underlying Lexical editor — used by host
   *  components that need an imperative handle before any edit has happened
   *  (e.g. to push prop updates into the document tree). */
  onEditorReady?: (editor: LexicalEditor) => void;
  /** Render the toolbar above the editor. Default true. */
  showToolbar?: boolean;
  /** Reports the current chip styling target to the host (so an external
   *  toolbar can route style commands to the targeted cell). */
  onTargetChange?: (t: ChipTarget | null) => void;
  /** Fires when an edit was reverted for exceeding one line (host shows its
   *  "field limit reached" warning). */
  onLineOverflow?: () => void;
  /**
   * Visual chrome around the contenteditable:
   *   - 'shell' (default): bordered, padded card — for standalone use.
   *   - 'inline': no wrapper styling. The host owns background / color /
   *     padding / border — use this when the editor sits inside another
   *     styled container (e.g. the preview card) and the host's look must
   *     not be overridden.
   */
  chrome?: 'shell' | 'inline';
  className?: string;
}

/** Internal: capture the composer's editor as soon as it's available. */
function EditorReadyCapture({
  onReady,
}: {
  onReady?: (editor: LexicalEditor) => void;
}): null {
  const [editor] = useLexicalComposerContext();
  useEffect(() => {
    onReady?.(editor);
  }, [editor, onReady]);
  return null;
}

// ============================================================
// Component
// ============================================================

export function TimerEditor({
  initialContent,
  initialStateJson,
  onChange,
  onEditorReady,
  showToolbar = true,
  onTargetChange,
  onLineOverflow,
  chrome = 'shell',
  className,
}: TimerEditorProps): React.ReactElement {
  const seedEditor = useCallback(() => {
    const root = $getRoot();
    root.clear();
    const para = $createParagraphNode();
    if (initialContent.prefixText) {
      para.append($createTextNode(initialContent.prefixText));
    }
    para.append($createTimerChipNode(initialContent.endDate));
    if (initialContent.suffixText) {
      para.append($createTextNode(initialContent.suffixText));
    }
    root.append(para);
  }, [initialContent]);

  const initialConfig = {
    namespace: 'TimerEditor',
    // Register the inline chip decorator node.
    nodes: [TimerChipNode],
    // Seed from full state JSON when provided (restores all styling), else
    // build a fresh document from prefix/suffix/endDate.
    editorState: initialStateJson || seedEditor,
    onError(error: Error) {
      // eslint-disable-next-line no-console
      console.error('[TimerEditor]', error);
    },
    theme: {
      paragraph: 'timer-editor-paragraph',
    },
  };

  return (
    <LexicalComposer initialConfig={initialConfig}>
      {/* Connects chip clicks (set the styling target) to the toolbar (reads
          it to route style commands). Must wrap both the toolbar and the
          editable so the decorator component + toolbar share the context. */}
      <TimerChipTargetProvider>
      {showToolbar && (
        <div className="mb-2 rounded-md border border-border bg-surface/50 px-2 py-1.5">
          <TimerToolbar />
        </div>
      )}
      <div
        className={
          chrome === 'shell'
            ? 'timer-editor-shell relative rounded-md border border-border bg-surface px-3 py-2 ' +
              'min-h-[44px] focus-within:border-primary/80 focus-within:ring-1 focus-within:ring-primary/60 ' +
              'transition-colors ' +
              (className ?? '')
            : // 'inline' chrome: no visual wrapper. The host component owns
              // background / color / padding / border. Only positioning hooks
              // (relative, so the placeholder absolute-positions correctly)
              // remain.
              'relative ' + (className ?? '')
        }
      >
        <RichTextPlugin
          contentEditable={
            <ContentEditable
              // nowrap: the timer is a single-line field (the widget renders it
              // nowrap too). Without this the preview wraps a long countdown +
              // prefix/suffix onto 2 lines while the live site keeps it on one.
              // `!` forces it: Lexical sets white-space:pre-wrap inline, which
              // otherwise beats a plain Tailwind class.
              className="outline-none !whitespace-nowrap break-words"
              aria-label="Timer field"
            />
          }
          placeholder={
            <div className="pointer-events-none absolute left-3 top-2 select-none text-on-surface-variant/50">
              Type before or after the countdown…
            </div>
          }
          ErrorBoundary={LexicalErrorBoundary}
        />
        <HistoryPlugin />
        {/* Keeps the chip undeletable. */}
        <ChipGuardPlugin />
        {/* 1-line limit: reverts edits that grow the timer onto a 2nd line
            (deletions always allowed), and signals the host to warn. */}
        <SingleLinePlugin onOverflow={onLineOverflow} />
        {/* Captures the underlying editor on mount so the host can drive
            imperative updates (endDate sync, format commands) before any
            user edit has happened. */}
        <EditorReadyCapture onReady={onEditorReady} />
        <TimerChipTargetBridge onTarget={onTargetChange} />
        {onChange && <OnChangePlugin onChange={onChange} />}
      </div>
      </TimerChipTargetProvider>
    </LexicalComposer>
  );
}
