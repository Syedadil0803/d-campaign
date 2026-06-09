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
  FONT_SIZE_MAP,
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
  buildTimerDisplayHtml,
  serializeTimerHtml,
  refreshTimerValueSpans,
  calculateTimeRemaining as calcTimerRemaining,
} from "@/lib/timerUtils";

interface PromoSectionProps {
  config: CampaignConfig;
  setConfig: (config: CampaignConfig) => void;
  markChanged: () => void;
  toast: (message: string, isError?: boolean) => void;
  onSelectedVersionChange?: (versionId: string | null) => void;
  onStopCampaign: () => Promise<void>;
}

type PromoField = "title" | "subtitle" | "description" | "timer" | "button";
const PROMO_EDITOR_DEFAULT_COLOR = "#ffffff";

// Virtual Mirror: max lines per field
const FIELD_MAX_LINES: Record<string, number> = {
  title: 1,
  subtitle: 2,
  description: 3,
};

function getPlainTextLength(html: string): number {
  return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/\u200B/g, '').trim().length;
}

// Mirror widths: min (400px card - 56px padding) to max (440px card - 56px padding)
const MIRROR_MIN_WIDTH = 344;
const MIRROR_MAX_WIDTH = 384;

/**
 * Virtual Mirror measurement.
 * Checks if html overflows at a given width against the field's max lines.
 */
function measureOverflowAtWidth(html: string, field: 'title' | 'subtitle' | 'description', width: number): boolean {
  if (!html || typeof document === 'undefined') return false;
  const plainText = html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/\u200B/g, '').trim();
  if (!plainText) return false;

  const maxLines = FIELD_MAX_LINES[field] || 1;

  const ghost = document.createElement('div');
  ghost.style.cssText = `
    position:absolute;visibility:hidden;pointer-events:none;
    width:${width}px;padding:0;
    font-family:inherit;line-height:1.5;
    word-break:break-word;overflow-wrap:break-word;
    white-space:nowrap;
  `;
  ghost.innerHTML = html;
  document.body.appendChild(ghost);
  const singleLineHeight = ghost.offsetHeight;

  ghost.style.whiteSpace = 'normal';
  const contentHeight = ghost.offsetHeight;
  document.body.removeChild(ghost);

  if (singleLineHeight === 0) return false;
  return contentHeight > singleLineHeight * maxLines;
}

/**
 * Dynamic mirror: tries min width first, then max width.
 * Returns true only if content overflows at max width (384px).
 */
function measureOverflow(html: string, field: 'title' | 'subtitle' | 'description'): boolean {
  return measureOverflowAtWidth(html, field, MIRROR_MAX_WIDTH);
}

/**
 * Returns the required card width (400–440) based on content across all fields.
 */
function getRequiredCardWidth(fields: { html: string; field: 'title' | 'subtitle' | 'description' }[]): number {
  for (const { html, field } of fields) {
    if (!html) continue;
    if (measureOverflowAtWidth(html, field, MIRROR_MIN_WIDTH)) {
      return 440;
    }
  }
  return 400;
}

function getDisabledSizes(html: string, field: 'title' | 'subtitle' | 'description'): string[] {
  if (!html || typeof document === 'undefined') return [];
  const plainText = html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/\u200B/g, '').trim();
  if (!plainText) return [];
  const sizes = ['xs', 'sm', 'md', 'lg', 'xl', 'xxl'];
  const sizeMap: Record<string, string> = {
    xs: '0.75rem', sm: '0.875rem', md: '1rem',
    lg: '1.125rem', xl: '1.25rem', xxl: '1.5rem',
  };
  const disabled: string[] = [];
  for (const size of sizes) {
    const testHtml = `<span style="font-size:${sizeMap[size]}">${plainText}</span>`;
    if (measureOverflow(testHtml, field)) disabled.push(size);
  }
  return disabled;
}

function wouldBoldOverflow(html: string, field: 'title' | 'subtitle' | 'description'): boolean {
  if (!html || typeof document === 'undefined') return false;
  const plainText = html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/\u200B/g, '').trim();
  if (!plainText) return false;
  return measureOverflow(`<b>${html}</b>`, field);
}

function wouldItalicOverflow(html: string, field: 'title' | 'subtitle' | 'description'): boolean {
  if (!html || typeof document === 'undefined') return false;
  const plainText = html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/\u200B/g, '').trim();
  if (!plainText) return false;
  return measureOverflow(`<i>${html}</i>`, field);
}

/**
 * Two-state segmented pill toggle (Off ◀ / ▶ On) with a sliding thumb.
 * Matches the status pills; replaces the old switch toggles.
 */
