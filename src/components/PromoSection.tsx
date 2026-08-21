"use client";

import {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
  type RefObject,
  type Dispatch,
  type SetStateAction,
  type KeyboardEvent,
} from "react";
import {
  ArrowLeft,
  RotateCcw,
  Gift,
  X,
  Palette,
  History,
  FilePlus2,
  FileClock,
  Sparkles,
  LayoutTemplate,
  Power,
  CalendarDays,
  Save,
  Loader2,
  Radio,
} from "lucide-react";
import { CampaignConfig, PromoCard, defaultConfig } from "@/types/campaign";
import { getBackgroundStyle } from "@/lib/utils";
import { applyTemplateFull, applyTemplateLook, BLANK_LOOK } from "@/lib/promoTemplate";
import {
  lookSignature,
  ourLooks,
  cardIsBlank,
  cardIsUntouchedTemplate,
} from "@/lib/promoAuthorship";
import { UndoStack } from "@/lib/undoStack";
import { SamplePromoTemplates, sampleTemplates } from "./SamplePromoTemplates";
import { useRichTextEditor } from "@/hooks/useRichTextEditor";
import { useSignalEffect } from "@/hooks/useSignalEffect";
import {
  wrapBareTextWithFontSize,
  rgbToHex,
  FONT_SIZE_LABEL_MAP,
  FONT_SIZE_MAP,
  fontSizeToLabel,
} from "@/lib/richTextUtils";
import RichTextToolbar from "./RichTextToolbar";
import { PopupDropdown } from "./PopupDropdown";
import { CountryFlag, COUNTRY_CODES } from "./CountryFlag";
import { whatsAppUrl, whatsAppLooksShort, maxNationalDigits } from "@/lib/whatsapp";
import { PromoMiniPreview } from "./PromoMiniPreview";
import {
  listVersions,
  deleteVersion,
  restoreVersion,
  MAX_VERSIONS,
  type PromoVersion,
} from "@/lib/promoVersions";
import {
  buildTimerDisplayHtml,
  serializeTimerHtml,
  refreshTimerValueSpans,
  calculateTimeRemaining as calcTimerRemaining,
} from "@/lib/timerUtils";
import { LexicalTimerField, type LexicalTimerFieldHandle } from "@/components/timer-lexical/LexicalTimerField";
import {
  TIMER_MIN_CONTENT_WIDTH,
  TIMER_MAX_CONTENT_WIDTH,
} from "@/components/timer-lexical/lineMeasure";

interface PromoSectionProps {
  config: CampaignConfig;
  // Accepts a value OR a functional updater (React useState setter). The
  // functional form matters where two setConfig calls fire in one batch (timer
  // onChange + onStateJson) and must merge instead of clobber via a stale closure.
  setConfig: (config: CampaignConfig | ((prev: CampaignConfig) => CampaignConfig)) => void;
  markChanged: () => void;
  toast: (
    message: string,
    isError?: boolean,
    action?: { label: string; onClick: () => void },
    durationMs?: number,
  ) => void;
  onSelectedVersionChange?: (versionId: string | null) => void;
  /**
   * Bumped once the real card arrives from the DB. The editor mounts on
   * defaultConfig, so anything seeded from the card at mount time (the Themes
   * revert point) has to be re-seeded when the actual card lands.
   */
  configLoadedSignal?: number;
  // "Go on air" is a one-click reactivation, only when the current content
  // matches what's published (same content, not new/edited).
  canReactivate: boolean;
  /**
   * The promo card currently PUBLISHED to the website.
   *
   * "Live" in My Published is a fact about the site, not about the editor —
   * it was previously derived from whichever variant matched the canvas, so
   * editing anything made the Live marker vanish from a campaign that was
   * still serving to visitors.
   */
  livePromoCard?: PromoCard;
  /**
   * The promo card as saved in My Draft.
   *
   * Compared field-by-field rather than trusting `draftUpToDate`, which is a
   * whole-config signature and drifts on HTML the app re-normalises itself.
   */
  draftPromoCard?: PromoCard | null;
  /** A different card just landed on the canvas (template, variant, fresh). */
  /** A different card landed on the canvas. */
  onCardReplaced?: () => void;
  /** The user has actually edited the countdown — they know where it lives. */
  onTimerEdited?: () => void;
  /**
   * The timer just switched itself on because a schedule was entered. Lets the
   * flow point at the countdown, which has only now appeared and is the one
   * field edited on the card rather than on the left.
   */
  onTimerAutoEnabled?: () => void;
  /**
   * "The canvas was cleared and nothing has been chosen since" — owned above
   * this component.
   *
   * It lived here as local state until switching tabs unmounted the editor and
   * took it with it: coming back, a cleared card lost its countdown and button
   * outlines and appeared to shrink. The flag describes the card, which
   * outlives this component, so it belongs where the card does.
   */
  blankStart: boolean;
  onBlankStartChange: (value: boolean) => void;
  /**
   * May the countdown switch itself on once the schedule is complete?
   *
   * Separate from `blankStart` because the two answer different questions.
   * Clearing the canvas leaves the end date missing, so filling it in later is
   * the user supplying the one fact the countdown needs — switching it on
   * there is a convenience. Create new asks for both dates up front, before
   * the card has been seen, so the same rule would decide for them.
   *
   * Both flows produce a blank card, which is why one flag cannot serve both.
   */
  timerAutoArmed: boolean;
  onTimerAutoArmedChange: (value: boolean) => void;
  // Immediate on/off (no Save → Publish) — the page persists the status change.
  onStop: () => void;
  onGoOnAir: () => void;
  // Bumped by the page when the user attempts to save/publish while the date
  // range is invalid — triggers the scroll-to + flash fallback guard.
  dateErrorPing?: number;
  // True when there are unsaved edits or a saved-but-unpublished draft. Drives
  // whether card-replacing actions (Start Fresh / Variant / Template) ask for
  // consent — we only warn when there's pending work that would be lost.
  hasUnsavedChanges: boolean;
  // Which top-level tab is active, and how to switch — used by the tab strip
  // above the preview.
  activeTab?: 'dashboard' | 'announcement' | 'promo';
  setActiveTab?: (tab: 'dashboard' | 'announcement' | 'promo') => void;
  // Explicit "Save as draft" — the only way a draft is written now. Saves the
  // FULL editor state (announcement + promo), not just this promo card.
  /**
   * Increment to open Template Hub from outside — used by the build panel's
   * "Write it myself", so a new card is designed in the same picker as every
   * other template change.
   */
  openTemplatesSignal?: number;
  /** Returns to the build panel from the templates popup, when it opened it. */
  onTemplatesBack?: () => void;
  /**
   * A picker to open as soon as the editor is on screen, from the dashboard.
   *
   * An intent rather than a counter: the dashboard sets it in the same batch
   * that switches tabs, so this component MOUNTS with the request already
   * pending. A counter can't say "act now" across a mount — on first render
   * there's no previous value to have incremented from.
   */
  pendingPopup?: 'published' | 'draft' | null;
  /** Called once the pending popup has been opened, so it fires only once. */
  onPendingPopupHandled?: () => void;
  onSaveDraft: () => void;
  /** Saves the draft immediately, skipping the replace-confirm dialog. */
  onSaveDraftDirect?: () => void;
  savingDraft: boolean;
  // Deletes the single saved draft slot (called from the My Draft popup).
  onDeleteDraft: () => void;
  /** Editor content already matches the stored draft — nothing new to save. */
  draftUpToDate: boolean;
  /** A draft is already stored, so saving overwrites it rather than creating one. */
  draftExists: boolean;
  /** Takes the live card off the site AND clears it from the published config. */
  onRemoveLive: () => void;
  /** Opens the AI step for the card being edited. Omitted = chip not shown. */
  onUseAi?: () => void;
}

type PromoField = "title" | "subtitle" | "description" | "timer" | "button";

/**
 * Split stored timer text into prefix/suffix plain-text parts for the panel
 * inputs. Storage is `"prefix{timer}suffix"` (or a rendered chip span); we
 * strip any markup so the panel never echoes inline styles back into the
 * inputs.
 */
