'use client';

import {
  FileClock,
  History,
  LayoutTemplate,
  Palette,
  Sparkles,
} from 'lucide-react';

interface PromoEditorToolbarProps {
  /** Absent when the AI flow is not available; the chip and its rule go too. */
  onUseAi?: () => void;
  setTemplatesFromBuild: (fromBuild: boolean) => void;
  setShowTemplatesPopup: (open: boolean) => void;
  setShowVersionsPopup: (open: boolean) => void;
  openDraftPopup: () => void;
  /** Card position controls */
  cardPositionPos: string | null;
  setCardPositionPos: (pos: string) => void;
  /** Styling popover trigger */
  customizeButtonRef: React.RefObject<HTMLButtonElement | null>;
  onShowStylingPopover?: () => void;
  stylingTriggerLabel?: string;
  showStylingPopover?: boolean;
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
  onDeleteDraft,
  cardPositionPos,
  setCardPositionPos,
  customizeButtonRef,
  onShowStylingPopover,
  stylingTriggerLabel = 'Customize',
  showStylingPopover = false,
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
        {/* Clear button moved to left panel next to "Content" heading */}
      </div>

      {/* Styling Studio Row — Styling controls on left, Card position on right */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-[0.08em] text-on-surface-variant">Styling Studio:</span>
          <button
            ref={customizeButtonRef}
            type="button"
            onClick={() => onShowStylingPopover?.()}
            aria-pressed={showStylingPopover}
            title="Edit card colors and themes"
            className={`flex h-7 items-center gap-2 rounded-lg border px-3.5 py-2 text-xs font-medium transition-colors ${
              showStylingPopover
                ? 'border-primary/80 bg-primary/10 text-primary'
                : 'border-border bg-surface-subtle text-on-surface-variant hover:border-primary/60 hover:text-on-surface'
            }`}
          >
            <Palette className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span className="max-w-[120px] truncate">{stylingTriggerLabel}</span>
            <svg
              className={`h-3.5 w-3.5 shrink-0 transition-transform ${showStylingPopover ? 'rotate-180' : ''}`}
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
            >
              <path d="M4 6l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-[0.08em] text-on-surface-variant">Position:</span>
          <select
            value={cardPositionPos || 'bottom-right'}
            onChange={(e) => setCardPositionPos(e.target.value)}
            className="rounded-lg border border-border bg-surface-subtle px-2.5 py-1.5 text-xs font-medium text-on-surface transition-colors hover:border-primary/60"
            title="Where the card sits on your website"
          >
            <option value="bottom-left">Bottom Left</option>
            <option value="bottom-right">Bottom Right</option>
          </select>
        </div>
      </div>

      {/* Position and card colour moved down to sit with Current in the Themes
          strip — all three are "what this card looks like", so they read as one
          group there instead of living apart from the Current swatch they act
          on. Only the primary action stays up here, pushed right. */}
      <div className="flex items-center justify-end gap-2">
        {/* Save draft functionality removed */}
      </div>
    </div>
  );
}
