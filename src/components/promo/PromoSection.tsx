"use client";

import {
  useState,
  useEffect,
  useRef,
  useMemo,
} from "react";
import { cardReplaceConsent } from '@/lib/promo/cardReplaceConsent';
import { PromoCanvas } from '@/components/promo/PromoCanvas';
import { PromoEditorPanel } from '@/components/promo/PromoEditorPanel';
import { usePromoUndo } from '@/components/promo/usePromoUndo';
import {
  PromoEditorProvider,
  type PromoEditorApi,
} from '@/components/promo/PromoEditorContext';
import { isInvalidRange } from '@/lib/dateRange';
import { getFreshPromoCard } from '@/lib/promo/freshPromoCard';
import { usePromoFieldStyling } from '@/components/promo/usePromoFieldStyling';
import { useMirroredHtml } from '@/components/promo/useMirroredHtml';
import { usePromoDropdowns } from '@/components/promo/usePromoDropdowns';
import { usePromoRichText } from '@/components/promo/usePromoRichText';
import {
} from "lucide-react";
import { CampaignConfig, PromoCard, PromoField } from '@/types/campaign';
import { getISODateWithOffset } from '@/lib/utils';
import { applyTemplateFull } from '@/lib/promo/promoTemplate';
import {
  lookSignature,
  ourLooks,
} from "@/lib/promo/promoAuthorship";
import { sampleTemplates } from '@/components/promo/SamplePromoTemplates';

