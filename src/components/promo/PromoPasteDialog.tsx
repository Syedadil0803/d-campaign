'use client';

import { X } from 'lucide-react';

interface PromoPasteDialogProps {
  showPaste: boolean;
  setShowPaste: (show: boolean) => void;
  pasteText: string;
  setPasteText: (text: string) => void;
  /** What went wrong with the last attempt, shown under the box. */
  pasteError: string;
  setPasteError: (error: string) => void;
  applyPaste: () => void;
}

/**
 * Where the AI's answer comes back in.
 *
 * A paste box rather than an API call: the prompt is taken to ChatGPT in the
 * user's own browser and the reply is pasted back, so the tool needs no key,
 * no per-call cost, and never sends the card anywhere itself.
 */
export function PromoPasteDialog({
  showPaste,
  setShowPaste,
  pasteText,
  setPasteText,
  pasteError,
  setPasteError,
  applyPaste,
}: PromoPasteDialogProps) {
  if (!showPaste) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0" onClick={() => setShowPaste(false)} />
      <div className="relative z-10 w-full max-w-lg rounded-2xl border border-border bg-surface-elevated p-5 text-on-surface shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold">Paste from AI</h2>
            <p className="mt-1 text-sm text-on-surface-variant">
              Paste the JSON your AI tool gave you.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowPaste(false)}
            aria-label="Close"
            className="inline-flex h-8 w-8 flex-none items-center justify-center rounded-md text-on-surface-variant transition-colors hover:bg-primary/10 hover:text-primary"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <textarea
          value={pasteText}
          onChange={(e) => {
            setPasteText(e.target.value);
            if (pasteError) setPasteError('');
          }}
          spellCheck={false}
          rows={7}
          placeholder='{"title": "Summer Sale", "buttonText": "Shop now", ...}'
          className="mt-4 w-full resize-y rounded-lg border border-border bg-surface px-3 py-2 font-mono text-xs text-on-surface outline-none focus:border-primary"
        />
        {pasteError && <p className="mt-2 text-xs font-medium text-red-500">{pasteError}</p>}
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setShowPaste(false)}
            className="rounded-md border border-border px-4 py-2 text-sm font-medium text-on-surface-variant transition-colors hover:border-primary/70 hover:text-primary"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={applyPaste}
            disabled={!pasteText.trim()}
            className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-on-primary shadow-sm transition-opacity hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Apply to my card
          </button>
        </div>
      </div>
    </div>
  );
}
