'use client';

import {
  FileClock,
  FilePlus2,
  History,
  LayoutTemplate,
  Loader2,
  Save,
  Sparkles,
} from 'lucide-react';

interface PromoEditorToolbarProps {
  /** Absent when the AI flow is not available; the chip and its rule go too. */
  onUseAi?: () => void;
  setTemplatesFromBuild: (fromBuild: boolean) => void;
  setShowTemplatesPopup: (open: boolean) => void;
  setShowVersionsPopup: (open: boolean) => void;
  confirmClearCanvas: () => void;
  canvasIsEmpty: boolean;
  openDraftPopup: () => void;
  draftExists: boolean;
  onSaveDraft: () => void;
  savingDraft: boolean;
  draftUpToDate: boolean;
}

/**
 * One toolbar, grouped by purpose.
 *
 * Everything used to sit in one undifferentiated run of six chips under two
 * lines of instructions, so nothing looked more or less important than anything
 * else. Now: what changes the card, then the places cards are kept, then the
 * card settings and the one primary action, pushed right. Thin rules mark the
 * seams.
 *
 * Clear Canvas stays in the open on purpose: it is the reset, and a reset you
 * cannot see is a reset you do not trust.
 */
export function PromoEditorToolbar({
  onUseAi,
  setTemplatesFromBuild,
  setShowTemplatesPopup,
  setShowVersionsPopup,
  confirmClearCanvas,
  canvasIsEmpty,
  openDraftPopup,
  draftExists,
  onSaveDraft,
  savingDraft,
  draftUpToDate,
}: PromoEditorToolbarProps) {
  return (
    <div className="flex shrink-0 flex-col gap-2 border-t border-border pt-3">
      <div className="flex flex-wrap items-center gap-2">
        {/* The rule belongs to the chip, not to the row: left outside the
            guard it opened the toolbar with a divider and nothing to its
            left whenever the AI flow was unavailable. */}
        {onUseAi && (
          <>
            <button
              type="button"
              onClick={onUseAi}
              title="Let AI write or restyle this card"
              className="ai-chip relative inline-flex h-9 items-center gap-1.5 overflow-hidden whitespace-nowrap rounded-lg border border-primary/40 bg-primary/[0.06] px-3 text-sm font-medium text-primary transition-colors duration-200 hover:border-primary/60 hover:bg-primary/[0.11] dark:bg-primary/[0.10] dark:hover:bg-primary/[0.16]"
            >
              {/* A light sweeps across the chip on hover and stops. Motion only
                  on intent: nothing animates while you work, so the toolbar
                  stays still, and the one control that isn't a plain command
                  still announces itself. */}
              <span aria-hidden="true" className="ai-sheen pointer-events-none absolute inset-0" />
              <Sparkles className="ai-spark relative h-4 w-4" />
              <span className="relative">Improve with AI</span>
            </button>
            <span className="h-6 w-px shrink-0 bg-border" aria-hidden="true" />
          </>
        )}
        <button
          type="button"
          onClick={() => {
            // Reset the flag: without this the popup kept the build-flow
            // header ("Pick a starting design", Back, Start blank) forever
            // once the build panel had opened it once.
            setTemplatesFromBuild(false);
            setShowTemplatesPopup(true);
          }}
          className="tool-chip relative inline-flex h-9 items-center gap-1.5 overflow-hidden whitespace-nowrap rounded-lg border border-on-surface-variant/40 px-3 py-2 text-sm font-medium text-on-surface-variant transition-colors hover:border-primary/70 hover:bg-primary/10 hover:text-primary"
          title="Start again from a ready-made card — design and sample text"
        >
          <span aria-hidden="true" className="ai-sheen pointer-events-none absolute inset-0" />
          <LayoutTemplate className="h-4 w-4" /> Template Hub
        </button>
        <button
          type="button"
          onClick={() => setShowVersionsPopup(true)}
          className="tool-chip relative inline-flex h-9 items-center gap-1.5 overflow-hidden whitespace-nowrap rounded-lg border border-on-surface-variant/40 px-3 py-2 text-sm font-medium text-on-surface-variant transition-colors hover:border-primary/70 hover:bg-primary/10 hover:text-primary"
          title="Saved variants of this promo card"
        >
          <span aria-hidden="true" className="ai-sheen pointer-events-none absolute inset-0" />
          <History className="h-4 w-4" /> My Published
        </button>

        {/* Everything to the left brings a card IN — AI writes one, the Hub and
            My Published fetch one. This one takes it away, and nothing in the
            row said so: same size, same colour, sitting fourth in the run, it
            read as a fourth source.

            It stays visible on purpose — a reset you cannot see is a reset you
            do not trust — so the separation is weight, not distance: the rule
            marks the seam and it is the quietest control in the row until you
            reach for it. Pushing it to the far edge instead left it stranded,
            reading as unrelated to anything and sitting directly above the
            primary save button. */}
        <span className="h-6 w-px shrink-0 bg-border" aria-hidden="true" />
        <button
          type="button"
          onClick={confirmClearCanvas}
          disabled={canvasIsEmpty}
          className="tool-chip relative inline-flex h-8 shrink-0 items-center gap-1.5 overflow-hidden whitespace-nowrap rounded-lg border border-on-surface-variant/25 px-2.5 text-xs font-medium text-on-surface-variant/80 transition-colors hover:border-primary/70 hover:bg-primary/10 hover:text-primary disabled:cursor-not-allowed disabled:opacity-40"
          title={
            canvasIsEmpty
              ? 'Nothing to clear — the canvas is already blank.'
              : 'Start from a blank promo card'
          }
        >
          <span aria-hidden="true" className="ai-sheen pointer-events-none absolute inset-0" />
          <FilePlus2 className="h-3.5 w-3.5" /> Clear
        </button>
      </div>

      {/* Position and card colour moved down to sit with Current in the Themes
          strip — all three are "what this card looks like", so they read as one
          group there instead of living apart from the Current swatch they act
          on. Only the primary action stays up here, pushed right. */}
      <div className="flex items-center justify-end gap-2">
        {/* Icon-only: it sits directly beside "Save draft", which already names
            the subject, so repeating "My Draft" in full spent a button's worth
            of width saying the same word twice. The dot still marks that a
            draft exists. */}
        <button
          type="button"
          data-tour="promo-my-draft"
          onClick={openDraftPopup}
          aria-label={draftExists ? 'View your saved draft' : 'No saved draft yet'}
          className="relative grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-on-surface-variant/40 text-on-surface-variant transition-colors hover:border-primary/70 hover:bg-primary/10 hover:text-primary"
          title={draftExists ? 'View your saved draft' : 'No saved draft yet'}
        >
          <FileClock className="h-4 w-4" />
          {draftExists && (
            <span
              aria-hidden="true"
              className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full border border-surface bg-primary"
            />
          )}
        </button>
        <button
          type="button"
          data-tour="promo-save-draft"
          onClick={onSaveDraft}
          disabled={savingDraft || canvasIsEmpty || draftUpToDate}
          className="inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-on-primary shadow-sm transition-opacity hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50"
          title={
            canvasIsEmpty
              ? 'Nothing to save yet - add some content first.'
              : draftUpToDate
                ? 'Your saved draft already matches this - make a change to save again.'
                : draftExists
                  ? 'Replace your saved draft with what you are editing now'
                  : 'Store these edits as your saved draft'
          }
        >
          {savingDraft ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {draftExists ? 'Update draft' : 'Save draft'}
        </button>
      </div>
    </div>
  );
}