import { isBlankLook } from '@/lib/promo/lookSignature';
import { useRichTextEditor } from '@/hooks/useRichTextEditor';
import { useSignalEffect } from '@/hooks/useSignalEffect';
import {
} from "@/lib/editor/richTextUtils";
import { whatsAppUrl } from '@/lib/whatsapp';
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
import type { LexicalTimerFieldHandle } from '@/components/timer-lexical/LexicalTimerField';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { getRequiredCardWidth } from '@/lib/promo/promoMeasure';
import { clonePromoCard, promoCardsEqual, withDefaultDates, cardSignature } from '@/lib/promo/promoCardIdentity';
import { readHiddenFieldInfos, hideFieldInfo } from '@/lib/promo/fieldInfoNotes';
import { PromoVersionsPopup } from '@/components/promo/PromoVersionsPopup';
import { PromoDraftPopup } from '@/components/promo/PromoDraftPopup';
import { PromoTemplatesPopup } from '@/components/promo/PromoTemplatesPopup';
import { PromoThemeRow } from '@/components/promo/PromoThemeRow';
import { PromoEditorToolbar } from '@/components/promo/PromoEditorToolbar';
import { PromoPreviewHeader } from '@/components/promo/PromoPreviewHeader';
import {
  type PromoCardAction,
} from '@/components/promo/PromoCardActionDialog';
import {
  PROMO_EDITOR_DEFAULT_COLOR,
  hasVisibleContent,
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

  /**
   * The promo card as it stands right now, ahead of React.
   *
   * setConfig does not land until the next render, so between an input event
   * and that render the editors show something `config` does not yet have. The
   * undo history reads this, so a snapshot never depends on which field happens
   * to hold the caret. Every editor write updates it alongside setConfig; this
   * assignment is the baseline for cards that arrive from anywhere else.
   */
  const liveCardRef = useRef(config.promoCard);
  /**
   * Config only wins when it has actually changed.
   *
   * Assigning on every render would let an unrelated re-render — one that
   * happens before a pending setConfig lands — put the OLD card back over an
   * edit the editors have already made, which is the same staleness this ref
   * exists to remove. Comparing identity means cards arriving from elsewhere
   * (a template, a draft, an undo) still take effect, and nothing else does.
   */
  const lastConfigCardRef = useRef(config.promoCard);
  if (lastConfigCardRef.current !== config.promoCard) {
    lastConfigCardRef.current = config.promoCard;
    liveCardRef.current = config.promoCard;
  }
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

  /** Every menu in the editor, and the one effect that dismisses them. */
  const {
    cardPositionBtnRef,
    cardPositionMenuRef,
    showCardPositionDropdown,
    setShowCardPositionDropdown,
    cardPositionPos,
    setCardPositionPos,
    cardBgTypeBtnRef,
    cardBgTypeMenuRef,
    showCardBgTypeDropdown,
    setShowCardBgTypeDropdown,
    cardBgTypePos,
    setCardBgTypePos,
    fieldBgTypeBtnRef,
    fieldBgTypeMenuRef,
    showFieldBgTypeDropdown,
    setShowFieldBgTypeDropdown,
    fieldBgTypePos,
    setFieldBgTypePos,
    countryCodeBtnRef,
    countryCodeMenuRef,
    showCountryCodeDropdown,
    setShowCountryCodeDropdown,
    countryCodePos,
    setCountryCodePos,
    cardBgPopupBtnRef,
    cardBgPopupRef,
    showCardBgPopup,
    setShowCardBgPopup,
    cardBgPopupTop,
    setCardBgPopupTop,
    getDropdownPosition,
    closeAllPromoDropdowns,
  } = usePromoDropdowns();

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


  const skipOverflowBlockRef = useRef(false);
  const promoDeletingRef = useRef(false);

  const PREVIEW_FIELD_REFS = {
    title: previewTitleRef,
    subtitle: previewSubtitleRef,
    description: previewDescriptionRef,
  } as const;

  /** The editors' refs stay here; PromoTextField only receives them. */
  const PANEL_FIELD_REFS = {
    title: titleRef,
    subtitle: subtitleRef,
    description: descRef,
  } as const;

  /**
   * usePromoRichText needs pushPromoState and usePromoUndo needs three of
   * rich text's functions, so one of the two has to be built first. Undo is,
   * because it needs three and rich text needs one — and that one is only
   * ever called from an event, never during render.
   */
  const restoringSnapshotRef = useRef(false);

  const pushPromoStateRef = useRef<(options?: { replace?: boolean }) => void>(
    () => {},
  );

  const refreshToolbarRef = useRef<(editor: HTMLDivElement | null) => void>(
    () => {},
  );

  const styling = usePromoFieldStyling({
    config,
    setConfig,
    markChanged,
    pushPromoState: (options?: { replace?: boolean }) =>
      pushPromoStateRef.current(options),
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
  const {
    setStylePopupAnchor,
    showStyleWarning,
  } = styling;
  // True while the current card is a Start-Fresh card. Leaving a fresh card,
  // undo should land on its EDITED state; leaving a template/variant, undo
  // should land on that card's CLEAN baseline (not the edited state).
  const isFreshCardRef = useRef(false);









  const TEMPLATE_CARDS = sampleTemplates.map((t) => t.promoCard as PromoCard);
  const OUR_LOOKS = ourLooks(TEMPLATE_CARDS);



  function getFieldRef(field: PromoField | null) {
    if (field === "title") return titleRef;
    if (field === "subtitle") return subtitleRef;
    if (field === "description") return descRef;
    if (field === "timer") return timerRef;
    if (field === "button") return buttonRef;
    return null;
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

  // Keep the preview's editors in step with the card without re-rendering
  // them, so a selection being held is not thrown away. See useMirroredHtml.
  useMirroredHtml(previewTitleRef, config.promoCard.title);
  useMirroredHtml(previewSubtitleRef, config.promoCard.subtitle);
  useMirroredHtml(previewDescriptionRef, config.promoCard.description);
  useMirroredHtml(
    previewButtonRef,
    config.promoCard.buttonText,
    config.promoCard.showButton,
  );

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


  const richText = usePromoRichText({
    config,
    setConfig,
    liveCardRef,
    markChanged,
    pushPromoState: (options?: { replace?: boolean }) =>
      pushPromoStateRef.current(options),
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
  const {
    refreshPromoToolbarFormats,
    syncEditorsFromConfig,
    getActivePromoEditor,
  } = richText;

  const {
    pushPromoState,
    pushPromoStateFromConfig,
    capturePromoRestorePoint,
    nothingToOfferBack,
    toastWithUndo,
    setPromoAppliedCardBaseline,
    promoAppliedCardBaselineRef,
    promoHistory,
    promoAppliedRedoRef,
  } = usePromoUndo({
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
    isFreshCardRef,
    draftPromoCardRef,
    livePromoCardRef,
    selectedVersionId,
    setSelectedVersionId,
    onSelectedVersionChange,
    onCardReplaced,
    restoringSnapshotRef,
    toast,
    templateCards: TEMPLATE_CARDS,
  });
  pushPromoStateRef.current = pushPromoState;
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
    const incoming = opts.replacementLabel ?? 'the new card';
    const offerDraftSave = opts.offerDraftSave !== false;

    const verdict = cardReplaceConsent({
      current: pc,
      next: opts.nextCard,
      live: livePromoCard,
      draft: draftPromoCard,
      draftExists,
      draftUpToDate,
      hasUnsavedChanges,
      appliedBaseline: promoAppliedCardBaselineRef.current?.promoCard ?? null,
      nothingToOfferBack: nothingToOfferBack(pc),
      offerDraftSave,
    });

    if (verdict.kind === 'already-applied') {
      toast("That's already the card you're editing.");
      return;
    }
    if (verdict.kind === 'silent') {
      action();
      return;
    }

    // Every dialog below shares one rule: "No" simply closes it. It cancels the
    // replacement and touches nothing, because a button labelled No must never
    // destroy anything.
    if (verdict.kind === 'overwrites-draft') {
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

    if (verdict.kind === 'reassure') {
      setCardActionConfirm({
        ...opts,
        body:
          opts.reassuranceBody ??
          "This only changes the card you're editing. What's live on your website stays up until you publish again.",
        onConfirm: action,
      });
      return;
    }

    if (verdict.kind === 'destructive') {
      setCardActionConfirm({ ...opts, onConfirm: action });
      return;
    }

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
      // Discards the current card without keeping a copy. Offered because some
      // cards are not worth a draft slot, and the cap is five.
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
  /** Keyed forms of the three flags above, for the preview's field table. */
  const previewFieldVisible = {
    title: showTitleInPreview,
    subtitle: showSubtitleInPreview,
    description: showDescriptionInPreview,
  } as const;
  const previewFieldHasContent = {
    title: hasTitle,
    subtitle: hasSubtitle,
    description: hasDescription,
  } as const;
  // The timer is opt-in via "Enable Timer" — it must follow the toggle only,
  // NOT the editing scaffold, so disabling it hides the countdown immediately.
  const showTimerInPreview = config.promoCard.showTimer;
  const showButtonInPreview = config.promoCard.showButton;

  /**
   * What the editor's parts read instead of taking props.
   *
   * The rich-text and styling hooks are spread whole rather than listed out,
   * so adding to either reaches the canvas without a change here.
   */
  const editorApi: PromoEditorApi = {
    ...richText,
    ...styling,
    config,
    setConfig,
    markChanged,
    currentField,
    setCurrentField,
    updateField,
    promoCardRef,
    previewFieldRefs: PREVIEW_FIELD_REFS,
    previewButtonRef,
    lexicalTimerRef,
    activeEditorRef,
    fieldPopupHeightRef,
    blankStart,
    previewZoom,
    cardWidth,
    setCardWidth,
    computeCardWidth,
    showTimerInPreview,
    showButtonInPreview,
    previewFieldVisible,
    previewFieldHasContent,
    ctaDestination,
    onTimerEdited,
    configLoadedSignal,
    activeFormats,
    setActiveFormats,
    styleWarning,
    setStyleWarning,
    showCardBgPopup,
    setShowCardBgPopup,
    cardBgPopupRef,
    cardBgPopupTop,
    showCardBgTypeDropdown,
    setShowCardBgTypeDropdown,
    cardBgTypeBtnRef,
    cardBgTypeMenuRef,
    cardBgTypePos,
    setCardBgTypePos,
    showFieldBgTypeDropdown,
    setShowFieldBgTypeDropdown,
    fieldBgTypeBtnRef,
    fieldBgTypeMenuRef,
    fieldBgTypePos,
    setFieldBgTypePos,
    closeAllPromoDropdowns,
    getDropdownPosition,
    popupEditableFields,
    panelFieldRefs: PANEL_FIELD_REFS,
    buttonRef,
    timerRef,
    fieldInfoPopup,
    setFieldInfoPopup,
    dismissFieldInfo,
    cardActionConfirm,
    setCardActionConfirm,
    pushPromoState,
    pushPromoStateFromConfig,
    liveCardRef,
    showStartDatePicker,
    setShowStartDatePicker,
    showEndDatePicker,
    setShowEndDatePicker,
    endDateFieldRef,
    promoDateRangeInvalid,
    dateErrorFlash,
    timerLimitReached,
    showCountryCodeDropdown,
    setShowCountryCodeDropdown,
    countryCodePos,
    setCountryCodePos,
    countryCodeBtnRef,
    countryCodeMenuRef,
  };

  return (
    <PromoEditorProvider value={editorApi}>
      <>
      <div
        className="sticky top-0 flex gap-4 overflow-hidden"
        style={{ height: "calc(100dvh - 120px)", maxHeight: "calc(100dvh - 120px)" }}
      >
        <PromoEditorPanel />

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
          <PromoCanvas />

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
    </PromoEditorProvider>
  );
}