function splitTimerStorageText(stored: string): { prefix: string; suffix: string } {
  if (!stored) return { prefix: '', suffix: '' };
  const stripTags = (s: string) =>
    s
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>');
  const TOKEN = '{timer}';
  if (stored.includes(TOKEN)) {
    const i = stored.indexOf(TOKEN);
    return {
      prefix: stripTags(stored.slice(0, i)),
      suffix: stripTags(stored.slice(i + TOKEN.length)),
    };
  }
  const chipMatch = stored.match(
    /^([\s\S]*?)<span\b[^>]*\bdata-timer-fixed\b[\s\S]*?<\/span>([\s\S]*)$/,
  );
  if (chipMatch) {
    return { prefix: stripTags(chipMatch[1]), suffix: stripTags(chipMatch[2]) };
  }
  return { prefix: stripTags(stored), suffix: '' };
}
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
    font-family:inherit;line-height:1.5;letter-spacing:normal;
    word-break:break-word;overflow-wrap:break-word;
    white-space:nowrap;
  `;
  ghost.innerHTML = html;
  // Letter-spacing is not a supported concept and the live preview strips it
  // (.promo-live-preview reset). Old configs still carry inline letter-spacing,
  // which would make this ghost measure WIDER than the text actually renders —
  // reading the field as "full" with visible room left. Neutralize it so the
  // check matches what the user sees.
  ghost.querySelectorAll('*').forEach((el) => {
    (el as HTMLElement).style.letterSpacing = 'normal';
  });
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
/**
 * Does the countdown line exceed the card's content width?
 *
 * It needs its own measurement because it renders `white-space: pre` — the
 * numbers must never break mid-chip — so the usual test, "does this need a
 * second line?", answers no however long it grows. It simply runs off the
 * edge instead, which is what "Private window closes in 3 days : 5 hours :
 * 7 mins" does at 400px.
 */
function timerOverflowsAtWidth(html: string, width: number): boolean {
  if (!html || typeof document === 'undefined') return false;
  const plain = html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/\u200B/g, '').trim();
  if (!plain) return false;

  const ghost = document.createElement('div');
  ghost.style.cssText = `
    position:absolute;visibility:hidden;pointer-events:none;
    white-space:pre;padding:0;
    font-family:inherit;line-height:1.5;letter-spacing:normal;
  `;
  ghost.innerHTML = html;
  // Same reason as the wrapping measurement: old configs carry inline
  // letter-spacing the live preview strips, which would measure too wide.
  ghost.querySelectorAll('*').forEach((el) => {
    (el as HTMLElement).style.letterSpacing = 'normal';
  });
  document.body.appendChild(ghost);
  const lineWidth = ghost.offsetWidth;
  document.body.removeChild(ghost);

  return lineWidth > width;
}

function getRequiredCardWidth(
  fields: { html: string; field: 'title' | 'subtitle' | 'description' }[],
  timerHtml = '',
): number {
  for (const { html, field } of fields) {
    if (!html) continue;
    if (measureOverflowAtWidth(html, field, MIRROR_MIN_WIDTH)) {
      return 440;
    }
  }
  // The countdown was never measured, so a card whose only long line was the
  // timer stayed at 400 and let it run off the edge. Templates with wordy
  // timer text — "Private window closes in", "Countdown to midnight:" — were
  // broken from the moment they were applied; switching between templates hid
  // it, because a previous long title had already pushed the card to 440.
  if (timerHtml && timerOverflowsAtWidth(timerHtml, MIRROR_MIN_WIDTH)) {
    return 440;
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
  configLoadedSignal,
  canReactivate,
  livePromoCard,
  draftPromoCard,
  onCardReplaced,
  onTimerEdited,
  onTimerAutoEnabled,
  blankStart,
  onBlankStartChange,
  timerAutoArmed,
  onTimerAutoArmedChange,
  onStop,
  onGoOnAir,
  dateErrorPing,
  hasUnsavedChanges,
  activeTab,
  setActiveTab,
  openTemplatesSignal,
  onTemplatesBack,
  pendingPopup,
  onPendingPopupHandled,
  onSaveDraft,
  onSaveDraftDirect,
  savingDraft,
  onDeleteDraft,
  draftUpToDate,
  draftExists,
  onRemoveLive,
  onUseAi,
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
  /**
   * Live copies of the stored cards, so checks running inside dialog handlers
   * see the current values rather than the scope the handler was born in.
   */
  const livePromoCardRef = useRef<PromoCard | null | undefined>(livePromoCard);
  livePromoCardRef.current = livePromoCard;
  const draftPromoCardRef = useRef<PromoCard | null | undefined>(draftPromoCard);
  draftPromoCardRef.current = draftPromoCard;

  /**
   * Whether the user's own swatch was in the themes row on the previous
   * render, so the notice fires the moment it appears.
   *
   * Seeded at mount rather than false: arriving on the tab with the swatch
   * already there is not it appearing, and announcing it then greeted every
   * visit to the Promo tab with the same message.
   */
  const ownSwatchWasVisibleRef = useRef<boolean | null>(null);

  /** Measured height of the field style panel, for keeping it in the canvas. */
  const fieldPopupHeightRef = useRef(0);

  /**
   * When the user last did something — a pointer press or a key.
   *
   * Focus alone does not mean intent. The browser restores focus to whatever
   * held it when a native dialog closes, so dismissing the "Leave site?" prompt
   * put the cursor back in the title and opened its style panel, as though the
   * user had clicked into it. A real click or Tab always has an interaction
   * immediately before the focus; a restored one has none.
   */
  const lastInteractionAtRef = useRef(0);

  useEffect(() => {
    const mark = () => {
      lastInteractionAtRef.current = Date.now();
    };
    document.addEventListener('pointerdown', mark, true);
    document.addEventListener('keydown', mark, true);
    return () => {
      document.removeEventListener('pointerdown', mark, true);
      document.removeEventListener('keydown', mark, true);
    };
  }, []);

  const [currentField, setCurrentField] = useState<PromoField | null>(null);
  /**
   * Which control opened the style popup, so it can appear beside whatever was
   * clicked. Opening it from the style icon next to an input on the left, then
   * having the panel appear across the canvas next to the card, meant looking
   * away from the thing just clicked.
   */
  const [stylePopupAnchor, setStylePopupAnchor] = useState<"card" | "input">("card");
  const [styleWarning, setStyleWarning] = useState<string | null>(null);
  const styleWarningTimer = useRef<NodeJS.Timeout | null>(null);
  const [fieldInfoPopup, setFieldInfoPopup] = useState<'title' | 'subtitle' | 'description' | null>(null);
  const [hiddenFieldInfos, setHiddenFieldInfos] = useState<Set<string>>(() => {
    if (typeof window === 'undefined') return new Set();
    const stored = localStorage.getItem('hidden-field-infos');
    return stored ? new Set(JSON.parse(stored)) : new Set();
  });
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
  // Imperative handle on the Lexical timer editor used by the panel side.
  // The legacy toolbar (handlePromoToolbarFormat/Color, refreshPromoToolbarFormats)
  // routes timer-field actions through this ref instead of the old DOM helpers.
  const lexicalTimerRef = useRef<LexicalTimerFieldHandle | null>(null);
  // 1-line guard for the timer: the rendered editor wrapper (to measure) +
  // the last state that fit on one line (to revert to). Mirrors the
  // lastValidHtmlRef pattern used by the title/subtitle/description fields.
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
  // Auto-fit: scale the preview card down so a tall card (or a short/zoomed
  // window) always shows the FULL card in the frame — never clipped or scrolled.
  const [previewZoom, setPreviewZoom] = useState(1);
  const previewZoomRef = useRef(1);
  useEffect(() => { previewZoomRef.current = previewZoom; }, [previewZoom]);
  useEffect(() => {
    const card = promoCardRef.current;
    const frame = card?.closest('.campaign-card-surface') as HTMLElement | null;
    if (!card || !frame) return;
    let raf = 0;
    const measure = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const applied = previewZoomRef.current || 1;
        // getBoundingClientRect reflects the applied zoom; divide it out to get
        // the card's natural (un-zoomed) height.
        const natural = card.getBoundingClientRect().height / applied;
        const avail = frame.clientHeight - 40; // frame padding (p-5 = 20px each)
        let z = 1;
        if (avail > 0 && natural > avail) z = Math.max(0.5, avail / natural);
        z = Math.round(z * 1000) / 1000;
        setPreviewZoom((prev) => (Math.abs(prev - z) > 0.005 ? z : prev));
      });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(frame);
    // Observe an ancestor too so a window/zoom change that resizes the layout
    // (but not the frame's own box synchronously) still triggers a re-fit.
    const outer = frame.parentElement;
    if (outer) ro.observe(outer);
    window.addEventListener('resize', measure);
    // visualViewport fires on browser zoom (Cmd +/-), which a plain resize
    // listener can miss — this is the case that left the card overflowing.
    const vv = window.visualViewport;
    if (vv) vv.addEventListener('resize', measure);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', measure);
      if (vv) vv.removeEventListener('resize', measure);
      cancelAnimationFrame(raf);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.promoCard, cardWidth]);

  const cardAngleWheelRef = useRef<HTMLDivElement>(null);
  const fieldAngleWheelRef = useRef<HTMLDivElement>(null);
  const startDatePickerRef = useRef<HTMLDivElement>(null);
  const endDatePickerRef = useRef<HTMLDivElement>(null);
  // End Date field wrapper — the fallback guard scrolls here and flashes its
  // inline error if the user tries to save with an invalid range.
  const endDateFieldRef = useRef<HTMLDivElement>(null);
  const [dateErrorFlash, setDateErrorFlash] = useState(false);
  // Consent before a card-replacing action (Start Fresh / apply Variant / apply Template).
  const [cardActionConfirm, setCardActionConfirm] = useState<{
    title: string;
    // ReactNode, not string: names of places in the UI ("My Published") are
    // emphasised inline so they read as things you can go and open.
    body: React.ReactNode;
    confirmLabel: string;
    onConfirm: () => void;
    /**
     * Optional third button, for actions where keeping a copy is worth
     * offering but must never be imposed — Clear Canvas being the case: the
     * user asked to destroy the card, so saving is an offer, not a condition.
     */
    secondaryLabel?: string;
    onSecondary?: () => void;
  } | null>(null);

  const [showCardPositionDropdown, setShowCardPositionDropdown] =
    useState(false);
  const [showCardBgTypeDropdown, setShowCardBgTypeDropdown] = useState(false);
  const [showFieldBgTypeDropdown, setShowFieldBgTypeDropdown] = useState(false);
  const [showCardBgPopup, setShowCardBgPopup] = useState(false);
  /**
   * Where the panel's top edge sits, decided once when it opens.
   *
   * Recomputing it as the panel resizes moves the heading under the user's
   * cursor: switching Type between Solid and a gradient adds or removes
   * controls, and an edge that follows the content makes the whole panel jump.
   * Fixed at open, the panel grows and shrinks downward from a stationary
   * heading.
   */
  const [cardBgPopupTop, setCardBgPopupTop] = useState<number | null>(null);
  const [showPersistentScaffold, setShowPersistentScaffold] = useState(true);
  /**
   * Renaming only: the flag itself is a prop now (see the interface above).
   *
   * Revealing the fields one at a time as they were filled was tried and
   * dropped — it left the user unable to see the shape of the card they were
   * building. What it still governs is the schedule: a cleared card has no end
   * date, so the countdown stays off until the user sets one.
   */
  const setBlankStart = onBlankStartChange;
  // Action popups launched from the buttons under the Promo Card heading.
  const [showVersionsPopup, setShowVersionsPopup] = useState(false);
  const [showTemplatesPopup, setShowTemplatesPopup] = useState(false);
  /**
   * The design to return to, shown as the first chip in the Themes strip.
   *
   * It follows every look you CHOOSE — a template, a variant, the saved draft,
   * a fresh card, an AI palette, or colors you pick by hand — and ignores only
   * the theme chips. So it always means "the design that's mine", and the
   * swatch only ever undoes theme browsing.
   *
   * It used to be re-seeded by hand at each of five places a card could land,
   * which had two consequences: applying an AI palette wasn't one of them, so
   * the swatch pointed at the look from before the AI and quietly undid it; and
   * colors picked by hand were never recorded, so one click on the swatch threw
   * them away — while its tooltip promised it only undid themes. One rule, fed
   * by the style itself, can't miss a route the way a list of call sites can.
   */
  const [themeBaseline, setThemeBaseline] = useState<PromoCard['style']>(
    () => config.promoCard.style,
  );

  /**
   * Set for the one action that must NOT move the baseline: sampling a theme.
   * The revert swatch sets it too — landing back on your own design shouldn't
   * re-record it.
   */
  const samplingThemeRef = useRef(false);


  useEffect(() => {
    if (samplingThemeRef.current) {
      samplingThemeRef.current = false;
      return;
    }
    setThemeBaseline(config.promoCard.style);
  }, [config.promoCard.style]);

  /**
   * True when the card is wearing the design you chose rather than a theme you
   * are trying. It decides which single swatch in the Themes strip is marked.
   */
  const onOwnDesign =
    JSON.stringify(themeBaseline) === JSON.stringify(config.promoCard.style);

  /**
   * The editor mounts on defaultConfig and the real card arrives a moment
   * later, so the seed above captures the DEFAULT template's look — the revert
   * chip then showed a design the user never chose, and lit up as "current".
   * Re-seed from the card that actually loaded.
   */
  useSignalEffect(configLoadedSignal, () => {
    setThemeBaseline(configRef.current.promoCard.style);
  });

  /**
   * True when the popup was opened by the build panel rather than the toolbar
   * chip — that's the only case with somewhere to go Back to.
   */
  const [templatesFromBuild, setTemplatesFromBuild] = useState(false);

  // Opened from outside (the build panel's "Write it myself"). Guarded on > 0
  // so the initial render doesn't pop it open on its own.
  useSignalEffect(openTemplatesSignal, () => {
    setTemplatesFromBuild(true);
    setShowTemplatesPopup(true);
  });

  // The dashboard's "My Published" / "My Draft" entries land in the editor and
  // open the matching picker, so the choice of WHICH card is made here — in
  // front of the canvas it will load onto.
  useEffect(() => {
    if (!pendingPopup) return;
    if (pendingPopup === 'published') setShowVersionsPopup(true);
    else openDraftPopup();
    onPendingPopupHandled?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingPopup]);
  const [showDraftPopup, setShowDraftPopup] = useState(false);
  const [draftPopupCard, setDraftPopupCard] = useState<PromoCard | null>(null);
  const [draftPopupLoading, setDraftPopupLoading] = useState(false);
  const [confirmDeleteDraft, setConfirmDeleteDraft] = useState(false);
  const [showStopConfirm, setShowStopConfirm] = useState(false);
  const [showGoOnAirConfirm, setShowGoOnAirConfirm] = useState(false);
  // Paste-from-AI import: modal open, textarea contents, and last parse error.

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
  /** Wraps the country button + its menu, so outside-clicks can be told apart. */
  const countryCodeBtnRef = useRef<HTMLButtonElement>(null);
  const countryCodeMenuRef = useRef<HTMLDivElement>(null);
  const [countryCodePos, setCountryCodePos] = useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);
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

  /**
   * Multi-step history for the promo editor.
   *
   * HistoryManager (still used by the announcement bar) keeps a single previous
   * state, so it can swap once but can't walk back through a session. The promo
   * needs ~30 actions of depth, so it gets a real stack.
   */
  const promoHistory = useRef(new UndoStack<PromoSnapshot>()).current;
  const restoringSnapshotRef = useRef(false);
  const skipOverflowBlockRef = useRef(false);
  const promoDeletingRef = useRef(false);
  const promoAppliedCardBaselineRef = useRef<PromoSnapshot | null>(null);
  const promoAppliedRedoRef = useRef<PromoAppliedRedoSnapshot | null>(null);
  // True while the current card is a Start-Fresh card. Leaving a fresh card,
  // undo should land on its EDITED state; leaving a template/variant, undo
  // should land on that card's CLEAN baseline (not the edited state).
  const isFreshCardRef = useRef(false);

  function clonePromoCard(card: PromoCard): PromoCard {
    return JSON.parse(JSON.stringify(card)) as PromoCard;
  }

  function promoCardsEqual(a: PromoCard, b: PromoCard): boolean {
    return JSON.stringify(a) === JSON.stringify(b);
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
  const TEMPLATE_CARDS = sampleTemplates.map((t) => t.promoCard as PromoCard);
  const OUR_LOOKS = ourLooks(TEMPLATE_CARDS);


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
      cardIsUntouchedTemplate(card, TEMPLATE_CARDS)
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
  function getFreshPromoCard(): PromoCard {
    return {
      ...clonePromoCard(defaultConfig.promoCard),
      // No design either. Keeping the default gradient meant "clear" cleared
      // the words and left a look nobody had chosen, which then had to be
      // undone before any other could be picked.
      style: JSON.parse(JSON.stringify(BLANK_LOOK)) as PromoCard["style"],
      active: false,
      title: "",
      subtitle: "",
      description: "",
      buttonText: "",
      buttonUrl: "",
      /**
       * Both switches off, not just hidden.
       *
       * A countdown with no dates behind it is a number nobody can act on,
       * and a CTA with no words on it is a coloured bar. Leaving the toggles
       * on and suppressing the output would have made the panel disagree with
       * the card — the switch saying the card has a button while the card
       * shows none. Off is the honest state, and turning either on is then a
       * decision the user makes rather than one they have to undo.
       */
      showTimer: false,
      showButton: false,
      /**
       * Starts today, ends whenever the user decides.
       *
       * "From today" is the safe assumption — a campaign being built now is
       * one meant to run now — while the end is a real decision nobody can
       * make on the user's behalf. Leaving it blank is also what keeps the
       * countdown off: it switches on once the schedule is complete, so the
       * end date is both the missing fact and the trigger.
       */
      startDate: getISODateWithOffset(0),
      endDate: "",
      timerText: "Ends In {timer}",
    };
  }

  function startFreshPromoCard(options: { silent?: boolean } = {}) {
    // Not withDefaultDates: that fills today/tomorrow into any card missing a
    // schedule, which put the dates straight back the moment they were
    // cleared — and a complete schedule is exactly what switches the countdown
    // on. Clearing has to leave them empty for the user to set.
    const freshCard = getFreshPromoCard();
    // If the card is already fresh, do nothing — no toast, no "unsaved changes"
    // flip. "Already fresh" = no visible text in any field AND the style matches
    // the fresh style. We deliberately ignore dates, live flags, and the exact
    // timerText serialization (which can drift across re-renders) so a repeated
    // Start Fresh on a blank card is reliably a no-op.
    const cur = configRef.current.promoCard;
    const curIsBlank =
      !hasVisibleContent(cur.title) &&
      !hasVisibleContent(cur.subtitle) &&
      !hasVisibleContent(cur.description) &&
      !hasVisibleContent(cur.buttonText);
    const styleMatchesFresh =
      JSON.stringify(cur.style) === JSON.stringify(freshCard.style);
    if (curIsBlank && styleMatchesFresh) {
      return;
    }
    // Captured before anything moves, so the toast's Undo can put the card —
    // and the variant selection and theme revert point — back as they were.
    const before = capturePromoRestorePoint();
    // Mark as a fresh card: leaving it later, undo should land on its edited state.
    isFreshCardRef.current = true;
    setBlankStart(true);
    // Cleared by hand, so the end date is genuinely missing and filling it in
    // is the user completing the schedule rather than the app guessing.
    onTimerAutoArmedChange(true);
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
    setPromoAppliedCardBaseline(freshCard);
    markChanged();
    // Callers that already show their own toast (e.g. deleting the live card)
    // pass silent so the user doesn't get two messages for one action.
    if (!options.silent) toastWithUndo("Fresh promo card started", before);
    onCardReplaced?.();
  }

  useEffect(() => {
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
    setCardWidth(config.promoCard.cardWidth || getRequiredCardWidth(
      [
        { html: config.promoCard.title || '', field: 'title' },
        { html: config.promoCard.subtitle || '', field: 'subtitle' },
        { html: config.promoCard.description || '', field: 'description' },
      ],
      config.promoCard.showTimer
        ? buildTimerDisplayHtml(
            config.promoCard.timerText ?? '',
            calcTimerRemaining(config.promoCard.endDate || ''),
          )
        : '',
    ));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.promoCard.title, config.promoCard.subtitle, config.promoCard.description, config.promoCard.buttonText, config.promoCard.cardWidth, config.promoCard.timerText, config.promoCard.showTimer, config.promoCard.endDate]);

  // The preview renders at the local `cardWidth`, but only `config.promoCard.cardWidth`
  // gets persisted and published to R2 (and read by the live widget). Those can drift:
  // the width is recomputed into local state on load / text edits / timer changes, yet
  // it's only written back to config on some of those paths. Mirror the displayed width
  // into config here so publishing always saves the number the user actually sees — and
  // the site matches the tool. No-op (stable) once they already agree.
  useEffect(() => {
    if (cardWidth && cardWidth !== config.promoCard.cardWidth) {
      setConfig({ ...config, promoCard: { ...config.promoCard, cardWidth } });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cardWidth]);

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

  /**
   * Fill in a missing schedule — except on a canvas the user just cleared.
   *
   * This exists so a card that arrives without dates still has a valid range.
   * But it watches the whole config, so it also fired the instant Clear
   * emptied the end date and wrote a new one straight back — which completed
   * the schedule, which switched the countdown on. Three separate fixes to
   * clearing the dates were all undone here, one render later.
   *
   * A blank start is the one case where an empty end date is the point: it is
   * the decision being asked for, and the thing the countdown waits on.
   */
  useEffect(() => {
    if (blankStart) return;
    if (config.promoCard.startDate && config.promoCard.endDate) return;
    setConfig({
      ...config,
      promoCard: {
        ...config.promoCard,
        startDate: config.promoCard.startDate || getISODateWithOffset(0),
        endDate: config.promoCard.endDate || getISODateWithOffset(3),
      },
    });
  }, [config, setConfig, blankStart]);

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

  function openFieldStylePopup(
    field: PromoField,
    ref: RefObject<HTMLDivElement | null>,
    trigger?: HTMLElement | null,
  ) {
    const nextEditor = ref.current;
    const prevEditor = activeEditorRef.current;
    if (prevEditor && prevEditor !== nextEditor) {
      prevEditor.blur();
    }
    setShowPersistentScaffold(true);
    setShowCardBgPopup(false);
    setStylePopupAnchor("input");
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
    markChanged();
    refreshPromoToolbarFormats(el);

    // Update dynamic card width — across the text fields AND the timer.
    const newWidth = computeCardWidth(nextPromoCard);
    setCardWidth(newWidth);
    if (newWidth !== nextPromoCard.cardWidth) {
      setConfig({ ...config, promoCard: { ...nextPromoCard, cardWidth: newWidth } });
    }
  }

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

  function onPromoPreviewKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const mod = e.metaKey || e.ctrlKey;
    const key = e.key.toLowerCase();
    // Undo/redo are handled by the window-level listener above, for the whole
    // editor at once. Everything else typed on the card is blocked here.
    if (mod) return;
    e.preventDefault();
  }

  function onPromoEditorKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const mod = e.metaKey || e.ctrlKey;
    const key = e.key.toLowerCase();

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

  // Dynamic card width across the text fields AND the timer. The timer drives
  // the 400→440 stretch too: if it wraps at the narrow card's content width
  // (344) it needs the wide card. Measured on the live editor at a fixed
  // width, so it's independent of the current card width (no race).
  function computeCardWidth(promo: typeof config.promoCard): number {
    const base = getRequiredCardWidth([
      { html: promo.title || "", field: "title" },
      { html: promo.subtitle || "", field: "subtitle" },
      { html: promo.description || "", field: "description" },
    ]);
    if (base >= 440) return base;
    if (lexicalTimerRef.current?.wrapsAtContentWidth(TIMER_MIN_CONTENT_WIDTH)) {
      return 440;
    }
    return base;
  }

  // Show the transient style-warning toast (single owner of its lifecycle).
  function showStyleWarning(message: string) {
    if (styleWarningTimer.current) clearTimeout(styleWarningTimer.current);
    setStyleWarning(message);
    styleWarningTimer.current = setTimeout(() => setStyleWarning(null), 3000);
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

  // Invalid schedule = both dates set and start is after end. Drives the
  // in-field error, the red End Date border, and the disabled Save/Publish CTA.
  const promoDateRangeInvalid = (() => {
    const s = config.promoCard.startDate;
    const e = config.promoCard.endDate;
    return !!(s && e && s > e);
  })();

  // Fallback guard: when the page reports a blocked save/publish attempt, scroll
  // the End Date field into view and flash its inline error (no toast).
  useEffect(() => {
    if (!dateErrorPing) return;
    endDateFieldRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setDateErrorFlash(true);
    const t = setTimeout(() => setDateErrorFlash(false), 1200);
    return () => clearTimeout(t);
  }, [dateErrorPing]);

  // True when the timer — measured with its CURRENT countdown — can't fit one
  // line at the widest card. Drives the persistent "Field limit reached" note
  // (like the title's). NOTE: the rendered countdown WIDENS at rollovers
  // ("2 days : 1 hours : 0 mins" → "1 days : 23 hours : 59 mins"), so the
  // memo must also key on the countdown's current digits — they change at
  // most once a minute, so the ghost-measure (a forced layout) runs per
  // digit-change/edit, never per second. buildTimerDisplayHtml keeps the
  // user's style spans so this measures what the card actually renders.
  const timerRemaining = calcTimerRemaining(config.promoCard.endDate || '');
  const timerLimitReached = useMemo(() => {
    if (typeof document === 'undefined') return false;
    if (!config.promoCard.showTimer) return false;
    const tmpl = config.promoCard.timerText || '';
    // Ignore an empty timer (no prefix/suffix around the countdown token).
    const hasPrefixSuffix =
      tmpl
        .replace(/<[^>]*>/g, '')
        .replace(/\{timer\}/gi, '')
        .replace(/&nbsp;|​/g, '')
        .trim().length > 0;
    if (!hasPrefixSuffix) return false;
    const ghost = document.createElement('div');
    ghost.style.cssText =
      'position:absolute;visibility:hidden;white-space:pre;font-size:16px;line-height:24px;letter-spacing:normal;' +
      'font-family:-apple-system, BlinkMacSystemFont, system-ui, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;';
    ghost.innerHTML = buildTimerDisplayHtml(tmpl, timerRemaining);
    document.body.appendChild(ghost);
    const textW = ghost.getBoundingClientRect().width;
    document.body.removeChild(ghost);
    return textW > TIMER_MAX_CONTENT_WIDTH;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    config.promoCard.showTimer,
    config.promoCard.timerText,
    timerRemaining.days,
    timerRemaining.hours,
    timerRemaining.minutes,
  ]);

  function handlePromoToolbarFormat(format: string) {
    if (!currentFieldRef.current) return;
    // Timer is driven by the Lexical editor (no DOM editor element), so handle
    // it BEFORE the getActivePromoEditor()/null guard — otherwise it returns
    // early (there's no contenteditable div for the timer) and nothing applies.
    if (currentFieldRef.current === "timer") {
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
          showStyleWarning('This style exceeds the field limit — try a smaller size or shorter text');
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
          showStyleWarning('This style exceeds the field limit — try a smaller size or shorter text');
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
    // Timer: handle BEFORE the getActivePromoEditor()/null guard (no DOM
    // editor element for the timer). Route through the Lexical imperative API;
    // scope (cell / whole chip / text selection) is decided inside.
    if (currentFieldRef.current === "timer") {
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
        [countryCodeBtnRef, countryCodeMenuRef, setShowCountryCodeDropdown],
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
    setShowCountryCodeDropdown(false);
    setShowCardBgPopup(false);
  }, []);

  
  // Status is immediate (no Save → Publish): stopping takes the campaign off,
  // and "Go on air" reactivates the SAME already-published content. The page
  // owns the actual persistence.
  function confirmStopCampaign() {
    setShowStopConfirm(false);
    onStop();
  }

  function confirmGoOnAir() {
    setShowGoOnAirConfirm(false);
    onGoOnAir();
  }

  // The full brief we hand to any AI (ChatGPT or another tool the user prefers).


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
    markChanged();
  }


  /** Popup width and its gap from the card — must match the JSX below. */
  const STYLE_POPUP_WIDTH = 280;
  const STYLE_POPUP_GAP = 40;

  function getPopupPositionStyle(
    field: PopupField,
    popupHeight = 260,
  ): { top?: string; bottom?: string; left?: string } {
    const card = promoCardRef.current;
    const refMap = {
      title: previewTitleRef,
      subtitle: previewSubtitleRef,
      description: previewDescriptionRef,
      button: previewButtonRef,
      timer: previewTimerRef,
    } as const;
    const el = refMap[field].current;
    if (!card) return { bottom: "8px" };

    /**
     * Line the panel up with the field it edits, then keep it inside the
     * canvas.
     *
     * It used to ask whether the panel fitted below the field and pin it to
     * the card's bottom when it did not. The height it asked with was a
     * hardcoded 320 against a panel that is nearer 250, so the test almost
     * always failed — and pinning the bottom of a ~250px panel inside a ~244px
     * card pushed it up past the card entirely. Editing the timer, at the
     * bottom of the card, opened its panel at the top of the preview.
     *
     * The real height is measured once the panel has rendered; the constant
     * only covers the first frame.
     */
    const height = fieldPopupHeightRef.current || popupHeight;
    const canvas = card.closest("[data-promo-canvas]") as HTMLElement | null;
    const cardTop = card.getBoundingClientRect().top;
    /**
     * The field may not be on the card yet — during a blank start the preview
     * only draws what has been written, so styling a field before typing in it
     * means there is nothing to line up with. The card's own top stands in.
     *
     * Bailing out here instead returned a vertical offset and no horizontal
     * one, which left the panel at the card's left edge — sitting on top of
     * the card it was meant to sit beside.
     */
    let desiredTop = (el ?? card).getBoundingClientRect().top;
    if (canvas) {
      const canvasRect = canvas.getBoundingClientRect();
      const lowest = canvasRect.bottom - height - 8;
      desiredTop = Math.min(
        Math.max(desiredTop, canvasRect.top + 8),
        Math.max(canvasRect.top + 8, lowest),
      );
    }
    const vertical = { top: `${Math.round(desiredTop - cardTop)}px` };

    /**
     * Horizontal: open beside whatever was clicked.
     *
     * From a field in the card, the popup sits next to the card, on whichever
     * side has room — the canvas is ~838px, the card 400px and the popup
     * 280px, so they only fit side by side, never both on the same side.
     *
     * From the style icon beside an input on the left, it instead hugs the
     * canvas's left edge, next to the input that opened it. It can't go
     * further left and sit truly beside the inputs: an ancestor of the
     * preview column sets overflow-x: hidden, so anything past the canvas
     * edge is clipped rather than floating over the panel.
     */
    const offset = STYLE_POPUP_WIDTH + STYLE_POPUP_GAP;

    const cardIsOnTheLeft =
      config.promoCard.style.position === "bottom-left" ||
      config.promoCard.style.position === "top-left";

    /**
     * Opened from a style icon beside an input: hug the canvas's left edge,
     * the side those inputs are on.
     *
     * Unless the card is parked there. The left of the canvas is only free
     * real estate while the card sits on the right — move the card to
     * bottom-left and that same placement drops the panel straight on top of
     * the thing it is restyling, hiding the preview the user is watching.
     * In that case it falls through to the card-relative placement below,
     * which opens on whichever side the card actually leaves open.
     */
    if (stylePopupAnchor === "input" && !cardIsOnTheLeft) {
      if (canvas) {
        const cardLeft = card.getBoundingClientRect().left;
        const canvasLeft = canvas.getBoundingClientRect().left;
        return { ...vertical, left: `${Math.round(canvasLeft + 8 - cardLeft)}px` };
      }
    }

    // Clicked a field in the card: open to its right, so the panel lands on
    // the opposite side from the two left-hand routes and it stays obvious
    // which one opened it. A card parked bottom-right leaves no room there,
    // so that case falls back to the left rather than running off the canvas.
    const rightEdge = card.getBoundingClientRect().right;
    const roomOnRight = canvas
      ? canvas.getBoundingClientRect().right - rightEdge
      : 0;

    if (roomOnRight >= STYLE_POPUP_WIDTH + STYLE_POPUP_GAP) {
      return { ...vertical, left: `${card.clientWidth + STYLE_POPUP_GAP}px` };
    }
    return { ...vertical, left: `${-offset}px` };
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

  /**
   * Keeps the "Live" marker pointed at the variant the editor is actually
   * holding — including when that's none of them.
   *
   * This used to `return` early on no match, so the marker stayed on whatever
   * it last matched. Edit the card away from the published one and a variant
   * still claimed to be Live, which then fed real damage: deleting that variant
   * checks `selectedVersionId === id && active` to decide whether to pull the
   * campaign off the website, so a stale marker could take the site down (or
   * fail to) for the wrong card.
   */
  useEffect(() => {
    const matchingVersion = [...versions]
      .reverse()
      .find((version) => promoCardsEqual(version.promoCard, config.promoCard));
    const nextId = matchingVersion?.id ?? null;
    setSelectedVersionId((prev) => (prev === nextId ? prev : nextId));
    onSelectedVersionChange?.(nextId);
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

  // The campaign's scheduled run, shown on each "My Published" entry so the
  // published date range is visible at a glance (not just the save time).
  function formatScheduleRange(start?: string, end?: string): string {
    const fmt = (d?: string) => {
      if (!d) return "";
      const dt = new Date(`${d}T00:00:00`);
      if (Number.isNaN(dt.getTime())) return "";
      return dt.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    };
    const s = fmt(start);
    const e = fmt(end);
    if (s && e) return `${s} → ${e}`;
    return s || e || "";
  }


  /** True when this saved variant is the card currently on the website. */
  /**
   * What a card IS, ignoring noise the app rewrites by itself and the on-air
   * flags that belong to the website rather than the design.
   *
   * Shared by every "same card?" question in here. A raw compare fails on two
   * counts: a saved variant stores active:false while the live card is
   * active:true, and the editors re-serialise their own HTML constantly.
   */
  function cardSignature(c: PromoCard): string {
    return JSON.stringify({
      title: stripHtmlText(c.title),
      subtitle: stripHtmlText(c.subtitle),
      description: stripHtmlText(c.description),
      buttonText: stripHtmlText(c.buttonText),
      timerText: stripHtmlText(c.timerText),
      showTimer: c.showTimer,
      showButton: c.showButton,
      ctaType: c.ctaType,
      buttonUrl: c.buttonUrl,
      whatsappNumber: c.whatsappNumber,
      style: c.style,
    });
  }

  /** The URL this card's button opens on the live site, if it opens anything. */
  function ctaDestination(card?: PromoCard): string | null {
    const c = card ?? configRef.current.promoCard;
    if (c.ctaType === 'link') {
      const url = (c.buttonUrl || '').trim();
      if (!url) return null;
      return /^https?:\/\//i.test(url) ? url : `https://${url}`;
    }
    if ((c.ctaType || 'whatsapp') === 'whatsapp') {
      // Any typed national digit makes a link. The old rule counted the
      // dialling code too, so the real minimum slid by country and a
      // half-typed number left the button dead with no explanation.
      return whatsAppUrl(c.whatsappCountryCode, c.whatsappNumber);
    }
    return null;
  }

  function isLiveVersion(version: PromoVersion): boolean {
    if (!livePromoCard || !livePromoCard.active) return false;
    // Identity first: publishing marks the variant that went live, so an edit
    // to the live card can't move the tag onto a different entry — or lose it.
    if (versions.some((version) => version.isLive)) return Boolean(version.isLive);
    // Variants saved before the marker existed carry no flag, so fall back to
    // comparing content rather than showing no Live tag at all.
    return cardSignature(version.promoCard) === cardSignature(livePromoCard);
  }

  /**
   * True when a card is on the website but no saved variant is tagged Live —
   * the live card was edited after publishing, its variant was deleted, or the
   * list is empty. The popup then shows the live card itself, so the list can
   * never say "nothing is live" while the site says otherwise.
   */
  function liveCardIsUnlisted(): boolean {
    if (!livePromoCard || !livePromoCard.active) return false;
    return !versions.some(isLiveVersion);
  }

  async function handleDeleteVersion(id: string) {
    // "My Published" mirrors what's on the site, so deleting the entry that's
    // currently on air must also take the card off the website — otherwise the
    // campaign keeps serving to visitors with no saved copy left behind.
    const target = versions.find((v) => v.id === id);
    const targetIndex = versions.findIndex((v) => v.id === id);
    const wasLive = !!target && isLiveVersion(target);
    const wasSelected = selectedVersionId === id;
    const updated = await deleteVersion(id);
    setVersions(updated);
    if (wasSelected) {
      setSelectedVersionId(null);
      onSelectedVersionChange?.(null);
    }
    setPendingDeleteId(null);
    if (wasLive) {
      onRemoveLive();
      // The card is gone from My Published and from the site, so leaving it on
      // the canvas would strand a copy that matches nothing — clear it too.
      // Silent, because taking the card off the site is the headline here and
      // this action carries its own Undo.
      startFreshPromoCard({ silent: true });
      toast("Deleted — the card has been removed from your website");
      return;
    }
    if (!target) {
      toast("Variant deleted");
      return;
    }
    // A delete is the one action here with nothing left on screen to recover
    // from, so its Undo goes back to the list itself — same id, same slot.
    toast("Variant deleted", false, {
      label: "Undo",
      onClick: async () => {
        const restored = await restoreVersion(target, targetIndex);
        setVersions(restored);
        if (wasSelected) {
          setSelectedVersionId(target.id);
          onSelectedVersionChange?.(target.id);
        }
      },
    });
  }

  /**
   * Clearing the canvas moved into the ⋯ menu: it is the one destructive action
   * in the row and was sitting between two everyday ones, styled the same.
   */
  function confirmClearCanvas() {
    confirmCardReplace(startFreshPromoCard, {
                      title: 'Clear the canvas?',
                      // Never routed through the save-first branches: clearing is
                      // destruction the user asked for, so saving is offered as a
                      // third button below, never made a condition of continuing.
                      offerDraftSave: false,
                      body: (
                        <>
                          This removes all content and styling from the card you are editing. Your live
                          campaign remains unchanged.
                          {draftUpToDate ? (
                            <>
                              {' '}
                              This card is already saved in{' '}
                              <span className="font-semibold text-on-surface">My Draft</span>.
                            </>
                          ) : draftExists ? (
                            <>
                              {' '}
                              Keeping a copy will replace the card currently in{' '}
                              <span className="font-semibold text-on-surface">My Draft</span>.
                            </>
                          ) : null}
                        </>
                      ),
                      reassuranceBody:
                        'This removes all content and styling from the card you are editing. Your live ' +
                        'campaign remains unchanged.',
                      // Short enough that three buttons fit one row at max-w-md.
                      // "anyway" only means something next to a save button; alone
                      // it implies a choice that isn't being offered.
                      confirmLabel: canvasIsEmpty || draftUpToDate ? 'Clear canvas' : 'Clear anyway',
                      // Offered only when there is something to save that isn't
                      // already saved — otherwise it's a button that does nothing.
                      ...(canvasIsEmpty || draftUpToDate
                        ? {}
                        : {
                            secondaryLabel: draftExists ? 'Replace draft & clear' : 'Save & clear',
                            onSecondary: () => {
                              (onSaveDraftDirect ?? onSaveDraft)();
                              startFreshPromoCard();
                            },
                          }),
                    });
  }

  // Apply a saved version to the live card — click-to-apply, like a template.
  function applyVersion(version: PromoVersion) {
    const before = capturePromoRestorePoint();
    // Leaving a fresh card → undo lands on its EDITED state (getPromoSnapshot).
    // Leaving a template/variant → undo lands on its CLEAN baseline.
    isFreshCardRef.current = false;
    promoAppliedRedoRef.current = null;
    promoHistory.clear();
    // Same rule as templates: a variant contributes its design and its copy,
    // not its schedule. Its dates belong to the campaign that already ran, so
    // dragging them onto the card being edited silently re-dates it — and on a
    // past variant those dates are usually in the past.
    const current = configRef.current.promoCard;
    const restored = withDefaultDates({
      ...clonePromoCard(version.promoCard),
      active: false,
      startDate: current.startDate || version.promoCard.startDate,
      endDate: current.endDate || version.promoCard.endDate,
    });
    setConfig({ ...configRef.current, promoCard: restored });
    syncEditorsFromConfig(restored);
    markChanged();
    setPromoAppliedCardBaseline(restored);
    setSelectedVersionId(version.id);
    onSelectedVersionChange?.(version.id);
    setShowVersionsPopup(false);
    toastWithUndo(`Variant applied: ${version.label}`, before);
    onCardReplaced?.();
  }

  // Fetch the single saved draft from the DB and open the My Draft popup. We
  // only need its promo card for the preview.
  async function openDraftPopup() {
    setShowDraftPopup(true);
    setDraftPopupLoading(true);
    setDraftPopupCard(null);
    setConfirmDeleteDraft(false);
    try {
      const res = await fetch('/api/draft');
      const data = res.ok ? await res.json() : null;
      setDraftPopupCard((data?.draft?.promoCard as PromoCard | undefined) ?? null);
    } catch {
      setDraftPopupCard(null);
    } finally {
      setDraftPopupLoading(false);
    }
  }

  // Delete the single saved draft from where it's viewed. Only touches the DB
  // row — the card currently in the editor is untouched either way.
  function deleteDraft() {
    onDeleteDraft();
    setDraftPopupCard(null);
    setConfirmDeleteDraft(false);
    toast('Saved draft deleted');
  }

  // Load the saved draft's promo card back into the editor.
  function restoreDraftPromoCard(card: PromoCard) {
    const before = capturePromoRestorePoint();
    isFreshCardRef.current = false;
    promoAppliedRedoRef.current = null;
    promoHistory.clear();
    const restored = clonePromoCard(card);
    setConfig({ ...configRef.current, promoCard: restored });
    syncEditorsFromConfig(restored);
    markChanged();
    setPromoAppliedCardBaseline(restored);
    setSelectedVersionId(null);
    onSelectedVersionChange?.(null);
    toastWithUndo('Saved draft loaded into the editor', before);
  }

  /**
   * Apply a template in full — its design AND its sample copy.
   *
   * This is the destructive half of the old Template Hub, kept deliberately:
   * Themes swap the look and keep your words, so the only reason to come here
   * is to take the template's wording too. Callers wrap it in
   * confirmCardReplace, which stays quiet when there's nothing to lose.
   */
  function applyTemplate(template: PromoCard, templateName: string) {
    const before = capturePromoRestorePoint();
    setBlankStart(false);
    isFreshCardRef.current = false;
    promoAppliedRedoRef.current = null;
    promoHistory.clear();
    // Delegates to applyTemplateFull so the schedule survives. Cloning the
    // template wholesale here reset startDate/endDate to the template's own
    // sample dates (every one ships "today"), wiping the dates the user chose
    // when creating the campaign. A template is a design and its copy —
    // scheduling isn't part of it.
    const cloned = withDefaultDates(
      applyTemplateFull(configRef.current.promoCard, template),
    );
    cloned.timerText = serializeTimerHtml(cloned.timerText ?? "");
    setConfig({ ...configRef.current, promoCard: cloned });
    syncEditorsFromConfig(cloned);
    markChanged();
    setPromoAppliedCardBaseline(cloned);
    setSelectedVersionId(null);
    onSelectedVersionChange?.(null);
    toastWithUndo(`Template applied: ${templateName}`, before);
    onCardReplaced?.();
  }

  // Ask for consent before a replacing action — but only when there's actually
  // content to lose (no point confirming on a blank card). Undo still works after.
  /** Visible words only — immune to the HTML normalisation editors apply. */
  function stripHtmlText(html?: string): string {
    return String(html ?? '')
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/[\u200B\u200C\u200D\uFEFF]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function confirmCardReplace(
    action: () => void,
    opts: {
      title: string;
      body: React.ReactNode;
      confirmLabel: string;
      /** Copy used when nothing is actually at risk (see below). */
      reassuranceBody?: React.ReactNode;
      /**
       * What is about to take the card's place, as a noun phrase — "this
       * template", "this variant", "a blank canvas". The draft branches below
       * are shared by every card-replacing action, so without this they can
       * only say "the new one", which names nothing.
       */
      replacementLabel?: string;
      /**
       * The card that would replace the current one, when the caller knows it.
       *
       * Lets the consent detect a no-op: applying the template or variant the
       * editor already holds changes nothing, so asking permission for it is
       * noise — and the dialog's own wording ("this replaces the card you're
       * editing") would be false.
       */
      nextCard?: PromoCard;
      /**
       * Whether the draft branches apply. True for actions that swap one card
       * for another, where saving first protects the outgoing work.
       *
       * False for deliberate destruction (Clear Canvas): the user is throwing
       * the card away, so quietly saving it over their existing draft would
       * destroy the draft to preserve something they just discarded.
       */
      offerDraftSave?: boolean;
    },
  ) {
    const pc = configRef.current.promoCard;

    /**
     * What the card actually IS, ignoring noise the app rewrites by itself:
     * font-size spans the editors normalise, re-serialised timer HTML, and the
     * auto 400/440 width. A raw compare reports "different" for cards that
     * look and behave identically.
     */
    // Applying what's already on the canvas is a no-op: don't ask, don't apply
    // (applying would mark the card changed for no visible reason).
    if (opts.nextCard && cardSignature(opts.nextCard) === cardSignature(pc)) {
      toast("That's already the card you're editing.");
      return;
    }

    /**
     * Nothing of the user's own is on the canvas, so nothing can be lost:
     * it's blank, it's already stored, or it is a template — with or without
     * one of our themes over it — that Template Hub will hand straight back.
     *
     * Consent is for protecting work. Asking here made picking a second
     * template feel like a commitment, and offered to spend the single draft
     * slot on a card the user had merely glanced at.
     */
    if (nothingToOfferBack(pc)) {
      action();
      return;
    }

    const hasContent =
      hasVisibleContent(pc.title) ||
      hasVisibleContent(pc.subtitle) ||
      hasVisibleContent(pc.description) ||
      hasVisibleContent(pc.buttonText);
    // A blank/fresh card has nothing to lose — replace it silently (this also
    // covers the dirty flag being set right after a previous Start Fresh).
    if (!hasContent) {
      action();
      return;
    }

    // Still byte-identical to whatever was last applied, so the user hasn't
    // written anything into it — swapping it away loses nothing, and it's one
    // click from its own popup. Checked BEFORE the dirty flag on purpose:
    // applying a template calls markChanged(), so hasUnsavedChanges is always
    // true straight afterwards and this branch was unreachable — which made
    // browsing templates warn on every click after the first.
    // Compare only what represents the USER'S work: the words and the styling.
    // A whole-object compare fails on things the app changes by itself right
    // after applying — cardWidth is recomputed 400↔440, the timer HTML is
    // re-serialised, editors normalise font-size spans — so it reported "edited"
    // for a card nobody had touched, and every template click warned.
    const baseline = promoAppliedCardBaselineRef.current?.promoCard;
    const workSignature = (c: PromoCard) =>
      JSON.stringify({
        title: hasVisibleContent(c.title) ? stripHtmlText(c.title) : '',
        subtitle: hasVisibleContent(c.subtitle) ? stripHtmlText(c.subtitle) : '',
        description: hasVisibleContent(c.description) ? stripHtmlText(c.description) : '',
        buttonText: hasVisibleContent(c.buttonText) ? stripHtmlText(c.buttonText) : '',
        style: c.style,
      });
    if (baseline && workSignature(baseline) === workSignature(pc)) {
      action();
      return;
    }

    // ── Draft-aware branches ──────────────────────────────────────────
    // The card holds real work, so what happens next depends entirely on
    // whether that work is already safe in the draft. In every branch "No"
    // simply closes the dialog: it cancels the template change and touches
    // nothing, because a button labelled No must never destroy anything.

    const incoming = opts.replacementLabel ?? 'the new card';
    const offerDraftSave = opts.offerDraftSave !== false;

    /**
     * Already published — the card on the canvas can be fetched back from My
     * Published, so nothing is at risk and no save is worth offering.
     *
     * Checked BEFORE the draft branches on purpose: with a draft lying around
     * from other work, replacing a published card used to prompt "Replace your
     * saved draft?" — offering to overwrite the draft with a card that was
     * already safe, which is both pointless and destructive.
     */
    const cardIsPublished =
      !!livePromoCard && cardSignature(pc) === cardSignature(livePromoCard);

    /**
     * Already in the draft. Uses the card comparison, not `draftUpToDate`:
     * that flag is a whole-config signature, so switching tabs and coming back
     * made an unchanged card look edited and prompted to re-save it.
     */
    const cardIsInDraft =
      !!draftPromoCard && cardSignature(pc) === cardSignature(draftPromoCard);

    /**
     * Saved somewhere — apply it, say nothing.
     *
     * These two cases used to open a dialog whose entire message was "nothing
     * is at risk". A confirmation that confirms nothing is just a click in the
     * way: the card can be brought back from My Published or My Draft, and the
     * action's own toast already reports what happened.
     */
    if (offerDraftSave && (cardIsPublished || cardIsInDraft || draftUpToDate)) {
      action();
      return;
    }

    if (offerDraftSave && draftExists && !draftUpToDate && !cardIsInDraft) {
      // A draft exists but the editor has moved on. Continuing overwrites the
      // draft with what's on screen now — say so before it happens.
      setCardActionConfirm({
        ...opts,
        title: 'Replace your saved draft?',
        body: (
          <>
            Applying {incoming} will replace your current card. Your current card contains changes
            made after your last save, and continuing will save it to{' '}
            <span className="font-semibold text-on-surface">My Draft</span>, replacing the previous
            version.
          </>
        ),
        confirmLabel: 'Save and continue',
        onConfirm: () => {
          (onSaveDraftDirect ?? onSaveDraft)();
          action();
        },
        // Saving is the safe default, not the only way through: the draft on
        // disk may be the copy worth keeping, and forcing it to be overwritten
        // to get past this dialog destroys the very thing it protects.
        secondaryLabel: 'Continue anyway',
        onSecondary: action,
      });
      return;
    }

    if (!hasUnsavedChanges) {
      // Content with no pending edits — typically their published card, loaded
      // on landing. Confirmed with reassuring copy so it never vanishes
      // unannounced, but without implying work will be lost.
      setCardActionConfirm({
        ...opts,
        body:
          opts.reassuranceBody ??
          "This only changes the card you're editing. What's live on your website stays up until you publish again.",
        onConfirm: action,
      });
      return;
    }

    // Destructive by intent (Clear Canvas): warn plainly, save nothing.
    if (!offerDraftSave) {
      setCardActionConfirm({ ...opts, onConfirm: action });
      return;
    }

    // Unsaved work with no draft behind it — the only branch where continuing
    // could actually lose something, so it offers to save on the way through.
    setCardActionConfirm({
      ...opts,
      title: 'Save this card as a draft?',
      body: (
        <>
          Applying {incoming} will replace your current card, which has not been saved. Continuing
          will save it to <span className="font-semibold text-on-surface">My Draft</span> so a copy
          is kept.
        </>
      ),
      confirmLabel: 'Save and continue',
      onConfirm: () => {
        (onSaveDraftDirect ?? onSaveDraft)();
        action();
      },
      // Discards the current card without keeping a copy. Offered because
      // some cards are not worth a draft slot, and the cap is five.
      secondaryLabel: 'Continue anyway',
      onSecondary: action,
    });
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
    invalid?: boolean;
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
      invalid,
    } = params;
    const days = buildMonthDays(viewDate);
    const month = viewDate.getMonth();
    const selected = value;
    const today = toISODate(new Date());
    // A day is out of range if before minDate (past dates). Cross-field limits
    // are NOT applied here — an invalid range surfaces as an inline error.
    const isOutOfRange = (iso: string) => Boolean(minDate && iso < minDate);
    const todayDisabled = Boolean(isOutOfRange(today));
    return (
      <div
        ref={mode === "start" ? startDatePickerRef : endDatePickerRef}
        className="relative"
      >
        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            setOpen(!open);
          }}
          className={`flex h-11 w-full items-center justify-between rounded-md border bg-surface px-3 text-sm text-on-surface transition-colors hover:border-primary/70 ${
            invalid
              ? "border-red-500 dark:border-red-400"
              : "border-border"
          }`}
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
  // Nothing to save, nothing to clear: no visible text in any field AND the
  // style is still the fresh default. Styling-only work counts as work, so it
  // must keep both actions enabled — same test as startFreshPromoCard's no-op
  // guard.
  const canvasIsEmpty =
    !hasTitle &&
    !hasSubtitle &&
    !hasDescription &&
    !hasButtonText &&
    JSON.stringify(config.promoCard.style) ===
      JSON.stringify(getFreshPromoCard().style);
  /**
   * Is there a design of the user's OWN to hold on to?
   *
   * Two cases where there isn't, and both make the swatch noise:
   *
   * An empty canvas has nothing to return to — the button would restore
   * blankness.
   *
   * A design taken straight from a template is already on screen as one of
   * the theme swatches beside it, so showing it again under "Current Design"
   * offers a trip back to somewhere the user never left, and reads as two
   * different things that happen to look identical.
   *
   * The themes take that space in either case.
   */
  const baselineIsATheme = OUR_LOOKS.includes(lookSignature(themeBaseline));
  const hasCurrentDesign = !canvasIsEmpty && !baselineIsATheme;

  /**
   * Say where the design went, the moment it becomes a swatch.
   *
   * The line under the themes row explains the same thing and stays put, but
   * it only helps someone already looking there. The toast is what tells a
   * user who is watching the card that their design was kept rather than
   * overwritten.
   */
  useEffect(() => {
    const wasVisible = ownSwatchWasVisibleRef.current;
    ownSwatchWasVisibleRef.current = hasCurrentDesign;
    // First render only records the state; it has not appeared, it just is.
    if (wasVisible === null) return;
    if (!wasVisible && hasCurrentDesign) {
      toast(
        'Your design is saved as the first swatch — tap it to come back',
        false,
        undefined,
        // Longer than the default: this asks the user to go and find
        // something, and three seconds is gone before the eye has left the
        // toast to look for it.
        8000,
      );
    }
  }, [hasCurrentDesign, toast]);


  /**
   * A schedule is what makes a countdown mean something, so setting both dates
   * on a freshly cleared card turns the timer on.
   *
   * It starts off after a clear because a countdown with no dates behind it is
   * a number nobody can act on. Once the dates exist the timer has something
   * to count to, and switching it on is what the user was going to do next
   * anyway.
   *
   * Only while blank-starting: on any other card the toggle is the user's, and
   * flipping it under them because they edited a date would be the app
   * overruling a choice they already made.
   */
  useEffect(() => {
    if (!blankStart || !timerAutoArmed) return;
    const { startDate, endDate, showTimer } = config.promoCard;
    if (showTimer || !startDate || !endDate) return;
    // Fires once. Turning the countdown back off by hand afterwards is a
    // decision, and re-arming would overrule it on the next date edit.
    onTimerAutoArmedChange(false);
    setConfig({
      ...configRef.current,
      promoCard: { ...configRef.current.promoCard, showTimer: true },
    });
    markChanged();
    onTimerAutoEnabled?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blankStart, timerAutoArmed, config.promoCard.startDate, config.promoCard.endDate]);

  /**
   * The blank start ends the moment a design arrives, whatever brought it —
   * a template, a variant, a draft, My Published. Watching the card rather
   * than patching each of those routes means a new one cannot forget to.
   *
   * Typing keeps the mode: words alone are what the progressive reveal is for.
   */
  useEffect(() => {
    if (!blankStart) return;
    if (lookSignature(config.promoCard.style) !== lookSignature(BLANK_LOOK)) {
      setBlankStart(false);
    }
  }, [blankStart, config.promoCard.style]);

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
        className="sticky top-0 flex gap-4 overflow-hidden"
        style={{ height: "calc(100dvh - 120px)", maxHeight: "calc(100dvh - 120px)" }}
      >
        {/* Left: All editables — 30% width, scrollable */}
        <div className="campaign-custom-scrollbar w-[30%] min-h-0 shrink-0 overflow-y-auto overflow-x-hidden pr-4 space-y-5">
          {/* Header + Toggle */}
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div className="p-1 bg-primary/15 rounded-lg mr-3 border border-primary/60">
                <Gift className="w-4 h-4 text-primary" />
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
          </div>

          {/* Quick actions (Clear Canvas / My Published / Template Hub) now live
              in the action-tab strip above the Website Content Area preview. */}

          {/* Consent before a card-replacing action */}
          {cardActionConfirm && (
            <div data-modal className="fixed inset-0 z-[60] flex items-center justify-center p-4">
              <div className="absolute inset-0 bg-black/20" onClick={() => setCardActionConfirm(null)} />
              <div
                className={`relative z-10 w-full rounded-xl border border-white/10 bg-black/10 p-5 text-on-surface shadow-2xl backdrop-blur-md ${
                  cardActionConfirm.secondaryLabel ? 'max-w-xl' : 'max-w-md'
                }`}
              >
                <h2 className="text-base font-semibold">{cardActionConfirm.title}</h2>
                <p className="mt-2 text-sm text-on-surface-variant">{cardActionConfirm.body}</p>
                {/* Cancel sits apart on the left — it's "leave", not one of the
                    ways forward. The two ways forward group on the right, with
                    the safe one weighted. Three buttons in a single row read as
                    a queue and hide which is which. */}
                <div className="mt-5 flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => setCardActionConfirm(null)}
                    className="shrink-0 whitespace-nowrap rounded-md px-2 py-2 text-sm font-medium text-on-surface-variant transition-colors hover:text-primary"
                  >
                    Cancel
                  </button>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        const fn = cardActionConfirm.onConfirm;
                        setCardActionConfirm(null);
                        fn();
                      }}
                      className={
                        cardActionConfirm.secondaryLabel
                          ? 'whitespace-nowrap rounded-md border border-white/15 bg-transparent px-4 py-2 text-sm font-medium text-on-surface-variant transition-colors hover:border-red-400/70 hover:text-red-500'
                          : 'whitespace-nowrap rounded-md bg-primary px-4 py-2 text-sm font-semibold text-on-primary shadow-sm transition-opacity hover:opacity-95'
                      }
                    >
                      {cardActionConfirm.confirmLabel}
                    </button>
                    {cardActionConfirm.secondaryLabel && cardActionConfirm.onSecondary && (
                      <button
                        type="button"
                        onClick={() => {
                          const fn = cardActionConfirm.onSecondary!;
                          setCardActionConfirm(null);
                          fn();
                        }}
                        className="whitespace-nowrap rounded-md bg-primary px-4 py-2 text-sm font-semibold text-on-primary shadow-sm transition-opacity hover:opacity-95"
                      >
                        {cardActionConfirm.secondaryLabel}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* More room than the other sections get, because this is the only
              one that follows a heading rather than body text. "Promo Card" at
              28px and "Content" at 24px are close enough in size to compete,
              and the standard gap left them reading as two titles stacked
              rather than a section beneath a page. */}
          <div className="!mt-12">
            <h4 className="text-2xl font-semibold leading-8 text-on-surface">
              Content
            </h4>
            <p className="mt-2 text-sm text-on-surface-variant">
              Main promo copy shown in the card.
            </p>
          </div>

          <div className="!mt-6">
            <div className="!mt-0 flex items-center justify-between">
              <label className="block text-sm font-semibold text-on-surface mb-2">
                Title
              </label>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  openFieldStylePopup("title", titleRef, e.currentTarget as HTMLElement);
                }}
                className="p-1 rounded text-on-surface-variant hover:text-primary hover:bg-primary/10 transition-colors"
                title="Open title style"
                aria-label="Open title style"
              >
                <Palette className="w-3.5 h-3.5" />
              </button>
            </div>

            {fieldInfoPopup === 'title' && (
              <div className="mb-2 p-3 rounded-lg bg-surface border border-border shadow-md text-[12px] text-on-surface/80 leading-relaxed">
                <p>Titles work best as a single line — marketing best practice. Adjust font size or shorten text to fit.</p>
                <div className="flex gap-2 mt-2">
                  <button onClick={() => setFieldInfoPopup(null)} className="px-3 py-1 rounded-md bg-primary/10 hover:bg-primary/20 text-primary text-[11px] font-medium transition-colors">Got it</button>
                  <button onClick={() => { setFieldInfoPopup(null); const next = new Set(hiddenFieldInfos); next.add('title'); setHiddenFieldInfos(next); localStorage.setItem('hidden-field-infos', JSON.stringify([...next])); }} className="px-3 py-1 rounded-md bg-primary/10 hover:bg-primary/20 text-primary text-[11px] font-medium transition-colors">Don&apos;t show again</button>
                </div>
              </div>
            )}

            <div
              ref={titleRef}
              contentEditable
              spellCheck={true}
              data-placeholder="Your headline"
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
                /**
                 * The placeholder wears the colour its field paints on the
                 * card, so panel and card agree at a glance: the box labelled
                 * "Your headline" is the same warm near-brown as the headline
                 * beside it.
                 *
                 * Safe in dark mode without a second value, because these
                 * fields already take the card's own background — the contrast
                 * here is whatever the contrast is over there.
                 */
                ['--ph' as string]: config.promoCard.style.titleStyle.textColor,
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
                <p className="mt-1.5 text-[11px] font-semibold text-amber-600 dark:text-amber-400 animate-pulse">⚠️ Field limit reached</p>
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
                  openFieldStylePopup("subtitle", subtitleRef, e.currentTarget as HTMLElement);
                }}
                className="p-1 rounded text-on-surface-variant hover:text-primary hover:bg-primary/10 transition-colors"
                title="Open subtitle style"
                aria-label="Open subtitle style"
              >
                <Palette className="w-3.5 h-3.5" />
              </button>
            </div>

            {fieldInfoPopup === 'subtitle' && (
              <div className="mb-2 p-3 rounded-lg bg-surface border border-border shadow-md text-[12px] text-on-surface/80 leading-relaxed">
                <p>Subtitles are optimised for 2 lines for better engagement. Adjust font size or styling to fit.</p>
                <div className="flex gap-2 mt-2">
                  <button onClick={() => setFieldInfoPopup(null)} className="px-3 py-1 rounded-md bg-primary/10 hover:bg-primary/20 text-primary text-[11px] font-medium transition-colors">Got it</button>
                  <button onClick={() => { setFieldInfoPopup(null); const next = new Set(hiddenFieldInfos); next.add('subtitle'); setHiddenFieldInfos(next); localStorage.setItem('hidden-field-infos', JSON.stringify([...next])); }} className="px-3 py-1 rounded-md bg-primary/10 hover:bg-primary/20 text-primary text-[11px] font-medium transition-colors">Don&apos;t show again</button>
                </div>
              </div>
            )}

            <div
              ref={subtitleRef}
              contentEditable
              spellCheck={true}
              data-placeholder="A supporting line"
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
                ['--ph' as string]: config.promoCard.style.subheadingStyle.textColor,
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
                <p className="mt-1.5 text-[11px] font-semibold text-amber-600 dark:text-amber-400 animate-pulse">⚠️ Field limit reached</p>
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
                  openFieldStylePopup("description", descRef, e.currentTarget as HTMLElement);
                }}
                className="p-1 rounded text-on-surface-variant hover:text-primary hover:bg-primary/10 transition-colors"
                title="Open description style"
                aria-label="Open description style"
              >
                <Palette className="w-3.5 h-3.5" />
              </button>
            </div>

            {fieldInfoPopup === 'description' && (
              <div className="mb-2 p-3 rounded-lg bg-surface border border-border shadow-md text-[12px] text-on-surface/80 leading-relaxed">
                <p>Descriptions are capped at 3 lines for readability. Adjust font size or styling to fit your message.</p>
                <div className="flex gap-2 mt-2">
                  <button onClick={() => setFieldInfoPopup(null)} className="px-3 py-1 rounded-md bg-primary/10 hover:bg-primary/20 text-primary text-[11px] font-medium transition-colors">Got it</button>
                  <button onClick={() => { setFieldInfoPopup(null); const next = new Set(hiddenFieldInfos); next.add('description'); setHiddenFieldInfos(next); localStorage.setItem('hidden-field-infos', JSON.stringify([...next])); }} className="px-3 py-1 rounded-md bg-primary/10 hover:bg-primary/20 text-primary text-[11px] font-medium transition-colors">Don&apos;t show again</button>
                </div>
              </div>
            )}

            <div
              ref={descRef}
              contentEditable
              spellCheck={true}
              suppressContentEditableWarning
              data-placeholder="A little more about the offer"
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
                ['--ph' as string]: config.promoCard.style.descriptionStyle.textColor,
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
                <p className="mt-1.5 text-[11px] font-semibold text-amber-600 dark:text-amber-400 animate-pulse">⚠️ Field limit reached</p>
              ) : null;
            })()}
          </div>

          <div className="!mt-8">
            <h4 className="text-2xl font-semibold leading-8 text-on-surface">
              Campaign Schedule &amp; Timing
            </h4>
          </div>

          {/* Sub-section 1 — the system action: when the campaign auto-runs. */}
          <div className="!mt-6">
            <div className="flex items-center gap-2">
              <h5 className="text-base font-semibold text-on-surface">
                Campaign Duration
              </h5>
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                Required
              </span>
            </div>
            <p className="mt-1 text-sm text-on-surface-variant">
              Set when this campaign will automatically start running and stop running.
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
                // Any future date is selectable — the End picker is NOT used to
                // gray out Start days. An invalid range is surfaced as an
                // inline error, not by blocking the picker.
                minDate: toISODate(new Date()),
                onSelect: (nextValue) => {
                  pushPromoState();
                  const nextPromoCard = {
                    ...config.promoCard,
                    startDate: nextValue,
                    ...(nextValue ? { showTimer: true } : {}),
                  };
                  setConfig({ ...config, promoCard: nextPromoCard });
                  markChanged();
                },
              })}
            </div>
            <div ref={endDateFieldRef}>
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
                // Any future date is selectable; an end before start is caught
                // by the inline error below, not blocked in the picker.
                minDate: toISODate(new Date()),
                invalid: promoDateRangeInvalid,
                onSelect: (nextValue) => {
                  pushPromoState();
                  const nextPromoCard = {
                    ...config.promoCard,
                    endDate: nextValue,
                    ...(nextValue ? { showTimer: true } : {}),
                  };
                  setConfig({ ...config, promoCard: nextPromoCard });
                  markChanged();
                },
              })}
              {promoDateRangeInvalid && (
                <p
                  className={`mt-1.5 text-[11px] font-semibold text-red-600 dark:text-red-400 ${
                    dateErrorFlash ? "animate-pulse" : ""
                  }`}
                >
                  End date must be on or after the start date.
                </p>
              )}
            </div>
          </div>

          {/* Sub-section 2 — the optional visual feature: a countdown clock.
              Divider + pt-8 matches the app's section-divider convention. */}
          <div className="!mt-8 flex items-center justify-between gap-4 border-t border-border pt-8">
            <div>
              <div className="flex items-center gap-2">
                <h5 className="text-base font-semibold text-on-surface">
                  Countdown Timer Display
                </h5>
                <span className="rounded-full bg-on-surface-variant/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-on-surface-variant">
                  Optional
                </span>
              </div>
              <p className="mt-1 text-sm text-on-surface-variant">
                Show a dynamic countdown clock on the promo card to create urgency.
              </p>
            </div>
            <SegmentedToggle
              value={config.promoCard.showTimer}
              onChange={(v) => updateField("showTimer", v)}
            />
          </div>

          {/* Timer Text — the editor lives HERE in the panel (consistent with
              title / subtitle / description). Type the prefix/suffix, click
              the countdown chip's cells to style them, and use the editor's
              own toolbar for bold/italic/size/color. The preview card on the
              right is a read-only render of the result. */}
          <div
            className={`ml-1 border-l-2 border-border pl-4 ${
              !config.promoCard.showTimer ? "opacity-50 pointer-events-none" : ""
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <label className="block text-sm font-semibold text-on-surface">
                  Timer Text
                </label>
                <div className="relative group">
                  <div className="flex items-center justify-center w-4 h-4 rounded-full bg-on-surface-variant/25 text-[9px] font-bold text-on-surface-variant cursor-help select-none">
                    i
                  </div>
                  <div className="absolute bottom-full left-0 mb-1.5 w-56 p-2 bg-surface-elevated border border-border text-on-surface text-[11px] leading-relaxed rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 pointer-events-none">
                    Type text before/after the countdown. The countdown can&apos;t be edited but can&apos;t be deleted. Select text to style it; click a number, word, or colon in the chip to style just that part.
                    <div className="absolute top-full left-3 w-0 h-0 border-l-[5px] border-r-[5px] border-t-[5px] border-l-transparent border-r-transparent border-t-surface-elevated"></div>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  openFieldStylePopup("timer", timerRef, e.currentTarget as HTMLElement);
                }}
                className="p-1 rounded text-on-surface-variant hover:text-primary hover:bg-primary/10 transition-colors"
                title="Open timer style"
                aria-label="Open timer style"
              >
                <Palette className="w-3.5 h-3.5" />
              </button>
            </div>
            <p className="text-[11px] text-on-surface-variant leading-relaxed">
              ↪ Edit the timer in the preview card on the right: type the text
              before/after the countdown, select text or click a number, word,
              or colon in the countdown to style it.
            </p>
            {timerLimitReached && (
              <p className="mt-1.5 text-[11px] font-semibold text-amber-600 dark:text-amber-400 animate-pulse">
                ⚠️ Field limit reached — shorten the timer text so it fits one line
              </p>
            )}
          </div>

          <div className="!mt-8">
            <h4 className="text-2xl font-semibold leading-8 text-on-surface">
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

          <div className={`space-y-5 ${!config.promoCard.showButton ? "opacity-50 pointer-events-none" : ""}`}>
              {/* CTA Type Selector */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => updateField("ctaType", "whatsapp")}
                  className={`flex-1 h-11 rounded-md border text-xs font-semibold transition-colors inline-flex items-center justify-center gap-1.5 ${
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
                  className={`flex-1 h-11 rounded-md border text-xs font-semibold transition-colors inline-flex items-center justify-center gap-1.5 ${
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
                <button
                  type="button"
                  onClick={() => updateField("ctaType", "text")}
                  className={`flex-1 h-11 rounded-md border text-xs font-semibold transition-colors inline-flex items-center justify-center gap-1.5 ${
                    config.promoCard.ctaType === 'text'
                      ? 'border-primary/80 bg-primary/10 text-primary'
                      : 'border-border text-on-surface-variant hover:border-primary/70 hover:text-primary'
                  }`}
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 7V4h16v3M9 20h6M12 4v16" />
                  </svg>
                  Text
                </button>
              </div>

              {/* WhatsApp Input */}
              {(config.promoCard.ctaType || 'whatsapp') === 'whatsapp' && (
                <div>
                  <label className="block text-sm font-semibold text-on-surface mb-2">
                    WhatsApp Number
                  </label>
                  {/* The dial-code trigger sits inside this field rather than
                      beside it, so it takes no background of its own on hover:
                      any fill reads as a band laid across the field, whatever
                      the colour. The chevron and label shifting to the accent
                      is enough to show it is live, and the shell already
                      answers the pointer with its own border. */}
                  <div className="flex items-center h-[44px] rounded-md border border-border bg-surface overflow-visible transition-colors hover:border-primary/70 focus-within:border-primary/80">
                    {/* The shared dropdown, not a second one built by hand.
                        This picker used to roll its own absolute panel: it was
                        the only list in the app that didn't portal, so it could
                        be clipped, and it drifted from the others in width,
                        row height and hover colour. */}
                    <PopupDropdown
                      labelClassName="sr-only"
                      label="Country dialling code"
                      value={config.promoCard.whatsappCountryCode || '+44'}
                      options={COUNTRY_CODES.map(({ code, flag, name }) => ({
                        value: code,
                        label: name,
                        meta: code,
                        // The name as shown, and nothing else — see below.
                        searchText: name,
                        icon: <CountryFlag flag={flag} name={name} />,
                      }))}
                      open={showCountryCodeDropdown}
                      onOpen={() => {
                        const next = !showCountryCodeDropdown;
                        closeAllPromoDropdowns();
                        setShowCountryCodeDropdown(next);
                        setCountryCodePos(
                          getDropdownPosition(countryCodeBtnRef.current),
                        );
                      }}
                      onSelect={(v) => {
                        updateField('whatsappCountryCode', v);
                        setShowCountryCodeDropdown(false);
                      }}
                      buttonRef={countryCodeBtnRef}
                      menuRef={countryCodeMenuRef}
                      menuPosition={countryCodePos}
                      // 66 rows have to scroll, and near the bottom of this
                      // column the menu has to open upward.
                      // Five rows and the search box. Sixty-six countries behind a tall
                      // menu is a wall of names to read past; five is enough to show the
                      // list scrolls and that typing is the faster way through it.
                      menuMaxHeight={200}
                      flip
                      searchable
                      searchPlaceholder="Search country"
                      buttonClassName="h-full rounded-l-md px-3 border-r border-border text-on-surface flex items-center gap-1.5 transition-colors hover:text-primary"
                      triggerContent={(() => {
                        const selectedCode = config.promoCard.whatsappCountryCode || '+44';
                        const selected = COUNTRY_CODES.find((c) => c.code === selectedCode);
                        return (
                          <>
                            <CountryFlag
                              flag={selected?.flag ?? ''}
                              name={selected?.name ?? ''}
                            />
                            <span className="text-sm font-semibold text-on-surface tabular-nums">
                              {selectedCode}
                            </span>
                          </>
                        );
                      })()}
                    />
                    <input
                      type="tel"
                      value={config.promoCard.whatsappNumber || ''}
                      onChange={(e) =>
                        updateField(
                          "whatsappNumber",
                          // Capped at what still fits E.164 once the dialling
                          // code is prefixed — past that the link is invalid
                          // however it's built.
                          e.target.value
                            .replace(/\D/g, '')
                            .slice(0, maxNationalDigits(config.promoCard.whatsappCountryCode)),
                        )
                      }
                      placeholder="7911 123456"
                      inputMode="tel"
                      className="flex-1 h-full px-3 outline-none text-sm bg-transparent text-on-surface"
                    />
                  </div>
                  {/* Same warning the announcement bar shows, and the same one
                      the publish check raises — surfaced while typing so a
                      short number is caught before you reach for Publish. */}
                  {whatsAppLooksShort(
                    config.promoCard.whatsappCountryCode,
                    config.promoCard.whatsappNumber,
                  ) && (
                    <p className="mt-1 text-[11px] text-amber-600 dark:text-amber-500">
                      That looks short for{' '}
                      {config.promoCard.whatsappCountryCode || '+44'}. Double-check
                      it before publishing.
                    </p>
                  )}
                  <p className="mt-1 text-[11px] text-on-surface-variant">Select country code and enter number</p>
                  <p className="mt-1 text-[11px] text-on-surface-variant">The button is shown on the card and opens a WhatsApp chat when clicked.</p>
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
                  <p className="mt-1 text-[11px] text-on-surface-variant">The button is shown on the card and opens this link when clicked.</p>
                </div>
              )}

              {/* Plain Text (no link) */}
              {config.promoCard.ctaType === 'text' && (
                <p className="text-[11px] text-on-surface-variant">The button is shown on the card but is not clickable (no link).</p>
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
                      openFieldStylePopup("button", buttonRef, e.currentTarget as HTMLElement);
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
                  spellCheck={true}
                  suppressContentEditableWarning
                  data-placeholder="Your button text"
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
                  className={`rich-editor promo-standard-editor block w-full rounded-md px-2 border min-h-[44px] max-h-[360px] resize-none overflow-y-auto outline-none break-words transition-colors ${
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
        <div className="flex-1 min-h-0 h-full pr-2 flex flex-col gap-3 overflow-x-hidden">
          <div className="space-y-1">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h4 className="text-xs font-bold text-on-surface-variant uppercase tracking-[0.08em]">
                  Preview
                </h4>
                <p className="mt-2 text-sm text-on-surface-variant">
                  See your promo card update as you edit — click any field to restyle it.
                </p>
              </div>
              <div className="shrink-0">
                {/* Status chip — 3 states: On air (tap to stop) / Go on air
                    enabled (same content, one click) / Go on air disabled
                    (new or edited content → must Save & Publish). */}
                <button
                  type="button"
                  onClick={
                    config.promoCard.active
                      ? () => setShowStopConfirm(true)
                      : canReactivate
                      ? () => setShowGoOnAirConfirm(true)
                      : undefined
                  }
                  disabled={!config.promoCard.active && !canReactivate}
                  aria-pressed={config.promoCard.active}
                  title={
                    config.promoCard.active
                      ? "On air — tap to stop"
                      : canReactivate
                      ? "Reactivate the same content — go on air now"
                      : "You have unpublished changes — Save & Publish to go live"
                  }
                  className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-semibold transition-colors duration-200 ${
                    config.promoCard.active
                      ? "border-transparent bg-primary/[0.13] text-primary hover:bg-primary/[0.18] cursor-pointer"
                      : canReactivate
                      ? "border-border bg-surface-subtle text-on-surface-variant hover:border-primary/50 hover:text-primary cursor-pointer"
                      : "border-border bg-surface-subtle text-on-surface-variant/40 cursor-not-allowed"
                  }`}
                >
                  {config.promoCard.active ? (
                    <>
                      <span className="live-dot" />
                      On air · tap to stop
                    </>
                  ) : (
                    <>
                      <Power className="h-3.5 w-3.5" />
                      Go on air
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
          {/* Action tabs — sit between the preview header and the Website
              Content Area, left-aligned. Fixed height so the preview below
              shrinks to keep the column scroll-free. */}
          {/* One toolbar, grouped by purpose.

              Everything used to sit in one undifferentiated run of six chips
              under two lines of instructions, so nothing looked more or less
              important than anything else. Now: what changes the card, then the
              places cards are kept, then the card settings and the one primary
              action, pushed right. Thin rules mark the seams.

              Clear Canvas stays in the open on purpose: it is the reset, and a
              reset you cannot see is a reset you do not trust. */}
          <div className="flex shrink-0 flex-col gap-2 border-t border-border pt-3">
            <div className="flex flex-wrap items-center gap-2">
            {onUseAi && (
              <button
                type="button"
                onClick={onUseAi}
                title="Let AI write or restyle this card"
                className="ai-chip relative inline-flex h-9 items-center gap-1.5 overflow-hidden whitespace-nowrap rounded-lg border border-primary/40 bg-primary/[0.06] px-3 text-sm font-medium text-primary transition-colors duration-200 hover:border-primary/60 hover:bg-primary/[0.11] dark:bg-primary/[0.10] dark:hover:bg-primary/[0.16]"
              >
                {/* A light sweeps across the chip on hover and stops. Motion
                    only on intent: nothing animates while you work, so the
                    toolbar stays still, and the one control that isn't a plain
                    command still announces itself. */}
                <span aria-hidden="true" className="ai-sheen pointer-events-none absolute inset-0" />
                <Sparkles className="ai-spark relative h-4 w-4" />
                <span className="relative">Improve with AI</span>
              </button>
            )}
            <span className="h-6 w-px shrink-0 bg-border" aria-hidden="true" />
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
{/* My Draft moved to row 2 next to the save button */}

            {/* Everything to the left brings a card IN — AI writes one, the Hub
                and My Published fetch one. This one takes it away, and nothing
                in the row said so: same size, same colour, sitting fourth in
                the run, it read as a fourth source.

                It stays visible on purpose — a reset you cannot see is a reset
                you do not trust — so the separation is weight, not distance:
                the rule marks the seam and it is the quietest control in the
                row until you reach for it. Pushing it to the far edge instead
                left it stranded, reading as unrelated to anything and sitting
                directly above the primary save button. */}
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

            {/* Position and card colour moved down to sit with Current in the
                Themes strip — all three are "what this card looks like", so
                they read as one group there instead of living apart from the
                Current swatch they act on. Only the primary action stays up
                here, pushed right. */}
            <div className="flex items-center justify-end gap-2">
            {/* Icon-only: it sits directly beside "Save draft", which already
                names the subject, so repeating "My Draft" in full spent a
                button's worth of width saying the same word twice. The dot
                still marks that a draft exists. */}
            <button
              type="button"
              data-tour="promo-my-draft"
              onClick={openDraftPopup}
              aria-label={draftExists ? "View your saved draft" : "No saved draft yet"}
              className="relative grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-on-surface-variant/40 text-on-surface-variant transition-colors hover:border-primary/70 hover:bg-primary/10 hover:text-primary"
              title={draftExists ? "View your saved draft" : "No saved draft yet"}
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
                  ? "Nothing to save yet - add some content first."
                  : draftUpToDate
                  ? "Your saved draft already matches this - make a change to save again."
                  : draftExists
                  ? "Replace your saved draft with what you are editing now"
                  : "Store these edits as your saved draft"
              }
            >
              {savingDraft ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {draftExists ? "Update draft" : "Save draft"}
            </button>
            </div>
          </div>
          {/* data-promo-canvas: the build panel measures this box and sits
              inside it, so it never floats over the toolbar above. */}
          <div
            data-promo-canvas
            className="campaign-card-surface rounded-lg px-5 pt-5 pb-2 relative flex-1 min-h-0 border border-gray-200 dark:border-gray-600"
          >
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
                  className={`promo-live-preview relative rounded-xl shadow-2xl p-5 flex flex-col ${
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
                    // Auto-fit: scale the whole card down (layout included, via
                    // `zoom`) when it's taller than the frame, so the full card is
                    // always visible — no clip, no scroll — at any window/zoom.
                    zoom: previewZoom,
                    // No max-height: the live widget card grows to fit its content
                    // (it's position:fixed on the site), so capping it here clipped
                    // the preview and forced a scroll that never happens on the site.
                    // Render the preview in the SAME system font the widget uses
                    // so line-wrapping is identical (WYSIWYG). The app's Geist is
                    // a different, wider cut than the widget could reliably load,
                    // which made text wrap differently between tool and site.
                    fontFamily:
                      '-apple-system, BlinkMacSystemFont, system-ui, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
                    background: getBackgroundStyle(
                      config.promoCard.style.background,
                    ),
                  }}
                >
                  {showTitleInPreview && (
                    <div
                      ref={previewTitleRef}
                      contentEditable
                      suppressContentEditableWarning
                      /**
                       * Names the region rather than saying "Enter text here".
                       *
                       * The card was rendering as a bare white box: these
                       * fields are always present so the shape stays visible,
                       * but with nothing in them and no placeholder attribute
                       * the CSS resolved attr(data-placeholder) to an empty
                       * string and drew nothing — the skeleton existed and was
                       * invisible.
                       *
                       * Each names what belongs there, because someone who is
                       * not a designer looking at an empty card needs to know
                       * which part is the headline and which is the small
                       * print, not to be told three times that text goes in.
                       */
                      data-placeholder="Your headline"
                      className={`${blankStart ? "promo-ghost" : ""} ${hasTitle ? "text-base font-normal" : "text-xl font-semibold"} mb-1 px-2 py-1 rounded break-words cursor-pointer outline-none ${currentField === "title" ? "ring-1 ring-primary/70" : ""}`}
                      onMouseDown={() => {
                        activeEditorRef.current = previewTitleRef.current;
                      }}
                      onClick={() => {
                        setShowCardBgPopup(false);
                        setStylePopupAnchor("card");
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
                      data-placeholder="A supporting line"
                      className={`${blankStart ? "promo-ghost" : ""} ${hasSubtitle ? "text-base font-normal" : "text-sm font-medium"} mb-2 px-2 py-1 rounded break-words cursor-pointer outline-none ${currentField === "subtitle" ? "ring-1 ring-primary/70" : ""}`}
                      onMouseDown={() => {
                        // Don't trigger state updates while dragging selection.
                        activeEditorRef.current = previewSubtitleRef.current;
                      }}
                      onClick={() => {
                        setShowCardBgPopup(false);
                        setStylePopupAnchor("card");
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
                      data-placeholder="A little more about the offer"
                      className={`${blankStart ? "promo-ghost" : ""} ${hasDescription ? "text-base font-normal" : "text-xs"} mb-2 px-2 py-1 rounded break-words cursor-pointer outline-none ${currentField === "description" ? "ring-1 ring-primary/70" : ""}`}
                      onMouseDown={() => {
                        activeEditorRef.current = previewDescriptionRef.current;
                      }}
                      onClick={() => {
                        setShowCardBgPopup(false);
                        setStylePopupAnchor("card");
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
                          getPreviewFieldBackground("timer"),
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
                          // Functional update: this fires in the SAME batch as
                          // onStateJson below. Spreading a stale closure `config`
                          // in both makes the second setConfig clobber the first
                          // (that desynced timerText from timerStateJson — stale
                          // suffixes like "on a" survived in timerText only).
                          setConfig((prev) =>
                            nextTimerText === (prev.promoCard.timerText ?? '')
                              ? prev
                              : { ...prev, promoCard: { ...prev.promoCard, timerText: nextTimerText } },
                          );
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
                  )}

                  {/* Ghosts for the two parts that are switched off.
                      A cleared card has no countdown and no button, so the
                      skeleton stopped after the description and the lower half
                      of the card was blank — someone who has never built one
                      had no way to know a countdown or a button were even
                      possible, which is the whole reason the skeleton exists.

                      Inert on purpose. They are dashed outlines that render
                      nothing real: showTimer and showButton stay false, so
                      nothing here can switch the countdown back on behind the
                      user, and they disappear the moment a design arrives or
                      the toggle is turned on for real. */}
                  {blankStart && !showTimerInPreview && (
                    <div
                      className="mb-2 rounded border border-dashed px-2 py-1.5 text-center text-xs"
                      style={{
                        borderColor: `${config.promoCard.style.textColor}33`,
                        color: `${config.promoCard.style.textColor}66`,
                      }}
                    >
                      {/* Says the step that is actually outstanding.
                          Fixed text told people to set an end date they may
                          have already set — the countdown turns itself on when
                          a cleared card gets its dates, so the only way to be
                          looking at this ghost WITH dates in place is to have
                          switched the timer off by hand. Repeating the first
                          instruction there is telling someone to redo work
                          they have done. */}
                      {config.promoCard.endDate
                        ? 'Countdown — turn on Countdown Timer Display'
                        : 'Countdown — set an end date to switch it on'}
                    </div>
                  )}

                  {blankStart && !showButtonInPreview && (
                    <div className="flex justify-center">
                      {/* A dashed outline again, not a filled button.
                          Filling it made the card look finished — a real call
                          to action sitting on a real design — which is exactly
                          what a skeleton must not look like. Dashed says
                          "something goes here", which is the whole message. */}
                      <div
                        className="rounded border border-dashed px-4 py-1.5 text-xs"
                        style={{
                          borderColor: `${config.promoCard.style.textColor}55`,
                          color: `${config.promoCard.style.textColor}aa`,
                        }}
                      >
                        Button — turn on Call to Action
                      </div>
                    </div>
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
                        {...(ctaDestination(config.promoCard)
                          ? { role: 'button' as const, tabIndex: 0 }
                          : {})}
                        title={
                          // Silence was the problem: an inert button gives no
                          // clue that a destination is missing, so a click that
                          // does nothing reads as broken rather than unset.
                          ctaDestination(config.promoCard)
                            ? `Opens ${ctaDestination(config.promoCard)} in a new tab`
                            : config.promoCard.ctaType === 'text'
                              ? 'Text only — this button has no link'
                              : (config.promoCard.ctaType || 'whatsapp') === 'whatsapp'
                                ? 'Add a WhatsApp number on the left to make this clickable'
                                : 'Add a link on the left to make this clickable'
                        }
                        data-placeholder="Button"
                        className={`promo-preview-button py-2 px-4 rounded-lg text-base font-semibold outline-none min-h-10 ${
                          config.promoCard.buttonFullWidth ? "w-full" : ""
                        } ${currentField === "button" ? "ring-1 ring-primary/70" : ""} ${
                          ctaDestination(config.promoCard)
                            ? 'cursor-pointer transition-opacity hover:opacity-90'
                            : ''
                        }`}
                        onClick={() => {
                          // The card's CTA behaves like the button it depicts:
                          // it opens its destination. Its styles are reached
                          // from the palette beside "Button Text" on the left,
                          // so a click here doesn't have to serve two masters.
                          const url = ctaDestination(config.promoCard);
                          if (!url) return;
                          setShowCardBgPopup(false);
                          window.open(url, '_blank', 'noopener,noreferrer');
                        }}
                        style={{
                          background: getBackgroundStyle(
                            getPreviewFieldBackground("button"),
                          ),
                          color: config.promoCard.style.buttonStyle.textColor,
                          textAlign:
                            config.promoCard.style.buttonStyle.textAlign ||
                            "center",
                          cursor: ctaDestination(config.promoCard) ? 'pointer' : 'default',
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
                          ref={(node) => {
                            if (node) fieldPopupHeightRef.current = node.offsetHeight;
                          }}
                          className="absolute z-30 w-[280px] bg-black/10 backdrop-blur-md border border-white/10 rounded-xl shadow-2xl p-3"
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

                          {/* The app's own style bar drives every field,
                              including the timer. For the timer it routes
                              through the LexicalTimerField imperative handle,
                              which is cell-aware (styles the targeted chip
                              number/word/colon, or the text selection). */}
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
                              {/* No backdrop: an invisible full-screen layer
                                  silently eats the user's next click (the
                                  same bug the welcome-back banner had). The
                                  warning auto-dismisses in 3s and has ✕. */}
                              <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[100] bg-surface-elevated/85 backdrop-blur-sm border border-border text-on-surface rounded-2xl shadow-2xl px-8 py-6 w-[420px] text-center">
                                <button
                                  onClick={() => setStyleWarning(null)}
                                  className="absolute top-3 right-4 text-on-surface-variant hover:text-on-surface text-lg"
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
                      className="absolute z-30 w-[320px] bg-black/10 backdrop-blur-md border border-white/10 rounded-xl shadow-2xl p-3"
                      style={(() => {
                        const card = promoCardRef.current;
                        const canvas = card?.closest(
                          "[data-promo-canvas]",
                        ) as HTMLElement | null;
                        const left =
                          card && canvas
                            ? `${Math.round(
                                canvas.getBoundingClientRect().left +
                                  8 -
                                  card.getBoundingClientRect().left,
                              )}px`
                            : "8px";
                        // Top fixed at open — see cardBgPopupTop.
                        return { top: `${cardBgPopupTop ?? 8}px`, left };
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

          {/* Themes — restyle the card without touching the words. This is the
              safe half of what "Template Hub" used to do: applying a template
              wholesale replaced the user's copy, which is what made it need a
              consent popup. Swapping only the look never destroys anything. */}
          <div className="mt-5 shrink-0 pb-1">
            {/* Two labelled groups rather than one unbroken row.

                The current design used to sit in the row as just another
                swatch, told apart only by a small revert icon — so the one
                thing you most need to find looked like a thirteenth theme. It
                gets its own heading and its own space now, with a rule between
                the two, and exactly one swatch across both groups is ever
                marked: yours when the card is on your design, the theme's only
                while you're trying it. */}
            <div className="flex items-start gap-4">
              {/* Position and colour share one explainer: both describe the
                  card itself, so a line under each would say the same thing
                  twice. */}
              <div className="shrink-0">
                <div className="flex items-start gap-4">
                  <div className="shrink-0">
                    <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-on-surface-variant">
                      Card Position
                    </p>
                    <span title="Where the card sits on your website">
                  <PopupDropdown
                    labelClassName="sr-only"
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
                    // Sits low in the panel, so there is often no room beneath
                    // it — without this the menu opened past the fold.
                    flip
                    buttonClassName="flex h-10 items-center gap-2 whitespace-nowrap rounded-lg border border-border bg-surface px-3 text-left text-sm font-medium text-on-surface shadow-sm transition-colors hover:border-primary/70 hover:text-primary"
                      />
                    </span>
                  </div>

                  <div className="shrink-0">
                    <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-on-surface-variant">
                      Card Color
                    </p>
                    <button
                      ref={cardBgPopupBtnRef}
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        closeAllPromoDropdowns();
                        setShowPersistentScaffold(true);
                        setShowCardBgPopup((prev) => {
                          if (prev) return false;
                          const card = promoCardRef.current;
                          const canvas = card?.closest(
                            '[data-promo-canvas]',
                          ) as HTMLElement | null;
                          if (card && canvas) {
                            const cardRect = card.getBoundingClientRect();
                            const canvasRect = canvas.getBoundingClientRect();
                            setCardBgPopupTop(
                              Math.round(canvasRect.top + 8 - cardRect.top),
                            );
                          }
                          return true;
                        });
                      }}
                      className="inline-flex h-10 items-center gap-2 whitespace-nowrap rounded-lg border border-border bg-surface px-3 text-sm font-medium text-on-surface shadow-sm transition-colors hover:border-primary/70 hover:text-primary"
                      title="The card's own background colors"
                    >
                      <Palette className="h-4 w-4" /> Edit Colors
                    </button>
                  </div>
                </div>
                <p className="mt-1.5 text-[11px] text-on-surface-variant">
                  Card sits on website, and the colors it uses there.
                </p>
              </div>

              <div className="mt-4 h-10 w-px shrink-0 bg-border" />

              <div className="min-w-0 flex-1">
                <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-on-surface-variant">
                  Themes
                </p>
                {/* Vertical padding is not decoration: overflow-x also clips the Y
                    axis, and the selected swatch's ring sits 2px outside its
                    box, so without room the marker is sliced off top and bottom. */}
                <div className="campaign-custom-scrollbar flex gap-2 overflow-x-auto px-1 pb-2 pt-1.5">
                  {/* Your own design leads the row rather than sitting in a
                      group of its own. It is chosen the same way a theme is,
                      so it belongs among them; the separate section made the
                      one design you cannot lose look like a different kind of
                      thing, and cost a label and two rules to say so. The
                      revert badge marks it as yours. */}
                  {hasCurrentDesign && (
                    <button
                      type="button"
                      title="Your own design — back to how the card looked before you tried a theme"
                      onClick={() => {
                        // Already on it: restoring would change nothing, so an
                        // "undo" step and a toast claiming a restore both lie.
                        if (onOwnDesign) return;
                        pushPromoState({ replace: true });
                        samplingThemeRef.current = true;
                        setConfig({
                          ...configRef.current,
                          promoCard: { ...configRef.current.promoCard, style: themeBaseline },
                        });
                        markChanged();
                        toast('Restored your original design');
                      }}
                      style={{ background: getBackgroundStyle(themeBaseline.background) }}
                      className={`relative h-10 w-14 shrink-0 rounded-lg ring-offset-2 ring-offset-surface transition-all hover:scale-105 ${
                        onOwnDesign
                          ? 'ring-2 ring-primary'
                          : 'ring-1 ring-border hover:ring-primary/60'
                      }`}
                    >
                      <span className="absolute -right-1.5 -top-1.5 grid h-4 w-4 place-items-center rounded-full border border-border bg-surface text-on-surface-variant">
                        <RotateCcw className="h-2.5 w-2.5" />
                      </span>
                    </button>
                  )}
                  {sampleTemplates.map((t) => {
                    /**
                     * Marked when the card is wearing this look — either
                     * because it is being tried on, or because the design
                     * simply is this template.
                     *
                     * `onOwnDesign` alone hid the mark in the second case:
                     * an untouched template counts as "your design", so no
                     * theme lit up, and with the Current swatch hidden for
                     * exactly that case nothing in the strip was marked at all.
                     */
                    const on =
                      (!onOwnDesign || baselineIsATheme) &&
                      lookSignature((t.promoCard as PromoCard).style) ===
                        lookSignature(config.promoCard.style);
                    return (
                      <button
                        key={t.id}
                        type="button"
                        title={t.name}
                        onClick={() => {
                          // This look is already applied — re-applying marks
                          // the card changed and stacks an undo step that
                          // steps back to the same picture.
                          if (on) return;
                          pushPromoState({ replace: true });
                          samplingThemeRef.current = true;
                          setConfig({
                            ...configRef.current,
                            promoCard: applyTemplateLook(
                              configRef.current.promoCard,
                              t.promoCard as PromoCard,
                            ),
                          });
                          markChanged();
                        }}
                        style={{
                          background: getBackgroundStyle((t.promoCard as PromoCard).style.background),
                        }}
                        className={`h-10 w-14 shrink-0 rounded-lg ring-offset-2 ring-offset-surface transition-all hover:scale-105 ${
                          on ? "ring-2 ring-primary" : "ring-1 ring-border hover:ring-primary/60"
                        }`}
                      />
                    );
                  })}
                </div>
                {/* Sits under Themes, not under the whole row: it explains the
                    swatches, and spanning the full width put a sentence about
                    themes directly beneath "Card Position". */}
                {/* Said here rather than in a toast: it explains a control
                    that is on screen, so it should be readable while the user
                    is looking at it — and still there the second time they
                    wonder, which a toast never is. */}
                {hasCurrentDesign && (
                  <p className="mt-1.5 text-[11px] text-on-surface-variant">
                    Trying a theme keeps your text. Your own design is saved as
                    the{' '}
                    <span className="font-semibold text-on-surface">
                      first swatch
                    </span>{' '}
                    — tap it to come back.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Stop Campaign Confirmation — immediate (no save/publish needed) */}
      {showStopConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0" onClick={() => setShowStopConfirm(false)} />
          <div className="relative z-10 w-full max-w-md rounded-xl border border-white/10 bg-black/10 p-5 text-on-surface shadow-2xl backdrop-blur-md">
            <h2 className="text-base font-semibold">Switch off this campaign?</h2>
            <p className="mt-2 text-sm text-on-surface-variant">
              If you switch off the campaign, the entire campaign stops displaying on your website. Are you sure you want to do it?
            </p>
            <p className="mt-2 text-xs text-on-surface-variant/80">
              You can switch it back on anytime with <strong>Go on air</strong> — as long as the content hasn&apos;t changed. New content needs Save &amp; Publish.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowStopConfirm(false)}
                className="rounded-md border border-white/10 bg-transparent px-4 py-2 text-sm font-medium text-on-surface-variant transition-colors hover:border-primary/70 hover:text-primary"
              >
                No
              </button>
              <button
                type="button"
                onClick={confirmStopCampaign}
                className="rounded-md bg-red-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-opacity hover:bg-red-600"
              >
                Yes, switch off
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Go On Air Confirmation — reactivate the same published content */}
      {showGoOnAirConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0" onClick={() => setShowGoOnAirConfirm(false)} />
          <div className="relative z-10 w-full max-w-md rounded-xl border border-white/10 bg-black/10 p-5 text-on-surface shadow-2xl backdrop-blur-md">
            <h2 className="text-base font-semibold">Go on air?</h2>
            <p className="mt-2 text-sm text-on-surface-variant">
              This puts the same campaign back on your website right away — no need to save or publish again.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowGoOnAirConfirm(false)}
                className="rounded-md border border-white/10 bg-transparent px-4 py-2 text-sm font-medium text-on-surface-variant transition-colors hover:border-primary/70 hover:text-primary"
              >
                No
              </button>
              <button
                type="button"
                onClick={confirmGoOnAir}
                className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-on-primary shadow-sm transition-opacity hover:opacity-95"
              >
                Yes, go on air
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Paste-from-AI import */}
      {/* Sample Templates popup — shows the same 6 cards; click one to apply */}
      {showTemplatesPopup && (
        <div data-modal className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0" onClick={() => setShowTemplatesPopup(false)} />
          <div className="relative z-10 flex max-h-[90vh] w-[92vw] max-w-[1500px] flex-col overflow-hidden rounded-xl border border-border shadow-2xl backdrop-blur-md">
            <div className="flex items-center gap-3 border-b border-border px-6 py-3">
              {/* Back exists only when the build panel sent us here; opened
                  from the toolbar chip there is nowhere to go back to. */}
              {templatesFromBuild && onTemplatesBack && (
                <button
                  type="button"
                  onClick={() => {
                    setShowTemplatesPopup(false);
                    setTemplatesFromBuild(false);
                    onTemplatesBack();
                  }}
                  aria-label="Back"
                  className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-on-surface-variant transition-colors hover:bg-primary/10 hover:text-primary"
                >
                  <ArrowLeft className="h-4 w-4" />
                </button>
              )}
              {/* Two audiences, one popup. Arriving from the build panel this
                  is a step in creating a card, so it gets a step title and a
                  "start blank" alternative. Opened from the Template Hub chip
                  it's just the template browser, and those would be clutter —
                  starting blank already lives in Clear Canvas next to it. */}
              {templatesFromBuild ? (
                <>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-on-surface">Pick a starting design</p>
                    <p className="text-xs text-on-surface-variant">
                      Applies the design and its sample text. You can change either afterwards.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setShowTemplatesPopup(false);
                      setTemplatesFromBuild(false);
                      confirmCardReplace(startFreshPromoCard, {
                        title: 'Start from a blank card?',
                        offerDraftSave: false,
                        body: (
                          <>
                            This removes all content and styling from the card you are editing.
                            Anything saved in{' '}
                            <span className="font-semibold text-on-surface">My Draft</span> and your
                            live campaign remain unchanged.
                          </>
                        ),
                        reassuranceBody: (
                          <>
                            This removes all content and styling from the card you are editing.
                            Anything saved in{' '}
                            <span className="font-semibold text-on-surface">My Draft</span> and your
                            live campaign remain unchanged.
                          </>
                        ),
                        confirmLabel: 'Start blank',
                      });
                    }}
                    className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-border px-3 text-sm font-medium text-on-surface-variant transition-colors hover:border-primary/70 hover:text-primary"
                  >
                    <FilePlus2 className="h-4 w-4" /> Start blank
                  </button>
                </>
              ) : (
                <p className="min-w-0 flex-1 text-sm text-on-surface-variant">
                  Starts the card again with this template&apos;s design{' '}
                  <span className="font-semibold text-on-surface">and its sample text</span>. To keep
                  your words and change only the look, use Themes below the card.
                </p>
              )}
              <button
                type="button"
                onClick={() => {
                  setShowTemplatesPopup(false);
                  setTemplatesFromBuild(false);
                }}
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-on-surface-variant transition-colors hover:bg-primary/10 hover:text-primary"
                aria-label="Close templates"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="campaign-custom-scrollbar overflow-y-auto p-6">
              <SamplePromoTemplates
                onApplyTemplate={(template, name) => {
                  setShowTemplatesPopup(false);
                  confirmCardReplace(() => applyTemplate(template, name), {
                    title: 'Apply this template?',
                    replacementLabel: 'this template',
                    nextCard: applyTemplateFull(configRef.current.promoCard, template),
                    body: "This replaces the text and design of the card you're editing. Your live campaign remains unchanged until you publish.",
                    reassuranceBody:
                      "This replaces the card you're editing, including its text. Your live campaign remains unchanged until you publish.",
                    confirmLabel: 'Apply template',
                  });
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* My Draft popup — the single saved, unpublished draft. */}
      {showDraftPopup && (() => {
        const draftCard = draftPopupCard;
        // The draft may already be what's on the canvas (you saved it, or just
        // restored it). Restoring it again would be a no-op, so offering to
        // "replace the current card" reads as nonsense — compare the cards and
        // disable the action instead. `active`/`stoppedByUser` are live on/off
        // flags, not content, so they're excluded (same rule as the dirty check).
        const stripCard = (c: PromoCard) => {
          const rest = { ...c } as Record<string, unknown>;
          delete rest.active;
          delete rest.stoppedByUser;
          return JSON.stringify(rest);
        };
        const draftIsOnCanvas =
          !!draftCard && stripCard(draftCard) === stripCard(config.promoCard);
        return (
          <div data-modal className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0" onClick={() => setShowDraftPopup(false)} />
            <div className="relative z-10 flex max-h-[90vh] w-[92vw] max-w-[520px] flex-col overflow-hidden rounded-xl border border-white/10 bg-black/10 backdrop-blur-md shadow-2xl">
              <div className="flex items-center justify-between gap-3 border-b border-white/10 px-6 py-3">
                <div>
                  <h3 className="text-sm font-semibold text-on-surface">My Draft</h3>
                  <p className="text-xs text-on-surface-variant">
                    The card you stored — kept until you replace or delete it.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowDraftPopup(false)}
                  className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-on-surface-variant transition-colors hover:bg-primary/10 hover:text-primary"
                  aria-label="Close draft"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="campaign-custom-scrollbar overflow-y-auto p-6">
                {draftPopupLoading ? (
                  <div className="p-8 text-center text-sm text-on-surface-variant">
                    Loading your saved draft…
                  </div>
                ) : draftCard ? (
                  // Render at the card's own width (same as the editor), never
                  // stretched to the popup width.
                  <div
                    className="mx-auto"
                    style={{ width: `${draftCard.cardWidth || 400}px`, maxWidth: '100%' }}
                  >
                    <PromoMiniPreview promoCard={draftCard} faithful />
                  </div>
                ) : (
                  <div className="p-8 text-center text-sm text-on-surface-variant">
                    No saved draft yet. Use “Save as draft” to store the card you're editing here.
                  </div>
                )}
              </div>

              {draftCard && (
                <div className="flex shrink-0 items-center justify-end gap-2 border-t border-white/10 px-6 py-3">
                  <button
                    type="button"
                    onClick={() => setConfirmDeleteDraft(true)}
                    className="rounded-lg border border-red-500/40 px-3 py-1.5 text-sm font-semibold text-red-500 transition-colors hover:bg-red-500/10"
                  >
                    Delete saved draft
                  </button>
                  <button
                    type="button"
                    disabled={draftIsOnCanvas}
                    title={
                      draftIsOnCanvas
                        ? "You're already editing your saved draft."
                        : 'Load your saved draft into the editor'
                    }
                    onClick={() => {
                      setShowDraftPopup(false);
                      confirmCardReplace(() => restoreDraftPromoCard(draftCard), {
                        title: 'Continue editing your saved draft?',
                        replacementLabel: 'your saved draft',
                        nextCard: draftCard,
                        body: "This loads your saved draft into the editor, replacing the card you're editing now. What's live on your website won't change until you publish.",
                        reassuranceBody:
                          "This loads your saved draft into the editor. Nothing is lost, and what's live on your website won't change until you publish.",
                        confirmLabel: 'Continue editing',
                      });
                    }}
                    className="rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-on-primary shadow-sm transition-opacity hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {draftIsOnCanvas ? 'Already in editor' : 'Continue editing'}
                  </button>
                </div>
              )}

              {confirmDeleteDraft && (
                <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 rounded-xl bg-surface-elevated/95 p-6 text-center backdrop-blur-sm">
                  <p className="text-sm font-semibold text-on-surface">Delete your saved draft?</p>
                  <p className="-mt-1 text-xs text-on-surface-variant">
                    Your saved draft will be deleted. This can&apos;t be undone.
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteDraft(false)}
                      className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-on-surface-variant transition-colors hover:border-primary/70 hover:text-primary"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={deleteDraft}
                      className="rounded-md bg-red-500 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-red-600"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* Versions popup — save / restore / delete up to MAX_VERSIONS snapshots */}
      {showVersionsPopup && (
        <div data-modal className="fixed inset-0 z-50 flex items-center justify-center p-4">
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
              {/* What's on the website, when no saved variant is carrying the
                  Live tag. Without this the list can read "nothing is live"
                  while the card is still serving — and with the list empty
                  there was no control anywhere in here to take it off. */}
              {liveCardIsUnlisted() && livePromoCard && (
                <div className="mb-6 rounded-xl border border-primary/40 bg-primary/5 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="flex items-center gap-2 text-sm font-semibold text-on-surface">
                        <Radio className="h-3.5 w-3.5 text-primary" />
                        Live on your website
                      </p>
                      <p className="mt-1 text-xs text-on-surface-variant">
                        This card is serving now but isn&apos;t one of your saved
                        variants — it was edited after publishing, or its variant
                        was deleted.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setShowVersionsPopup(false);
                        setShowStopConfirm(true);
                      }}
                      className="shrink-0 rounded-md border border-border px-3 py-1.5 text-xs font-semibold text-on-surface-variant transition-colors hover:border-red-500/70 hover:text-red-500"
                    >
                      Take it off my website
                    </button>
                  </div>
                  <div className="mt-3 max-w-xs">
                    <PromoMiniPreview promoCard={livePromoCard} />
                  </div>
                </div>
              )}

              {versions.length === 0 ? (
                <div className="p-10 text-center text-sm text-on-surface-variant">
                  No saved variants yet.
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
                  {[...versions].reverse().map((version) => {
                    // Two independent facts: what's on your website, and what's
                    // in your editor. A variant can be either, both or neither.
                    const isLive = isLiveVersion(version);
                    const isOnCanvas = promoCardsEqual(version.promoCard, config.promoCard);
                    return (
                      <div
                        key={version.id}
                        onClick={() => {
                          setShowVersionsPopup(false);
                          if (isOnCanvas) return;
                          confirmCardReplace(() => applyVersion(version), {
                            title: 'Apply this variant?',
                            replacementLabel: 'this saved variant',
                            nextCard: version.promoCard,
                            body: "This replaces the card you're editing with this saved variant. It won't change what's live on your website until you publish.",
                            confirmLabel: 'Apply variant',
                          });
                        }}
                        className={`group relative rounded-xl border bg-white p-3 shadow-sm transition-colors dark:border-gray-700 dark:bg-gray-900 ${
                          isOnCanvas
                            ? 'cursor-default border-primary/60 ring-1 ring-primary/30'
                            : 'cursor-pointer border-gray-200 hover:border-primary hover:shadow-lg hover:ring-1 hover:ring-primary'
                        }`}
                      >
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <p className="min-w-0 truncate text-xs font-semibold text-gray-800 dark:text-gray-200">
                            {version.label}
                          </p>
                          <div className="flex shrink-0 items-center gap-1">
                            {/* Live first — it's the fact about the website.
                                "In editor" is only worth saying when the
                                variant isn't already marked Live. */}
                            {isLive ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-green-500/15 px-2 py-0.5 text-[10px] font-semibold text-green-600 dark:text-green-400">
                                <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                                Live
                              </span>
                            ) : isOnCanvas ? (
                              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                                In editor
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
                        {formatScheduleRange(version.promoCard.startDate, version.promoCard.endDate) && (
                          <p className="mb-2 flex items-center gap-1 text-[11px] font-medium text-gray-500 dark:text-gray-400">
                            <CalendarDays className="h-3 w-3" />
                            {formatScheduleRange(version.promoCard.startDate, version.promoCard.endDate)}
                          </p>
                        )}
                        <PromoMiniPreview promoCard={version.promoCard} />

                        {pendingDeleteId === version.id && (
                          <div
                            onClick={(e) => e.stopPropagation()}
                            className="absolute inset-0 z-10 flex cursor-default flex-col items-center justify-center gap-3 rounded-xl bg-surface-elevated/95 p-4 text-center backdrop-blur-sm"
                          >
                            <p className="text-sm font-medium text-on-surface">
                              Delete “{version.label}”?
                            </p>
                            {isLive ? (
                              <p className="-mt-1 text-[11px] font-medium text-red-500">
                                This card is live. Deleting it removes it from your
                                website right away. This can't be undone.
                              </p>
                            ) : (
                              <p className="-mt-1 text-[11px] text-on-surface-variant">
                                You'll have a few seconds to undo this.
                              </p>
                            )}
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
                                {isLive ? 'Delete & take offline' : 'Delete'}
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
        /* Letter-spacing is not a supported styling concept (no control for it).
           A few sample templates hard-coded it; neutralize it in the live preview
           so the tool renders plain — matching the widget, which also drops it. */
        .promo-live-preview,
        .promo-live-preview * {
          letter-spacing: normal !important;
        }
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
