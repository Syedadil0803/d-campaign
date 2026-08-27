'use client';


import {
  useEffect,
  type RefObject,
  type Dispatch,
  type SetStateAction,
  type KeyboardEvent,
} from "react";
import {
} from "lucide-react";
import { CampaignConfig, PromoCard, PromoField } from '@/types/campaign';
import {
} from "@/lib/promo/promoAuthorship";

import { useRichTextEditor } from '@/hooks/useRichTextEditor';
import {
  wrapBareTextWithFontSize,
  rgbToHex,
  fontSizeToLabel,
} from "@/lib/editor/richTextUtils";
import {
} from "@/lib/promo/promoVersions";
import {
  buildTimerDisplayHtml,
  serializeTimerHtml,
  calculateTimeRemaining as calcTimerRemaining,
} from "@/lib/editor/timerUtils";
import { type LexicalTimerFieldHandle } from '@/components/timer-lexical/LexicalTimerField';
import { type MeasuredField, measureOverflow } from '@/lib/promo/promoMeasure';
import {
} from '@/components/promo/PromoCardActionDialog';
import {
  PROMO_EDITOR_DEFAULT_COLOR,
  selectionIsInsideEditor,
  hasVisibleContent,
  getEditorFallbackColor,
  unwrapInlineTags,
} from '@/lib/promo/promoEditorSelection';
import {
} from "@/components/timer-lexical/lineMeasure";

type RichTextApi = ReturnType<typeof useRichTextEditor>;
type Editor = RefObject<HTMLDivElement | null>;

interface UsePromoRichTextArgs {
  config: CampaignConfig;
  setConfig: (config: CampaignConfig) => void;
  markChanged: () => void;
  pushPromoState: (options?: { replace?: boolean }) => void;

  currentField: PromoField | null;
  setCurrentField: Dispatch<SetStateAction<PromoField | null>>;
  currentFieldRef: RefObject<PromoField | null>;
  getFieldRef: (field: PromoField | null) => Editor | null;

  /** The panel's editors, the preview's timer, and whichever has focus. */
  titleRef: Editor;
  subtitleRef: Editor;
  descRef: Editor;
  buttonRef: Editor;
  timerRef: Editor;
  previewTimerRef: Editor;
  activeEditorRef: Editor;
  lexicalTimerRef: RefObject<LexicalTimerFieldHandle | null>;

  cardWidth: number;
  setCardWidth: Dispatch<SetStateAction<number>>;
  computeCardWidth: (promo: PromoCard) => number;

  hiddenFieldInfos: Set<string>;
  setFieldInfoPopup: Dispatch<
    SetStateAction<'title' | 'subtitle' | 'description' | null>
  >;
  setShowCardBgPopup: Dispatch<SetStateAction<boolean>>;
  setShowPersistentScaffold: Dispatch<SetStateAction<boolean>>;
  setStylePopupAnchor: (anchor: 'card' | 'input') => void;
  showStyleWarning: (message: string) => void;
  closeAllPromoDropdowns: () => void;

  lastInteractionAtRef: RefObject<number>;
  lastSyncedPromoRef: RefObject<string | null>;
  lastValidHtmlRef: RefObject<Record<string, string>>;
  promoDeletingRef: RefObject<boolean>;
  restoringSnapshotRef: RefObject<boolean>;
  skipOverflowBlockRef: RefObject<boolean>;

  activeFormats: RichTextApi['activeFormats'];
  setActiveFormats: RichTextApi['setActiveFormats'];
  formatText: RichTextApi['formatText'];
  applyColor: RichTextApi['applyColor'];
  detectFormats: RichTextApi['detectFormats'];
  ensureDefaultFontSize: RichTextApi['ensureDefaultFontSize'];
  saveSelection: RichTextApi['saveSelection'];
}

