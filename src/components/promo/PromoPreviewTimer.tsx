'use client';

import type { Dispatch, RefObject, SetStateAction } from 'react';
import type { CampaignConfig, GradientStyle, PromoCard, PromoField } from '@/types/campaign';
import type { ActiveFormats } from '@/hooks/useRichTextEditor';
import {
  LexicalTimerField,
  type LexicalTimerFieldHandle,
} from '@/components/timer-lexical/LexicalTimerField';
import { getBackgroundStyle } from '@/lib/utils';

interface PromoPreviewTimerProps {
  config: CampaignConfig;
  currentField: string | null;
  background: GradientStyle;
  lexicalTimerRef: RefObject<LexicalTimerFieldHandle | null>;
  setConfig: Dispatch<SetStateAction<CampaignConfig>>;
  markChanged: () => void;
  setCurrentField: (field: PromoField) => void;
  setActiveFormats: (formats: ActiveFormats) => void;
  setShowCardBgPopup: (open: boolean) => void;
  setStylePopupAnchor: (anchor: 'card' | 'input') => void;
  setCardWidth: (width: number) => void;
  computeCardWidth: (promo: PromoCard) => number;
  warnTimerLimit: () => void;
  pushPromoStateFromConfig: () => void;
  /** Kept current here too — the countdown writes through its own onChange. */
  liveCardRef: RefObject<PromoCard>;
  onTimerEdited: (() => void) | undefined;
}

/**
 * The countdown as it appears on the card.
 *
 * Unlike the three text fields either side of it this is a Lexical editor, not
 * a contenteditable div — the chip's per-cell styling cannot be expressed as
 * plain HTML — so it keeps its own component rather than joining
 * PromoPreviewTextField.
 */
export function PromoPreviewTimer({
  config,
  currentField,
  background,
  lexicalTimerRef,
  setConfig,
  markChanged,
  setCurrentField,
  setActiveFormats,
  setShowCardBgPopup,
  setStylePopupAnchor,
  setCardWidth,
  computeCardWidth,
  warnTimerLimit,
  pushPromoStateFromConfig,
  liveCardRef,
  onTimerEdited,
}: PromoPreviewTimerProps) {
  return (
                  /* The preview card IS the timer editor — you type, select,
                     and style here (and see the result here). It renders
                     inside the card's dateStyle (background / textColor /
                     align); chrome='inline' keeps the editor from adding any
                     wrapper styling that would change that look. */
                  <div
                    data-tour="promo-timer"
                    className={`mb-4 px-2 py-1 rounded break-words ${currentField === "timer" ? "ring-1 ring-primary/70" : ""}`}
                    onMouseDown={() => {
                      if (currentField !== "timer") setCurrentField("timer");
                      // Touching the countdown is the signal that the hint
                      // has done its job and should stop reappearing.
                      onTimerEdited?.();
                    }}
                    onClick={(e) => {
                      setShowCardBgPopup(false);
                      setStylePopupAnchor("card");
                      if (currentField !== "timer") setCurrentField("timer");
                      // Clicking ON the countdown targets a chip cell for
                      // styling (its own mousedown sets the target) — placing
                      // a caret here would fire a text SELECTION_CHANGE that
                      // clears that just-set target. Only place the caret for
                      // clicks OUTSIDE the countdown; pass the click X so a
                      // click beside it lands on the correct side.
                      const onChip = (e.target as HTMLElement).closest?.(
                        "[data-timer-chip]",
                      );
                      if (!onChip) {
                        lexicalTimerRef.current?.focus(e.clientX);
                      } else if (
                        document.activeElement instanceof HTMLElement &&
                        document.activeElement !== document.body
                      ) {
                        // The chip's mousedown preventDefault()s, so the
                        // browser never moves DOM focus — without this,
                        // keystrokes after a chip click keep going to the
                        // PREVIOUSLY focused field (e.g. the Title).
                        document.activeElement.blur();
                      }
                    }}
                    style={{
                      background: getBackgroundStyle(
                        background,
                      ),
                      color: config.promoCard.style.dateStyle.textColor,
                      textAlign:
                        config.promoCard.style.dateStyle.textAlign ||
                        "center",
                    }}
                  >
                    <LexicalTimerField
                      ref={lexicalTimerRef}
                      chrome="inline"
                      timerText={config.promoCard.timerText ?? ''}
                      initialStateJson={config.promoCard.timerStateJson}
                      endDate={config.promoCard.endDate || ''}
                      onFocus={() => {
                        if (currentField !== "timer") setCurrentField("timer");
                      }}
                      onTargetChange={() => {
                        setTimeout(() => {
                          const fmts = lexicalTimerRef.current?.getActiveFormats();
                          if (fmts) setActiveFormats(fmts);
                        }, 0);
                      }}
                      onChange={(nextTimerText) => {
                        /**
                         * Only a real change is a step.
                         *
                         * Lexical reports a change whenever its state is
                         * rewritten — including when a snapshot is restored
                         * into it, which is not the user doing anything. That
                         * echo used to reach the history, and because a push
                         * discards the redo branch, undo worked and redo did
                         * not. The restoring flag could not stop it: that flag
                         * clears on a timer and this callback can land after.
                         *
                         * Comparing against the live card is exact — an echo
                         * carries the text that was just restored, an edit does
                         * not.
                         */
                        if (nextTimerText !== (liveCardRef.current.timerText ?? '')) {
                          // Taken from config, not from the editor: it already
                          // holds the new text by the time it says so, and the
                          // step has to record what came before.
                          pushPromoStateFromConfig();
                        }
                        // Functional update: this fires in the SAME batch as
                        // onStateJson below. Spreading a stale closure `config`
                        // in both makes the second setConfig clobber the first
                        // (that desynced timerText from timerStateJson — stale
                        // suffixes like "on a" survived in timerText only).
                        setConfig((prev) => {
                          if (nextTimerText === (prev.promoCard.timerText ?? '')) return prev;
                          const nextCard = { ...prev.promoCard, timerText: nextTimerText };
                          liveCardRef.current = nextCard;
                          return { ...prev, promoCard: nextCard };
                        });
                        markChanged();
                      }}
                      onStateJson={(json) => {
                        // The timer can also drive the 400→440 stretch.
                        const w = computeCardWidth(config.promoCard);
                        setCardWidth(w);
                        // Functional update so this merges onto the latest state
                        // (incl. the timerText just set by onChange) instead of
                        // overwriting it from a stale closure — keeps timerText
                        // and timerStateJson in sync.
                        setConfig((prev) =>
                          json === (prev.promoCard.timerStateJson ?? '')
                            ? prev
                            : {
                                ...prev,
                                promoCard: { ...prev.promoCard, timerStateJson: json, cardWidth: w },
                              },
                        );
                        markChanged();
                      }}
                      // 1-line limit is enforced inside the editor (plugin);
                      // it reverts the overflowing edit and calls this so we
                      // show the shared "field limit reached" warning.
                      onLineOverflow={warnTimerLimit}
                    />
                  </div>
  );
}
