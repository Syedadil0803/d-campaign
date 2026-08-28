'use client';

import { useEffect, useRef, type RefObject } from 'react';
import type { EditorState } from 'lexical';
import type { CampaignConfig, PromoCard, PromoField } from '@/types/campaign';
import type { PromoSelectionSnapshot } from '@/lib/promo/promoEditorSelection';
import { UndoStack } from '@/lib/editor/undoStack';
import { clonePromoCard, cardSignature } from '@/lib/promo/promoCardIdentity';
import { cardIsBlank, cardIsUntouchedTemplate } from '@/lib/promo/promoAuthorship';
import { restorePromoSelection, getPromoSelectionSnapshot } from '@/lib/promo/promoEditorSelection';

export interface PromoSnapshot {
  promoCard: PromoCard;
  currentField: PromoField | null;
  selection: PromoSelectionSnapshot | null;
  /**
   * Whether the empty-field ghosts were on screen at this moment.
   *
   * Carried rather than recomputed. It is a mode the session is in — "the user
   * is building a card" — not something the card can be read for, which is why
   * startFreshCard sets it by hand. Deriving it on restore from
   * `active || currentField` meant undoing to any step recorded while focus was
   * outside a text field (a date picker, a colour, the countdown before its
   * focus had committed) switched the ghosts off, and an empty title and
   * subtitle vanished from the card even though undo had changed nothing about
   * them.
   */
  showPersistentScaffold: boolean;
  /**
   * The countdown's editor state at this moment, or null when it had not
   * mounted yet.
   *
   * Held as Lexical's own EditorState rather than the card's timerStateJson.
   * The JSON is written asynchronously by onStateJson, so a push could record
   * the state from BEFORE the change it was meant to precede; it has the caret
   * slot pruned out of it, so a restore could not put the caret back; and it
   * has to be re-parsed. The state object has none of those problems and is
   * what Lexical restores natively.
   *
   * timerStateJson stays on the card — it is what gets saved. It is simply not
   * what the history reads.
   */
  timerEditorState: EditorState | null;
}

interface PromoAppliedRedoSnapshot {
  snapshot: PromoSnapshot;
  baseline: PromoSnapshot | null;
}

