'use client';

import { useRef, type RefObject } from 'react';
import type { CampaignConfig, PromoCard, PromoField } from '@/types/campaign';
import type { PromoSelectionSnapshot } from '@/lib/promo/promoEditorSelection';
import { UndoStack } from '@/lib/editor/undoStack';
import { clonePromoCard, cardSignature } from '@/lib/promo/promoCardIdentity';
import { cardIsBlank, cardIsUntouchedTemplate } from '@/lib/promo/promoAuthorship';
import { restorePromoSelection, getPromoSelectionSnapshot } from '@/lib/promo/promoEditorSelection';
import { wrapBareTextWithFontSize } from '@/lib/editor/richTextUtils';
import { serializeTimerHtml } from '@/lib/editor/timerUtils';

export interface PromoSnapshot {
  promoCard: PromoCard;
  currentField: PromoField | null;
  selection: PromoSelectionSnapshot | null;
}

interface PromoAppliedRedoSnapshot {
  snapshot: PromoSnapshot;
  baseline: PromoSnapshot | null;
}

interface UsePromoUndoArgs {
  configRef: RefObject<CampaignConfig>;
  setConfig: (config: CampaignConfig) => void;
  markChanged: () => void;
  currentFieldRef: RefObject<PromoField | null>;
  setCurrentField: (field: PromoField | null) => void;
  activeEditorRef: RefObject<HTMLDivElement | null>;
  timerRef: RefObject<HTMLDivElement | null>;
  previewTimerRef: RefObject<HTMLDivElement | null>;
  getActivePromoEditor: () => HTMLDivElement | null;
  getFieldRef: (field: PromoField | null) => RefObject<HTMLDivElement | null> | null;
  syncEditorsFromConfig: (card: PromoCard) => void;
  refreshPromoToolbarFormats: (editor?: HTMLDivElement | null) => void;
  setShowPersistentScaffold: (show: boolean) => void;
  isFreshCardRef: RefObject<boolean>;
  draftPromoCardRef: RefObject<PromoCard | null | undefined>;
  livePromoCardRef: RefObject<PromoCard | null | undefined>;
  templateCards: PromoCard[];
  selectedVersionId: string | null;
  setSelectedVersionId: (id: string | null) => void;
  onSelectedVersionChange: ((versionId: string | null) => void) | undefined;
  onCardReplaced: (() => void) | undefined;
  /**
   * Passed in rather than owned: usePromoRichText needs it as well, and that
   * hook is built before this one.
   */
  restoringSnapshotRef: RefObject<boolean>;
  toast: (message: string, isError?: boolean, action?: { label: string; onClick: () => void }, durationMs?: number) => void;
}

/**
 * Stepping backwards and forwards through work on the promo card.
 *
 * Owns the history stack and the three refs that go with it — whether a
 * restore is in flight, what the card looked like when it was last applied,
 * and the redo counterpart of that. Those exist for nothing else, which is
 * what makes this a module rather than a pile of arguments: the card lifecycle
 * group beside it owns no state of its own and was left where it is.
 *
 * The announcement bar keeps a single previous state, so it can swap back once
 * but cannot walk through a session. The promo needs about thirty actions of
 * depth, so it gets a real stack.
 */
