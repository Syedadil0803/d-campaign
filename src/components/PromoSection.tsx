"use client";

import {
  useState,
  useEffect,
  useRef,
  useCallback,
  type RefObject,
  type Dispatch,
  type SetStateAction,
  type KeyboardEvent,
} from "react";
import {
  Gift,
  X,
  Palette,
  Undo2,
  Redo2,
  RotateCcw,
  LayoutTemplate,
  History,
  FilePlus2,
  Sparkles,
} from "lucide-react";
import { CampaignConfig, PromoCard, defaultConfig } from "@/types/campaign";
import { getBackgroundStyle, stripHtml } from "@/lib/utils";
import { HistoryManager } from "@/lib/historyManager";
import { SamplePromoTemplates } from "./SamplePromoTemplates";
import { useRichTextEditor } from "@/hooks/useRichTextEditor";
import {
  wrapBareTextWithFontSize,
  rgbToHex,
  FONT_SIZE_LABEL_MAP,
} from "@/lib/richTextUtils";
import RichTextToolbar from "./RichTextToolbar";
import { PopupDropdown } from "./PopupDropdown";
import { PromoMiniPreview } from "./PromoMiniPreview";
import {
  listVersions,
  deleteVersion,
  MAX_VERSIONS,
  type PromoVersion,
} from "@/lib/promoVersions";
import {
  getDefaultTimerStorageHTML,
  normalizeTimerTemplate,
  formatTimerText,
  calculateTimeRemaining as calcTimerRemaining,
} from "@/lib/timerUtils";

interface PromoSectionProps {
  config: CampaignConfig;
  setConfig: (config: CampaignConfig) => void;
  markChanged: () => void;
  toast: (message: string, isError?: boolean) => void;
  onSelectedVersionChange?: (versionId: string | null) => void;
}

type PromoField = "title" | "subtitle" | "description" | "timer" | "button";
const PROMO_EDITOR_DEFAULT_COLOR = "#ffffff";

interface PromoSnapshot {
  promoCard: PromoCard;
  currentField: PromoField | null;
  selection: PromoSelectionSnapshot | null;
}

interface PromoSelectionSnapshot {
  start: number;
  end: number;
}

interface PromoAppliedRedoSnapshot {
  snapshot: PromoSnapshot;
  baseline: PromoSnapshot | null;
}