function SegmentedToggle({
  value,
  onChange,
  offLabel = "Off",
  onLabel = "On",
}: {
  value: boolean;
  onChange: (next: boolean) => void;
  offLabel?: string;
  onLabel?: string;
}) {
  return (
    <div className="relative flex w-[96px] items-center rounded-full border border-border bg-surface-subtle p-0.5 text-[11px] font-semibold">
      <span
        aria-hidden
        className={`absolute inset-y-0.5 left-0.5 w-[calc(50%-2px)] rounded-full shadow-sm will-change-transform transition-[transform,background-color] duration-300 ease-in-out ${
          value ? "bg-primary" : "bg-surface"
        }`}
        style={{ transform: value ? "translateX(100%)" : "translateX(0)" }}
      />
      <button
        type="button"
        onClick={() => value && onChange(false)}
        className={`relative z-10 flex-1 rounded-full py-1 text-center transition-colors ${
          !value
            ? "text-on-surface cursor-default"
            : "text-on-surface-variant hover:text-on-surface cursor-pointer"
        }`}
      >
        {offLabel}
      </button>
      <button
        type="button"
        onClick={() => !value && onChange(true)}
        className={`relative z-10 flex-1 rounded-full py-1 text-center transition-colors ${
          value
            ? "text-on-primary cursor-default"
            : "text-on-surface-variant hover:text-on-surface cursor-pointer"
        }`}
      >
        {onLabel}
      </button>
    </div>
  );
}

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
  onStopCampaign,
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
  const [styleWarning, setStyleWarning] = useState<string | null>(null);
  const styleWarningTimer = useRef<NodeJS.Timeout | null>(null);
  const configRef = useRef(config);
  configRef.current = config;
  const currentFieldRef = useRef<PromoField | null>(currentField);
  currentFieldRef.current = currentField;

  // Refs for each contenteditable editor
  const titleRef = useRef<HTMLDivElement>(null);
  const subtitleRef = useRef<HTMLDivElement>(null);
  const descRef = useRef<HTMLDivElement>(null);
  const lastValidHtmlRef = useRef<Record<string, string>>({ title: '', subtitle: '', description: '' });
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
  const [cardWidth, setCardWidth] = useState(config.promoCard.cardWidth || 400);

  const cardAngleWheelRef = useRef<HTMLDivElement>(null);
  const fieldAngleWheelRef = useRef<HTMLDivElement>(null);
  const startDatePickerRef = useRef<HTMLDivElement>(null);
  const endDatePickerRef = useRef<HTMLDivElement>(null);

  const [showCardPositionDropdown, setShowCardPositionDropdown] =
    useState(false);
  const [showCardBgTypeDropdown, setShowCardBgTypeDropdown] = useState(false);
  const [showFieldBgTypeDropdown, setShowFieldBgTypeDropdown] = useState(false);
  const [showCardBgPopup, setShowCardBgPopup] = useState(false);
  const [showPersistentScaffold, setShowPersistentScaffold] = useState(true);
  // Action popups launched from the buttons under the Promo Card heading.
  const [showTemplatesPopup, setShowTemplatesPopup] = useState(false);
  const [showVersionsPopup, setShowVersionsPopup] = useState(false);
  const [showStopConfirm, setShowStopConfirm] = useState(false);

  // Saved promo-card versions (local-only for now; see lib/promoVersions).
  const [versions, setVersions] = useState<PromoVersion[]>([]);

  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(
    null,
  );

  // Id of the variant awaiting delete confirmation (null = none).
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  const [showCountryCodeDropdown, setShowCountryCodeDropdown] = useState(false);
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
  const skipOverflowBlockRef = useRef(false);
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
      active: false,
      title: "",
      subtitle: "",
      description: "",
      buttonText: "",
      buttonUrl: "",
      showTimer: true,
      showButton: true,
      timerText: "{timer}",
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
  const lastSyncedPromoRef = useRef<string | null>(null);
  useEffect(() => {
    const sig = JSON.stringify({
      t: config.promoCard.title,
      s: config.promoCard.subtitle,
      d: config.promoCard.description,
      b: config.promoCard.buttonText,
    });
    if (sig === lastSyncedPromoRef.current) return;
    lastSyncedPromoRef.current = sig;
    if (titleRef.current)
      titleRef.current.innerHTML = config.promoCard.title || "";
    if (subtitleRef.current)
      subtitleRef.current.innerHTML = config.promoCard.subtitle || "";
    if (descRef.current)
      descRef.current.innerHTML = config.promoCard.description || "";
    if (buttonRef.current)
      buttonRef.current.innerHTML = config.promoCard.buttonText || "";
    lastValidHtmlRef.current = {
      title: config.promoCard.title || '',
      subtitle: config.promoCard.subtitle || '',
      description: config.promoCard.description || '',
    };
    setCardWidth(config.promoCard.cardWidth || getRequiredCardWidth([
      { html: config.promoCard.title || '', field: 'title' },
      { html: config.promoCard.subtitle || '', field: 'subtitle' },
      { html: config.promoCard.description || '', field: 'description' },
    ]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.promoCard.title, config.promoCard.subtitle, config.promoCard.description, config.promoCard.buttonText, config.promoCard.cardWidth]);

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
  }, [config.promoCard.buttonText, config.promoCard.showButton]);

  // Structural sync: prefix/suffix HTML + the fixed countdown chip. Numbers are
  // refreshed separately (tick effect below) so typing never resets the caret.
  useEffect(() => {
    const el = previewTimerRef.current;
    if (!el) return;
    // Never rebuild the editor the user is actively typing in — it resets caret.
    if (el === activeEditorRef.current || document.activeElement === el) return;
    const nextHtml = buildTimerDisplayHtml(
      config.promoCard.timerText ?? "",
      calcTimerRemaining(config.promoCard.endDate || ""),
    );
    if (el.innerHTML !== nextHtml) {
      el.innerHTML = nextHtml;
    }
    // showTimer is a dep so the preview repopulates when the timer is toggled
    // back on (the element unmounts/remounts empty otherwise).
  }, [
    config.promoCard.timerText,
    config.promoCard.endDate,
    config.promoCard.showTimer,
  ]);

  useEffect(() => {
    const el = timerRef.current;
    if (!el) return;
    if (el === activeEditorRef.current || document.activeElement === el) return;
    const nextHtml = buildTimerDisplayHtml(
      config.promoCard.timerText ?? "",
      calcTimerRemaining(config.promoCard.endDate || ""),
    );
    if (el.innerHTML !== nextHtml) {
      el.innerHTML = nextHtml;
    }
  }, [config.promoCard.timerText, config.promoCard.endDate, config.promoCard.showTimer]);

  // Live tick: update only the fixed chip's text in-place (no innerHTML reset,
  // so the caret and any prefix/suffix styling are preserved while editing).
  useEffect(() => {
    const value = calcTimerRemaining(config.promoCard.endDate || "");
    [timerRef.current, previewTimerRef.current].forEach((el) => {
      if (!el) return;
      // Don't write into the editor being typed in — updating the number spans
      // resets the caret to the start (typing feels jumpy). It resumes ticking
      // once focus leaves.
      if (el === activeEditorRef.current || document.activeElement === el) return;
      refreshTimerValueSpans(el, value);
    });
  }, [currentTime, config.promoCard.endDate]);

  useEffect(() => {
    // The preview popup is always shown now, so keep the field scaffold visible
    // regardless of active state — the card always shows its placeholder
    // structure instead of rendering as a bare empty white box.
    setShowPersistentScaffold(true);
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
        timerRef.current.innerHTML = buildTimerDisplayHtml(
          pc.timerText ?? "",
          calcTimerRemaining(pc.endDate || ""),
        );
      }
    }, 0);
  }

  function smartPaste(e: React.ClipboardEvent<HTMLDivElement>, field: 'title' | 'subtitle' | 'description') {
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
    let html = wrapBareTextWithFontSize(el.innerHTML);
    if (!hasVisibleContent(html)) {
      html = "";
      if (el.innerHTML !== "") el.innerHTML = "";
    }

    // Block typing if overflow (skip when format handler will handle it)
    const overflowFields: PromoField[] = ['title', 'subtitle', 'description'];
    if (!skipOverflowBlockRef.current && overflowFields.includes(field) && html && measureOverflow(html, field as 'title' | 'subtitle' | 'description')) {
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
    syncResetPromoEditsButton(nextPromoCard);
    markChanged();
    refreshPromoToolbarFormats(el);

    // Update dynamic card width
    const fields = [
      { html: nextPromoCard.title || '', field: 'title' as const },
      { html: nextPromoCard.subtitle || '', field: 'subtitle' as const },
      { html: nextPromoCard.description || '', field: 'description' as const },
    ];
    const newWidth = getRequiredCardWidth(fields);
    setCardWidth(newWidth);
    if (newWidth !== nextPromoCard.cardWidth) {
      setConfig({ ...config, promoCard: { ...nextPromoCard, cardWidth: newWidth } });
    }
  }

  // Returns true (and blocks the event) if the keystroke would delete or
  // overwrite the fixed, non-editable countdown chip. Keeps it undeletable.
  function blocksFixedTimer(e: KeyboardEvent<HTMLDivElement>): boolean {
    const el = e.currentTarget;
    const chips = el.querySelectorAll("[data-timer-fixed]");
    if (chips.length === 0) return false;
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return false;
    const range = sel.getRangeAt(0);
    const isDelete = e.key === "Backspace" || e.key === "Delete";
    const isDestructive =
      isDelete ||
      e.key === "Enter" ||
      (e.key.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey);

    // A selection that touches the chip → any destructive key would wipe it.
    if (!sel.isCollapsed) {
      if (!isDestructive) return false;
      for (const chip of Array.from(chips)) {
        if (range.intersectsNode(chip)) {
          e.preventDefault();
          return true;
        }
      }
      return false;
    }

    if (!isDelete) return false;

    // Collapsed caret directly beside the chip → block the directional delete.
    const node = range.startContainer;
    const offset = range.startOffset;
    const back = e.key === "Backspace";
    let adjacent: Node | null = null;
    if (node.nodeType === Node.TEXT_NODE) {
      const len = node.textContent?.length ?? 0;
      if (back && offset === 0) adjacent = node.previousSibling;
      else if (!back && offset === len) adjacent = node.nextSibling;
    } else {
      adjacent = back
        ? node.childNodes[offset - 1] ?? null
        : node.childNodes[offset] ?? null;
    }
    if (
      adjacent &&
      adjacent.nodeType === Node.ELEMENT_NODE &&
      (adjacent as Element).hasAttribute?.("data-timer-fixed")
    ) {
      e.preventDefault();
      return true;
    }
    return false;
  }

  function onTimerEditorKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (blocksFixedTimer(e)) return;
    onPromoEditorKeyDown(e);
  }

  function onTimerPreviewKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (blocksFixedTimer(e)) return;
    onPromoPreviewKeyDown(e);
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

  // The word/number spans inside the fixed block the selection touches.
  function selectedTimerWordSpans(editor: HTMLDivElement): HTMLElement[] {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return [];
    const words = Array.from(
      editor.querySelectorAll<HTMLElement>(
        "[data-timer-fixed] [data-timer-val], [data-timer-fixed] [data-timer-word]",
      ),
    );
    let targets = words.filter((w) => sel.containsNode(w, true));
    // Whole-block selection: style every word in any touched block.
    if (targets.length === 0) {
      targets = Array.from(
        editor.querySelectorAll<HTMLElement>("[data-timer-fixed]"),
      )
        .filter((c) => sel.containsNode(c, true))
        .flatMap((c) =>
          Array.from(
            c.querySelectorAll<HTMLElement>("[data-timer-val], [data-timer-word]"),
          ),
        );
    }
    return targets;
  }

  // Wrap the plain prefix/suffix text inside the selection (outside the block)
  // in styled spans — direct DOM, so the fixed block is never touched.
  function styleSelectedTimerText(
    editor: HTMLDivElement,
    patch: Record<string, string>,
  ): void {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return;
    const range = sel.getRangeAt(0);
    const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT, null);
    const nodes: Text[] = [];
    let tn: Text | null;
    while ((tn = walker.nextNode() as Text | null)) {
      if ((tn.parentElement as HTMLElement | null)?.closest("[data-timer-fixed]"))
        continue;
      if (range.intersectsNode(tn) && (tn.textContent || "").trim()) nodes.push(tn);
    }
    nodes.forEach((node) => {
      const span = document.createElement("span");
      Object.entries(patch).forEach(([k, v]) => {
        if (v) span.style.setProperty(k, v);
      });
      node.parentNode?.insertBefore(span, node);
      span.appendChild(node);
    });
  }

  // Apply a style patch to the selected timer word-spans (direct DOM).
  function styleSelectedTimerChips(
    editor: HTMLDivElement,
    patch: Record<string, string>,
  ): void {
    selectedTimerWordSpans(editor).forEach((el) => {
      Object.entries(patch).forEach(([k, v]) => {
        if (v === "") el.style.removeProperty(k);
        else el.style.setProperty(k, v);
      });
    });
  }

  // The currently-active TIMER editor (panel or preview) — never another field.
  function getActiveTimerEditor(): HTMLDivElement | null {
    const a = activeEditorRef.current;
    if (a === timerRef.current || a === previewTimerRef.current) return a;
    return timerRef.current ?? previewTimerRef.current;
  }

  // Clicking the timer sometimes can't land a caret (it's a non-editable chip
  // between tiny empty slots), so focus falls back to the previous field. Only
  // then force the caret into the timer (at the end). If the click already
  // landed the caret/selection ANYWHERE inside the timer (e.g. the user clicked
  // at the start to type a prefix), respect it — don't yank it to the end.
  function placeCaretInTimer(el: HTMLDivElement | null) {
    if (!el) return;
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0 && el.contains(sel.anchorNode)) {
      return;
    }
    el.focus();
    const target = el.querySelector("[data-timer-suffix]") ?? el;
    const range = document.createRange();
    range.selectNodeContents(target);
    range.collapse(false);
    const s = window.getSelection();
    s?.removeAllRanges();
    s?.addRange(range);
  }

  // Turn a toolbar format action into a CSS patch for the timer block.
  function timerFormatPatch(format: string): Record<string, string> {
    if (format.startsWith("size-")) {
      const key = format.replace("size-", "");
      return { "font-size": FONT_SIZE_MAP[key] || FONT_SIZE_MAP.md };
    }
    if (format === "bold") return { "font-weight": "bold" };
    if (format === "italic") return { "font-style": "italic" };
    return {};
  }

  // Style the whole timer selection (block words + prefix/suffix text) directly.
  // Apply a style patch to EVERY part of the timer (all word/number spans +
  // all prefix/suffix text). Used for box-level styling (no specific selection).
  function styleWholeTimer(
    editor: HTMLDivElement,
    patch: Record<string, string>,
  ): void {
    const apply = (el: HTMLElement) =>
      Object.entries(patch).forEach(([k, v]) => {
        if (v === "") el.style.removeProperty(k);
        else el.style.setProperty(k, v);
      });
    // Style the chip container(s) (so labels inherit) AND every word/number span
    // (to override any prior per-word styling so box-level is uniform).
    editor
      .querySelectorAll<HTMLElement>(
        "[data-timer-fixed], [data-timer-fixed] [data-timer-val], [data-timer-fixed] [data-timer-word]",
      )
      .forEach(apply);
    // Wrap each prefix/suffix text node (outside the chip) in a styled span.
    const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT, null);
    const nodes: Text[] = [];
    let tn: Text | null;
    while ((tn = walker.nextNode() as Text | null)) {
      if ((tn.parentElement as HTMLElement | null)?.closest("[data-timer-fixed]"))
        continue;
      if ((tn.textContent || "").trim()) nodes.push(tn);
    }
    nodes.forEach((node) => {
      const span = document.createElement("span");
      Object.entries(patch).forEach(([k, v]) => {
        if (v) span.style.setProperty(k, v);
      });
      node.parentNode?.insertBefore(span, node);
      span.appendChild(node);
    });
  }

  // Returns true when handled, so callers skip execCommand entirely.
  function applyTimerSelectionStyle(
    editor: HTMLDivElement,
    patch: Record<string, string>,
  ): boolean {
    if (!Object.keys(patch).length) return false;
    // Toolbar buttons (incl. color swatches) use mousedown+preventDefault, so the
    // live selection is preserved — no need to restore a (possibly stale) saved
    // range. Specific = a real selection inside this editor; otherwise box-level.
    const sel = window.getSelection();
    const specific =
      !!sel &&
      sel.rangeCount > 0 &&
      !sel.isCollapsed &&
      editor.contains(sel.anchorNode);

    if (specific) {
      // Style only what's selected.
      styleSelectedTimerChips(editor, patch);
      styleSelectedTimerText(editor, patch);
    } else {
      // No selection → box-level: style the whole timer (all content).
      styleWholeTimer(editor, patch);
    }

    onFieldInput("timer");
    setTimeout(() => refreshPromoToolbarFormats(editor), 0);
    return true;
  }

  function handlePromoToolbarFormat(format: string) {
    if (!currentFieldRef.current) return;
    const editor = getActivePromoEditor();
    if (!editor) return;
    pushPromoState();
    if (currentFieldRef.current === "timer") {
      const timerEl = getActiveTimerEditor();
      if (timerEl) applyTimerSelectionStyle(timerEl, timerFormatPatch(format));
      return;
    }
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
          if (styleWarningTimer.current) clearTimeout(styleWarningTimer.current);
          setStyleWarning('This style exceeds the field limit — try a smaller size or shorter text');
          styleWarningTimer.current = setTimeout(() => setStyleWarning(null), 3000);
          return;
        }
        lastValidHtmlRef.current[field] = newHtml;
      }
    };
    if (selectionIsInsideEditor(editor)) {
      // Pre-check: would this format cause overflow?
      if (overflowFields.includes(field)) {
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
          const currentHtml = wrapBareTextWithFontSize(editor.innerHTML);
          testHtml = `<b>${currentHtml}</b>`;
        } else if (format === 'italic') {
          const currentHtml = wrapBareTextWithFontSize(editor.innerHTML);
          testHtml = `<i>${currentHtml}</i>`;
        }
        if (testHtml && measureOverflow(testHtml, field as 'title' | 'subtitle' | 'description')) {
          if (styleWarningTimer.current) clearTimeout(styleWarningTimer.current);
          setStyleWarning('This style exceeds the field limit — try a smaller size or shorter text');
          styleWarningTimer.current = setTimeout(() => setStyleWarning(null), 3000);
          return;
        }
      }
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
      if (overflowFields.includes(field)) {
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
          const currentHtml = wrapBareTextWithFontSize(editor.innerHTML);
          testHtml = `<b>${currentHtml}</b>`;
        } else if (format === 'italic') {
          const currentHtml = wrapBareTextWithFontSize(editor.innerHTML);
          testHtml = `<i>${currentHtml}</i>`;
        }
        if (testHtml && measureOverflow(testHtml, field as 'title' | 'subtitle' | 'description')) {
          if (styleWarningTimer.current) clearTimeout(styleWarningTimer.current);
          setStyleWarning('This style exceeds the field limit — try a smaller size or shorter text');
          styleWarningTimer.current = setTimeout(() => setStyleWarning(null), 3000);
          return;
        }
      }
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
    const editor = getActivePromoEditor();
    if (!editor) return;
    pushPromoState();
    // Timer: ALWAYS style via direct DOM, handled FIRST so execCommand (which
    // clones the non-editable chip → duplicate) is never reached.
    if (currentFieldRef.current === "timer") {
      const timerEl = getActiveTimerEditor();
      if (timerEl) applyTimerSelectionStyle(timerEl, { color });
      setActiveFormats((prev) => ({ ...prev, color }));
      return;
    }
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
      setShowCountryCodeDropdown(false);
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

  // Campaign activation is date-driven (selecting a date activates it). The
  // control in the UI is one-way: it can only STOP a running campaign.
  function stopCampaign() {
    if (!config.promoCard.active) return;
    setShowStopConfirm(true);
  }

  async function confirmStopCampaign() {
    setShowStopConfirm(false);
    pushPromoState();
    const nextPromoCard = {
      ...config.promoCard,
      active: false,
      stoppedByUser: true,
    };
    setConfig({
      ...config,
      promoCard: nextPromoCard,
    });
    syncResetPromoEditsButton(nextPromoCard);
    await onStopCampaign();
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
    const restored = withDefaultDates({ ...clonePromoCard(version.promoCard), active: false });
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
    cloned.timerText = serializeTimerHtml(cloned.timerText ?? "");
    cloned.active = false;
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
    minDate?: string;
    maxDate?: string;
  }) {
    const {
      mode,
      value,
      viewDate,
      setViewDate,
      open,
      setOpen,
      onSelect,
      minDate,
      maxDate,
    } = params;
    const days = buildMonthDays(viewDate);
    const month = viewDate.getMonth();
    const selected = value;
    const today = toISODate(new Date());
    // A day is out of range if before minDate or after maxDate (ISO strings
    // compare correctly as YYYY-MM-DD).
    const isOutOfRange = (iso: string) =>
      (minDate && iso < minDate) || (maxDate && iso > maxDate);
    const todayDisabled = Boolean(isOutOfRange(today));
    return (
      <div
        ref={mode === "start" ? startDatePickerRef : endDatePickerRef}
        className="relative mt-2"
      >
        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            setOpen(!open);
          }}
          className="flex h-11 w-full items-center justify-between rounded-md border border-border bg-surface px-3 text-sm text-on-surface transition-colors hover:border-primary/70"
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
                const disabled = Boolean(isOutOfRange(iso));
                return (
                  <button
                    key={iso}
                    type="button"
                    disabled={disabled}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      if (disabled) return;
                      onSelect(iso);
                      setOpen(false);
                    }}
                    className={`h-8 rounded text-xs transition-colors ${
                      disabled
                        ? "text-on-surface-variant/30 cursor-not-allowed line-through"
                        : isSelected
                          ? "bg-primary text-on-primary"
                          : inMonth
                            ? "text-on-surface hover:bg-primary/10 hover:text-primary"
                            : "text-on-surface-variant/60 hover:bg-primary/5"
                    } ${isToday && !isSelected && !disabled ? "ring-1 ring-primary/40" : ""}`}
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
                disabled={todayDisabled}
                onMouseDown={(e) => {
                  e.preventDefault();
                  if (todayDisabled) return;
                  const now = new Date();
                  onSelect(toISODate(now));
                  setViewDate(new Date(now.getFullYear(), now.getMonth(), 1));
                  setOpen(false);
                }}
                className="text-xs font-medium text-primary hover:opacity-80 disabled:opacity-30 disabled:cursor-not-allowed"
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
      .replace(/[\u200B\u200C\u200D\uFEFF]/g, "")
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
  // The timer is opt-in via "Enable Timer" — it must follow the toggle only,
  // NOT the editing scaffold, so disabling it hides the countdown immediately.
  const showTimerInPreview = config.promoCard.showTimer;
  const showButtonInPreview = config.promoCard.showButton;

  return (
    <>
      <div
        className="flex gap-4 overflow-hidden"
        style={{ height: "calc(100vh - 120px)" }}
      >
        {/* Left: All editables — 30% width, scrollable */}
        <div className="campaign-custom-scrollbar w-[30%] min-h-0 shrink-0 overflow-y-auto overflow-x-hidden pr-4 space-y-5">
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
                <p className="mt-2 max-w-2xl text-sm text-on-surface-variant">
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
              className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border border-border px-3 py-2 text-sm font-medium text-on-surface-variant transition-colors hover:border-primary/70 hover:bg-primary/10 hover:text-primary"
              title="Start from a blank promo card"
            >
              <FilePlus2 className="h-4 w-4" /> Start Fresh
            </button>
            <button
              type="button"
              onClick={() => setShowVersionsPopup(true)}
              className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border border-border px-3 py-2 text-sm font-medium text-on-surface-variant transition-colors hover:border-primary/70 hover:bg-primary/10 hover:text-primary"
              title="Saved variants of this promo card"
            >
              <History className="h-4 w-4" /> Variants
            </button>
            <button
              type="button"
              onClick={() => setShowTemplatesPopup(true)}
              className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border border-border px-3 py-2 text-sm font-medium text-on-surface-variant transition-colors hover:border-primary/70 hover:bg-primary/10 hover:text-primary"
              title="Start from a ready-made sample template"
            >
              <LayoutTemplate className="h-4 w-4" /> Template Hub
            </button>
          </div>

          <div className="!mt-8">
            <h4 className="text-xs font-bold text-on-surface-variant uppercase tracking-[0.08em]">
              Content
            </h4>
            <p className="mt-2 text-sm text-on-surface-variant">
              Main promo copy shown in the card.
            </p>
          </div>

          <div className="!mt-4">
            <div className="!mt-0 flex items-center justify-between">
              <label className="block text-sm font-semibold text-on-surface mb-2">
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
              data-placeholder="Enter text here"
              suppressContentEditableWarning
              onInput={() => onFieldInput("title")}
              onFocus={() => onFieldFocus("title", titleRef)}
              onKeyDown={onPromoEditorKeyDown}
              onMouseUp={() => refreshPromoToolbarFormats(titleRef.current)}
              onKeyUp={() => refreshPromoToolbarFormats(titleRef.current)}
              onPaste={(e) => smartPaste(e, 'title')}
              className={`rich-editor promo-standard-editor block w-full rounded-md px-2 border min-h-[44px] max-h-[360px] resize-none overflow-y-auto outline-none break-words transition-colors ${
                currentField === "title" ? "border-primary/70" : "border-border"
              } focus:ring-primary/60 focus:border-primary/80 hover:border-primary/70`}
              style={{
                background: getBackgroundStyle(
                  config.promoCard.style.background,
                ),
                paddingTop: '10px',
                paddingBottom: '10px',
              }}
            />
            {(() => {
              const html = config.promoCard.title || '';
              if (!html) return null;
              const testHtml = html + 'x';
              return measureOverflow(testHtml, 'title') ? (
                <p className="mt-1.5 text-[11px] text-on-surface-variant/70 animate-pulse">⚠️ Field limit reached</p>
              ) : null;
            })()}
          </div>
          <div>
            <div className="flex items-center justify-between">
              <label className="block text-sm font-semibold text-on-surface mb-2">
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
              data-placeholder="Enter text here"
              suppressContentEditableWarning
              onInput={() => onFieldInput("subtitle")}
              onFocus={() => onFieldFocus("subtitle", subtitleRef)}
              onKeyDown={onPromoEditorKeyDown}
              onMouseUp={() => refreshPromoToolbarFormats(subtitleRef.current)}
              onKeyUp={() => refreshPromoToolbarFormats(subtitleRef.current)}
              onPaste={(e) => smartPaste(e, 'subtitle')}
              className={`rich-editor promo-standard-editor block w-full rounded-md px-2 border min-h-[44px] max-h-[360px] resize-none overflow-y-auto outline-none break-words transition-colors ${
                currentField === "subtitle"
                  ? "border-primary/70"
                  : "border-border"
              } focus:ring-primary/60 focus:border-primary/80 hover:border-primary/70`}
              style={{
                background: getBackgroundStyle(
                  config.promoCard.style.background,
                ),
                paddingTop: '10px',
                paddingBottom: '10px',
              }}
            />
            {(() => {
              const html = config.promoCard.subtitle || '';
              if (!html) return null;
              const testHtml = html + 'x';
              return measureOverflow(testHtml, 'subtitle') ? (
                <p className="mt-1.5 text-[11px] text-on-surface-variant/70 animate-pulse">⚠️ Field limit reached</p>
              ) : null;
            })()}
          </div>

          <div>
            <div className="flex items-center justify-between">
              <label className="block text-sm font-semibold text-on-surface mb-2">
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
              data-placeholder="Enter text here"
              onInput={() => onFieldInput("description")}
              onFocus={() => onFieldFocus("description", descRef)}
              onKeyDown={onPromoEditorKeyDown}
              onMouseUp={() => refreshPromoToolbarFormats(descRef.current)}
              onKeyUp={() => refreshPromoToolbarFormats(descRef.current)}
              onPaste={(e) => smartPaste(e, 'description')}
              className={`rich-editor promo-standard-editor block w-full rounded-md px-2 border min-h-[44px] max-h-[360px] resize-none overflow-y-auto outline-none break-words transition-colors ${
                currentField === "description"
                  ? "border-primary/70"
                  : "border-border"
              } focus:ring-primary/60 focus:border-primary/80 hover:border-primary/70`}
              style={{
                background: getBackgroundStyle(
                  config.promoCard.style.background,
                ),
                paddingTop: '10px',
                paddingBottom: '10px',
              }}
            />
            {(() => {
              const html = config.promoCard.description || '';
              if (!html) return null;
              const testHtml = html + 'x';
              return measureOverflow(testHtml, 'description') ? (
                <p className="mt-1.5 text-[11px] text-on-surface-variant/70 animate-pulse">⚠️ Field limit reached</p>
              ) : null;
            })()}
          </div>

          <div className="!mt-8">
            <h4 className="text-xs font-bold text-on-surface-variant uppercase tracking-[0.08em]">
              Schedule
            </h4>
            <p className="mt-2 text-sm text-on-surface-variant">
              Control when the promo card is active.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-semibold text-on-surface mb-2">
                Start Date
              </label>
              {renderDatePicker({
                mode: "start",
                value: config.promoCard.startDate,
                viewDate: startDateView,
                setViewDate: setStartDateView,
                open: showStartDatePicker,
                setOpen: setShowStartDatePicker,
                minDate: toISODate(new Date()),
                maxDate: config.promoCard.endDate || undefined,
                onSelect: (nextValue) => {
                  pushPromoState();
                  const nextPromoCard = {
                    ...config.promoCard,
                    startDate: nextValue,
                    ...(nextValue ? { showTimer: true } : {}),
                  };
                  setConfig({ ...config, promoCard: nextPromoCard });
                  syncResetPromoEditsButton(nextPromoCard);
                  markChanged();
                },
              })}
            </div>
            <div>
              <label className="block text-sm font-semibold text-on-surface mb-2">
                End Date
              </label>
              {renderDatePicker({
                mode: "end",
                value: config.promoCard.endDate,
                viewDate: endDateView,
                setViewDate: setEndDateView,
                open: showEndDatePicker,
                setOpen: setShowEndDatePicker,
                minDate:
                  config.promoCard.startDate &&
                  config.promoCard.startDate > toISODate(new Date())
                    ? config.promoCard.startDate
                    : toISODate(new Date()),
                onSelect: (nextValue) => {
                  pushPromoState();
                  const nextPromoCard = {
                    ...config.promoCard,
                    endDate: nextValue,
                    ...(nextValue ? { showTimer: true } : {}),
                  };
                  setConfig({ ...config, promoCard: nextPromoCard });
                  syncResetPromoEditsButton(nextPromoCard);
                  markChanged();
                },
              })}
            </div>
          </div>

          <div className="flex items-center justify-between">
            <label className="text-sm font-semibold text-on-surface">
              Countdown Timer
            </label>
            <SegmentedToggle
              value={config.promoCard.showTimer}
              onChange={(v) => updateField("showTimer", v)}
            />
          </div>

          {/* Timer Controls — rich text editor */}
          <div className={!config.promoCard.showTimer ? "opacity-50 pointer-events-none" : ""}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5">
                  <label className="block text-sm font-semibold text-on-surface">
                    Timer Text
                  </label>
                  <div className="relative group">
                    <div className="flex items-center justify-center w-4 h-4 rounded-full bg-on-surface-variant/25 text-[9px] font-bold text-on-surface-variant cursor-help select-none">
                      i
                    </div>
                    <div className="absolute bottom-full left-0 mb-1.5 w-52 p-2 bg-gray-900 dark:bg-gray-700 text-white text-[11px] leading-relaxed rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 pointer-events-none">
                      Type text before/after the countdown. The countdown updates automatically and can&apos;t be edited. Select text in preview to style it.
                      <div className="absolute top-full left-3 w-0 h-0 border-l-[5px] border-r-[5px] border-t-[5px] border-l-transparent border-r-transparent border-t-gray-900 dark:border-t-gray-700"></div>
                    </div>
                  </div>
                </div>
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
                onClick={() =>
                  setTimeout(() => placeCaretInTimer(timerRef.current), 0)
                }
                onKeyDown={onTimerEditorKeyDown}
                onMouseUp={() => refreshPromoToolbarFormats(timerRef.current)}
                onKeyUp={() => refreshPromoToolbarFormats(timerRef.current)}
                onPaste={(e) => {
                  e.preventDefault();
                  const text = e.clipboardData.getData('text/plain');
                  document.execCommand('insertText', false, text);
                }}
                className={`rich-editor promo-standard-editor shadow-sm focus:ring-primary/60 focus:border-primary/80 hover:border-primary/70 block w-full sm:text-sm rounded-md px-2 border outline-none break-words min-h-[48px] transition-colors ${
                  currentField === "timer"
                    ? "border-primary/70"
                    : "border-border"
                }`}
                style={{
                  background: getBackgroundStyle(
                    config.promoCard.style.background,
                  ),
                  whiteSpace: "pre-wrap",
                  paddingTop: '12px',
                  paddingBottom: '12px',
                }}
              />

          </div>

          <div className="!mt-8">
            <h4 className="text-xs font-bold text-on-surface-variant uppercase tracking-[0.08em]">
              Call To Action
            </h4>
            <p className="mt-2 text-sm text-on-surface-variant">
              Configure button text and destination.
            </p>
          </div>

          <div className="flex items-center justify-between">
            <label className="text-sm font-semibold text-on-surface">
              CTA Button
            </label>
            <SegmentedToggle
              value={config.promoCard.showButton}
              onChange={(v) => updateField("showButton", v)}
            />
          </div>

          <div className={`space-y-4 ${!config.promoCard.showButton ? "opacity-50 pointer-events-none" : ""}`}>
              {/* CTA Type Selector */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => updateField("ctaType", "whatsapp")}
                  className={`flex-1 h-9 rounded-md border text-xs font-semibold transition-colors inline-flex items-center justify-center gap-1.5 ${
                    (config.promoCard.ctaType || 'whatsapp') === 'whatsapp'
                      ? 'border-primary/80 bg-primary/10 text-primary'
                      : 'border-border text-on-surface-variant hover:border-primary/70 hover:text-primary'
                  }`}
                >
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                  </svg>
                  WhatsApp
                </button>
                <button
                  type="button"
                  onClick={() => updateField("ctaType", "link")}
                  className={`flex-1 h-9 rounded-md border text-xs font-semibold transition-colors inline-flex items-center justify-center gap-1.5 ${
                    config.promoCard.ctaType === 'link'
                      ? 'border-primary/80 bg-primary/10 text-primary'
                      : 'border-border text-on-surface-variant hover:border-primary/70 hover:text-primary'
                  }`}
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                  </svg>
                  Link
                </button>
              </div>

              {/* WhatsApp Input */}
              {(config.promoCard.ctaType || 'whatsapp') === 'whatsapp' && (
                <div>
                  <label className="block text-sm font-semibold text-on-surface mb-2">
                    WhatsApp Number
                  </label>
                  <div className="flex items-center h-[44px] rounded-md border border-border bg-surface overflow-visible transition-colors hover:border-primary/70 focus-within:border-primary/80">
                    <div className="relative h-full">
                      <button
                        type="button"
                        onClick={() => setShowCountryCodeDropdown(!showCountryCodeDropdown)}
                        className="h-full px-3 text-sm border-r border-border text-on-surface flex items-center gap-1 hover:bg-surface-subtle transition-colors"
                      >
                        <span className="text-on-surface">
                          {config.promoCard.whatsappCountryCode || '+44'}
                        </span>
                        <svg className={`h-3 w-3 text-on-surface-variant transition-transform ${showCountryCodeDropdown ? 'rotate-180' : ''}`} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M6 8l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </button>
                      {showCountryCodeDropdown && (
                        <div className="absolute bottom-full left-full ml-1 mb-0 z-50 w-[100px] max-h-[200px] overflow-y-auto rounded-xl bg-black/10 backdrop-blur-md border border-white/10 shadow-2xl p-1 campaign-custom-scrollbar">
                          {[
                            { code: '+1', flag: '🇺🇸' },
                            { code: '+7', flag: '🇷🇺' },
                            { code: '+20', flag: '🇪🇬' },
                            { code: '+27', flag: '🇿🇦' },
                            { code: '+30', flag: '🇬🇷' },
                            { code: '+31', flag: '🇳🇱' },
                            { code: '+32', flag: '🇧🇪' },
                            { code: '+33', flag: '🇫🇷' },
                            { code: '+34', flag: '🇪🇸' },
                            { code: '+36', flag: '🇭🇺' },
                            { code: '+39', flag: '🇮🇹' },
                            { code: '+40', flag: '🇷🇴' },
                            { code: '+41', flag: '🇨🇭' },
                            { code: '+43', flag: '🇦🇹' },
                            { code: '+44', flag: '🇬🇧' },
                            { code: '+45', flag: '🇩🇰' },
                            { code: '+46', flag: '🇸🇪' },
                            { code: '+47', flag: '🇳🇴' },
                            { code: '+48', flag: '🇵🇱' },
                            { code: '+49', flag: '🇩🇪' },
                            { code: '+51', flag: '🇵🇪' },
                            { code: '+52', flag: '🇲🇽' },
                            { code: '+54', flag: '🇦🇷' },
                            { code: '+55', flag: '🇧🇷' },
                            { code: '+56', flag: '🇨🇱' },
                            { code: '+57', flag: '🇨🇴' },
                            { code: '+58', flag: '🇻🇪' },
                            { code: '+60', flag: '🇲🇾' },
                            { code: '+61', flag: '🇦🇺' },
                            { code: '+62', flag: '🇮🇩' },
                            { code: '+63', flag: '🇵🇭' },
                            { code: '+64', flag: '🇳🇿' },
                            { code: '+65', flag: '🇸🇬' },
                            { code: '+66', flag: '🇹🇭' },
                            { code: '+81', flag: '🇯🇵' },
                            { code: '+82', flag: '🇰🇷' },
                            { code: '+84', flag: '🇻🇳' },
                            { code: '+86', flag: '🇨🇳' },
                            { code: '+90', flag: '🇹🇷' },
                            { code: '+91', flag: '🇮🇳' },
                            { code: '+92', flag: '🇵🇰' },
                            { code: '+93', flag: '🇦🇫' },
                            { code: '+94', flag: '🇱🇰' },
                            { code: '+95', flag: '🇲🇲' },
                            { code: '+98', flag: '🇮🇷' },
                            { code: '+212', flag: '🇲🇦' },
                            { code: '+213', flag: '🇩🇿' },
                            { code: '+234', flag: '🇳🇬' },
                            { code: '+254', flag: '🇰🇪' },
                            { code: '+351', flag: '🇵🇹' },
                            { code: '+353', flag: '🇮🇪' },
                            { code: '+358', flag: '🇫🇮' },
                            { code: '+380', flag: '🇺🇦' },
                            { code: '+852', flag: '🇭🇰' },
                            { code: '+880', flag: '🇧🇩' },
                            { code: '+886', flag: '🇹🇼' },
                            { code: '+961', flag: '🇱🇧' },
                            { code: '+962', flag: '🇯🇴' },
                            { code: '+965', flag: '🇰🇼' },
                            { code: '+966', flag: '🇸🇦' },
                            { code: '+968', flag: '🇴🇲' },
                            { code: '+971', flag: '🇦🇪' },
                            { code: '+972', flag: '🇮🇱' },
                            { code: '+973', flag: '🇧🇭' },
                            { code: '+974', flag: '🇶🇦' },
                            { code: '+977', flag: '🇳🇵' },
                          ].map(({ code, flag }) => (
                            <button
                              key={code}
                              type="button"
                              onClick={() => {
                                updateField("whatsappCountryCode", code);
                                setShowCountryCodeDropdown(false);
                              }}
                              className={`w-full text-left px-2 py-1.5 text-xs rounded-md transition-colors flex items-center gap-1.5 ${
                                (config.promoCard.whatsappCountryCode || '+44') === code
                                  ? 'bg-primary/20 text-primary font-semibold'
                                  : 'text-on-surface hover:bg-primary/10 hover:text-primary'
                              }`}
                            >
                              <span className="text-base">{flag}</span>
                              <span>{code}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <input
                      type="tel"
                      value={config.promoCard.whatsappNumber || ''}
                      onChange={(e) => updateField("whatsappNumber", e.target.value.replace(/\D/g, ''))}
                      placeholder="7911 123456"
                      inputMode="tel"
                      className="flex-1 h-full px-3 outline-none text-sm bg-transparent text-on-surface"
                      onFocus={() => setShowCountryCodeDropdown(false)}
                    />
                  </div>
                  <p className="mt-1 text-[11px] text-on-surface-variant">Select country code and enter number</p>
                </div>
              )}

              {/* Link Input */}
              {config.promoCard.ctaType === 'link' && (
                <div>
                  <label className="block text-sm font-semibold text-on-surface mb-2">
                    Destination URL
                  </label>
                  <input
                    type="url"
                    value={config.promoCard.buttonUrl}
                    onChange={(e) => updateField("buttonUrl", e.target.value)}
                    onBlur={(e) => updateField("buttonUrl", e.target.value.trim())}
                    placeholder="https://example.com/offer"
                    inputMode="url"
                    autoCapitalize="off"
                    autoCorrect="off"
                    spellCheck={false}
                    className="block w-full rounded-md p-2 border h-[44px] outline-none text-sm transition-colors border-border bg-surface text-on-surface focus:ring-primary/60 focus:border-primary/80 hover:border-primary/70"
                  />
                  <p className="mt-1 text-[11px] text-on-surface-variant">Directions, mail, website — any URL</p>
                </div>
              )}

              {/* Button Text */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-semibold text-on-surface">
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
                  onPaste={(e) => {
                    e.preventDefault();
                    const text = e.clipboardData.getData('text/plain');
                    document.execCommand('insertText', false, text);
                  }}
                  className={`rich-editor promo-standard-editor block w-full rounded-md px-2 border h-[44px] outline-none break-words transition-colors ${
                    currentField === "button"
                      ? "border-primary/70"
                      : "border-border"
                  } focus:ring-primary/60 focus:border-primary/80 hover:border-primary/70`}
                  style={{
                    background: getBackgroundStyle(
                      config.promoCard.style.buttonStyle?.background ||
                        config.promoCard.style.background,
                    ),
                    paddingTop: '10px',
                    paddingBottom: '10px',
                  }}
                />
              </div>
            </div>
        </div>

        {/* Right: Preview — 70% width, fixed */}
        <div className="flex-1 min-h-0 h-full pr-2 flex flex-col gap-4 overflow-x-hidden">
          <div className="space-y-1">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h4 className="text-xs font-bold text-on-surface-variant uppercase tracking-[0.08em]">
                  Preview
                </h4>
                <p className="mt-2 text-sm text-on-surface-variant">
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
                      Status
                    </label>
                    {/* Segmented pills with a sliding thumb. One-way: only
                        "Stopped" is actionable; activation is date-driven.
                        Stopped = left, Active = right; thumb slides right when
                        the campaign is active. */}
                    <div className="relative flex w-[136px] items-center rounded-full border border-border bg-surface-subtle p-0.5 text-[11px] font-semibold">
                      {/* sliding highlight */}
                      <span
                        aria-hidden
                        className={`absolute inset-y-0.5 left-0.5 w-[calc(50%-2px)] rounded-full shadow-sm will-change-transform transition-[transform,background-color] duration-300 ease-in-out ${
                          config.promoCard.active ? "bg-primary" : "bg-surface"
                        }`}
                        style={{
                          transform: config.promoCard.active
                            ? "translateX(100%)"
                            : "translateX(0)",
                        }}
                      />
                      <button
                        type="button"
                        onClick={stopCampaign}
                        disabled={!config.promoCard.active}
                        title={
                          config.promoCard.active
                            ? "Stop the running campaign"
                            : "Campaign is stopped"
                        }
                        className={`relative z-10 flex-1 rounded-full py-1 text-center transition-colors ${
                          !config.promoCard.active
                            ? "text-on-surface cursor-default"
                            : "text-on-surface-variant hover:text-on-surface cursor-pointer"
                        }`}
                      >
                        {config.promoCard.active ? "Stop" : "Stopped"}
                      </button>
                      <span
                        title={
                          config.promoCard.active
                            ? "Campaign is on air"
                            : "Select a start/end date to activate the campaign"
                        }
                        className={`relative z-10 flex-1 rounded-full py-1 text-center transition-colors ${
                          config.promoCard.active
                            ? "text-on-primary"
                            : "text-on-surface-variant/20"
                        }`}
                      >
                        On Air
                      </span>
                    </div>
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
              {/* Preview popup is ALWAYS rendered (even when the campaign is
                  stopped) so editing stays visible; `active` only controls the
                  live website output, not this editor preview. */}
              {(
                <div
                  ref={promoCardRef}
                  className={`relative rounded-xl shadow-2xl p-5 flex flex-col ${
                    config.promoCard.style.position === "bottom-right"
                      ? "justify-self-end self-end"
                      : config.promoCard.style.position === "bottom-left"
                        ? "justify-self-start self-end"
                        : config.promoCard.style.position === "top-right"
                          ? "justify-self-end self-start"
                          : "justify-self-start self-start"
                  }`}
                  style={{
                    width: `${cardWidth}px`,
                    maxHeight: '360px',
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
                        setTimeout(() => {
                          placeCaretInTimer(previewTimerRef.current);
                          refreshPromoToolbarFormats(previewTimerRef.current);
                        }, 0);
                      }}
                      onFocus={() => {
                        activeEditorRef.current = previewTimerRef.current;
                      }}
                      onMouseUp={() => {
                        refreshPromoToolbarFormats(previewTimerRef.current);
                      }}
                      onInput={() => onFieldInput("timer")}
                      onKeyDown={onTimerPreviewKeyDown}
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
                        // No blinking caret (users shouldn't feel they can type
                        // here), but selection highlight still works for styling.
                        caretColor: "transparent",
                        userSelect: "text",
                        WebkitUserSelect: "text",
                        cursor: "text",
                        whiteSpace: "pre-wrap",
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
                              ? "right-full mr-10"
                              : "left-full ml-10"
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

                          {styleWarning && (
                            <>
                              <div className="fixed inset-0 z-[99] bg-black/40" onClick={() => setStyleWarning(null)} />
                              <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[100] bg-black/70 backdrop-blur-xl border border-white/15 rounded-2xl shadow-2xl px-8 py-6 w-[420px] text-center">
                                <button
                                  onClick={() => setStyleWarning(null)}
                                  className="absolute top-3 right-4 text-white/50 hover:text-white text-lg"
                                >
                                  ✕
                                </button>
                                <p className="text-2xl mb-3">⚠️</p>
                                <p className="text-sm text-on-surface font-medium leading-relaxed">{styleWarning}</p>
                              </div>
                            </>
                          )}

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
                          ? "right-full mr-10"
                          : "left-full ml-10"
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

      {/* Stop Campaign Confirmation */}
      {showStopConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0" onClick={() => setShowStopConfirm(false)} />
          <div className="relative z-10 w-full max-w-md rounded-xl border border-white/10 bg-black/10 p-5 text-on-surface shadow-2xl backdrop-blur-md">
            <h2 className="text-base font-semibold">Stop this campaign?</h2>
            <p className="mt-2 text-sm text-on-surface-variant">
              Your promo card will be removed from the website. Whenever you&apos;re ready to launch again, just set up a new card and hit publish &mdash; easy as that.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowStopConfirm(false)}
                className="rounded-md border border-white/10 bg-transparent px-4 py-2 text-sm font-medium text-on-surface-variant transition-colors hover:border-primary/70 hover:text-primary"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmStopCampaign}
                className="rounded-md bg-red-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-opacity hover:bg-red-600"
              >
                Stop Campaign
              </button>
            </div>
          </div>
        </div>
      )}

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
        /* Per-side "Enter text here" placeholders around the fixed countdown.
           Scoped to the panel editor only — never shown in the live preview.
           inline-block so the empty slot is a focusable box (caret can land at
           the very start, before the countdown). */
        [data-timer-prefix],
        [data-timer-suffix] {
          display: inline-block;
          vertical-align: baseline;
          min-width: 1px;
        }
        .promo-standard-editor [data-timer-prefix]:empty::before {
          content: "Enter text here ";
          color: #dbc1b2;
          opacity: 0.6;
          pointer-events: none;
          user-select: none;
        }
        .promo-standard-editor [data-timer-suffix]:empty::after {
          content: " Enter text here";
          color: #dbc1b2;
          opacity: 0.6;
          pointer-events: none;
          user-select: none;
        }
        /* Dim the fixed (non-editable) countdown in the INPUT BOX only, so it
           reads as locked. Preview is untouched (real styling shown there). */
        .promo-standard-editor [data-timer-fixed] {
          opacity: 0.55;
        }
      `}</style>
    </>
  );
}
