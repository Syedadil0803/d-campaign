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
} from "react";
import { createPortal } from 'react-dom';
import { FieldLimitNote } from '@/components/promo/FieldLimitNote';
import { isInvalidRange } from '@/lib/dateRange';
import { usePromoFieldStyling } from '@/components/promo/usePromoFieldStyling';
import { usePromoRichText } from '@/components/promo/usePromoRichText';
import {
  Gift,
  X,
  Palette,
} from "lucide-react";
import { CampaignConfig, PromoCard, PromoField, defaultConfig, GradientStyle } from '@/types/campaign';
import { getBackgroundStyle, getISODateWithOffset } from '@/lib/utils';
import { applyTemplateFull } from '@/lib/promo/promoTemplate';
import {
  lookSignature,
  ourLooks,
  cardIsBlank,
  cardIsUntouchedTemplate,
} from "@/lib/promo/promoAuthorship";
import { UndoStack } from '@/lib/editor/undoStack';
import { sampleTemplates } from '@/components/promo/SamplePromoTemplates';

import { advanceBlankLook } from '@/lib/promo/blankLooks';
import { isBlankLook } from '@/lib/promo/lookSignature';
import { useRichTextEditor } from '@/hooks/useRichTextEditor';
import { useSignalEffect } from '@/hooks/useSignalEffect';
import {
  wrapBareTextWithFontSize,
} from "@/lib/editor/richTextUtils";
import RichTextToolbar from "@/components/shared/RichTextToolbar";
import { PopupDropdown } from '@/components/shared/PopupDropdown';
import { CountryFlag, COUNTRY_CODES } from '@/components/shared/CountryFlag';
import { whatsAppUrl, whatsAppLooksShort, maxNationalDigits } from '@/lib/whatsapp';
import {
  listVersions,
  deleteVersion,
  restoreVersion,
  type PromoVersion,
} from "@/lib/promo/promoVersions";
import {
  buildTimerDisplayHtml,
  serializeTimerHtml,
  refreshTimerValueSpans,
  calculateTimeRemaining as calcTimerRemaining,
} from "@/lib/editor/timerUtils";
import { LexicalTimerField, type LexicalTimerFieldHandle } from '@/components/timer-lexical/LexicalTimerField';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { getRequiredCardWidth } from '@/lib/promo/promoMeasure';
import { SegmentedToggle } from '@/components/promo/SegmentedToggle';
import { clonePromoCard, promoCardsEqual, stripHtmlText, withDefaultDates, cardSignature } from '@/lib/promo/promoCardIdentity';
import { GradientControls } from '@/components/promo/GradientControls';
import { FieldInfoNote } from '@/components/promo/FieldInfoNote';
import { readHiddenFieldInfos, hideFieldInfo } from '@/lib/promo/fieldInfoNotes';
import { PromoVersionsPopup } from '@/components/promo/PromoVersionsPopup';
import { PromoDraftPopup } from '@/components/promo/PromoDraftPopup';
import { PromoTemplatesPopup } from '@/components/promo/PromoTemplatesPopup';
import { PromoCardBackgroundPopup } from '@/components/promo/PromoCardBackgroundPopup';
import { PromoThemeRow } from '@/components/promo/PromoThemeRow';
import { PromoEditorToolbar } from '@/components/promo/PromoEditorToolbar';
import { PromoScheduleAndTimer } from '@/components/promo/PromoScheduleAndTimer';
import { PromoPreviewHeader } from '@/components/promo/PromoPreviewHeader';
import {
  PromoCardActionDialog,
  type PromoCardAction,
} from '@/components/promo/PromoCardActionDialog';
import {
  PROMO_EDITOR_DEFAULT_COLOR,
  type PromoSelectionSnapshot,
  hasVisibleContent,
  getPromoSelectionSnapshot,
  restorePromoSelection,
} from '@/lib/promo/promoEditorSelection';
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
  onSaveDraftDirect?: (options?: { keepEditor?: boolean }) => void;
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