/**
 * The promo card's rich-text editing: what the toolbar does, what typing does,
 * and keeping the panel's editors and the preview's editors in step.
 *
 * Moved out of PromoSection as functions, deliberately NOT as a component. The
 * per-field line limit is measured against live DOM in these editors, and an
 * earlier attempt to lift the fields into a component of their own broke it —
 * a new component remounts the contentEditable nodes it renders. A hook leaves
 * the JSX tree exactly as it was, so the same DOM elements survive.
 *
 * The bodies below are unchanged from PromoSection, character for character.
 */
export function usePromoRichText({
  activeEditorRef,
  buttonRef,
  closeAllPromoDropdowns,
  computeCardWidth,
  config,
  currentField,
  currentFieldRef,
  descRef,
  getFieldRef,
  hiddenFieldInfos,
  lastInteractionAtRef,
  lastSyncedPromoRef,
  lastValidHtmlRef,
  lexicalTimerRef,
  markChanged,
  previewTimerRef,
  promoDeletingRef,
  pushPromoState,
  restoringSnapshotRef,
  setCardWidth,
  setConfig,
  setCurrentField,
  setFieldInfoPopup,
  setShowCardBgPopup,
  setShowPersistentScaffold,
  skipOverflowBlockRef,
  subtitleRef,
  timerRef,
  titleRef,
  showStyleWarning,
  ensureDefaultFontSize,
  setActiveFormats,
  formatText,
  setStylePopupAnchor,
  detectFormats,
  saveSelection,
  applyColor,
  activeFormats,
}: UsePromoRichTextArgs) {
  /**
   * Keep the toolbar in step with what is selected inside the countdown.
   *
   * The timer reports only chip-TARGET changes, and selecting text clears the
   * target to null — so the first text selection fired an event and every one
   * after it was null to null, silently. Moving between a small blue run and a
   * large red one left the toolbar showing whichever run was selected first.
   *
   * The editor's own selection is the signal, so listen for it directly, and
   * only while the countdown is the field being edited.
   */
  useEffect(() => {
    if (currentField !== 'timer') return;
    const syncFromSelection = () => {
      const fmts = lexicalTimerRef.current?.getActiveFormats();
      if (fmts) setActiveFormats(fmts);
    };
    document.addEventListener('selectionchange', syncFromSelection);
    return () =>
      document.removeEventListener('selectionchange', syncFromSelection);
  }, [currentField, lexicalTimerRef, setActiveFormats]);

  function applyWholeEditorStyleToggle(
    editor: HTMLDivElement,
    format: "bold" | "italic",
    enable: boolean,
  ) {
    if (enable) {
      formatText(format);
      return;
    }
    if (format === "bold") {
      unwrapInlineTags(editor, "b,strong");
      return;
    }
    unwrapInlineTags(editor, "i,em");
  }

  function detectPromoFormatsFromHTML(
    html: string,
    fallbackColor = PROMO_EDITOR_DEFAULT_COLOR,
  ) {
    const container = document.createElement("div");
    container.innerHTML = html;

    const textNodes: Node[] = [];
    function findTextNodes(node: Node) {
      if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent?.replace(/\u200B/g, "").trim();
        if (text) textNodes.push(node);
      } else {
        node.childNodes.forEach(findTextNodes);
      }
    }
    findTextNodes(container);

    if (textNodes.length === 0) {
      setActiveFormats({
        bold: false,
        italic: false,
        size: "md",
        color: fallbackColor,
      });
      return;
    }

    const sizes = new Set<string>();
    const colors = new Set<string>();
    let allBold = true;
    let allItalic = true;

    textNodes.forEach((textNode) => {
      let foundSize = false;
      let isBold = false;
      let isItalic = false;
      let effectiveColor = fallbackColor;
      let node: HTMLElement | null = textNode.parentElement;

      while (node && node !== container) {
        if (!foundSize && node.style.fontSize) {
          // Snaps to the nearest preset — template sizes like 1.6rem aren't in
          // the six-value map and used to fall through, showing "md".
          const label = fontSizeToLabel(node.style.fontSize);
          if (label) {
            sizes.add(label);
            foundSize = true;
          }
        }
        if (node.style.color) {
          const color = node.style.color;
          effectiveColor = color.startsWith("rgb") ? rgbToHex(color) : color;
        }
        const tag = node.tagName;
        if (tag === "B" || tag === "STRONG") isBold = true;
        if (tag === "I" || tag === "EM") isItalic = true;
        node = node.parentElement;
      }

      colors.add(effectiveColor);
      if (!isBold) allBold = false;
      if (!isItalic) allItalic = false;
    });

    setActiveFormats({
      bold: allBold,
      italic: allItalic,
      size: sizes.size === 1 ? [...sizes][0] : sizes.size === 0 ? "md" : "",
      color: colors.size === 1 ? [...colors][0] : "",
    });
  }

  function syncEditorsFromConfig(pc: PromoCard) {
    setTimeout(() => {
      if (titleRef.current) titleRef.current.innerHTML = pc.title || "";
      if (subtitleRef.current)
        subtitleRef.current.innerHTML = pc.subtitle || "";
      if (descRef.current) descRef.current.innerHTML = pc.description || "";
      if (buttonRef.current) buttonRef.current.innerHTML = pc.buttonText || "";
      if (timerRef.current) {
        timerRef.current.innerHTML = buildTimerDisplayHtml(
          pc.timerText ?? "",
          calcTimerRemaining(pc.endDate || ""),
        );
      }
    }, 0);
  }

  function smartPaste(e: React.ClipboardEvent<HTMLDivElement>, field: MeasuredField) {
    e.preventDefault();
    const text = e.clipboardData.getData('text/plain');
    if (!text) return;
    const el = e.currentTarget;
    const currentHtml = el.innerHTML;

    // Extract the style wrapper from existing content to match font size
    // Use the actual editor HTML as base for measurement
    const buildTestHtml = (addedText: string) => {
      // If there's existing styled content, append plain text after it
      if (currentHtml && currentHtml !== '<br>') {
        return currentHtml + addedText;
      }
      // Empty field — inherit whatever the default style would be
      return addedText;
    };

    // Try full paste
    const fullTestHtml = buildTestHtml(text);
    if (!measureOverflow(fullTestHtml, field)) {
      document.execCommand('insertText', false, text);
      const resultHtml = wrapBareTextWithFontSize(el.innerHTML);
      lastValidHtmlRef.current[field] = resultHtml;
      onFieldInput(field);
      return;
    }

    // Binary search for max that fits
    let low = 0;
    let high = text.length;
    let best = 0;
    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      const testHtml = buildTestHtml(text.slice(0, mid));
      if (!measureOverflow(testHtml, field)) {
        best = mid;
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }

    if (best > 0) {
      document.execCommand('insertText', false, text.slice(0, best));
      const resultHtml = wrapBareTextWithFontSize(el.innerHTML);
      lastValidHtmlRef.current[field] = resultHtml;
      onFieldInput(field);
    }
  }

  function onFieldFocus(
    field: PromoField,
    ref: RefObject<HTMLDivElement | null>,
  ) {
    activeEditorRef.current = ref.current;
    // Focus the browser handed back rather than focus the user asked for —
    // keep the field editable, but do not act as though they opened it.
    if (Date.now() - lastInteractionAtRef.current > 1000) return;
    setShowPersistentScaffold(true);
    // Two panels cannot both be the one being edited. Focusing a field means
    // its styles are what the user wants next, so the card's own background
    // panel and any open dropdown step aside — they were staying open on top
    // of the field panel, leaving two style surfaces on screen at once with
    // no way to tell which the controls belonged to.
    closeAllPromoDropdowns();
    setShowCardBgPopup(false);
    // Focusing an input on the left is the second way into the style panel,
    // and it belongs on the same side as the style icon beside it.
    setStylePopupAnchor("input");
    setCurrentField(field);
    activeEditorRef.current = ref.current;
    if ((field === 'title' || field === 'subtitle' || field === 'description') && !hiddenFieldInfos.has(field)) {
      setFieldInfoPopup(field);
    }
    promoDeletingRef.current = false;
    setTimeout(() => {
      refreshPromoToolbarFormats(ref.current);
      ensureDefaultFontSize();
    }, 0);
  }

  function onFieldInput(field: PromoField) {
    if (restoringSnapshotRef.current) return;
    if (field === "timer") {
      // Only ever operate on a REAL timer editor. If activeEditorRef points
      // elsewhere (e.g. Description), using it here would inject the countdown
      // into that field via the self-heal below. Fall back to the panel editor.
      const active = activeEditorRef.current;
      const el =
        active === timerRef.current || active === previewTimerRef.current
          ? active
          : timerRef.current;
      if (!el) return;
      const html = wrapBareTextWithFontSize(el.innerHTML);
      const text = serializeTimerHtml(html);
      const nextPromoCard = { ...config.promoCard, timerText: text };
      setConfig({
        ...config,
        promoCard: nextPromoCard,
      });
      // Self-heal: the fixed countdown is undeletable. If an edit removed it,
      // rebuild the editor immediately (serializeTimerHtml already re-injected
      // it into `text`) and drop the caret at the end so typing continues.
      if (!el.querySelector("[data-timer-fixed]")) {
        el.innerHTML = buildTimerDisplayHtml(
          text,
          calcTimerRemaining(config.promoCard.endDate || ""),
        );
        const r = document.createRange();
        r.selectNodeContents(el);
        r.collapse(false);
        const s = window.getSelection();
        s?.removeAllRanges();
        s?.addRange(r);
      }
      markChanged();
      refreshPromoToolbarFormats(el);
      return;
    }

    const refMap = {
      title: titleRef,
      subtitle: subtitleRef,
      description: descRef,
      button: buttonRef,
    };
    const fallbackEl = refMap[field].current;
    const el =
      currentField === field && activeEditorRef.current
        ? activeEditorRef.current
        : fallbackEl;
    if (!el) return;
    let html = wrapBareTextWithFontSize(el.innerHTML);
    if (!hasVisibleContent(html)) {
      html = "";
      if (el.innerHTML !== "") el.innerHTML = "";
    }

    // Block typing if overflow (skip when format handler will handle it)
    const overflowFields: PromoField[] = ['title', 'subtitle', 'description', 'button'];
    if (!skipOverflowBlockRef.current && overflowFields.includes(field) && html && measureOverflow(html, field as MeasuredField)) {
      const lastValid = lastValidHtmlRef.current[field] || '';
      el.innerHTML = lastValid;
      const sel = window.getSelection();
      if (sel && el.lastChild) {
        const range = document.createRange();
        range.selectNodeContents(el);
        range.collapse(false);
        sel.removeAllRanges();
        sel.addRange(range);
      }
      return;
    }
    if (!skipOverflowBlockRef.current && overflowFields.includes(field)) {
      lastValidHtmlRef.current[field] = html;
    }
    const fieldMap = {
      title: "title",
      subtitle: "subtitle",
      description: "description",
      button: "buttonText",
    } as const;
    const nextPromoCard = {
      ...config.promoCard,
      [fieldMap[field]]: html,
    };
    setConfig({
      ...config,
      promoCard: nextPromoCard,
    });
    lastSyncedPromoRef.current = JSON.stringify({
      t: nextPromoCard.title,
      s: nextPromoCard.subtitle,
      d: nextPromoCard.description,
      b: nextPromoCard.buttonText,
    });
    markChanged();
    refreshPromoToolbarFormats(el);

    // Update dynamic card width — across the text fields AND the timer.
    const newWidth = computeCardWidth(nextPromoCard);
    setCardWidth(newWidth);
    if (newWidth !== nextPromoCard.cardWidth) {
      setConfig({ ...config, promoCard: { ...nextPromoCard, cardWidth: newWidth } });
    }
  }

  function onPromoPreviewKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const mod = e.metaKey || e.ctrlKey;
    // Undo/redo are handled by the window-level listener above, for the whole
    // editor at once. Everything else typed on the card is blocked here.
    if (mod) return;
    e.preventDefault();
  }

  function onPromoEditorKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const mod = e.metaKey || e.ctrlKey;

    if (mod) return;

    const editor = e.currentTarget;
    const selection = window.getSelection();
    const hasSelectionInEditor = Boolean(
      selection &&
      !selection.isCollapsed &&
      selection.rangeCount > 0 &&
      editor.contains(selection.getRangeAt(0).commonAncestorContainer),
    );
    const isDestructiveKey = e.key === "Backspace" || e.key === "Delete";
    const overwritesSelection = hasSelectionInEditor && e.key.length === 1;

    if (hasSelectionInEditor && (isDestructiveKey || overwritesSelection)) {
      // Typing over a selection is a typing run, not a delete run — leave the
      // lock off so the rest of the word coalesces into this one step.
      promoDeletingRef.current = isDestructiveKey;
      pushPromoState({ replace: true });
      return;
    }

    const isTypingKey = e.key.length === 1 || e.key === "Enter";

    if (isDestructiveKey) {
      // One snapshot per delete run: hold the lock so a held-down Backspace
      // undoes as a single step instead of one step per character.
      if (!promoDeletingRef.current) {
        promoDeletingRef.current = true;
        pushPromoState({ replace: true });
      }
      return;
    }

    /**
     * Ordinary typing. Snapshot BEFORE the character lands, so undo restores
     * the text as it was; the stack's coalescing window collapses the rest of
     * the burst into this one step.
     *
     * Without this, typing left no trace on the stack at all — Ctrl+Z would
     * skip straight past everything the user had written to the last style or
     * date change.
     */
    if (!isTypingKey) return;

    if (promoDeletingRef.current) {
      // Typing after a delete run ends that run and opens its own step, so the
      // words survive one Ctrl+Z: delete "DROP", type "TODAY ONLY" → the first
      // undo brings back "TODAY ONLY"'s absence, the second brings back "DROP".
      // Without the force the coalescing window would fold the typing into the
      // delete and Ctrl+Z would swallow both at once.
      promoDeletingRef.current = false;
      pushPromoState({ replace: true });
      return;
    }

    pushPromoState();
  }

  function getActivePromoEditor(): HTMLDivElement | null {
    if (activeEditorRef.current) return activeEditorRef.current;
    return getFieldRef(currentFieldRef.current)?.current || null;
  }

  function refreshPromoToolbarFormats(editor = getActivePromoEditor()) {
    // Timer is now driven by the Lexical editor — read active formats from
    // its imperative API instead of walking the legacy DOM. This applies
    // whether the user is interacting with the panel or the preview side.
    if (currentField === "timer") {
      const fmts = lexicalTimerRef.current?.getActiveFormats();
      if (fmts) setActiveFormats(fmts);
      return;
    }
    if (!editor) return;
    if (selectionIsInsideEditor(editor)) {
      detectFormats();
      return;
    }
    detectPromoFormatsFromHTML(
      editor.innerHTML,
      getEditorFallbackColor(editor),
    );
  }

  function syncInactiveFieldEditor(field: PromoField, html: string) {
    const ref = getFieldRef(field);
    if (!ref?.current || ref.current === activeEditorRef.current) return;
    ref.current.innerHTML = html;
  }

  function applyPromoFormatToAll(editor: HTMLDivElement, action: () => void) {
    const hasContent = editor.textContent?.replace(/\u200B/g, "").trim();
    if (!hasContent) return;
    const wasFocused = document.activeElement === editor;
    editor.focus();
    const selection = window.getSelection();
    if (selection) {
      selection.removeAllRanges();
      const range = document.createRange();
      range.selectNodeContents(editor);
      selection.addRange(range);
      saveSelection();
    }
    action();
    onFieldInput(currentFieldRef.current as PromoField);
    window.getSelection()?.removeAllRanges();
    if (!wasFocused) editor.blur();
    detectPromoFormatsFromHTML(
      editor.innerHTML,
      getEditorFallbackColor(editor),
    );
  }

  // Show the transient style-warning toast (single owner of its lifecycle).
  /**
   * Would applying this format push the field past its line limit?
   *
   * Asked in both branches of the toolbar handler — once when there is a
   * selection inside the editor, once when the whole field is being formatted
   * — and the two copies were identical. Shows the warning itself, so the
   * caller only has to decide whether to stop.
   *
   * Measures against a mock-up of the result rather than applying the format
   * and undoing it, so the editor never flickers through a state the user
   * did not ask for.
   */
  function formatWouldOverflow(
    editor: HTMLElement,
    field: PromoField,
    format: string,
  ): boolean {
    const overflowFields: PromoField[] = ['title', 'subtitle', 'description', 'button'];
    if (!overflowFields.includes(field)) return false;

    const plainText = editor.textContent?.replace(/\u200B/g, '').trim() || '';
    const sizeMap: Record<string, string> = {
      xs: '0.75rem', sm: '0.875rem', md: '1rem',
      lg: '1.125rem', xl: '1.25rem', xxl: '1.5rem',
    };
    let testHtml = '';
    if (format.startsWith('size-')) {
      const size = format.replace('size-', '');
      testHtml = `<span style="font-size:${sizeMap[size] || '1rem'}">${plainText}</span>`;
    } else if (format === 'bold') {
      testHtml = `<b>${wrapBareTextWithFontSize(editor.innerHTML)}</b>`;
    } else if (format === 'italic') {
      testHtml = `<i>${wrapBareTextWithFontSize(editor.innerHTML)}</i>`;
    }

    if (testHtml && measureOverflow(testHtml, field as 'title' | 'subtitle' | 'description')) {
      showStyleWarning('This style exceeds the field limit — try a smaller size or shorter text');
      return true;
    }
    return false;
  }

  // Fires when the editor reverted an edit for exceeding one line. Shows the
  // shared "field limit reached" warning AND re-syncs the toolbar to the
  // actual (reverted) state — otherwise a rejected size/style (e.g. clicking
  // XL when only LG fits) would stay highlighted even though it didn't apply.
  function warnTimerLimit() {
    showStyleWarning(
      "This text exceeds the field limit — shorten it to fit one line",
    );
    // The plugin has already reverted the editor state by now; reflect it.
    const fmts = lexicalTimerRef.current?.getActiveFormats();
    if (fmts) setActiveFormats(fmts);
  }

  function handlePromoToolbarFormat(format: string) {
    if (!currentFieldRef.current) return;
    // Timer is driven by the Lexical editor (no DOM editor element), so handle
    // it BEFORE the getActivePromoEditor()/null guard — otherwise it returns
    // early (there's no contenteditable div for the timer) and nothing applies.
    if (currentFieldRef.current === "timer") {
      // Recorded like every other style change. This branch returned before
      // reaching the push below, so styling the countdown left no step on the
      // stack and Ctrl+Z jumped past it to whatever came before the timer.
      pushPromoState();
      const fmts = lexicalTimerRef.current?.applyFormat(format);
      if (fmts) setActiveFormats(fmts);
      return;
    }
    const editor = getActivePromoEditor();
    if (!editor) return;
    pushPromoState();
    const field = currentFieldRef.current;
    const overflowFields: PromoField[] = ['title', 'subtitle', 'description'];
    const syncLastValid = () => {
      if (overflowFields.includes(field) && editor) {
        const newHtml = wrapBareTextWithFontSize(editor.innerHTML);
        if (measureOverflow(newHtml, field as 'title' | 'subtitle' | 'description')) {
          const lastValid = lastValidHtmlRef.current[field] || '';
          editor.innerHTML = lastValid;
          skipOverflowBlockRef.current = true;
          onFieldInput(field);
          skipOverflowBlockRef.current = false;
          showStyleWarning('This style exceeds the field limit — try a smaller size or shorter text');
          return;
        }
        lastValidHtmlRef.current[field] = newHtml;
      }
    };
    if (selectionIsInsideEditor(editor)) {
      // Pre-check: would this format cause overflow?
      if (formatWouldOverflow(editor, field, format)) return;
      saveSelection();
      formatText(format);
      skipOverflowBlockRef.current = true;
      onFieldInput(currentFieldRef.current);
      skipOverflowBlockRef.current = false;
      syncInactiveFieldEditor(
        currentFieldRef.current,
        wrapBareTextWithFontSize(editor.innerHTML),
      );
      syncLastValid();
      setTimeout(() => refreshPromoToolbarFormats(editor), 0);
      return;
    }

    const hasContent = editor.textContent?.replace(/\u200B/g, "").trim();
    if (hasContent) {
      // Pre-check: would this format cause overflow?
      if (formatWouldOverflow(editor, field, format)) return;
      if (format === "bold" || format === "italic") {
        const shouldEnable =
          format === "bold" ? !activeFormats.bold : !activeFormats.italic;
        applyPromoFormatToAll(editor, () =>
          applyWholeEditorStyleToggle(editor, format, shouldEnable),
        );
      } else {
        applyPromoFormatToAll(editor, () => formatText(format));
      }
      syncInactiveFieldEditor(
        currentFieldRef.current,
        wrapBareTextWithFontSize(editor.innerHTML),
      );
      syncLastValid();
      return;
    }

    if (format.startsWith("size-")) {
      setActiveFormats((prev) => ({
        ...prev,
        size: format.replace("size-", ""),
      }));
    } else if (format === "bold") {
      setActiveFormats((prev) => ({ ...prev, bold: !prev.bold }));
    } else if (format === "italic") {
      setActiveFormats((prev) => ({ ...prev, italic: !prev.italic }));
    }
  }

  function handlePromoToolbarColor(color: string) {
    if (!currentFieldRef.current) return;
    // Timer: handle BEFORE the getActivePromoEditor()/null guard (no DOM
    // editor element for the timer). Route through the Lexical imperative API;
    // scope (cell / whole chip / text selection) is decided inside.
    if (currentFieldRef.current === "timer") {
      // Same as the format branch above: this returned before the push.
      pushPromoState();
      const fmts = lexicalTimerRef.current?.applyColor(color);
      if (fmts) setActiveFormats(fmts);
      return;
    }
    const editor = getActivePromoEditor();
    if (!editor) return;
    pushPromoState();
    if (selectionIsInsideEditor(editor)) {
      saveSelection();
      applyColor(color);
      onFieldInput(currentFieldRef.current);
      syncInactiveFieldEditor(
        currentFieldRef.current,
        wrapBareTextWithFontSize(editor.innerHTML),
      );
      setTimeout(() => refreshPromoToolbarFormats(editor), 0);
      return;
    }

    const hasContent = editor.textContent?.replace(/\u200B/g, "").trim();
    if (hasContent) {
      applyPromoFormatToAll(editor, () => applyColor(color));
      syncInactiveFieldEditor(
        currentFieldRef.current,
        wrapBareTextWithFontSize(editor.innerHTML),
      );
    }
    setActiveFormats((prev) => ({ ...prev, color }));
  }

  return {
    handlePromoToolbarFormat,
    handlePromoToolbarColor,
    detectPromoFormatsFromHTML,
    applyPromoFormatToAll,
    applyWholeEditorStyleToggle,
    smartPaste,
    onFieldInput,
    onFieldFocus,
    refreshPromoToolbarFormats,
    syncInactiveFieldEditor,
    syncEditorsFromConfig,
    getActivePromoEditor,
    formatWouldOverflow,
    onPromoEditorKeyDown,
    onPromoPreviewKeyDown,
    warnTimerLimit,
  };
}