interface UsePromoUndoArgs {
  configRef: RefObject<CampaignConfig>;
  /** The card ahead of React — see getPromoSnapshot. */
  liveCardRef: RefObject<PromoCard>;
  setConfig: (config: CampaignConfig) => void;
  markChanged: () => void;
  currentFieldRef: RefObject<PromoField | null>;
  setCurrentField: (field: PromoField | null) => void;
  activeEditorRef: RefObject<HTMLDivElement | null>;
  getActivePromoEditor: () => HTMLDivElement | null;
  getFieldRef: (field: PromoField | null) => RefObject<HTMLDivElement | null> | null;
  syncEditorsFromConfig: (card: PromoCard, options?: { skipTimer?: boolean }) => void;
  refreshPromoToolbarFormats: (editor?: HTMLDivElement | null) => void;
  setShowPersistentScaffold: (show: boolean) => void;
  /** Read at push time so a snapshot records the ghosts as they then were. */
  showPersistentScaffoldRef: RefObject<boolean>;
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
  /** Reads and restores the countdown's editor state. */
  lexicalTimerRef: RefObject<{
    getEditorState: () => EditorState | null;
    getPreviousEditorState: () => EditorState | null;
    restoreEditorState: (state: EditorState) => void;
  } | null>;
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
  liveCardRef,
  setConfig,
  markChanged,
  currentFieldRef,
  setCurrentField,
  activeEditorRef,
  getActivePromoEditor,
  getFieldRef,
  syncEditorsFromConfig,
  refreshPromoToolbarFormats,
  setShowPersistentScaffold,
  showPersistentScaffoldRef,
  isFreshCardRef,
  draftPromoCardRef,
  livePromoCardRef,
  templateCards,
  selectedVersionId,
  setSelectedVersionId,
  onSelectedVersionChange,
  onCardReplaced,
  restoringSnapshotRef,
  lexicalTimerRef,
  toast,
}: UsePromoUndoArgs) {
  const promoHistory = useRef(new UndoStack<PromoSnapshot>()).current;
  const promoAppliedCardBaselineRef = useRef<PromoSnapshot | null>(null);
  const promoAppliedRedoRef = useRef<PromoAppliedRedoSnapshot | null>(null);


  /**
   * The card as it is now, plus where the caret was.
   *
   * ONE source. This used to be `configRef` overlaid with the live DOM of
   * whichever field had focus, which made a snapshot's accuracy depend on where
   * the caret happened to be: with the cursor in the countdown its text was
   * read live and was right, with the cursor in the title the countdown's text
   * — and showTimer — came from a config that had not caught up. Undoing from
   * the title could therefore restore a card in which the timer had never been
   * switched on, and because each push discards the redo branch it could not be
   * brought back.
   *
   * liveCardRef is updated by every editor in the same breath as setConfig, so
   * it is never behind, and the caret no longer decides what the history sees.
   */
  function getPromoSnapshot(): PromoSnapshot {
    const editor = getActivePromoEditor();
    return {
      promoCard: clonePromoCard(liveCardRef.current),
      currentField: currentFieldRef.current,
      selection: editor ? getPromoSelectionSnapshot(editor) : null,
      showPersistentScaffold: showPersistentScaffoldRef.current,
      timerEditorState: lexicalTimerRef.current?.getEditorState() ?? null,
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

  /**
   * Would this push add a step that goes nowhere?
   *
   * The stack records the state BEFORE each action, so if the step on top holds
   * this exact card, nothing landed between the two pushes. The user meets these
   * as a Ctrl+Z that visibly does nothing and has to be pressed twice.
   *
   * Time coalescing cannot catch them: every style, colour and date change
   * pushes with `force`, which bypasses the window deliberately.
   *
   * The WHOLE card is compared, not cardSignature — that strips HTML and omits
   * dates, so it would call a bold or a new end date "the same" and throw away a
   * real step. Different key order compares unequal, which only lets a redundant
   * step survive: the safe way round.
   */
  function pushIsRedundant(snapshot: PromoSnapshot): boolean {
    const top = promoHistory.peek();
    return (
      !!top &&
      JSON.stringify(top.promoCard) === JSON.stringify(snapshot.promoCard)
    );
  }

  function pushPromoState(options: { replace?: boolean } = {}) {
    if (restoringSnapshotRef.current) return;
    const snapshot = getPromoSnapshot();
    // Before the redo branch is dropped, not after: an action that changed
    // nothing must not cost the user their redo.
    if (pushIsRedundant(snapshot)) return;
    promoAppliedRedoRef.current = null;
    promoHistory.push(snapshot, { force: options.replace });
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

  /**
   * A step taken from the config rather than from the editors.
   *
   * getPromoSnapshot reads the live DOM for whichever field is active, which is
   * right when the push happens BEFORE the edit lands — how typing in the three
   * text fields is recorded, from their keydown. The countdown has no keydown to
   * hang that on: it is a Lexical editor and only reports a change once the
   * change is already in it, so reading its DOM there would snapshot the edit we
   * are trying to be able to undo. The config still holds the previous text at
   * that moment, so it is the honest source.
   */
  function pushPromoStateFromConfig() {
    if (restoringSnapshotRef.current) return;
    const snapshot: PromoSnapshot = {
      promoCard: clonePromoCard(liveCardRef.current),
      currentField: currentFieldRef.current,
      selection: null,
      showPersistentScaffold: showPersistentScaffoldRef.current,
      // One further back, for the same reason the card comes from the config:
      // the countdown reports a change once it already holds it.
      timerEditorState: lexicalTimerRef.current?.getPreviousEditorState() ?? null,
    };
    if (pushIsRedundant(snapshot)) return;
    promoAppliedRedoRef.current = null;
    promoHistory.push(snapshot);
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
    // The live card moves with the restore, or the next push would record the
    // card we just stepped away from.
    liveCardRef.current = nextPromoCard;
    setCurrentField(snapshot.currentField);
    setShowPersistentScaffold(snapshot.showPersistentScaffold);
    setConfig({ ...configRef.current, promoCard: nextPromoCard });
    syncEditorsFromConfig(nextPromoCard, {
      skipTimer: Boolean(snapshot.timerEditorState),
    });
    /**
     * The countdown is put back from the state the step captured, not from the
     * card's JSON — so its wording, its per-word styling, the chip's cell
     * colours and the caret all come back in one atomic update.
     *
     * Only when the step has one. A step recorded before the editor mounted
     * has none, and syncEditorsFromConfig's JSON path is right for that.
     */
    if (snapshot.timerEditorState) {
      lexicalTimerRef.current?.restoreEditorState(snapshot.timerEditorState);
    }
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
      showPersistentScaffold: showPersistentScaffoldRef.current,
      timerEditorState: lexicalTimerRef.current?.getEditorState() ?? null,
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
  useEffect(() => {
    function onKeyDown(e: globalThis.KeyboardEvent) {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;
      const key = e.key.toLowerCase();
      const isUndo = key === 'z' && !e.shiftKey;
      const isRedo = (key === 'z' && e.shiftKey) || key === 'y';
      if (!isUndo && !isRedo) return;

      // Typing in a plain input (WhatsApp number, button URL) is that field's
      // own business — the browser's undo is the right one there.
      const el = document.activeElement;
      if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) return;

      e.preventDefault();
      if (isUndo) undoPromo();
      else redoPromo();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  return {
    getPromoSnapshot,
    pushPromoState,
    pushPromoStateFromConfig,
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