interface PromoSnapshot {
  promoCard: PromoCard;
  currentField: PromoField | null;
  selection: PromoSelectionSnapshot | null;
}


interface PromoAppliedRedoSnapshot {
  snapshot: PromoSnapshot;
  baseline: PromoSnapshot | null;
}

/**
 * Rewrites a countdown element to match the stored text, unless the user is
 * typing in it.
 *
 * Both the panel's timer field and the card preview need this, and both had
 * their own copy of it. Module level rather than inside the component so its
 * identity is stable — the two effects that call it list only the campaign
 * values they watch, and a function rebuilt on every render would have had to
 * join those lists and rebuild the element far more often than the text
 * actually changes.
 *
 * The guard is the important line. Replacing innerHTML while the caret is in
 * the element moves the caret to the start, so an element being typed in is
 * left alone and picks up the change when focus leaves.
 */
function syncTimerElement(
  el: HTMLElement | null,
  timerText: string,
  endDate: string,
  activeEditor: HTMLElement | null,
): void {
  if (!el) return;
  if (el === activeEditor || document.activeElement === el) return;
  const nextHtml = buildTimerDisplayHtml(timerText, calcTimerRemaining(endDate));
  if (el.innerHTML !== nextHtml) {
    el.innerHTML = nextHtml;
  }
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
  const [currentTime, setCurrentTime] = useState(Date.now());
  /**
   * Live copies of the stored cards, so checks running inside dialog handlers
   * see the current values rather than the scope the handler was born in.
   */
  /**
   * Is a campaign serving on the customer's website right now?
   *
   * The published card, not the one being edited. These differ the moment the
   * canvas is cleared or a different card is loaded in: the draft is not
   * active, while the website carries on showing what was published. Reading
   * the draft here meant clearing the canvas removed the only button that
   * takes a live campaign down — the campaign kept running with no way to
   * stop it from the editor.
   *
   * Stopping is safe from any editor state: it is built from the published
   * config, so it never pushes whatever happens to be on the canvas.
   */
  const liveIsOnAir = Boolean(livePromoCard?.active);

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
  const [styleWarning, setStyleWarning] = useState<string | null>(null);
  const [fieldInfoPopup, setFieldInfoPopup] = useState<'title' | 'subtitle' | 'description' | null>(null);
  const [hiddenFieldInfos, setHiddenFieldInfos] = useState<Set<string>>(readHiddenFieldInfos);
  /** Closes the note and remembers not to offer it again. */
  function dismissFieldInfo(field: string) {
    setFieldInfoPopup(null);
    setHiddenFieldInfos((current) => hideFieldInfo(current, field));
  }

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
     
  }, [config.promoCard, cardWidth]);

  // End Date field wrapper — the fallback guard scrolls here and flashes its
  // inline error if the user tries to save with an invalid range.
  const endDateFieldRef = useRef<HTMLDivElement>(null);
  const [dateErrorFlash, setDateErrorFlash] = useState(false);
  // Consent before a card-replacing action (Start Fresh / apply Variant / apply Template).
  const [cardActionConfirm, setCardActionConfirm] =
    useState<PromoCardAction | null>(null);

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
  } = useRichTextEditor(activeEditorRef, {
    defaultColor: PROMO_EDITOR_DEFAULT_COLOR,
  });

  /**
   * Multi-step history for the promo editor.
   *
   * The announcement bar keeps a single previous state, so it can swap back
   * once but cannot walk through a session. The promo needs about thirty
   * actions of depth, so it gets a real stack.
   */
  const promoHistory = useRef(new UndoStack<PromoSnapshot>()).current;
  const restoringSnapshotRef = useRef(false);
  const skipOverflowBlockRef = useRef(false);
  const promoDeletingRef = useRef(false);

  const refreshToolbarRef = useRef<(editor: HTMLDivElement | null) => void>(
    () => {},
  );

  const {
    setStylePopupAnchor,
    updateFieldBg,
    setFieldAlignment,
    updateCardBg,
    openFieldStylePopup,
    showStyleWarning,
    getPopupFieldStyle,
    getPopupFieldLabel,
    getPreviewFieldBackground,
    getPopupPositionStyle,
  } = usePromoFieldStyling({
    config,
    setConfig,
    markChanged,
    pushPromoState,
    currentField,
    setCurrentField,
    activeEditorRef,
    promoDeletingRef,
    setShowPersistentScaffold,
    setShowCardBgPopup,
    setStyleWarning,
    // Through a ref: the two hooks each need one thing from the other —
    // styling opens a field and asks the toolbar to re-read it, and the
    // toolbar's handlers show styling's warning. Both calls happen from
    // events, never during render, so one direction is indirected rather than
    // forcing the two groups back into a single hook.
    refreshPromoToolbarFormats: (editor: HTMLDivElement | null) =>
      refreshToolbarRef.current(editor),
    ensureDefaultFontSize,
    promoCardRef,
    fieldPopupHeightRef,
    previewFieldRefs: {
      title: previewTitleRef,
      subtitle: previewSubtitleRef,
      description: previewDescriptionRef,
      button: previewButtonRef,
      timer: previewTimerRef,
    },
  });
  const promoAppliedCardBaselineRef = useRef<PromoSnapshot | null>(null);
  const promoAppliedRedoRef = useRef<PromoAppliedRedoSnapshot | null>(null);
  // True while the current card is a Start-Fresh card. Leaving a fresh card,
  // undo should land on its EDITED state; leaving a template/variant, undo
  // should land on that card's CLEAN baseline (not the edited state).
  const isFreshCardRef = useRef(false);







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
      // The next palette in the rotation — see src/lib/blankLooks.ts.
      style: JSON.parse(JSON.stringify(advanceBlankLook())) as PromoCard["style"],
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
    syncTimerElement(
      previewTimerRef.current,
      config.promoCard.timerText ?? "",
      config.promoCard.endDate || "",
      activeEditorRef.current,
    );
    // showTimer is a dep so the preview repopulates when the timer is toggled
    // back on (the element unmounts/remounts empty otherwise).
  }, [
    config.promoCard.timerText,
    config.promoCard.endDate,
    config.promoCard.showTimer,
  ]);

  useEffect(() => {
    syncTimerElement(
      timerRef.current,
      config.promoCard.timerText ?? "",
      config.promoCard.endDate || "",
      activeEditorRef.current,
    );
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
    /**
     * The prop cannot be trusted on the first render after a load.
     *
     * `blankStart` is decided in page.tsx and arrives here as a prop, so on the
     * commit where a card is loaded this effect can still see `false` while the
     * card on screen is plainly blank. It then filled in an end date, which
     * completed the schedule, which armed the countdown — and a blank canvas
     * came back from a login with a timer running.
     *
     * Asking the card directly removes the timing from the question: a card
     * with no words wearing a blank palette is a blank start, whatever the
     * prop currently says.
     */
    const plain = (html?: string) => String(html ?? '').replace(/<[^>]*>/g, '').trim();
    const looksBlank =
      isBlankLook(config.promoCard.style) &&
      !plain(config.promoCard.title) &&
      !plain(config.promoCard.subtitle) &&
      !plain(config.promoCard.description) &&
      !plain(config.promoCard.buttonText);

    if (blankStart || looksBlank) return;
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



  // Invalid schedule = both dates set and start is after end. Drives the
  // in-field error, the red End Date border, and the disabled Save/Publish CTA.
  const promoDateRangeInvalid = isInvalidRange(
    config.promoCard.startDate,
    config.promoCard.endDate,
  );

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



  // Style key map for field → config path







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

  const {
    handlePromoToolbarFormat,
    handlePromoToolbarColor,
    smartPaste,
    onFieldInput,
    onFieldFocus,
    refreshPromoToolbarFormats,
    syncEditorsFromConfig,
    getActivePromoEditor,
    onPromoEditorKeyDown,
    onPromoPreviewKeyDown,
    warnTimerLimit,
  } = usePromoRichText({
    config,
    setConfig,
    markChanged,
    pushPromoState,
    currentField,
    setCurrentField,
    currentFieldRef,
    getFieldRef,
    titleRef,
    subtitleRef,
    descRef,
    buttonRef,
    timerRef,
    previewTimerRef,
    activeEditorRef,
    lexicalTimerRef,
    cardWidth,
    setCardWidth,
    computeCardWidth,
    hiddenFieldInfos,
    setFieldInfoPopup,
    setShowCardBgPopup,
    setShowPersistentScaffold,
    setStylePopupAnchor,
    showStyleWarning,
    closeAllPromoDropdowns,
    lastInteractionAtRef,
    lastSyncedPromoRef,
    lastValidHtmlRef,
    promoDeletingRef,
    restoringSnapshotRef,
    skipOverflowBlockRef,
    activeFormats,
    setActiveFormats,
    formatText,
    applyColor,
    detectFormats,
    ensureDefaultFontSize,
    saveSelection,
  });
  refreshToolbarRef.current = refreshPromoToolbarFormats;

  
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


  function updateField<K extends keyof PromoCard>(field: K, value: PromoCard[K]) {
    if (configRef.current.promoCard[field] === value) return;
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




  const popupEditableFields = [
    "title",
    "subtitle",
    "description",
    "button",
    "timer",
  ] as const;
  type PopupField = (typeof popupEditableFields)[number];

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
                              saveOutgoingCardToDraft();
                              startFreshPromoCard();
                            },
                          }),
                    });
  }

  // Apply a saved version to the live card — click-to-apply, like a template.
  function applyVersion(version: PromoVersion) {
    setBlankStart(false); // a design has arrived
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
    setBlankStart(false); // a design has arrived
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
    setBlankStart(false); // a design has arrived
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


  /**
   * Save what is on the canvas now, on the way to replacing it.
   *
   * keepEditor matters: the incoming card is applied immediately after this
   * returns, while the write is still in flight, so the editor must survive
   * the write completing.
   */
  function saveOutgoingCardToDraft() {
    if (onSaveDraftDirect) onSaveDraftDirect({ keepEditor: true });
    else onSaveDraft();
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
          saveOutgoingCardToDraft();
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
        saveOutgoingCardToDraft();
        action();
      },
      // Discards the current card without keeping a copy. Offered because
      // some cards are not worth a draft slot, and the cap is five.
      secondaryLabel: 'Continue anyway',
      onSecondary: action,
    });
  }















  const hasTitle = hasVisibleContent(config.promoCard.title);
  const hasSubtitle = hasVisibleContent(config.promoCard.subtitle);
  const hasDescription = hasVisibleContent(config.promoCard.description);
  const hasButtonText = hasVisibleContent(config.promoCard.buttonText);
  /**
   * Words the user wrote around the countdown — "Ends in", "left", and so on.
   *
   * The countdown token itself is stripped before checking, so an untouched
   * timer does not count as work. The timer can also arm itself when dates are
   * set, which is why enabling it is not the test: only text someone typed is.
   */
  const hasTimerText = hasVisibleContent(
    (config.promoCard.timerText || '').replace(/\{timer\}/gi, ''),
  );
  // Nothing to save, nothing to clear: no visible text in any field AND the
  // style is still the fresh default. Styling-only work counts as work, so it
  // must keep both actions enabled — same test as startFreshPromoCard's no-op
  // guard.
  const canvasIsEmpty =
    !hasTitle &&
    !hasSubtitle &&
    !hasDescription &&
    !hasButtonText &&
    // Timer wording is work too. Without this, typing "Ends in" and nothing
    // else left Clear disabled — the canvas plainly was not blank, and the one
    // button that undoes it refused.
    !hasTimerText &&
    // Any blank palette, not this visit's. The palettes rotate per visit, so
    // comparing against today's would say a canvas cleared last week is not
    // empty — leaving Clear enabled on an empty card and treating it as work.
    isBlankLook(config.promoCard.style);
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
   * The blank start ends when a design ARRIVES — a template, a variant, a
   * draft, My Published — and those routes say so themselves, below.
   *
   * It used to be inferred by watching promoCard.style and ending the moment
   * the look stopped being one of the blank palettes. That could not tell a
   * design landing from the user picking their own colour on the blank canvas,
   * so a colour change ended the mode and took the countdown and button
   * outlines with it, while the three text ghosts beside them — which follow
   * showContentScaffold, not this — stayed put. Five hints, two rules, and any
   * style edit dropped two of them.
   *
   * Cards loaded from the server are covered separately: page.tsx recomputes
   * the flag from the card it just loaded.
   */

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
          <PromoCardActionDialog
            action={cardActionConfirm}
            onDismiss={() => setCardActionConfirm(null)}
          />

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

            <FieldInfoNote
              open={fieldInfoPopup === 'title'}
              onDismiss={() => setFieldInfoPopup(null)}
              onNeverShow={() => dismissFieldInfo('title')}
            >
              Titles work best as a single line — marketing best practice. Adjust font size or shorten text to fit.
            </FieldInfoNote>

            {/*
              These three editable fields — title, subtitle, description —
              look like one component written three times, and an attempt to
              make them one was reverted on 26 August 2026 because it changed
              how the per-field line limit behaved.

              The cause was never identified. Every part of the limit was
              compared against the original and matched line for line: the
              per-field maxima, the measurement, the input handler that blocks
              overlong text, the style pre-check, and the card-width
              calculation. Something else about having them here, written out,
              matters.

              So: do not merge these without first working out what that
              something is. The limit logic behind them took a long time to get
              right and is not worth trading for the lines this would save.
            */}
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
                background: getBackgroundStyle(
                  config.promoCard.style.background,
                ),
                paddingTop: '10px',
                paddingBottom: '10px',
              }}
            />
            <FieldLimitNote html={config.promoCard.title} field="title" />
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

            <FieldInfoNote
              open={fieldInfoPopup === 'subtitle'}
              onDismiss={() => setFieldInfoPopup(null)}
              onNeverShow={() => dismissFieldInfo('subtitle')}
            >
              Subtitles are optimised for 2 lines for better engagement. Adjust font size or styling to fit.
            </FieldInfoNote>

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
                background: getBackgroundStyle(
                  config.promoCard.style.background,
                ),
                paddingTop: '10px',
                paddingBottom: '10px',
              }}
            />
            <FieldLimitNote html={config.promoCard.subtitle} field="subtitle" />
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

            <FieldInfoNote
              open={fieldInfoPopup === 'description'}
              onDismiss={() => setFieldInfoPopup(null)}
              onNeverShow={() => dismissFieldInfo('description')}
            >
              Descriptions are capped at 3 lines for readability. Adjust font size or styling to fit your message.
            </FieldInfoNote>

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
                background: getBackgroundStyle(
                  config.promoCard.style.background,
                ),
                paddingTop: '10px',
                paddingBottom: '10px',
              }}
            />
            <FieldLimitNote html={config.promoCard.description} field="description" />
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

          <PromoScheduleAndTimer
            config={config}
            setConfig={setConfig}
            markChanged={markChanged}
            pushPromoState={pushPromoState}
            updateField={updateField}
            showStartDatePicker={showStartDatePicker}
            setShowStartDatePicker={setShowStartDatePicker}
            showEndDatePicker={showEndDatePicker}
            setShowEndDatePicker={setShowEndDatePicker}
            endDateFieldRef={endDateFieldRef}
            promoDateRangeInvalid={promoDateRangeInvalid}
            dateErrorFlash={dateErrorFlash}
            timerRef={timerRef}
            timerLimitReached={timerLimitReached}
            openFieldStylePopup={openFieldStylePopup}
          />

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
                  // Was a plain insert with no cap, so pasting was the one way
                  // to get more than a line into the button.
                  onPaste={(e) => smartPaste(e, 'button')}
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
                <FieldLimitNote html={config.promoCard.buttonText} field="button" />
              </div>
            </div>
        </div>

        {/* Right: Preview — 70% width, fixed */}
        <div className="flex-1 min-h-0 h-full pr-2 flex flex-col gap-3 overflow-x-hidden">
          <PromoPreviewHeader
            liveIsOnAir={liveIsOnAir}
            canReactivate={canReactivate}
            setShowStopConfirm={setShowStopConfirm}
            setShowGoOnAirConfirm={setShowGoOnAirConfirm}
          />
          {/* Action tabs — sit between the preview header and the Website
              Content Area, left-aligned. Fixed height so the preview below
              shrinks to keep the column scroll-free. */}
          <PromoEditorToolbar
            onUseAi={onUseAi}
            setTemplatesFromBuild={setTemplatesFromBuild}
            setShowTemplatesPopup={setShowTemplatesPopup}
            setShowVersionsPopup={setShowVersionsPopup}
            confirmClearCanvas={confirmClearCanvas}
            canvasIsEmpty={canvasIsEmpty}
            openDraftPopup={openDraftPopup}
            draftExists={draftExists}
            onSaveDraft={onSaveDraft}
            savingDraft={savingDraft}
            draftUpToDate={draftUpToDate}
          />
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
                    /**
                     * Held back until the first load, then faded in.
                     *
                     * The editor paints from defaultConfig — always palette one
                     * — before the real card arrives, so the card appeared in
                     * the wrong colours and swapped a moment later, outlines
                     * arriving after that. Gating the whole tab fixed the swap
                     * and replaced it with a blank page, which is worse: the
                     * panel and controls are correct from the first frame and
                     * have no reason to wait.
                     *
                     * Only the card waits, and it holds its space while it
                     * does, so nothing moves when it appears.
                     */
                    opacity: (configLoadedSignal ?? 0) > 0 ? 1 : 0,
                    transition: 'opacity 160ms ease-out',
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

                          {/* Portalled to the body on purpose. `position:
                              fixed` is measured against the nearest ancestor
                              with a transform or filter, and the panel this
                              sits inside carries backdrop-blur — so a 420px
                              box "centred on the viewport" was really centred
                              on a 280px popup, and hung off both sides. With
                              the popup against the canvas's left edge the
                              overflow-x: hidden above it clipped the warning
                              away entirely. */}
                          {styleWarning && typeof document !== 'undefined' && createPortal(
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
                            </>,
                            document.body,
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
                                    updateFieldBg({ type: v as GradientStyle['type'] });
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
                              <GradientControls
                                background={fbg}
                                onChange={updateFieldBg}
                                keyPrefix="field"
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  {showCardBgPopup && (
                    <PromoCardBackgroundPopup
                      popupRef={cardBgPopupRef}
                      anchorRef={promoCardRef}
                      top={cardBgPopupTop}
                      background={config.promoCard.style.background}
                      onChange={updateCardBg}
                      onClose={() => setShowCardBgPopup(false)}
                      typeDropdownOpen={showCardBgTypeDropdown}
                      onTypeDropdownOpen={() => {
                        const next = !showCardBgTypeDropdown;
                        closeAllPromoDropdowns();
                        setShowCardBgPopup(true);
                        setShowCardBgTypeDropdown(next);
                        setCardBgTypePos(getDropdownPosition(cardBgTypeBtnRef.current));
                      }}
                      onTypeDropdownClose={() => setShowCardBgTypeDropdown(false)}
                      typeButtonRef={cardBgTypeBtnRef}
                      typeMenuRef={cardBgTypeMenuRef}
                      typeMenuPosition={cardBgTypePos}
                    />
                  )}
                </div>
              )}
            </div>
          </div>

          <PromoThemeRow
            config={config}
            configRef={configRef}
            setConfig={setConfig}
            markChanged={markChanged}
            pushPromoState={pushPromoState}
            toast={toast}
            showCardPositionDropdown={showCardPositionDropdown}
            setShowCardPositionDropdown={setShowCardPositionDropdown}
            cardPositionPos={cardPositionPos}
            setCardPositionPos={setCardPositionPos}
            cardPositionBtnRef={cardPositionBtnRef}
            cardPositionMenuRef={cardPositionMenuRef}
            closeAllPromoDropdowns={closeAllPromoDropdowns}
            getDropdownPosition={getDropdownPosition}
            cardBgPopupBtnRef={cardBgPopupBtnRef}
            promoCardRef={promoCardRef}
            setShowCardBgPopup={setShowCardBgPopup}
            setCardBgPopupTop={setCardBgPopupTop}
            setShowPersistentScaffold={setShowPersistentScaffold}
            hasCurrentDesign={hasCurrentDesign}
            onOwnDesign={onOwnDesign}
            baselineIsATheme={baselineIsATheme}
            themeBaseline={themeBaseline}
            samplingThemeRef={samplingThemeRef}
          />
        </div>
      </div>

      {/* Stop Campaign Confirmation — immediate (no save/publish needed) */}
      <ConfirmDialog
        open={showStopConfirm}
        title="Switch off this campaign?"
        confirmLabel="Yes, switch off"
        tone="danger"
        onCancel={() => setShowStopConfirm(false)}
        onConfirm={confirmStopCampaign}
      >
        <p className="mt-2 text-sm text-on-surface-variant">
          If you switch off the campaign, the entire campaign stops displaying on your website. Are you sure you want to do it?
        </p>
        <p className="mt-2 text-xs text-on-surface-variant/80">
          You can switch it back on anytime with <strong>Go on air</strong> — as long as the content hasn&apos;t changed. New content needs Save &amp; Publish.
        </p>
      </ConfirmDialog>

      {/* Go On Air Confirmation — reactivate the same published content */}
      <ConfirmDialog
        open={showGoOnAirConfirm}
        title="Go on air?"
        confirmLabel="Yes, go on air"
        onCancel={() => setShowGoOnAirConfirm(false)}
        onConfirm={confirmGoOnAir}
      >
        <p className="mt-2 text-sm text-on-surface-variant">
          This puts the same campaign back on your website right away — no need to save or publish again.
        </p>
      </ConfirmDialog>

      {/* Paste-from-AI import */}
      {/* Sample Templates popup — shows the same 6 cards; click one to apply */}
      {showTemplatesPopup && (
        <PromoTemplatesPopup
          currentCard={configRef.current.promoCard}
          showBack={templatesFromBuild && Boolean(onTemplatesBack)}
          onBack={() => {
            setShowTemplatesPopup(false);
            setTemplatesFromBuild(false);
            onTemplatesBack?.();
          }}
          // Closing always clears the came-from-build flag; every exit did
          // that separately before, and one of them forgetting would have
          // stranded a Back button with nowhere to go.
          onClose={() => {
            setShowTemplatesPopup(false);
            setTemplatesFromBuild(false);
          }}
          onStartFresh={startFreshPromoCard}
          onApplyTemplate={applyTemplate}
          confirmCardReplace={confirmCardReplace}
        />
      )}

      {/* My Draft popup — the single saved, unpublished draft. */}
      {showDraftPopup && (
        <PromoDraftPopup
          draftCard={draftPopupCard}
          loading={draftPopupLoading}
          currentCard={config.promoCard}
          confirmingDelete={confirmDeleteDraft}
          onClose={() => setShowDraftPopup(false)}
          onAskDelete={setConfirmDeleteDraft}
          onDelete={deleteDraft}
          onRestore={restoreDraftPromoCard}
          confirmCardReplace={confirmCardReplace}
        />
      )}

      {/* Versions popup — save / restore / delete up to MAX_VERSIONS snapshots */}
      {showVersionsPopup && (
        <PromoVersionsPopup
          versions={versions}
          livePromoCard={livePromoCard}
          currentCard={config.promoCard}
          pendingDeleteId={pendingDeleteId}
          isLiveVersion={isLiveVersion}
          liveCardIsUnlisted={liveCardIsUnlisted}
          onClose={() => setShowVersionsPopup(false)}
          onApply={applyVersion}
          onDelete={handleDeleteVersion}
          onAskDelete={setPendingDeleteId}
          onStopLive={() => setShowStopConfirm(true)}
          confirmCardReplace={confirmCardReplace}
        />
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