export function usePromoUndo({
  configRef,
  setConfig,
  markChanged,
  currentFieldRef,
  setCurrentField,
  activeEditorRef,
  timerRef,
  previewTimerRef,
  getActivePromoEditor,
  getFieldRef,
  syncEditorsFromConfig,
  refreshPromoToolbarFormats,
  setShowPersistentScaffold,
  isFreshCardRef,
  draftPromoCardRef,
  livePromoCardRef,
  templateCards,
  selectedVersionId,
  setSelectedVersionId,
  onSelectedVersionChange,
  onCardReplaced,
  restoringSnapshotRef,
  toast,
}: UsePromoUndoArgs) {
  const promoHistory = useRef(new UndoStack<PromoSnapshot>()).current;
  const promoAppliedCardBaselineRef = useRef<PromoSnapshot | null>(null);
  const promoAppliedRedoRef = useRef<PromoAppliedRedoSnapshot | null>(null);

  function getPromoSnapshot(): PromoSnapshot {
    const editor = getActivePromoEditor();
    const promoCard = clonePromoCard(configRef.current.promoCard);
    const currentField = currentFieldRef.current;
    if (editor && currentField) {
      const html = wrapBareTextWithFontSize(editor.innerHTML);
      if (currentField === "title") promoCard.title = html;
      if (currentField === "subtitle") promoCard.subtitle = html;
      if (currentField === "description") promoCard.description = html;
      if (currentField === "button") promoCard.buttonText = html;
      if (currentField === "timer") {
        // Always read the real timer editor — never a stale/other-field editor,
        // which would corrupt timerText in the undo/redo history.
        const tEl =
          editor === timerRef.current || editor === previewTimerRef.current
            ? editor
            : timerRef.current;
        if (tEl) {
          promoCard.timerText = serializeTimerHtml(
            wrapBareTextWithFontSize(tEl.innerHTML),
          );
        }
      }
    }
    return {
      promoCard,
      currentField,
      selection: editor ? getPromoSelectionSnapshot(editor) : null,
    };
  }

  /**
   * Record the card as it is BEFORE a change, so undo restores this moment.
   *
   * `replace` marks an action that is its own step even mid-burst — the start
   * of a delete run, an overwrite, a color or date change. Everything else
   * coalesces, so a burst of typing collapses into one step.
   *
   * Pushes are no longer blocked while a template/variant baseline is set:
   * editing after a swap is ordinary editing and belongs on the stack. Only the
   * swap itself is off-limits, and that's handled by clearing the stack.
   */

  function pushPromoState(options: { replace?: boolean } = {}) {
    if (restoringSnapshotRef.current) return;
    promoAppliedRedoRef.current = null;
    promoHistory.push(getPromoSnapshot(), { force: options.replace });
  }

  /**
   * Everything a card-replacing action overwrites — the card itself plus the
   * bookkeeping that hangs off it (which variant is selected, what the Themes
   * strip reverts to, whether this counts as a fresh card).
   *
   * Ctrl+Z deliberately stops at these actions, so the only way back is the
   * Undo offer on their toast, and that offer has to put all of it back.
   */
  interface PromoRestorePoint {
    snapshot: PromoSnapshot;
    selectedVersionId: string | null;
    isFreshCard: boolean;
    appliedBaseline: PromoSnapshot | null;
    /**
     * True when an Undo offer would give the user nothing back — the card was
     * blank, or is stored somewhere it can be fetched from.
     *
     * Decided at capture time rather than at toast time: the snapshot folds
     * the live editor's HTML into the card, so its signature drifts from the
     * stored copy and a plainly recoverable card stops looking like one.
     */
    nothingToUndo: boolean;
  }

  function capturePromoRestorePoint(): PromoRestorePoint {
    return {
      snapshot: getPromoSnapshot(),
      selectedVersionId,
      isFreshCard: isFreshCardRef.current,
      appliedBaseline: promoAppliedCardBaselineRef.current,
      nothingToUndo: nothingToOfferBack(configRef.current.promoCard),
    };
  }

  function restorePromoPoint(point: PromoRestorePoint) {
    applyPromoSnapshot(point.snapshot);
    setSelectedVersionId(point.selectedVersionId);
    onSelectedVersionChange?.(point.selectedVersionId);
    isFreshCardRef.current = point.isFreshCard;
    promoAppliedCardBaselineRef.current = point.appliedBaseline;
    promoAppliedRedoRef.current = null;
    // Stepping back over a swap is itself a boundary: the steps on the stack
    // belong to the card we just left, not the one coming back.
    promoHistory.clear();
    onCardReplaced?.();
  }

  /**
   * Is this card already stored somewhere the user can fetch it from?
   *
   * Published or sitting in the draft both count: My Published and My Draft
   * bring it back on demand, so it cannot be lost by being replaced.
   */
  /** The template cards themselves, for the authorship checks below. */

  function cardIsRecoverable(card: PromoCard | null | undefined): boolean {
    if (!card) return false;
    const sig = cardSignature(card);
    /**
     * Read through refs, not the props directly.
     *
     * These checks run from dialog confirm handlers, and a handler keeps the
     * scope it was created in. Saving a draft from inside that dialog updates
     * the prop but not the closure, so the card looked absent from the draft
     * the moment after it had been written there — and Undo came back.
     */
    const live = livePromoCardRef.current;
    const draft = draftPromoCardRef.current;
    return (
      (!!live && sig === cardSignature(live)) ||
      (!!draft && sig === cardSignature(draft))
    );
  }



  /**
   * Would an Undo offer actually give the user anything back?
   *
   * No, in three cases. There was no card to begin with, so undoing restores
   * blankness. The card is published or in the draft, so My Published and My
   * Draft already hold it. Or it is a template exactly as it ships, which
   * Template Hub will hand back in one click.
   *
   * What all three share: nothing of the user's own would be lost. Undo is
   * for work, and none of these are work yet.
   */

  function nothingToOfferBack(card: PromoCard | null | undefined): boolean {
    return (
      cardIsBlank(card) ||
      cardIsRecoverable(card) ||
      cardIsUntouchedTemplate(card, templateCards)
    );
  }

  /**
   * Confirmation toast, carrying a one-tap way back only when there is
   * something to come back to.
   *
   * Undo is for work that would otherwise be gone. Offering it after replacing
   * a card that is already published or already in the draft protects nothing
   * — it just puts a countdown on screen after every template, variant and
   * clear, training the user to ignore the one toast that will matter.
   */

  function toastWithUndo(message: string, point: PromoRestorePoint) {
    if (point.nothingToUndo) {
      toast(message);
      return;
    }
    toast(message, false, {
      label: "Undo",
      onClick: () => restorePromoPoint(point),
    });
  }

  function applyPromoSnapshot(snapshot: PromoSnapshot) {
    restoringSnapshotRef.current = true;
    const nextPromoCard = clonePromoCard(snapshot.promoCard);
    setCurrentField(snapshot.currentField);
    setShowPersistentScaffold(
      nextPromoCard.active || Boolean(snapshot.currentField),
    );
    setConfig({ ...configRef.current, promoCard: nextPromoCard });
    syncEditorsFromConfig(nextPromoCard);
    setTimeout(() => {
      const ref = getFieldRef(snapshot.currentField);
      activeEditorRef.current = ref?.current || null;
      if (ref?.current) {
        restorePromoSelection(ref.current, snapshot.selection);
      }
      refreshPromoToolbarFormats(ref?.current || undefined);
      restoringSnapshotRef.current = false;
    }, 0);
    markChanged();
  }

  /**
   * Remember the card exactly as it was applied. Only the consent check reads
   * this now — an untouched template/variant doesn't need a "you'll lose work"
   * prompt, because it's one click away in its own popup.
   */

  function setPromoAppliedCardBaseline(promoCard: PromoCard) {
    promoAppliedCardBaselineRef.current = {
      promoCard: clonePromoCard(promoCard),
      currentField: currentFieldRef.current,
      selection: null,
    };
  }


  /**
   * The card a cleared canvas starts from: no words, no design, no end date,
   * and both optional parts switched off.
   *
   * The schedule used to carry over, on the reasoning that dates were chosen
   * when the campaign was created and clearing a card is not a decision to
   * re-plan. That still holds when a card is being replaced — a template or a
   * variant keeps the user's dates — but clearing is a fresh start, and the
   * countdown switching itself on before anyone has said when the campaign
   * runs is what gave that away.
   */

  /**
   * Step back one action. Returns false when there's nothing left, so callers
   * can decide whether to swallow the key.
   */
  function undoPromo(): boolean {
    const previous = promoHistory.undo(getPromoSnapshot());
    if (!previous) return false;
    applyPromoSnapshot(previous);
    return true;
  }

  function redoPromo(): boolean {
    const next = promoHistory.redo(getPromoSnapshot());
    if (!next) return false;
    applyPromoSnapshot(next);
    return true;
  }

  /**
   * Ctrl/Cmd+Z and Ctrl/Cmd+Shift+Z for the whole promo editor.
   *
   * Bound at the window rather than per-field: every field, style control,
   * date and CTA setting shares one timeline, so the shortcut can't belong to
   * whichever element happens to have focus. It also has to REPLACE the
   * browser's native contentEditable undo, which only knows about the box the
   * caret is in and would otherwise fight this stack — hence preventDefault on
   * every handled combination.
   */

  return {
    getPromoSnapshot,
    pushPromoState,
    capturePromoRestorePoint,
    restorePromoPoint,
    cardIsRecoverable,
    nothingToOfferBack,
    toastWithUndo,
    applyPromoSnapshot,
    setPromoAppliedCardBaseline,
    undoPromo,
    redoPromo,
    promoAppliedCardBaselineRef,
    promoHistory,
    promoAppliedRedoRef,
  };
}