export function PromoSection({
  config,
  setConfig,
  markChanged,
  toast,
  onSelectedVersionChange,
}: PromoSectionProps) {
  const getISODateWithOffset = useCallback((daysFromToday = 0): string => {
    const date = new Date();
    date.setDate(date.getDate() + daysFromToday);
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }, []);
  const [currentTime, setCurrentTime] = useState(Date.now());
  const [currentField, setCurrentField] = useState<PromoField | null>(null);
  const configRef = useRef(config);
  configRef.current = config;
  const currentFieldRef = useRef<PromoField | null>(currentField);
  currentFieldRef.current = currentField;

  // Refs for each contenteditable editor
  const titleRef = useRef<HTMLDivElement>(null);
  const subtitleRef = useRef<HTMLDivElement>(null);
  const descRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<HTMLDivElement>(null);
  const previewTitleRef = useRef<HTMLDivElement>(null);
  const previewSubtitleRef = useRef<HTMLDivElement>(null);
  const previewDescriptionRef = useRef<HTMLDivElement>(null);
  const previewButtonRef = useRef<HTMLDivElement>(null);
  const previewTimerRef = useRef<HTMLDivElement>(null);
  const activeEditorRef = useRef<HTMLDivElement>(null);
  const cardPositionBtnRef = useRef<HTMLButtonElement>(null);
  const cardPositionMenuRef = useRef<HTMLDivElement>(null);
  const cardBgTypeBtnRef = useRef<HTMLButtonElement>(null);
  const cardBgTypeMenuRef = useRef<HTMLDivElement>(null);
  const fieldBgTypeBtnRef = useRef<HTMLButtonElement>(null);
  const fieldBgTypeMenuRef = useRef<HTMLDivElement>(null);
  const cardBgPopupBtnRef = useRef<HTMLButtonElement>(null);
  const cardBgPopupRef = useRef<HTMLDivElement>(null);
  const promoCardRef = useRef<HTMLDivElement>(null);

  const cardAngleWheelRef = useRef<HTMLDivElement>(null);
  const fieldAngleWheelRef = useRef<HTMLDivElement>(null);
  const startDatePickerRef = useRef<HTMLDivElement>(null);
  const endDatePickerRef = useRef<HTMLDivElement>(null);

  const [showCardPositionDropdown, setShowCardPositionDropdown] =
    useState(false);
  const [showCardBgTypeDropdown, setShowCardBgTypeDropdown] = useState(false);
  const [showFieldBgTypeDropdown, setShowFieldBgTypeDropdown] = useState(false);
  const [showCardBgPopup, setShowCardBgPopup] = useState(false);
  const [showPersistentScaffold, setShowPersistentScaffold] = useState(false);
  // Action popups launched from the buttons under the Promo Card heading.
  const [showTemplatesPopup, setShowTemplatesPopup] = useState(false);
  const [showVersionsPopup, setShowVersionsPopup] = useState(false);

  // Saved promo-card versions (local-only for now; see lib/promoVersions).
  const [versions, setVersions] = useState<PromoVersion[]>([]);

  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(
    null,
  );

  // Id of the variant awaiting delete confirmation (null = none).
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  const [startDateView, setStartDateView] = useState<Date>(() => {
    const base = config.promoCard.startDate
      ? new Date(`${config.promoCard.startDate}T00:00:00`)
      : new Date();
    return new Date(base.getFullYear(), base.getMonth(), 1);
  });
  const [endDateView, setEndDateView] = useState<Date>(() => {
    const base = config.promoCard.endDate
      ? new Date(`${config.promoCard.endDate}T00:00:00`)
      : new Date();
    return new Date(base.getFullYear(), base.getMonth(), 1);
  });

  const [cardPositionPos, setCardPositionPos] = useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);
  const [cardBgTypePos, setCardBgTypePos] = useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);
  const [fieldBgTypePos, setFieldBgTypePos] = useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);

  // Single hook instance — activeEditorRef is swapped on focus
  const {
    activeFormats,
    setActiveFormats,
    formatText,
    applyColor,
    detectFormats,
    ensureDefaultFontSize,
    saveSelection,
    getNormalizedHTML,
  } = useRichTextEditor(activeEditorRef, {
    defaultColor: PROMO_EDITOR_DEFAULT_COLOR,
  });

  const promoHistory = useRef(
    new HistoryManager<PromoSnapshot>("Promo"),
  ).current;
  const restoringSnapshotRef = useRef(false);
  const promoDeletingRef = useRef(false);
  const promoAppliedCardBaselineRef = useRef<PromoSnapshot | null>(null);
  const promoPreAppliedCardRef = useRef<PromoSnapshot | null>(null);
  const promoAppliedRedoRef = useRef<PromoAppliedRedoSnapshot | null>(null);
  // True while the current card is a Start-Fresh card. Leaving a fresh card,
  // undo should land on its EDITED state; leaving a template/variant, undo
  // should land on that card's CLEAN baseline (not the edited state).
  const isFreshCardRef = useRef(false);
  const [canUndoPromo, setCanUndoPromo] = useState(false);
  const [canRedoPromo, setCanRedoPromo] = useState(false);
  const [canResetPromoEdits, setCanResetPromoEdits] = useState(false);

  function clonePromoCard(card: PromoCard): PromoCard {
    return JSON.parse(JSON.stringify(card)) as PromoCard;
  }

  function promoCardsEqual(a: PromoCard, b: PromoCard): boolean {
    return JSON.stringify(a) === JSON.stringify(b);
  }

  function syncPromoHistoryButtons() {
    setCanUndoPromo(promoHistory.canUndo() || Boolean(promoPreAppliedCardRef.current));
    setCanRedoPromo(promoHistory.canRedo() || Boolean(promoAppliedRedoRef.current));
  }

  function syncResetPromoEditsButton(nextPromoCard = configRef.current.promoCard) {
    const baseline = promoAppliedCardBaselineRef.current?.promoCard;
    setCanResetPromoEdits(
      Boolean(baseline && !promoCardsEqual(nextPromoCard, baseline)),
    );
  }

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
      if (currentField === "timer") promoCard.timerText = normalizeTimerTemplate(html);
    }
    return {
      promoCard,
      currentField,
      selection: editor ? getPromoSelectionSnapshot(editor) : null,
    };
  }

  function pushPromoState(options: { replace?: boolean } = {}) {
    if (restoringSnapshotRef.current) return;
    if (promoAppliedCardBaselineRef.current) {
      syncPromoHistoryButtons();
      return;
    }
    promoAppliedRedoRef.current = null;
    const replaceLockedSnapshot = options.replace;
    if (replaceLockedSnapshot) promoHistory.unlock();
    promoHistory.pushState(getPromoSnapshot());
    syncPromoHistoryButtons();
  }

  function getFieldRef(field: PromoField | null) {
    if (field === "title") return titleRef;
    if (field === "subtitle") return subtitleRef;
    if (field === "description") return descRef;
    if (field === "timer") return timerRef;
    if (field === "button") return buttonRef;
    return null;
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
    syncResetPromoEditsButton(nextPromoCard);
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

  function undoPromo() {
    const snapshot = promoHistory.undo(getPromoSnapshot());
    if (snapshot) {
      applyPromoSnapshot(snapshot);
      toast("Promo action undone");
      syncPromoHistoryButtons();
      return;
    }

    const preAppliedSnapshot = promoPreAppliedCardRef.current;
    if (preAppliedSnapshot) {
      const currentSnapshot = getPromoSnapshot();
      promoAppliedRedoRef.current = {
        snapshot: currentSnapshot,
        baseline: promoAppliedCardBaselineRef.current
          ? {
              ...promoAppliedCardBaselineRef.current,
              promoCard: clonePromoCard(promoAppliedCardBaselineRef.current.promoCard),
            }
          : null,
      };
      promoPreAppliedCardRef.current = null;
      if (promoAppliedCardBaselineRef.current) {
        promoAppliedCardBaselineRef.current = null;
        setCanResetPromoEdits(false);
      }
      applyPromoSnapshot(preAppliedSnapshot);
      toast("Promo action undone");
    }
    syncPromoHistoryButtons();
  }

  function redoPromo() {
    const snapshot = promoHistory.redo(getPromoSnapshot());
    if (snapshot) {
      applyPromoSnapshot(snapshot);
      toast("Promo action redone");
      syncPromoHistoryButtons();
      return;
    }

    const appliedRedo = promoAppliedRedoRef.current;
    if (appliedRedo) {
      promoAppliedRedoRef.current = null;
      promoPreAppliedCardRef.current = getPromoSnapshot();
      promoAppliedCardBaselineRef.current = appliedRedo.baseline;
      applyPromoSnapshot(appliedRedo.snapshot);
      syncResetPromoEditsButton(appliedRedo.snapshot.promoCard);
      toast("Promo action redone");
    }
    syncPromoHistoryButtons();
  }

  function resetPromoEdits() {
    const snapshot = promoAppliedCardBaselineRef.current;
    if (!snapshot) return;
    promoHistory.clear();
    syncPromoHistoryButtons();
    applyPromoSnapshot(snapshot);
    setCanResetPromoEdits(false);
    toast("Promo edits reset");
  }

  function setPromoAppliedCardBaseline(promoCard: PromoCard, previousSnapshot: PromoSnapshot) {
    promoAppliedCardBaselineRef.current = {
      promoCard: clonePromoCard(promoCard),
      currentField: currentFieldRef.current,
      selection: null,
    };
    promoPreAppliedCardRef.current = previousSnapshot;
    setCanResetPromoEdits(false);
    syncPromoHistoryButtons();
  }

  // Fill default start/end dates if missing. Must be applied BEFORE a card's
  // baseline is captured — otherwise the date-defaulting effect mutates the
  // card after the baseline, making it look "edited" and wrongly enabling Reset.
  function withDefaultDates(card: PromoCard): PromoCard {
    if (card.startDate && card.endDate) return card;
    return {
      ...card,
      startDate: card.startDate || getISODateWithOffset(0),
      endDate: card.endDate || getISODateWithOffset(1),
    };
  }

  function getFreshPromoCard(): PromoCard {
    const baseStyle = clonePromoCard(defaultConfig.promoCard).style;
    return {
      ...clonePromoCard(defaultConfig.promoCard),
      active: true,
      title: "",
      subtitle: "",
      description: "",
      buttonText: "",
      buttonUrl: "",
      showTimer: false,
      showButton: false,
      timerText: "Ends in {hh}:{mm}:{ss}",
      style: {
        ...baseStyle,
        background: {
          type: "linear",
          startColor: "#2c8da0",
          endColor: "#4d9a52",
          direction: "to right",
          midpoint: 50,
        },
        textColor: "#ffffff",
        titleStyle: {
          ...baseStyle.titleStyle,
          background: {
            type: "solid",
            startColor: "#1f7a8c",
            endColor: "#1f7a8c",
            midpoint: 50,
          },
          textColor: "#ffffff",
        },
        subheadingStyle: {
          ...baseStyle.subheadingStyle,
          background: {
            type: "solid",
            startColor: "#2c8da0",
            endColor: "#2c8da0",
            midpoint: 50,
          },
          textColor: "#ffffff",
        },
        descriptionStyle: {
          ...baseStyle.descriptionStyle,
          background: {
            type: "solid",
            startColor: "#4d9a52",
            endColor: "#4d9a52",
            midpoint: 50,
          },
          textColor: "#ffffff",
        },
        dateStyle: {
          ...baseStyle.dateStyle,
          background: {
            type: "solid",
            startColor: "#aed136",
            endColor: "#aed136",
            midpoint: 50,
          },
          textColor: "#1f2937",
        },
        buttonStyle: {
          ...baseStyle.buttonStyle,
          background: {
            type: "solid",
            startColor: "#3f8f47",
            endColor: "#3f8f47",
            midpoint: 50,
          },
          textColor: "#ffffff",
        },
      },
    };
  }

  function startFreshPromoCard() {
    const previousSnapshot = getPromoSnapshot();
    const freshCard = withDefaultDates(getFreshPromoCard());
    // Mark as a fresh card: leaving it later, undo should land on its edited state.
    isFreshCardRef.current = true;
    promoAppliedRedoRef.current = null;
    promoHistory.clear();
    setConfig({ ...configRef.current, promoCard: freshCard });
    syncEditorsFromConfig(freshCard);
    setCurrentField(null);
    currentFieldRef.current = null;
    activeEditorRef.current = null;
    setShowPersistentScaffold(true);
    setSelectedVersionId(null);
    onSelectedVersionChange?.(null);
    setPromoAppliedCardBaseline(freshCard, previousSnapshot);
    setCanResetPromoEdits(false);
    markChanged();
    toast("Fresh promo card started");
  }

  useEffect(() => {
    syncResetPromoEditsButton(config.promoCard);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.promoCard]);

  // Populate editors from config on mount
  useEffect(() => {
    if (titleRef.current)
      titleRef.current.innerHTML = config.promoCard.title || "";
    if (subtitleRef.current)
      subtitleRef.current.innerHTML = config.promoCard.subtitle || "";
    if (descRef.current)
      descRef.current.innerHTML = config.promoCard.description || "";
    if (buttonRef.current)
      buttonRef.current.innerHTML = config.promoCard.buttonText || "";
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep preview subtitle DOM in sync without re-rendering innerHTML every state change,
  // so text selection in preview is not reset.
  useEffect(() => {
    const el = previewTitleRef.current;
    if (!el) return;
    const nextHtml = config.promoCard.title || "";
    if (el.innerHTML !== nextHtml) {
      el.innerHTML = nextHtml;
    }
  }, [config.promoCard.title]);

  useEffect(() => {
    const el = previewSubtitleRef.current;
    if (!el) return;
    const nextHtml = config.promoCard.subtitle || "";
    if (el.innerHTML !== nextHtml) {
      el.innerHTML = nextHtml;
    }
  }, [config.promoCard.subtitle]);

  useEffect(() => {
    const el = previewDescriptionRef.current;
    if (!el) return;
    const nextHtml = config.promoCard.description || "";
    if (el.innerHTML !== nextHtml) {
      el.innerHTML = nextHtml;
    }
  }, [config.promoCard.description]);

  useEffect(() => {
    const el = previewButtonRef.current;
    if (!el) return;
    const nextHtml = config.promoCard.buttonText || "";
    if (el.innerHTML !== nextHtml) {
      el.innerHTML = nextHtml;
    }
  }, [config.promoCard.buttonText]);

  useEffect(() => {
    const el = previewTimerRef.current;
    if (!el) return;
    const nextHtml = getFormattedTimerText();
    if (el.innerHTML !== nextHtml) {
      el.innerHTML = nextHtml;
    }
  }, [config.promoCard.timerText, config.promoCard.endDate, currentTime]);

  useEffect(() => {
    const el = timerRef.current;
    if (!el) return;
    const nextHtml = normalizeTimerTemplate(
      config.promoCard.timerText ?? getDefaultTimerStorageHTML(),
    );
    if (el.innerHTML !== nextHtml) {
      el.innerHTML = nextHtml;
    }
  }, [config.promoCard.timerText, config.promoCard.showTimer]);

  useEffect(() => {
    // Keep the field scaffold visible whenever the card is active so the
    // preview shows the placeholder structure (title/subtitle/.../button)
    // instead of rendering as a bare empty white box. Turns off when inactive.
    setShowPersistentScaffold(config.promoCard.active);
  }, [config.promoCard.active]);

  useEffect(() => {
    const nextStart = config.promoCard.startDate || getISODateWithOffset(0);
    const nextEnd = config.promoCard.endDate || getISODateWithOffset(1);
    if (config.promoCard.startDate && config.promoCard.endDate) return;
    setConfig({
      ...config,
      promoCard: {
        ...config.promoCard,
        startDate: nextStart,
        endDate: nextEnd,
      },
    });
  }, [config, setConfig, getISODateWithOffset]);

  function syncEditorsFromConfig(pc: PromoCard) {
    setTimeout(() => {
      if (titleRef.current) titleRef.current.innerHTML = pc.title || "";
      if (subtitleRef.current)
        subtitleRef.current.innerHTML = pc.subtitle || "";
      if (descRef.current) descRef.current.innerHTML = pc.description || "";
      if (buttonRef.current) buttonRef.current.innerHTML = pc.buttonText || "";
      if (timerRef.current) {
        timerRef.current.innerHTML = normalizeTimerTemplate(
          pc.timerText ?? getDefaultTimerStorageHTML(),
        );
      }
    }, 0);
  }

  function onFieldFocus(
    field: PromoField,
    ref: RefObject<HTMLDivElement | null>,
  ) {
    setShowPersistentScaffold(true);
    setCurrentField(field);
    activeEditorRef.current = ref.current;
    promoDeletingRef.current = false;
    setTimeout(() => {
      refreshPromoToolbarFormats(ref.current);
      ensureDefaultFontSize();
    }, 0);
  }

  function openFieldStylePopup(
    field: PromoField,
    ref: RefObject<HTMLDivElement | null>,
  ) {
    const nextEditor = ref.current;
    const prevEditor = activeEditorRef.current;
    if (prevEditor && prevEditor !== nextEditor) {
      prevEditor.blur();
    }
    setShowPersistentScaffold(true);
    setShowCardBgPopup(false);
    setCurrentField(field);
    activeEditorRef.current = nextEditor;
    promoDeletingRef.current = false;
    setTimeout(() => {
      nextEditor?.focus();
      refreshPromoToolbarFormats(ref.current);
      ensureDefaultFontSize();
    }, 0);
  }

  function onFieldInput(field: PromoField) {
    if (restoringSnapshotRef.current) return;
    if (field === "timer") {
      const fallbackEl = timerRef.current;
      const el =
        currentField === "timer" && activeEditorRef.current
          ? activeEditorRef.current
          : fallbackEl;
      if (!el) return;
      const html = wrapBareTextWithFontSize(el.innerHTML);
      const text = normalizeTimerTemplate(html);
      const nextPromoCard = { ...config.promoCard, timerText: text };
      setConfig({
        ...config,
        promoCard: nextPromoCard,
      });
      syncResetPromoEditsButton(nextPromoCard);
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
    const html = wrapBareTextWithFontSize(el.innerHTML);
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
    syncResetPromoEditsButton(nextPromoCard);
    markChanged();
    refreshPromoToolbarFormats(el);
  }

  function onPromoPreviewKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const mod = e.metaKey || e.ctrlKey;
    const key = e.key.toLowerCase();
    if (mod && (key === "z" || key === "y")) {
      onPromoEditorKeyDown(e);
      return;
    }
    e.preventDefault();
  }

  function onPromoEditorKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const mod = e.metaKey || e.ctrlKey;
    const key = e.key.toLowerCase();

    if (mod && (key === "z" || key === "y")) {
      e.preventDefault();
      const isUndo = key === "z" && !e.shiftKey;
      const isRedo = (key === "z" && e.shiftKey) || key === "y";
      if (isUndo) undoPromo();
      if (isRedo) redoPromo();
      promoDeletingRef.current = false;
      return;
    }

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
      promoDeletingRef.current = true;
      pushPromoState({ replace: true });
      return;
    }

    if (isDestructiveKey && !promoDeletingRef.current) {
      promoDeletingRef.current = true;
      // Start of a new delete session: unlock any stale lock (e.g. from an
      // earlier style/format change) so we capture a fresh pre-delete snapshot,
      // matching the select+delete path. The promoDeletingRef guard keeps the
      // whole session collapsed into a single undo step.
      pushPromoState({ replace: true });
      return;
    }

    // Keep a delete/replace text session grouped across follow-up typing.
    // Example: delete "DROP", type "TODAY ONLY", delete "ONLY" should undo
    // to the original text with "DROP", not just restore "ONLY".
  }

  function getActivePromoEditor(): HTMLDivElement | null {
    if (activeEditorRef.current) return activeEditorRef.current;
    return getFieldRef(currentFieldRef.current)?.current || null;
  }

  function selectionIsInsideEditor(editor: HTMLDivElement): boolean {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed)
      return false;
    const range = selection.getRangeAt(0);
    return (
      editor.contains(range.commonAncestorContainer) ||
      editor.contains(selection.anchorNode)
    );
  }

  function getPromoSelectionSnapshot(
    editor: HTMLDivElement,
  ): PromoSelectionSnapshot | null {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return null;
    const range = selection.getRangeAt(0);
    if (
      !editor.contains(range.commonAncestorContainer) &&
      !editor.contains(selection.anchorNode)
    )
      return null;

    const preStartRange = document.createRange();
    preStartRange.selectNodeContents(editor);
    preStartRange.setEnd(range.startContainer, range.startOffset);

    const preEndRange = document.createRange();
    preEndRange.selectNodeContents(editor);
    preEndRange.setEnd(range.endContainer, range.endOffset);

    return {
      start: preStartRange.toString().length,
      end: preEndRange.toString().length,
    };
  }

  function restorePromoSelection(
    editor: HTMLDivElement,
    selectionSnapshot: PromoSelectionSnapshot | null,
  ) {
    if (!selectionSnapshot || typeof window === "undefined") return;
    const textLength = editor.textContent?.length || 0;
    const start = Math.max(0, Math.min(selectionSnapshot.start, textLength));
    const end = Math.max(start, Math.min(selectionSnapshot.end, textLength));
    const range = document.createRange();
    const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT);
    let currentOffset = 0;
    let startSet = false;
    let endSet = false;
    let node = walker.nextNode();

    while (node) {
      const nodeLength = node.textContent?.length || 0;
      const nextOffset = currentOffset + nodeLength;

      if (!startSet && start <= nextOffset) {
        range.setStart(node, Math.max(0, start - currentOffset));
        startSet = true;
      }
      if (!endSet && end <= nextOffset) {
        range.setEnd(node, Math.max(0, end - currentOffset));
        endSet = true;
        break;
      }

      currentOffset = nextOffset;
      node = walker.nextNode();
    }

    if (!startSet) {
      range.selectNodeContents(editor);
      range.collapse(false);
    } else if (!endSet) {
      range.setEnd(range.startContainer, range.startOffset);
    }

    editor.focus();
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
  }

  function refreshPromoToolbarFormats(editor = getActivePromoEditor()) {
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

  function getEditorFallbackColor(editor: HTMLDivElement): string {
    if (typeof window === "undefined") return PROMO_EDITOR_DEFAULT_COLOR;
    const color = window.getComputedStyle(editor).color;
    return color.startsWith("rgb")
      ? rgbToHex(color)
      : color || PROMO_EDITOR_DEFAULT_COLOR;
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
          const label = FONT_SIZE_LABEL_MAP[node.style.fontSize];
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

  function unwrapInlineTags(
    editor: HTMLDivElement,
    selector: "b,strong" | "i,em",
  ) {
    const nodes = Array.from(editor.querySelectorAll(selector));
    nodes.forEach((node) => {
      const parent = node.parentNode;
      if (!parent) return;
      while (node.firstChild) {
        parent.insertBefore(node.firstChild, node);
      }
      parent.removeChild(node);
    });
  }

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

  function handlePromoToolbarFormat(format: string) {
    if (!currentFieldRef.current) return;
    const editor = getActivePromoEditor();
    if (!editor) return;
    pushPromoState();
    if (selectionIsInsideEditor(editor)) {
      saveSelection();
      formatText(format);
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

  // Style key map for field → config path
  const STYLE_KEY_MAP = {
    title: "titleStyle",
    subtitle: "subheadingStyle",
    description: "descriptionStyle",
    button: "buttonStyle",
  } as const;

  // Get current field's style object
  function getFieldStyle() {
    if (!currentField) return null;
    if (currentField === "timer") {
      // Timer uses dateStyle
      return config.promoCard.style.dateStyle;
    }
    const key = STYLE_KEY_MAP[currentField];
    return config.promoCard.style[key];
  }

  // Update a property on current field's style
  function updateFieldStyle(patch: Record<string, any>) {
    if (!currentField) return;
    pushPromoState();

    if (currentField === "timer") {
      // Timer uses dateStyle
      setConfig({
        ...config,
        promoCard: {
          ...config.promoCard,
          style: {
            ...config.promoCard.style,
            dateStyle: { ...config.promoCard.style.dateStyle, ...patch },
          },
        },
      });
    } else {
      const key = STYLE_KEY_MAP[currentField];
      setConfig({
        ...config,
        promoCard: {
          ...config.promoCard,
          style: {
            ...config.promoCard.style,
            [key]: { ...config.promoCard.style[key], ...patch },
          },
        },
      });
    }
    markChanged();
  }

  // Update a property on the current field's background
  function updateFieldBg(patch: Record<string, any>) {
    if (!currentField) return;
    pushPromoState();

    if (currentField === "timer") {
      // Timer uses dateStyle
      const style = config.promoCard.style.dateStyle;
      setConfig({
        ...config,
        promoCard: {
          ...config.promoCard,
          style: {
            ...config.promoCard.style,
            dateStyle: {
              ...style,
              background: { ...style.background, ...patch },
            },
          },
        },
      });
    } else {
      const key = STYLE_KEY_MAP[currentField];
      const style = config.promoCard.style[key];
      setConfig({
        ...config,
        promoCard: {
          ...config.promoCard,
          style: {
            ...config.promoCard.style,
            [key]: { ...style, background: { ...style.background, ...patch } },
          },
        },
      });
    }
    markChanged();
  }

  // Alignment helper
  function setFieldAlignment(align: "left" | "center" | "right") {
    updateFieldStyle({ textAlign: align });
  }

  // Direct style update for a specific style key (used by timer controls)
  function updateFieldStyleDirect(
    styleKey: string,
    patch: Record<string, any>,
  ) {
    pushPromoState();
    setConfig({
      ...config,
      promoCard: {
        ...config.promoCard,
        style: {
          ...config.promoCard.style,
          [styleKey]: {
            ...(config.promoCard.style as any)[styleKey],
            ...patch,
          },
        },
      },
    });
    markChanged();
  }

  // Card-level background update
  function updateCardBg(patch: Record<string, any>) {
    pushPromoState();
    setConfig({
      ...config,
      promoCard: {
        ...config.promoCard,
        style: {
          ...config.promoCard.style,
          background: { ...config.promoCard.style.background, ...patch },
        },
      },
    });
    markChanged();
  }

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const getDropdownPosition = useCallback(
    (button: HTMLButtonElement | null) => {
      if (!button) return null;
      const rect = button.getBoundingClientRect();
      return { top: rect.bottom + 6, left: rect.left, width: rect.width };
    },
    [],
  );

  useEffect(() => {
    const onDocMouseDown = (e: MouseEvent) => {
      const target = e.target as Node;
      const pairs: Array<
        [
          RefObject<HTMLButtonElement | null>,
          RefObject<HTMLDivElement | null>,
          Dispatch<SetStateAction<boolean>>,
        ]
      > = [
        [cardPositionBtnRef, cardPositionMenuRef, setShowCardPositionDropdown],
        [cardBgTypeBtnRef, cardBgTypeMenuRef, setShowCardBgTypeDropdown],
        [fieldBgTypeBtnRef, fieldBgTypeMenuRef, setShowFieldBgTypeDropdown],
      ];
      pairs.forEach(([btnRef, menuRef, setOpen]) => {
        if (
          btnRef.current?.contains(target) ||
          menuRef.current?.contains(target)
        )
          return;
        setOpen(false);
      });
      if (!startDatePickerRef.current?.contains(target))
        setShowStartDatePicker(false);
      if (!endDatePickerRef.current?.contains(target))
        setShowEndDatePicker(false);
      // Keep card background popup open until explicit close (X button).
    };
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, []);

  const closeAllPromoDropdowns = useCallback(() => {
    setShowCardPositionDropdown(false);
    setShowCardBgTypeDropdown(false);
    setShowFieldBgTypeDropdown(false);
    setShowCardBgPopup(false);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: globalThis.KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;

      const key = e.key.toLowerCase();
      const isUndo = key === "z" && !e.shiftKey;
      const isRedo = (key === "z" && e.shiftKey) || key === "y";
      if (!isUndo && !isRedo) return;

      const target = e.target as HTMLElement | null;
      if (target?.isContentEditable) return;

      e.preventDefault();
      if (isUndo) undoPromo();
      if (isRedo) redoPromo();
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  });

  function toggleActive() {
    pushPromoState();
    const nextPromoCard = {
      ...config.promoCard,
      active: !config.promoCard.active,
    };
    setConfig({
      ...config,
      promoCard: nextPromoCard,
    });
    syncResetPromoEditsButton(nextPromoCard);
    markChanged();
  }

  function openChatGptWithPromoPrompt() {
    const title = stripHtml(config.promoCard.title || "").trim();
    const subtitle = stripHtml(config.promoCard.subtitle || "").trim();
    const description = stripHtml(config.promoCard.description || "").trim();
    const buttonText = stripHtml(config.promoCard.buttonText || "").trim();
    const timerText = stripHtml(config.promoCard.timerText || "").trim();

    const existingCopy = [
      title && `Title: ${title}`,
      subtitle && `Subtitle: ${subtitle}`,
      description && `Description: ${description}`,
      buttonText && `Button: ${buttonText}`,
      timerText && `Timer: ${timerText}`,
    ].filter(Boolean);

    const prompt = [
      "Write 3 polished promo card variants for a website floating offer widget.",
      "Keep each variant concise, conversion-focused, and friendly.",
      "For each variant include: title, subtitle, short description, timer text, and CTA button text.",
      "Avoid long sentences. Make the CTA action-oriented.",
      existingCopy.length
        ? `Use this existing copy as context:\n${existingCopy.join("\n")}`
        : "Base it on a general ecommerce promotion.",
    ].join("\n");

    const url = `https://chatgpt.com/?q=${encodeURIComponent(prompt)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  function updateField(field: keyof PromoCard, value: any) {
    if ((configRef.current.promoCard as any)[field] === value) return;
    pushPromoState();
    const nextPromoCard = {
      ...config.promoCard,
      [field]: value,
    };
    setConfig({
      ...config,
      promoCard: nextPromoCard,
    });
    syncResetPromoEditsButton(nextPromoCard);
    markChanged();
  }

  function getPopupPositionStyle(
    field: PopupField,
    popupHeight = 320,
  ): { top?: string; bottom?: string } {
    const card = promoCardRef.current;
    const refMap = {
      title: previewTitleRef,
      subtitle: previewSubtitleRef,
      description: previewDescriptionRef,
      button: previewButtonRef,
      timer: previewTimerRef,
    } as const;
    const el = refMap[field].current;
    if (!card || !el) return { bottom: "8px" };
    const fieldTop = el.offsetTop;
    const spaceBelow = card.clientHeight - fieldTop;
    if (spaceBelow >= popupHeight + 8) {
      return { top: `${Math.max(8, fieldTop)}px` };
    }
    return { bottom: "8px" };
  }


  const popupEditableFields = [
    "title",
    "subtitle",
    "description",
    "button",
    "timer",
  ] as const;
  type PopupField = (typeof popupEditableFields)[number];

  function getPopupFieldStyle(field: PopupField) {
    if (field === "title") return config.promoCard.style.titleStyle;
    if (field === "subtitle") return config.promoCard.style.subheadingStyle;
    if (field === "description") return config.promoCard.style.descriptionStyle;
    if (field === "timer") return config.promoCard.style.dateStyle;
    return config.promoCard.style.buttonStyle;
  }

  function getPopupFieldLabel(field: PopupField) {
    if (field === "title") return "Title Style";
    if (field === "subtitle") return "Subtitle Style";
    if (field === "description") return "Description Style";
    if (field === "timer") return "Timer Style";
    return "Button Style";
  }

  function getPreviewFieldBackground(field: PopupField) {
    return getPopupFieldStyle(field).background;
  }

  function getFormattedTimerText(): string {
    const rawHtml = config.promoCard.timerText ?? getDefaultTimerStorageHTML();
    const timerValue = calcTimerRemaining(config.promoCard.endDate || "");

    if (
      [
        timerValue.hours,
        timerValue.minutes,
        timerValue.seconds,
        timerValue.days ?? 0,
      ].some(Number.isNaN)
    ) {
      // Replace tokens with dashes, preserving HTML structure
      return rawHtml.replace(
        /\{hhh\}|\{hh\}|\{h\}|\{mmm\}|\{mm\}|\{m\}|\{sss\}|\{ss\}|\{s\}|\{ddd\}|\{dd\}|\{d\}/g,
        "--",
      );
    }
    return formatTimerText(rawHtml, timerValue);
  }

  // On mount: load saved versions. The saved config remains the source of truth.
  useEffect(() => {
    listVersions().then((list) => {
      setVersions(list);
    });
  }, []);

  useEffect(() => {
    const matchingVersion = [...versions]
      .reverse()
      .find((version) => promoCardsEqual(version.promoCard, config.promoCard));
    if (!matchingVersion) return;
    setSelectedVersionId(matchingVersion.id);
    onSelectedVersionChange?.(matchingVersion.id);
  }, [config.promoCard, versions, onSelectedVersionChange]);

  // Refresh the list whenever the popup is opened (keeps it current).
  useEffect(() => {
    if (!showVersionsPopup) {
      setPendingDeleteId(null);
      return;
    }
    let active = true;
    listVersions().then((list) => {
      if (active) setVersions(list);
    });
    return () => {
      active = false;
    };
  }, [showVersionsPopup]);

  function formatVersionTime(savedAt: string): string {
    const date = new Date(savedAt);
    if (Number.isNaN(date.getTime())) return "";
    return date.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }


  async function handleDeleteVersion(id: string) {
    const updated = await deleteVersion(id);
    setVersions(updated);
    if (selectedVersionId === id) {
      setSelectedVersionId(null);
      onSelectedVersionChange?.(null);
    }
    setPendingDeleteId(null);
    toast("Variant deleted");
  }

  // Apply a saved version to the live card — click-to-apply, like a template.
  function applyVersion(version: PromoVersion) {
    // Leaving a fresh card → undo lands on its EDITED state (getPromoSnapshot).
    // Leaving a template/variant → undo lands on its CLEAN baseline.
    const leavingFresh = isFreshCardRef.current;
    isFreshCardRef.current = false;
    const previousSnapshot =
      !leavingFresh && promoAppliedCardBaselineRef.current
        ? promoAppliedCardBaselineRef.current
        : getPromoSnapshot();
    promoAppliedRedoRef.current = null;
    promoHistory.clear();
    const restored = withDefaultDates(clonePromoCard(version.promoCard));
    setConfig({ ...configRef.current, promoCard: restored });
    syncEditorsFromConfig(restored);
    markChanged();
    setPromoAppliedCardBaseline(restored, previousSnapshot);
    setSelectedVersionId(version.id);
    onSelectedVersionChange?.(version.id);
    setShowVersionsPopup(false);
    toast(`Variant applied: ${version.label}`);
  }

  function applyTemplate(template: PromoCard, templateName: string) {
    // Leaving a fresh card → undo lands on its EDITED state (getPromoSnapshot).
    // Leaving a template/variant → undo lands on its CLEAN baseline.
    const leavingFresh = isFreshCardRef.current;
    isFreshCardRef.current = false;
    const previousSnapshot =
      !leavingFresh && promoAppliedCardBaselineRef.current
        ? promoAppliedCardBaselineRef.current
        : getPromoSnapshot();
    promoAppliedRedoRef.current = null;
    promoHistory.clear();
    let cloned = JSON.parse(JSON.stringify(template));
    cloned.timerText = normalizeTimerTemplate(
      cloned.timerText ?? getDefaultTimerStorageHTML(),
    );
    cloned = withDefaultDates(cloned);
    setConfig({ ...configRef.current, promoCard: cloned });
    syncEditorsFromConfig(cloned);
    markChanged();
    setPromoAppliedCardBaseline(cloned, previousSnapshot);
    setSelectedVersionId(null);
    onSelectedVersionChange?.(null);
    toast(`Template applied: ${templateName}`);
  }

  function formatDateLabel(value: string): string {
    if (!value) return "Select date";
    const date = new Date(`${value}T00:00:00`);
    if (Number.isNaN(date.getTime())) return "Select date";
    return date.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }

  function toISODate(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  function buildMonthDays(viewDate: Date): Date[] {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const first = new Date(year, month, 1);
    const startOffset = first.getDay();
    const gridStart = new Date(year, month, 1 - startOffset);
    return Array.from(
      { length: 42 },
      (_, i) =>
        new Date(
          gridStart.getFullYear(),
          gridStart.getMonth(),
          gridStart.getDate() + i,
        ),
    );
  }

  function renderDatePicker(params: {
    mode: "start" | "end";
    value: string;
    viewDate: Date;
    setViewDate: (date: Date) => void;
    open: boolean;
    setOpen: (open: boolean) => void;
    onSelect: (value: string) => void;
  }) {
    const { mode, value, viewDate, setViewDate, open, setOpen, onSelect } =
      params;
    const days = buildMonthDays(viewDate);
    const month = viewDate.getMonth();
    const selected = value;
    const today = toISODate(new Date());
    return (
      <div
        ref={mode === "start" ? startDatePickerRef : endDatePickerRef}
        className="relative mt-1"
      >
        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            setOpen(!open);
          }}
          className="flex w-full items-center justify-between rounded-md border border-border bg-surface px-3 py-2 text-sm text-on-surface transition-colors hover:border-primary/70"
        >
          <span
            className={selected ? "text-on-surface" : "text-on-surface-variant"}
          >
            {formatDateLabel(value)}
          </span>
          <svg
            className={`h-4 w-4 flex-shrink-0 text-on-surface-variant transition-transform duration-200 ${open ? "rotate-180" : "rotate-0"}`}
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
          >
            <path
              d="M6 8l4 4 4-4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
        {open && (
          <div
            className={`absolute z-40 mt-1 w-[260px] rounded-xl border border-border bg-surface-elevated p-2 shadow-2xl ${mode === "end" ? "right-0" : "left-0"}`}
          >
            <div className="mb-2 flex items-center justify-between">
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  setViewDate(
                    new Date(
                      viewDate.getFullYear(),
                      viewDate.getMonth() - 1,
                      1,
                    ),
                  );
                }}
                className="h-7 w-7 rounded border border-border text-on-surface-variant hover:border-primary/70 hover:text-primary"
                aria-label="Previous month"
              >
                <svg
                  className="mx-auto h-4 w-4"
                  viewBox="0 0 20 20"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                >
                  <path
                    d="M12 6l-4 4 4 4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
              <div className="text-xs font-semibold text-on-surface">
                {viewDate.toLocaleDateString(undefined, {
                  month: "long",
                  year: "numeric",
                })}
              </div>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  setViewDate(
                    new Date(
                      viewDate.getFullYear(),
                      viewDate.getMonth() + 1,
                      1,
                    ),
                  );
                }}
                className="h-7 w-7 rounded border border-border text-on-surface-variant hover:border-primary/70 hover:text-primary"
                aria-label="Next month"
              >
                <svg
                  className="mx-auto h-4 w-4"
                  viewBox="0 0 20 20"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                >
                  <path
                    d="M8 6l4 4-4 4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            </div>
            <div className="mb-1 grid grid-cols-7 gap-1 text-center text-[10px] font-medium text-on-surface-variant">
              {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((day) => (
                <div key={day}>{day}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {days.map((date) => {
                const iso = toISODate(date);
                const inMonth = date.getMonth() === month;
                const isSelected = selected === iso;
                const isToday = today === iso;
                return (
                  <button
                    key={iso}
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      onSelect(iso);
                      setOpen(false);
                    }}
                    className={`h-8 rounded text-xs transition-colors ${
                      isSelected
                        ? "bg-primary text-on-primary"
                        : inMonth
                          ? "text-on-surface hover:bg-primary/10 hover:text-primary"
                          : "text-on-surface-variant/60 hover:bg-primary/5"
                    } ${isToday && !isSelected ? "ring-1 ring-primary/40" : ""}`}
                  >
                    {date.getDate()}
                  </button>
                );
              })}
            </div>
            <div className="mt-2 flex items-center justify-between border-t border-border pt-2">
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  onSelect("");
                  setOpen(false);
                }}
                className="text-xs text-on-surface-variant hover:text-primary"
              >
                Clear
              </button>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  const now = new Date();
                  onSelect(toISODate(now));
                  setViewDate(new Date(now.getFullYear(), now.getMonth(), 1));
                  setOpen(false);
                }}
                className="text-xs font-medium text-primary hover:opacity-80"
              >
                Today
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  function directionToAngle(direction?: string): number {
    if (!direction) return 90;
    const normalized = direction.trim().toLowerCase();
    const degreeMatch = normalized.match(/^(-?\d+(?:\.\d+)?)deg$/);
    if (degreeMatch) return Number(degreeMatch[1]);
    const map: Record<string, number> = {
      "to top": 0,
      "to top right": 45,
      "to right": 90,
      "to bottom right": 135,
      "to bottom": 180,
      "to bottom left": 225,
      "to left": 270,
      "to top left": 315,
    };
    return map[normalized] ?? 90;
  }

  function normalizeAngle(angle: number): number {
    return ((angle % 360) + 360) % 360;
  }

  function angleToCssDirection(angle: number): string {
    return `${Math.round(normalizeAngle(angle))}deg`;
  }

  function setCardDirectionAngle(angle: number) {
    updateCardBg({ direction: angleToCssDirection(angle) });
  }

  function setFieldDirectionAngle(angle: number) {
    updateFieldBg({ direction: angleToCssDirection(angle) });
  }

  function getAngleFromPointer(
    clientX: number,
    clientY: number,
    wheelRef: RefObject<HTMLDivElement | null>,
  ): number | null {
    const wheel = wheelRef.current;
    if (!wheel) return null;
    const rect = wheel.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const dx = clientX - centerX;
    const dy = clientY - centerY;
    const distance = Math.hypot(dx, dy);
    if (distance < 10) return null;
    const raw = Math.atan2(dy, dx) * (180 / Math.PI);
    return normalizeAngle(raw + 90);
  }

  const presetDirections = [
    { label: "↑", angle: 0 },
    { label: "↗", angle: 45 },
    { label: "→", angle: 90 },
    { label: "↘", angle: 135 },
    { label: "↓", angle: 180 },
    { label: "↙", angle: 225 },
    { label: "←", angle: 270 },
    { label: "↖", angle: 315 },
  ];

  function renderGradientDirectionWheel({
    angle,
    wheelRef,
    onAngleChange,
    keyPrefix,
  }: {
    angle: number;
    wheelRef: RefObject<HTMLDivElement | null>;
    onAngleChange: (angle: number) => void;
    keyPrefix: string;
  }) {
    const normalizedAngle = normalizeAngle(angle);

    return (
      <div
        ref={wheelRef}
        className="relative h-28 w-28 rounded-full border border-border/80 bg-[conic-gradient(from_0deg,_rgba(255,255,255,0.14),_rgba(255,255,255,0.03),_rgba(255,255,255,0.14))] shadow-inner cursor-grab active:cursor-grabbing"
        onMouseDown={(e) => {
          e.preventDefault();
          const updateFromMouse = (clientX: number, clientY: number) => {
            const nextAngle = getAngleFromPointer(
              clientX,
              clientY,
              wheelRef,
            );
            if (nextAngle !== null) onAngleChange(nextAngle);
          };
          updateFromMouse(e.clientX, e.clientY);
          const onMove = (moveEvent: MouseEvent) =>
            updateFromMouse(moveEvent.clientX, moveEvent.clientY);
          const onUp = () => {
            window.removeEventListener("mousemove", onMove);
            window.removeEventListener("mouseup", onUp);
          };
          window.addEventListener("mousemove", onMove);
          window.addEventListener("mouseup", onUp);
        }}
      >
        <div
          className="pointer-events-none absolute left-1/2 top-1/2 z-40"
          style={{
            transform: `translateY(-50%) rotate(${normalizedAngle - 90}deg)`,
            transformOrigin: "left center",
          }}
        >
          <div className="h-[2px] w-6 bg-primary" />
          <div className="absolute right-0 top-1/2 h-0 w-0 -translate-y-1/2 translate-x-full border-y-4 border-y-transparent border-l-[6px] border-l-primary" />
        </div>
        <div className="pointer-events-none absolute left-1/2 top-1/2 z-50 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border border-primary bg-surface-elevated" />
        {presetDirections.map((preset) => (
          <button
            key={`${keyPrefix}-${preset.angle}`}
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onAngleChange(preset.angle);
            }}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            className={`absolute left-1/2 top-1/2 z-20 h-6 w-6 -translate-x-1/2 -translate-y-1/2 text-[12px] leading-none transition-colors ${
              Math.abs(normalizedAngle - preset.angle) < 0.6
                ? "font-semibold text-primary"
                : "text-on-surface-variant hover:text-primary"
            }`}
            style={{
              left: `calc(50% + ${Math.sin((preset.angle * Math.PI) / 180) * 37}px)`,
              top: `calc(50% - ${Math.cos((preset.angle * Math.PI) / 180) * 37}px)`,
            }}
            title={`${preset.angle}deg`}
          >
            {preset.label}
          </button>
        ))}
      </div>
    );
  }

  const cardAngle = directionToAngle(
    config.promoCard.style.background.direction || "to right",
  );
  const cardAngleNormalized = normalizeAngle(cardAngle);

  function hasVisibleContent(html: string | undefined): boolean {
    if (!html) return false;
    const plainText = html
      .replace(/<[^>]*>/g, "")
      .replace(/&nbsp;/g, " ")
      .trim();
    return plainText.length > 0;
  }

  const hasTitle = hasVisibleContent(config.promoCard.title);
  const hasSubtitle = hasVisibleContent(config.promoCard.subtitle);
  const hasDescription = hasVisibleContent(config.promoCard.description);
  const hasButtonText = hasVisibleContent(config.promoCard.buttonText);
  const showContentScaffold =
    showPersistentScaffold ||
    currentField === "title" ||
    currentField === "subtitle" ||
    currentField === "description" ||
    currentField === "timer" ||
    currentField === "button";
  const showTitleInPreview = hasTitle || showContentScaffold;
  const showSubtitleInPreview = hasSubtitle || showContentScaffold;
  const showDescriptionInPreview = hasDescription || showContentScaffold;
  const showTimerInPreview = config.promoCard.showTimer || showContentScaffold;
  const showButtonInPreview =
    config.promoCard.showButton || hasButtonText || showContentScaffold;

  return (
    <>
      <div
        className="flex gap-4 overflow-hidden"
        style={{ height: "calc(100vh - 120px)" }}
      >
        {/* Left: All editables — 30% width, scrollable */}
        <div className="campaign-custom-scrollbar w-[30%] min-h-0 shrink-0 overflow-y-auto overflow-x-hidden pr-4 space-y-4">
          {/* Header + Toggle */}
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div className="p-2 bg-pink-100 rounded-lg mr-3">
                <Gift className="w-4 h-4 text-pink-600" />
              </div>
              <div>
                <h3 className="text-[1.75rem] leading-9 font-bold text-on-surface">
                    Promo Card
                </h3>
                <p className="mt-0.5 max-w-2xl text-sm text-on-surface-variant">
                  Floating widget for special offers.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  openChatGptWithPromoPrompt();
                }}
                className="p-1 rounded text-on-surface-variant hover:text-primary hover:bg-primary/10 transition-colors"
                title="Open ChatGPT with a promo copy prompt"
                aria-label="Open ChatGPT with a promo copy prompt"
              >
                <Sparkles className="w-3.5 h-3.5" />
              </button>
              <button
                onMouseDown={(e) => e.preventDefault()}
                onClick={resetPromoEdits}
                disabled={!canResetPromoEdits}
                className="p-1 rounded text-on-surface-variant hover:text-primary hover:bg-primary/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                title="Reset edits to selected template or variant"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
              <button
                onMouseDown={(e) => e.preventDefault()}
                onClick={undoPromo}
                disabled={!canUndoPromo}
                className="p-1 rounded text-on-surface-variant hover:text-primary hover:bg-primary/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                title="Undo promo action"
              >
                <Undo2 className="w-3.5 h-3.5" />
              </button>
              <button
                onMouseDown={(e) => e.preventDefault()}
                onClick={redoPromo}
                disabled={!canRedoPromo}
                className="p-1 rounded text-on-surface-variant hover:text-primary hover:bg-primary/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                title="Redo promo action"
              >
                <Redo2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Quick actions: browse versions, or start from a sample */}
          <div className="!mt-6 flex items-center gap-2">
            <button
              type="button"
              onClick={startFreshPromoCard}
              className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-md border border-border px-3 py-2 text-sm font-medium text-on-surface-variant transition-colors hover:border-primary/70 hover:bg-primary/10 hover:text-primary"
              title="Start from a blank promo card"
            >
              <FilePlus2 className="h-4 w-4" /> Start Fresh
            </button>
            <button
              type="button"
              onClick={() => setShowVersionsPopup(true)}
              className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-md border border-border px-3 py-2 text-sm font-medium text-on-surface-variant transition-colors hover:border-primary/70 hover:bg-primary/10 hover:text-primary"
              title="Saved variants of this promo card"
            >
              <History className="h-4 w-4" /> Variants
            </button>
            <button
              type="button"
              onClick={() => setShowTemplatesPopup(true)}
              className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-md border border-border px-3 py-2 text-sm font-medium text-on-surface-variant transition-colors hover:border-primary/70 hover:bg-primary/10 hover:text-primary"
              title="Start from a ready-made sample template"
            >
              <LayoutTemplate className="h-4 w-4" /> Template Hub
            </button>
          </div>

          <div className="!mt-8">
            <h4 className="text-sm font-bold text-on-surface-variant uppercase tracking-wide">
              Content
            </h4>
            <p className="text-sm text-on-surface-variant">
              Main promo copy shown in the card.
            </p>
          </div>

          <div>
            <div className="!mt-0 flex items-center justify-between">
              <label className="block text-sm font-medium text-on-surface mb-1">
                Title
              </label>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  openFieldStylePopup("title", titleRef);
                }}
                className="p-1 rounded text-on-surface-variant hover:text-primary hover:bg-primary/10 transition-colors"
                title="Open title style"
                aria-label="Open title style"
              >
                <Palette className="w-3.5 h-3.5" />
              </button>
            </div>

            <div
              ref={titleRef}
              contentEditable
             // data-placeholder="Enter text here"
              suppressContentEditableWarning
              onInput={() => onFieldInput("title")}
              onFocus={() => onFieldFocus("title", titleRef)}
              onKeyDown={onPromoEditorKeyDown}
              onMouseUp={() => refreshPromoToolbarFormats(titleRef.current)}
              onKeyUp={() => refreshPromoToolbarFormats(titleRef.current)}
              className={`rich-editor promo-standard-editor block w-full rounded-md p-2 border min-h-[44px] outline-none break-words transition-colors ${
                currentField === "title" ? "border-primary/70" : "border-border"
              } focus:ring-primary/60 focus:border-primary/80 hover:border-primary/70`}
              style={{
                background: getBackgroundStyle(
                  config.promoCard.style.background,
                ),
              }}
            />
          </div>
          <div>
            <div className="flex items-center justify-between">
              <label className="block text-sm font-medium text-on-surface mb-1">
                Subtitle
              </label>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  openFieldStylePopup("subtitle", subtitleRef);
                }}
                className="p-1 rounded text-on-surface-variant hover:text-primary hover:bg-primary/10 transition-colors"
                title="Open subtitle style"
                aria-label="Open subtitle style"
              >
                <Palette className="w-3.5 h-3.5" />
              </button>
            </div>
            <div
              ref={subtitleRef}
              contentEditable
             // data-placeholder="Enter text here"
              suppressContentEditableWarning
              onInput={() => onFieldInput("subtitle")}
              onFocus={() => onFieldFocus("subtitle", subtitleRef)}
              onKeyDown={onPromoEditorKeyDown}
              onMouseUp={() => refreshPromoToolbarFormats(subtitleRef.current)}
              onKeyUp={() => refreshPromoToolbarFormats(subtitleRef.current)}
              className={`rich-editor promo-standard-editor block w-full rounded-md p-2 border min-h-[44px] outline-none break-words transition-colors ${
                currentField === "subtitle"
                  ? "border-primary/70"
                  : "border-border"
              } focus:ring-primary/60 focus:border-primary/80 hover:border-primary/70`}
              style={{
                background: getBackgroundStyle(
                  config.promoCard.style.background,
                ),
              }}
            />
          </div>

          <div>
            <div className="flex items-center justify-between">
              <label className="block text-sm font-medium text-on-surface mb-1">
                Description
              </label>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  openFieldStylePopup("description", descRef);
                }}
                className="p-1 rounded text-on-surface-variant hover:text-primary hover:bg-primary/10 transition-colors"
                title="Open description style"
                aria-label="Open description style"
              >
                <Palette className="w-3.5 h-3.5" />
              </button>
            </div>
            <div
              ref={descRef}
              contentEditable
              suppressContentEditableWarning
             // data-placeholder="Enter text here"
              onInput={() => onFieldInput("description")}
              onFocus={() => onFieldFocus("description", descRef)}
              onKeyDown={onPromoEditorKeyDown}
              onMouseUp={() => refreshPromoToolbarFormats(descRef.current)}
              onKeyUp={() => refreshPromoToolbarFormats(descRef.current)}
              className={`rich-editor promo-standard-editor block w-full rounded-md p-2 border min-h-[48px] outline-none break-words transition-colors ${
                currentField === "description"
                  ? "border-primary/70"
                  : "border-border"
              } focus:ring-primary/60 focus:border-primary/80 hover:border-primary/70`}
              style={{
                background: getBackgroundStyle(
                  config.promoCard.style.background,
                ),
              }}
            />
          </div>

          <div className="pt-1">
            <h4 className="text-sm font-bold text-on-surface-variant uppercase tracking-wide">
              Schedule
            </h4>
            <p className="text-sm text-on-surface-variant mb-2">
              Control when the promo card is active.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-on-surface">
                Start Date
              </label>
              {renderDatePicker({
                mode: "start",
                value: config.promoCard.startDate,
                viewDate: startDateView,
                setViewDate: setStartDateView,
                open: showStartDatePicker,
                setOpen: setShowStartDatePicker,
                onSelect: (nextValue) => updateField("startDate", nextValue),
              })}
            </div>
            <div>
              <label className="block text-sm font-medium text-on-surface">
                End Date
              </label>
              {renderDatePicker({
                mode: "end",
                value: config.promoCard.endDate,
                viewDate: endDateView,
                setViewDate: setEndDateView,
                open: showEndDatePicker,
                setOpen: setShowEndDatePicker,
                onSelect: (nextValue) => updateField("endDate", nextValue),
              })}
            </div>
          </div>

          <div className="pt-1">
            <h4 className="text-sm font-bold text-on-surface-variant uppercase tracking-wide">
              Timer
            </h4>
            <p className="text-sm text-on-surface-variant">
              Optional countdown messaging for urgency.
            </p>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <label className="text-sm font-medium text-on-surface">
                Enable Timer
              </label>
              {/* Tooltip info icon */}
              <div className="relative group">
                <svg
                  className="w-4 h-4 text-on-surface-variant cursor-help"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 16v-4M12 8h.01" />
                </svg>
                <div className="absolute bottom-full left-0 mb-2 w-64 p-2.5 bg-gray-900 dark:bg-gray-700 text-white text-[11px] leading-relaxed rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 pointer-events-none">
                  <p className="font-semibold mb-1">How timer works:</p>
                  <p className="mb-1">
                    Dates are <strong>calendar-based</strong>, not relative to
                    when you set them.
                  </p>
                  <ul className="space-y-0.5 list-disc list-inside">
                    <li>
                      <strong>Start date</strong> begins at{" "}
                      <strong>12:00 AM</strong> (midnight)
                    </li>
                    <li>
                      <strong>End date</strong> runs until{" "}
                      <strong>11:59 PM</strong> (end of day)
                    </li>
                  </ul>
                  <p className="mt-1 text-gray-300 dark:text-gray-300">
                    e.g. Start: Feb 19 → End: Feb 21 means timer counts down
                    from now until Feb 21, 11:59 PM.
                  </p>
                  <div className="absolute top-full left-4 w-0 h-0 border-l-[6px] border-r-[6px] border-t-[6px] border-l-transparent border-r-transparent border-t-gray-900 dark:border-t-gray-700"></div>
                </div>
              </div>
            </div>
            <button
              onClick={() =>
                updateField("showTimer", !config.promoCard.showTimer)
              }
              className={`relative inline-flex h-6 w-11 border-2 border-transparent rounded-full transition-all duration-200 hover:shadow-sm hover:shadow-primary/20 ${
                config.promoCard.showTimer
                  ? "bg-primary"
                  : "bg-surface-subtle hover:bg-primary/20"
              }`}
            >
              <span
                className={`inline-block h-5 w-5 rounded-full bg-white shadow transform transition ${
                  config.promoCard.showTimer ? "translate-x-5" : "translate-x-0"
                }`}
              ></span>
            </button>
          </div>

          {/* Timer Controls — rich text editor */}
          {config.promoCard.showTimer && (
            <div className="space-y-2">
              <div className="flex items-center justify-between mb-1">
                <label className="block text-sm font-medium text-on-surface">
                  Timer Text
                </label>
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    openFieldStylePopup("timer", timerRef);
                  }}
                  className="p-1 rounded text-on-surface-variant hover:text-primary hover:bg-primary/10 transition-colors"
                  title="Open timer style"
                  aria-label="Open timer style"
                >
                  <Palette className="w-3.5 h-3.5" />
                </button>
              </div>
              <div
                ref={timerRef}
                contentEditable
                suppressContentEditableWarning
                onInput={() => onFieldInput("timer")}
                onFocus={() => onFieldFocus("timer", timerRef)}
                onKeyDown={onPromoEditorKeyDown}
                onMouseUp={() => refreshPromoToolbarFormats(timerRef.current)}
                onKeyUp={() => refreshPromoToolbarFormats(timerRef.current)}
                className={`rich-editor promo-standard-editor shadow-sm focus:ring-primary/60 focus:border-primary/80 hover:border-primary/70 block w-full sm:text-sm rounded-md p-2 border outline-none break-words min-h-[48px] transition-colors ${
                  currentField === "timer"
                    ? "border-primary/70"
                    : "border-border"
                }`}
                style={{
                  background: getBackgroundStyle(
                    config.promoCard.style.background,
                  ),
                }}
              />
              <p className="text-xs text-on-surface-variant">
                Use tokens like {`{d}`}, {`{hh}`}, {`{mm}`}, {`{ss}`}. Select
                text to apply colors and sizes.
              </p>
              <div className="flex flex-wrap gap-1">
                {["{d}", "{hh}", "{mm}", "{ss}"].map((token) => (
                  <button
                    key={token}
                    onMouseDown={(e) => {
                      e.preventDefault(); // Prevent button from stealing focus
                      pushPromoState();
                      const el = timerRef.current;
                      if (!el) return;
                      const sel = window.getSelection();
                      if (!sel || sel.rangeCount === 0) {
                        // No selection, append to end
                        el.innerHTML += token;
                      } else {
                        const range = sel.getRangeAt(0);
                        if (el.contains(range.commonAncestorContainer)) {
                          // Insert at cursor position
                          const textNode = document.createTextNode(token);
                          range.deleteContents();
                          range.insertNode(textNode);
                          // Move cursor after inserted token
                          range.setStartAfter(textNode);
                          range.setEndAfter(textNode);
                          sel.removeAllRanges();
                          sel.addRange(range);
                        } else {
                          // Selection outside editor, append to end
                          el.innerHTML += token;
                        }
                      }
                      onFieldInput("timer");
                    }}
                    className="px-2 py-0.5 text-xs rounded transition-colors border border-border hover:border-primary/70 hover:bg-primary/10 hover:text-primary text-on-surface-variant"
                  >
                    {token}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="pt-1">
            <h4 className="text-xs font-semibold text-on-surface-variant uppercase tracking-wide mb-2">
              Call To Action
            </h4>
            <p className="text-xs text-on-surface-variant mb-2">
              Configure button text and destination.
            </p>
          </div>

          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-on-surface">
              Enable Button
            </label>
            <button
              onClick={() =>
                updateField("showButton", !config.promoCard.showButton)
              }
              className={`relative inline-flex h-6 w-11 border-2 border-transparent rounded-full transition-all duration-200 hover:shadow-sm hover:shadow-primary/20 ${
                config.promoCard.showButton
                  ? "bg-primary"
                  : "bg-surface-subtle hover:bg-primary/20"
              }`}
            >
              <span
                className={`inline-block h-5 w-5 rounded-full bg-white shadow transform transition ${
                  config.promoCard.showButton
                    ? "translate-x-5"
                    : "translate-x-0"
                }`}
              ></span>
            </button>
          </div>

          {config.promoCard.showButton && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-on-surface">
                  Button URL
                </label>
                <input
                  type="url"
                  value={config.promoCard.buttonUrl}
                  onChange={(e) => updateField("buttonUrl", e.target.value)}
                  onBlur={(e) =>
                    updateField("buttonUrl", e.target.value.trim())
                  }
                  placeholder="https://example.com"
                  inputMode="url"
                  autoCapitalize="off"
                  autoCorrect="off"
                  spellCheck={false}
                  className="block w-full rounded-md p-2 border min-h-[38px] outline-none text-sm transition-colors border-border bg-surface text-on-surface focus:ring-primary/60 focus:border-primary/80 hover:border-primary/70"
                />
              </div>
              <div>
                <div className="flex items-center justify-between">
                  <label className="block text-sm font-medium text-on-surface">
                    Button Text
                  </label>
                  <button
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      openFieldStylePopup("button", buttonRef);
                    }}
                    className="p-1 rounded text-on-surface-variant hover:text-primary hover:bg-primary/10 transition-colors"
                    title="Open button style"
                    aria-label="Open button style"
                  >
                    <Palette className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div
                  ref={buttonRef}
                  contentEditable
                  suppressContentEditableWarning
                  data-placeholder="Enter text here"
                  onInput={() => onFieldInput("button")}
                  onFocus={() => onFieldFocus("button", buttonRef)}
                  onKeyDown={onPromoEditorKeyDown}
                  onMouseUp={() =>
                    refreshPromoToolbarFormats(buttonRef.current)
                  }
                  onKeyUp={() => refreshPromoToolbarFormats(buttonRef.current)}
                  className={`rich-editor promo-standard-editor block w-full rounded-md p-2 border min-h-[38px] outline-none break-words transition-colors ${
                    currentField === "button"
                      ? "border-primary/70"
                      : "border-border"
                  } focus:ring-primary/60 focus:border-primary/80 hover:border-primary/70`}
                  style={{
                    background: getBackgroundStyle(
                      config.promoCard.style.buttonStyle?.background ||
                        config.promoCard.style.background,
                    ),
                  }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Right: Preview — 70% width, fixed */}
        <div className="flex-1 min-h-0 h-full pr-2 flex flex-col gap-4 overflow-x-hidden">
          <div className="space-y-1">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h4 className="text-sm font-bold text-on-surface-variant uppercase tracking-wide">
                  Preview
                </h4>
                <p className="text-sm text-on-surface-variant">
                  Live card rendering with editable field styles.
                </p>
              </div>
              <div className="flex flex-col items-end gap-1">
                <p className="text-[11px] text-primary font-medium flex items-center animate-pulse">
                  💡 click Position to place the card • click Style to edit card
                  background
                </p>
                <div className="flex flex-wrap items-center justify-end gap-1.5">
                  <PopupDropdown
                    label="Position"
                    value={config.promoCard.style.position}
                    options={[
                      { value: "bottom-right", label: "Bottom Right" },
                      { value: "bottom-left", label: "Bottom Left" },
                    ]}
                    open={showCardPositionDropdown}
                    onOpen={() => {
                      const next = !showCardPositionDropdown;
                      closeAllPromoDropdowns();
                      setShowCardPositionDropdown(next);
                      setCardPositionPos(
                        getDropdownPosition(cardPositionBtnRef.current),
                      );
                    }}
                    onSelect={(v) => {
                      pushPromoState();
                      setConfig({
                        ...config,
                        promoCard: {
                          ...config.promoCard,
                          style: {
                            ...config.promoCard.style,
                            position: v as any,
                          },
                        },
                      });
                      markChanged();
                      setShowCardPositionDropdown(false);
                    }}
                    buttonRef={cardPositionBtnRef}
                    menuRef={cardPositionMenuRef}
                    menuPosition={cardPositionPos}
                    compact={true}
                  />
                  <div>
                    <label className="block text-[10px] text-on-surface-variant mb-0.5">
                      Style
                    </label>
                    <button
                      ref={cardBgPopupBtnRef}
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        closeAllPromoDropdowns();
                        setShowPersistentScaffold(true);
                        setShowCardBgPopup((prev) => !prev);
                      }}
                      className="inline-flex h-9 items-center justify-center rounded-md border border-white/10 bg-black/10 px-2 text-on-surface shadow-2xl backdrop-blur-md transition-colors hover:border-primary/70 hover:bg-black/10"
                      title="Card Style"
                    >
                      <Palette className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="flex flex-col items-start pl-3">
                    <label className="block text-[10px] text-on-surface-variant mb-0.5">
                      {config.promoCard.active ? "Active" : "Inactive"}
                    </label>
                    <button
                      onClick={toggleActive}
                      title={
                        config.promoCard.active
                          ? "Promo card is ON — click to turn off"
                          : "Promo card is OFF — click to turn on"
                      }
                      className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full border-2 border-transparent transition-all duration-200 hover:shadow-sm hover:shadow-primary/20 ${
                        config.promoCard.active
                          ? "bg-primary"
                          : "bg-surface-subtle hover:bg-primary/20"
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${
                          config.promoCard.active
                            ? "translate-x-5"
                            : "translate-x-0"
                        }`}
                      />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="campaign-card-surface rounded-lg p-5 relative flex-1 min-h-0 border border-gray-200 dark:border-gray-600">
            <div className="absolute inset-x-0 top-4 flex items-center justify-center text-gray-400 text-sm font-medium pointer-events-none">
              Website Content Area
            </div>

            <div className="relative z-10 w-full h-full min-h-[228px] grid">
              {config.promoCard.active && (
                <div
                  ref={promoCardRef}
                  className={`relative w-[400px] rounded-xl shadow-2xl p-5 transition-all duration-300 flex flex-col ${
                    config.promoCard.style.position === "bottom-right"
                      ? "justify-self-end self-end"
                      : config.promoCard.style.position === "bottom-left"
                        ? "justify-self-start self-end"
                        : config.promoCard.style.position === "top-right"
                          ? "justify-self-end self-start"
                          : "justify-self-start self-start"
                  }`}
                  style={{
                    background: getBackgroundStyle(
                      config.promoCard.style.background,
                    ),
                  }}
                >
                  <button className="absolute top-2 right-2 opacity-60 hover:opacity-100 p-1">
                    <X className="w-4 h-4" />
                  </button>

                  {showTitleInPreview && (
                    <div
                      ref={previewTitleRef}
                      contentEditable
                      suppressContentEditableWarning
                      className={`text-base font-normal mb-1 px-2 py-1 rounded break-words cursor-pointer outline-none ${currentField === "title" ? "ring-1 ring-primary/70" : ""}`}
                      onMouseDown={() => {
                        activeEditorRef.current = previewTitleRef.current;
                      }}
                      onClick={() => {
                        setShowCardBgPopup(false);
                        if (currentField !== "title") setCurrentField("title");
                        activeEditorRef.current = previewTitleRef.current;
                        setTimeout(
                          () =>
                            refreshPromoToolbarFormats(previewTitleRef.current),
                          0,
                        );
                      }}
                      onFocus={() => {
                        activeEditorRef.current = previewTitleRef.current;
                      }}
                      onMouseUp={() => {
                        refreshPromoToolbarFormats(previewTitleRef.current);
                      }}
                      onInput={() => onFieldInput("title")}
                      onKeyDown={onPromoPreviewKeyDown}
                      onPaste={(e) => e.preventDefault()}
                      onDrop={(e) => e.preventDefault()}
                      style={{
                        background: getBackgroundStyle(
                          getPreviewFieldBackground("title"),
                        ),
                        color: config.promoCard.style.titleStyle.textColor,
                        textAlign:
                          config.promoCard.style.titleStyle.textAlign ||
                          "center",
                        caretColor: "transparent",
                        userSelect: "text",
                        WebkitUserSelect: "text",
                        cursor: "text",
                      }}
                    />
                  )}

                  {showSubtitleInPreview && (
                    <div
                      ref={previewSubtitleRef}
                      contentEditable
                      suppressContentEditableWarning
                      className={`text-base font-normal mb-2 px-2 py-1 rounded break-words cursor-pointer outline-none ${currentField === "subtitle" ? "ring-1 ring-primary/70" : ""}`}
                      onMouseDown={() => {
                        // Don't trigger state updates while dragging selection.
                        activeEditorRef.current = previewSubtitleRef.current;
                      }}
                      onClick={() => {
                        setShowCardBgPopup(false);
                        // Plain click activates subtitle style mode.
                        if (currentField !== "subtitle")
                          setCurrentField("subtitle");
                        activeEditorRef.current = previewSubtitleRef.current;
                        setTimeout(
                          () =>
                            refreshPromoToolbarFormats(
                              previewSubtitleRef.current,
                            ),
                          0,
                        );
                      }}
                      onFocus={() => {
                        activeEditorRef.current = previewSubtitleRef.current;
                      }}
                      onMouseUp={() => {
                        refreshPromoToolbarFormats(previewSubtitleRef.current);
                      }}
                      onInput={() => onFieldInput("subtitle")}
                      onKeyDown={onPromoPreviewKeyDown}
                      onPaste={(e) => e.preventDefault()}
                      onDrop={(e) => e.preventDefault()}
                      style={{
                        background: getBackgroundStyle(
                          getPreviewFieldBackground("subtitle"),
                        ),
                        color: config.promoCard.style.subheadingStyle.textColor,
                        textAlign:
                          config.promoCard.style.subheadingStyle.textAlign ||
                          "center",
                        caretColor: "transparent",
                        userSelect: "text",
                        WebkitUserSelect: "text",
                        cursor: "text",
                      }}
                    />
                  )}

                  {showDescriptionInPreview && (
                    <div
                      ref={previewDescriptionRef}
                      contentEditable
                      suppressContentEditableWarning
                      className={`text-base font-normal mb-2 px-2 py-1 rounded break-words cursor-pointer outline-none ${currentField === "description" ? "ring-1 ring-primary/70" : ""}`}
                      onMouseDown={() => {
                        activeEditorRef.current = previewDescriptionRef.current;
                      }}
                      onClick={() => {
                        setShowCardBgPopup(false);
                        if (currentField !== "description")
                          setCurrentField("description");
                        activeEditorRef.current = previewDescriptionRef.current;
                        setTimeout(
                          () =>
                            refreshPromoToolbarFormats(
                              previewDescriptionRef.current,
                            ),
                          0,
                        );
                      }}
                      onFocus={() => {
                        activeEditorRef.current = previewDescriptionRef.current;
                      }}
                      onMouseUp={() => {
                        refreshPromoToolbarFormats(
                          previewDescriptionRef.current,
                        );
                      }}
                      onInput={() => onFieldInput("description")}
                      onKeyDown={onPromoPreviewKeyDown}
                      onPaste={(e) => e.preventDefault()}
                      onDrop={(e) => e.preventDefault()}
                      style={{
                        background: getBackgroundStyle(
                          getPreviewFieldBackground("description"),
                        ),
                        color:
                          config.promoCard.style.descriptionStyle.textColor,
                        textAlign:
                          config.promoCard.style.descriptionStyle.textAlign ||
                          "left",
                        caretColor: "transparent",
                        userSelect: "text",
                        WebkitUserSelect: "text",
                        cursor: "text",
                      }}
                    />
                  )}

                  {showTimerInPreview && (
                    <div
                      ref={previewTimerRef}
                      contentEditable
                      suppressContentEditableWarning
                      className={`mb-4 px-2 py-1 rounded break-words cursor-pointer outline-none ${currentField === "timer" ? "ring-1 ring-primary/70" : ""}`}
                      onMouseDown={() => {
                        activeEditorRef.current = previewTimerRef.current;
                      }}
                      onClick={() => {
                        setShowCardBgPopup(false);
                        if (currentField !== "timer") setCurrentField("timer");
                        activeEditorRef.current = previewTimerRef.current;
                        setTimeout(
                          () =>
                            refreshPromoToolbarFormats(previewTimerRef.current),
                          0,
                        );
                      }}
                      onFocus={() => {
                        activeEditorRef.current = previewTimerRef.current;
                      }}
                      onMouseUp={() => {
                        refreshPromoToolbarFormats(previewTimerRef.current);
                      }}
                      onInput={() => onFieldInput("timer")}
                      onKeyDown={onPromoPreviewKeyDown}
                      onPaste={(e) => e.preventDefault()}
                      onDrop={(e) => e.preventDefault()}
                      style={{
                        background: getBackgroundStyle(
                          getPreviewFieldBackground("timer"),
                        ),
                        color: config.promoCard.style.dateStyle.textColor,
                        textAlign:
                          config.promoCard.style.dateStyle.textAlign ||
                          "center",
                        caretColor: "transparent",
                        userSelect: "text",
                        WebkitUserSelect: "text",
                        cursor: "text",
                      }}
                    />
                  )}

                  {showButtonInPreview && (
                    <div
                      className={
                        config.promoCard.buttonFullWidth
                          ? ""
                          : `flex ${
                              (config.promoCard.style.buttonStyle.textAlign ||
                                "center") === "left"
                                ? "justify-start"
                                : (config.promoCard.style.buttonStyle
                                      .textAlign || "center") === "right"
                                  ? "justify-end"
                                  : "justify-center"
                            }`
                      }
                    >
                      <div
                        ref={previewButtonRef}
                        contentEditable
                        suppressContentEditableWarning
                        data-placeholder="Button"
                        className={`promo-preview-button py-2 px-4 rounded-lg text-base font-semibold outline-none min-h-10 ${
                          config.promoCard.buttonFullWidth ? "w-full" : ""
                        } ${currentField === "button" ? "ring-1 ring-primary/70" : ""} cursor-pointer`}
                        onMouseDown={() => {
                          activeEditorRef.current = previewButtonRef.current;
                        }}
                        onClick={() => {
                          setShowCardBgPopup(false);
                          if (currentField !== "button")
                            setCurrentField("button");
                          activeEditorRef.current = previewButtonRef.current;
                          setTimeout(
                            () =>
                              refreshPromoToolbarFormats(
                                previewButtonRef.current,
                              ),
                            0,
                          );
                        }}
                        onFocus={() => {
                          activeEditorRef.current = previewButtonRef.current;
                        }}
                        onMouseUp={() => {
                          refreshPromoToolbarFormats(previewButtonRef.current);
                        }}
                        onInput={() => onFieldInput("button")}
                        onKeyDown={onPromoPreviewKeyDown}
                        onPaste={(e) => e.preventDefault()}
                        onDrop={(e) => e.preventDefault()}
                        style={{
                          background: getBackgroundStyle(
                            getPreviewFieldBackground("button"),
                          ),
                          color: config.promoCard.style.buttonStyle.textColor,
                          textAlign:
                            config.promoCard.style.buttonStyle.textAlign ||
                            "center",
                          caretColor: "transparent",
                          userSelect: "text",
                          WebkitUserSelect: "text",
                          cursor: "text",
                        }}
                      />
                    </div>
                  )}

                  {popupEditableFields.includes(currentField as PopupField) &&
                    !showCardBgPopup &&
                    (() => {
                      const field = currentField as PopupField;
                      const fieldStyle = getPopupFieldStyle(field);
                      const isButton = field === "button";
                      const fbg = fieldStyle.background;
                      const fieldAngle = directionToAngle(
                        fbg.direction || "to right",
                      );
                      const fieldAngleNormalized = normalizeAngle(fieldAngle);
                      return (
                        <div
                          className={`absolute z-30 w-[280px] bg-black/10 backdrop-blur-md border border-white/10 rounded-xl shadow-2xl p-3 ${
                            config.promoCard.style.position === "bottom-right" ||
                            config.promoCard.style.position === "top-right"
                              ? "right-full mr-3"
                              : "left-full ml-3"
                          }`}
                          style={getPopupPositionStyle(field)}
                        >
                          <button
                            type="button"
                            onMouseDown={(e) => {
                              e.preventDefault();
                              setCurrentField(null);
                            }}
                            className="absolute -top-[28px] -right-[28px] inline-flex h-7 w-7 items-center justify-center rounded-full border border-border bg-surface-elevated text-on-surface-variant shadow-sm transition-colors hover:border-primary/70 hover:bg-primary/10 hover:text-primary focus:outline-none focus:ring-2 focus:ring-primary/40"
                            aria-label="Close style controls"
                            title="Close"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                          <div className="mb-2 flex items-center justify-between gap-2">
                            <label className="text-xs font-semibold text-on-surface">
                              {getPopupFieldLabel(field)}
                            </label>
                            <div className="flex items-center gap-1">
                              <button
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  setFieldAlignment("left");
                                }}
                                className={`cursor-pointer h-9 w-9 flex items-center justify-center text-[10px] border rounded transition-colors ${(fieldStyle?.textAlign || "left") === "left" ? "bg-primary/10 text-primary border-primary/80" : "border-border hover:border-primary/70 hover:bg-primary/10 hover:text-primary text-on-surface-variant"}`}
                                title="Align Left"
                              >
                                <svg
                                  className="w-3.5 h-3.5"
                                  fill="currentColor"
                                  viewBox="0 0 20 20"
                                >
                                  <path
                                    fillRule="evenodd"
                                    d="M3 4h14v1H3V4zm0 4h10v1H3V8zm0 4h14v1H3v-1zm0 4h10v1H3v-1z"
                                    clipRule="evenodd"
                                  />
                                </svg>
                              </button>
                              <button
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  setFieldAlignment("center");
                                }}
                                className={`cursor-pointer h-9 w-9 flex items-center justify-center text-[10px] border rounded transition-colors ${(fieldStyle?.textAlign || "left") === "center" ? "bg-primary/10 text-primary border-primary/80" : "border-border hover:border-primary/70 hover:bg-primary/10 hover:text-primary text-on-surface-variant"}`}
                                title="Align Center"
                              >
                                <svg
                                  className="w-3.5 h-3.5"
                                  fill="currentColor"
                                  viewBox="0 0 20 20"
                                >
                                  <path
                                    fillRule="evenodd"
                                    d="M5 4h10v1H5V4zm2 4h6v1H7V8zm-2 4h10v1H5v-1zm2 4h6v1H7v-1z"
                                    clipRule="evenodd"
                                  />
                                </svg>
                              </button>
                              <button
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  setFieldAlignment("right");
                                }}
                                className={`cursor-pointer h-9 w-9 flex items-center justify-center text-[10px] border rounded transition-colors ${(fieldStyle?.textAlign || "left") === "right" ? "bg-primary/10 text-primary border-primary/80" : "border-border hover:border-primary/70 hover:bg-primary/10 hover:text-primary text-on-surface-variant"}`}
                                title="Align Right"
                              >
                                <svg
                                  className="w-3.5 h-3.5"
                                  fill="currentColor"
                                  viewBox="0 0 20 20"
                                >
                                  <path
                                    fillRule="evenodd"
                                    d="M7 4h10v1H7V4zm-4 4h14v1H3V8zm4 4h10v1H7v-1zm-4 4h14v1H3v-1z"
                                    clipRule="evenodd"
                                  />
                                </svg>
                              </button>
                            </div>
                          </div>

                          <RichTextToolbar
                            activeFormats={activeFormats}
                            onFormat={handlePromoToolbarFormat}
                            onColorSelect={handlePromoToolbarColor}
                            showAlignment={false}
                            showButtonWidth={isButton}
                            buttonFullWidth={
                              config.promoCard.buttonFullWidth || false
                            }
                            onButtonWidthChange={(fullWidth) =>
                              updateField("buttonFullWidth", fullWidth)
                            }
                            compact={true}
                          />

                          <div className="mt-2 pt-2 border-t border-white/10">
                            {/* Change here to reflect color updates on the selected field preview. */}
                            <label className="block text-xs text-on-surface-variant mb-1">
                              Field Background
                            </label>
                            <div className="grid grid-cols-3 gap-2">
                              <div>
                                <PopupDropdown
                                  label="Type"
                                  value={fbg.type}
                                  options={[
                                    { value: "solid", label: "Solid" },
                                    { value: "linear", label: "Linear" },
                                    { value: "radial", label: "Radial" },
                                  ]}
                                  open={showFieldBgTypeDropdown}
                                  onOpen={() => {
                                    const next = !showFieldBgTypeDropdown;
                                    closeAllPromoDropdowns();
                                    setShowFieldBgTypeDropdown(next);
                                    setFieldBgTypePos(
                                      getDropdownPosition(
                                        fieldBgTypeBtnRef.current,
                                      ),
                                    );
                                  }}
                                  onSelect={(v) => {
                                    updateFieldBg({ type: v });
                                    setShowFieldBgTypeDropdown(false);
                                  }}
                                  buttonRef={fieldBgTypeBtnRef}
                                  menuRef={fieldBgTypeMenuRef}
                                  menuPosition={fieldBgTypePos}
                                  compact={true}
                                />
                              </div>
                              <div className="col-span-2">
                                {(fbg.type === "linear" ||
                                  fbg.type === "radial") && (
                                  <>
                                    <label className="block text-xs text-on-surface-variant mb-0.5">
                                      Balance: {fbg.midpoint ?? 50}%
                                    </label>
                                    <input
                                      type="range"
                                      min="0"
                                      max="100"
                                      value={fbg.midpoint ?? 50}
                                      onChange={(e) =>
                                        updateFieldBg({
                                          midpoint: Number(e.target.value),
                                        })
                                      }
                                      className="balance-slider mt-3"
                                    />
                                  </>
                                )}
                              </div>
                            </div>
                            <div className="mt-2 min-h-[56px]">
                              {fbg.type === "solid" && (
                                <div className="grid grid-cols-3 gap-2">
                                  <div>
                                    <label className="block text-xs text-on-surface-variant mb-0.5">
                                      Background
                                    </label>
                                    <input
                                      type="color"
                                      value={fbg.startColor}
                                      onChange={(e) =>
                                        updateFieldBg({
                                          startColor: e.target.value,
                                        })
                                      }
                                      className="bg-color-picker h-9 w-full rounded cursor-pointer"
                                    />
                                  </div>
                                  <div aria-hidden="true" />
                                  <div aria-hidden="true" />
                                </div>
                              )}
                              {fbg.type === "linear" && (
                                <div className="grid grid-cols-2 gap-2">
                                  <div>
                                    <label className="block text-xs text-on-surface-variant mb-0.5">
                                      Start
                                    </label>
                                    <input
                                      type="color"
                                      value={fbg.startColor}
                                      onChange={(e) =>
                                        updateFieldBg({
                                          startColor: e.target.value,
                                        })
                                      }
                                      className="bg-color-picker h-9 w-full rounded cursor-pointer"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-xs text-on-surface-variant mb-0.5">
                                      End
                                    </label>
                                    <input
                                      type="color"
                                      value={fbg.endColor}
                                      onChange={(e) =>
                                        updateFieldBg({
                                          endColor: e.target.value,
                                        })
                                      }
                                      className="bg-color-picker h-9 w-full rounded cursor-pointer"
                                    />
                                  </div>
                                  <div className="col-span-2 mt-2 rounded-md border border-border/70 bg-surface/30 p-3">
                                    <div className="mb-1 flex items-center justify-between">
                                      <label className="block text-xs text-on-surface-variant">
                                        Gradient Direction
                                      </label>
                                      <span className="text-[11px] font-medium text-on-surface-variant">
                                        {Math.round(fieldAngleNormalized)}deg
                                      </span>
                                    </div>
                                    <div className="flex items-center justify-center">
                                      {renderGradientDirectionWheel({
                                        angle: fieldAngle,
                                        wheelRef: fieldAngleWheelRef,
                                        onAngleChange: setFieldDirectionAngle,
                                        keyPrefix: "field-wheel",
                                      })}
                                    </div>
                                  </div>
                                </div>
                              )}
                              {fbg.type === "radial" && (
                                <div className="grid grid-cols-3 gap-2">
                                  <div>
                                    <label className="block text-xs text-on-surface-variant mb-0.5">
                                      Center
                                    </label>
                                    <input
                                      type="color"
                                      value={fbg.startColor}
                                      onChange={(e) =>
                                        updateFieldBg({
                                          startColor: e.target.value,
                                        })
                                      }
                                      className="bg-color-picker h-9 w-full rounded cursor-pointer"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-xs text-on-surface-variant mb-0.5">
                                      Outer
                                    </label>
                                    <input
                                      type="color"
                                      value={fbg.endColor}
                                      onChange={(e) =>
                                        updateFieldBg({
                                          endColor: e.target.value,
                                        })
                                      }
                                      className="bg-color-picker h-9 w-full rounded cursor-pointer"
                                    />
                                  </div>
                                  <div aria-hidden="true" />
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  {showCardBgPopup && (
                    <div
                      ref={cardBgPopupRef}
                      className={`absolute z-30 w-[320px] bg-black/10 backdrop-blur-md border border-white/10 rounded-xl shadow-2xl p-3 ${
                        config.promoCard.style.position === "bottom-right" ||
                        config.promoCard.style.position === "top-right"
                          ? "right-full mr-3"
                          : "left-full ml-3"
                      }`}
                      style={(() => {
                        const card = promoCardRef.current;
                        if (!card || card.clientHeight >= 320 + 8 + 8)
                          return { top: "8px" };
                        return { bottom: "8px" };
                      })()}
                    >
                      <button
                        type="button"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          setShowCardBgPopup(false);
                        }}
                        className="absolute -top-[28px] -right-[28px] inline-flex h-7 w-7 items-center justify-center rounded-full border border-border bg-surface-elevated text-on-surface-variant shadow-sm transition-colors hover:border-primary/70 hover:bg-primary/10 hover:text-primary focus:outline-none focus:ring-2 focus:ring-primary/40"
                        aria-label="Close card background controls"
                        title="Close"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                      {/* Change here to reflect color updates on the full promo card preview. */}
                      <label className="text-xs font-semibold text-on-surface">
                        Card Background
                      </label>
                      <div className="mt-2.5 space-y-2">
                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <PopupDropdown
                              label="Type"
                              value={config.promoCard.style.background.type}
                              options={[
                                { value: "solid", label: "Solid" },
                                { value: "linear", label: "Linear" },
                                { value: "radial", label: "Gradient" },
                              ]}
                              open={showCardBgTypeDropdown}
                              onOpen={() => {
                                const next = !showCardBgTypeDropdown;
                                closeAllPromoDropdowns();
                                setShowCardBgPopup(true);
                                setShowCardBgTypeDropdown(next);
                                setCardBgTypePos(
                                  getDropdownPosition(cardBgTypeBtnRef.current),
                                );
                              }}
                              onSelect={(v) => {
                                updateCardBg({ type: v });
                                setShowCardBgTypeDropdown(false);
                              }}
                              buttonRef={cardBgTypeBtnRef}
                              menuRef={cardBgTypeMenuRef}
                              menuPosition={cardBgTypePos}
                              compact={true}
                            />
                          </div>
                          <div className="col-span-2">
                            {(config.promoCard.style.background.type ===
                              "linear" ||
                              config.promoCard.style.background.type ===
                                "radial") && (
                              <>
                                <label className="block text-xs text-on-surface-variant mb-0.5">
                                  Balance:{" "}
                                  {config.promoCard.style.background.midpoint ??
                                    50}
                                  %
                                </label>
                                <input
                                  type="range"
                                  min="0"
                                  max="100"
                                  value={
                                    config.promoCard.style.background
                                      .midpoint ?? 50
                                  }
                                  onChange={(e) =>
                                    updateCardBg({
                                      midpoint: Number(e.target.value),
                                    })
                                  }
                                  className="balance-slider mt-3"
                                />
                              </>
                            )}
                          </div>
                        </div>
                        <div className="mt-2 min-h-[56px]">
                          {config.promoCard.style.background.type ===
                            "solid" && (
                            <div className="grid grid-cols-3 gap-2">
                              <div>
                                <label className="block text-xs text-on-surface-variant mb-0.5">
                                  Background
                                </label>
                                <input
                                  type="color"
                                  value={
                                    config.promoCard.style.background.startColor
                                  }
                                  onChange={(e) =>
                                    updateCardBg({ startColor: e.target.value })
                                  }
                                  className="bg-color-picker h-9 w-full rounded cursor-pointer"
                                />
                              </div>
                              <div aria-hidden="true" />
                              <div aria-hidden="true" />
                            </div>
                          )}
                          {config.promoCard.style.background.type ===
                            "linear" && (
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="block text-xs text-on-surface-variant mb-0.5">
                                  Start
                                </label>
                                <input
                                  type="color"
                                  value={
                                    config.promoCard.style.background.startColor
                                  }
                                  onChange={(e) =>
                                    updateCardBg({ startColor: e.target.value })
                                  }
                                  className="bg-color-picker h-9 w-full rounded cursor-pointer"
                                />
                              </div>
                              <div>
                                <label className="block text-xs text-on-surface-variant mb-0.5">
                                  End
                                </label>
                                <input
                                  type="color"
                                  value={
                                    config.promoCard.style.background.endColor
                                  }
                                  onChange={(e) =>
                                    updateCardBg({ endColor: e.target.value })
                                  }
                                  className="bg-color-picker h-9 w-full rounded cursor-pointer"
                                />
                              </div>
                              <div className="col-span-2 mt-2 rounded-md border border-border/70 bg-surface/30 p-3">
                                <div className="mb-1 flex items-center justify-between">
                                  <label className="block text-xs text-on-surface-variant">
                                    Gradient Direction
                                  </label>
                                  <span className="text-[11px] font-medium text-on-surface-variant">
                                    {Math.round(cardAngleNormalized)}deg
                                  </span>
                                </div>
                                <div className="flex items-center justify-center">
                                  {renderGradientDirectionWheel({
                                    angle: cardAngle,
                                    wheelRef: cardAngleWheelRef,
                                    onAngleChange: setCardDirectionAngle,
                                    keyPrefix: "card-wheel",
                                  })}
                                </div>
                              </div>
                            </div>
                          )}
                          {config.promoCard.style.background.type ===
                            "radial" && (
                            <div className="grid grid-cols-3 gap-2">
                              <div>
                                <label className="block text-xs text-on-surface-variant mb-0.5">
                                  Center
                                </label>
                                <input
                                  type="color"
                                  value={
                                    config.promoCard.style.background.startColor
                                  }
                                  onChange={(e) =>
                                    updateCardBg({ startColor: e.target.value })
                                  }
                                  className="bg-color-picker h-9 w-full rounded cursor-pointer"
                                />
                              </div>
                              <div>
                                <label className="block text-xs text-on-surface-variant mb-0.5">
                                  Outer
                                </label>
                                <input
                                  type="color"
                                  value={
                                    config.promoCard.style.background.endColor
                                  }
                                  onChange={(e) =>
                                    updateCardBg({ endColor: e.target.value })
                                  }
                                  className="bg-color-picker h-9 w-full rounded cursor-pointer"
                                />
                              </div>
                              <div aria-hidden="true" />
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Sample Templates popup — shows the same 6 cards; click one to apply */}
      {showTemplatesPopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0"
            onClick={() => setShowTemplatesPopup(false)}
          />
          <div className="relative z-10 flex max-h-[90vh] w-[92vw] max-w-[1500px] flex-col overflow-hidden rounded-xl border border-border backdrop-blur-md shadow-2xl">
            <div className="flex items-center justify-between border-border px-6 py-2">
              <div>
                <p className="text-sm text-on-surface-variant">
                  Click a template to apply it to your promo card.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowTemplatesPopup(false)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md text-on-surface-variant transition-colors hover:bg-primary/10 hover:text-primary"
                aria-label="Close templates"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="campaign-custom-scrollbar overflow-y-auto p-6">
              <SamplePromoTemplates
                onApplyTemplate={(template, name) => {
                  applyTemplate(template, name);
                  setShowTemplatesPopup(false);
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Versions popup — save / restore / delete up to MAX_VERSIONS snapshots */}
      {showVersionsPopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0"
            onClick={() => setShowVersionsPopup(false)}
          />
          <div className="relative z-10 flex max-h-[90vh] w-[92vw] max-w-[1500px] flex-col overflow-hidden rounded-xl border border-border backdrop-blur-md shadow-2xl">
            <div className="flex items-center justify-between border-border px-6 py-2">
              <div>
                <p className="text-sm text-on-surface-variant">
                  Click a variant to apply it to your promo card ({versions.length}/
                  {MAX_VERSIONS}).
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowVersionsPopup(false)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md text-on-surface-variant transition-colors hover:bg-primary/10 hover:text-primary"
                aria-label="Close variants"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Saved versions grid (newest first) — click a card to apply */}
            <div className="campaign-custom-scrollbar overflow-y-auto p-6">
              {versions.length === 0 ? (
                <div className="p-10 text-center text-sm text-on-surface-variant">
                  No saved variants yet.
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
                  {[...versions].reverse().map((version) => {
                    const isLive = version.id === selectedVersionId;
                    return (
                      <div
                        key={version.id}
                        onClick={() => applyVersion(version)}
                        className="group relative rounded-xl border border-gray-200 hover:border-primary hover:ring-1 hover:ring-primary bg-white p-3 shadow-sm transition-colors hover:shadow-lg cursor-pointer dark:border-gray-700 dark:bg-gray-900"
                      >
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <p className="min-w-0 truncate text-xs font-semibold text-gray-800 dark:text-gray-200">
                            {version.label}
                          </p>
                          <div className="flex shrink-0 items-center gap-1">
                            {isLive ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-green-500/15 px-2 py-0.5 text-[10px] font-semibold text-green-600 dark:text-green-400">
                                <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                                Live
                              </span>
                            ) : (
                              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium dark:bg-gray-700 dark:text-gray-200">
                                Click to apply
                              </span>
                            )}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setPendingDeleteId(version.id);
                              }}
                              className="inline-flex h-6 w-6 items-center justify-center rounded-md text-gray-400 transition-colors hover:bg-red-500/10 hover:text-red-500"
                              aria-label={`Delete variant ${version.label}`}
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                        <PromoMiniPreview promoCard={version.promoCard} />

                        {pendingDeleteId === version.id && (
                          <div
                            onClick={(e) => e.stopPropagation()}
                            className="absolute inset-0 z-10 flex cursor-default flex-col items-center justify-center gap-3 rounded-xl bg-surface-elevated/95 p-4 text-center backdrop-blur-sm"
                          >
                            <p className="text-sm font-medium text-on-surface">
                              Delete “{version.label}”?
                            </p>
                            <p className="-mt-1 text-[11px] text-on-surface-variant">
                              This can’t be undone.
                            </p>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setPendingDeleteId(null);
                                }}
                                className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-on-surface-variant transition-colors hover:border-primary/70 hover:text-primary"
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteVersion(version.id);
                                }}
                                className="rounded-md bg-red-500 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-red-600"
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      <style jsx global>{`
        .promo-standard-editor,
        .promo-standard-editor * {
          color: rgb(var(--on-surface)) !important;
          font-size: 14px !important;
          font-weight: 400 !important;
          font-style: normal !important;
          letter-spacing: normal !important;
          line-height: 1.5 !important;
          text-decoration: none !important;
          text-transform: none !important;
          text-align: left !important;
          background: transparent !important;
        }
      `}</style>
    </>
  );
}
