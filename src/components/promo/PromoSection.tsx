"use client";

import {
  useState,
  useEffect,
  useRef,
  useMemo,
} from "react";
import { PromoCanvas } from '@/components/promo/PromoCanvas';
import { PromoEditorPanel } from '@/components/promo/PromoEditorPanel';
import { usePromoUndo } from '@/components/promo/usePromoUndo';
import {
  PromoEditorProvider,
  type PromoEditorApi,
} from '@/components/promo/PromoEditorContext';
import { getFreshPromoCard } from '@/lib/promo/freshPromoCard';
import { usePromoFieldStyling } from '@/components/promo/usePromoFieldStyling';
import { usePromoDropdowns } from '@/components/promo/usePromoDropdowns';
import { usePromoPopupFlags } from '@/components/promo/usePromoPopupFlags';
import { usePromoVersions } from '@/components/promo/usePromoVersions';
import { usePromoRichText } from '@/components/promo/usePromoRichText';
import {
} from "lucide-react";
import { PromoCard, PromoField } from '@/types/campaign';
import { getISODateWithOffset } from '@/lib/utils';
import {
  ourLooks,
  timerWordingIsOurs,
} from "@/lib/promo/promoAuthorship";
import { sampleTemplates } from '@/lib/promo/sampleTemplateCards';

import { isBlankLook } from '@/lib/promo/lookSignature';
import { useRichTextEditor } from '@/hooks/useRichTextEditor';
import { useSignalEffect } from '@/hooks/useSignalEffect';

import {
} from "@/lib/promo/promoVersions";
import {
  buildTimerDisplayHtml,
  calculateTimeRemaining as calcTimerRemaining,
} from "@/lib/editor/timerUtils";
import type { LexicalTimerFieldHandle } from '@/components/timer-lexical/LexicalTimerField';
import { getRequiredCardWidth } from '@/lib/promo/promoMeasure';
import {
} from '@/lib/promo/cardReplaceCopy';
import { PromoThemeRow } from '@/components/promo/PromoThemeRow';
import { PromoEditorStyles } from '@/components/promo/PromoEditorStyles';
import { PromoSectionDialogs } from '@/components/promo/PromoSectionDialogs';
import { usePromoCardLifecycle } from '@/components/promo/usePromoCardLifecycle';
import { usePromoPreviewFit } from '@/components/promo/usePromoPreviewFit';
import { usePromoEditorSync } from '@/components/promo/usePromoEditorSync';
import { usePromoThemeBaseline } from '@/components/promo/usePromoThemeBaseline';
import { usePromoScheduleUi } from '@/components/promo/usePromoScheduleUi';
import { useFieldInfoNotes } from '@/components/promo/useFieldInfoNotes';
import type { PromoSectionProps } from '@/components/promo/promoSectionProps';
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














/**
 * The template cards and every look the app hands out, built once.
 *
 * Both derive from module constants, so computing them inside the component
 * rebuilt a twelve-element array and re-signed twelve looks on every render —
 * for values that cannot change.
 */
const TEMPLATE_CARDS = sampleTemplates.map((t) => t.promoCard as PromoCard);
const OUR_LOOKS = ourLooks(TEMPLATE_CARDS);

export function PromoSection(props: PromoSectionProps) {
  // Named rather than destructured in the signature: the card-lifecycle
  // hook takes the whole object, which is one argument instead of eleven.
  const {
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
  openTemplatesSignal,
  onTemplatesBack,
  pendingPopup,
  onPendingPopupHandled,
  onSaveDraft,
  savingDraft,
  draftUpToDate,
  draftExists,
  onUseAi,
} = props;

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
  const fieldInfo = useFieldInfoNotes();
  const { hiddenFieldInfos, setFieldInfoPopup } = fieldInfo;

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
  // Shared by the sync hook and the rich-text hook — see usePromoEditorSync.
  const lastSyncedPromoRef = useRef<string | null>(null);
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
  const dropdowns = usePromoDropdowns();
  const {
    cardPositionBtnRef,
    cardPositionMenuRef,
    showCardPositionDropdown,
    setShowCardPositionDropdown,
    cardPositionPos,
    setCardPositionPos,
    cardBgPopupBtnRef,
    setShowCardBgPopup,
    setCardBgPopupTop,
    getDropdownPosition,
    closeAllPromoDropdowns,
  } = dropdowns;

  const { promoCardRef, cardWidth, setCardWidth, previewZoom } =
    usePromoPreviewFit({ config, setConfig });

  // End Date field wrapper — the fallback guard scrolls here and flashes its
  // inline error if the user tries to save with an invalid range.
  // Consent before a card-replacing action (Start Fresh / apply Variant / apply Template).
  const [cardActionConfirm, setCardActionConfirm] =
    useState<PromoCardAction | null>(null);

  const [showPersistentScaffold, setShowPersistentScaffold] = useState(true);
  /**
   * The same flag for the history to read at push time. Assigned during render
   * rather than in an effect, so a push in the very same commit as a change to
   * the flag still sees the new value.
   */
  const showPersistentScaffoldRef = useRef(showPersistentScaffold);
  showPersistentScaffoldRef.current = showPersistentScaffold;
  /**
   * Renaming only: the flag itself is a prop now (see the interface above).
   *
   * Revealing the fields one at a time as they were filled was tried and
   * dropped — it left the user unable to see the shape of the card they were
   * building. What it still governs is the schedule: a cleared card has no end
   * date, so the countdown stays off until the user sets one.
   */
  const setBlankStart = onBlankStartChange;

  const popupFlags = usePromoPopupFlags();
  const {
    setShowVersionsPopup,
    setShowTemplatesPopup,
    setTemplatesFromBuild,
    setShowDraftPopup,
    setConfirmDeleteDraft,
    draftPopupCard,
    confirmDeleteDraft,
    showDraftPopup,
    showTemplatesPopup,
    templatesFromBuild,
    draftPopupLoading,
    showVersionsPopup,
  } = popupFlags;

  const versionsApi = usePromoVersions({
    promoCard: config.promoCard,
    onSelectedVersionChange,
    showVersionsPopup: popupFlags.showVersionsPopup,
  });
  const {
    versions,
    selectedVersionId,
    setSelectedVersionId,
    pendingDeleteId,
    setPendingDeleteId,
  } = versionsApi;



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
  const [showStopConfirm, setShowStopConfirm] = useState(false);
  const [showGoOnAirConfirm, setShowGoOnAirConfirm] = useState(false);
  // Paste-from-AI import: modal open, textarea contents, and last parse error.





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
    liveCardRef,
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

  usePromoEditorSync({
    config,
    titleRef,
    subtitleRef,
    descRef,
    buttonRef,
    timerRef,
    previewTitleRef,
    previewSubtitleRef,
    previewDescriptionRef,
    previewButtonRef,
    previewTimerRef,
    activeEditorRef,
    lastValidHtmlRef,
    lastSyncedPromoRef,
    setCardWidth,
    currentTime,
  });

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



  const scheduleUi = usePromoScheduleUi({ config, dateErrorPing });

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

  const undo = usePromoUndo({
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
    selectedVersionId,
    setSelectedVersionId,
    onSelectedVersionChange,
    onCardReplaced,
    restoringSnapshotRef,
    lexicalTimerRef,
    toast,
    templateCards: TEMPLATE_CARDS,
  });
  const {
    pushPromoState,
    pushPromoStateFromConfig,
    capturePromoRestorePoint,
    toastWithUndo,
    setPromoAppliedCardBaseline,
    promoHistory,
    promoAppliedRedoRef,
} = undo;
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
  /**
   * Wording the user put on the countdown — not the wording we shipped.
   *
   * The default is "Ends In {timer}", which strips to "Ends In" and read as
   * writing, so Clear and Save as draft stayed enabled on a canvas nobody had
   * touched. timerWordingIsOurs is the same test cardIsBlank uses, so the two
   * cannot disagree about it again.
   */
  const hasTimerText =
    !timerWordingIsOurs(config.promoCard.timerText) &&
    hasVisibleContent((config.promoCard.timerText || '').replace(/\{timer\}/gi, ''));
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

  const {
    themeBaseline,
    setThemeBaseline,
    samplingThemeRef,
    onOwnDesign,
    baselineIsATheme,
    hasCurrentDesign,
  } = usePromoThemeBaseline({
    style: config.promoCard.style,
    canvasIsEmpty,
    ourLooks: OUR_LOOKS,
    toast,
  });

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
   * Everything that replaces the whole card — templates, variants, the draft,
   * clearing the canvas, deleting a variant.
   *
   * The four hooks and this component's own props go in whole rather than as
   * their thirty-nine members; the hook destructures each group straight back
   * to the names it uses, so the argument list is a seam without the bodies
   * having to be rewritten around it.
   */
  const lifecycle = usePromoCardLifecycle({
    props,
    undo,
    versionsApi,
    popupFlags,
    configRef,
    setConfig,
    markChanged,
    syncEditorsFromConfig,
    setBlankStart,
    startFreshPromoCard,
    toast,
    canvasIsEmpty,
    isFreshCardRef,
    setCardActionConfirm,
  });
  const {
    ctaDestination,
    isLiveVersion,
    liveCardIsUnlisted,
    handleDeleteVersion,
    confirmClearCanvas,
    applyVersion,
    openDraftPopup,
    deleteDraft,
    restoreDraftPromoCard,
    applyTemplate,
    confirmCardReplace,
  } = lifecycle;


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
    ...scheduleUi,
    ...fieldInfo,
    ...styling,
    ...popupFlags,
    ...versionsApi,
    ...dropdowns,
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
    popupEditableFields,
    panelFieldRefs: PANEL_FIELD_REFS,
    buttonRef,
    timerRef,
    cardActionConfirm,
    setCardActionConfirm,
    pushPromoState,
    pushPromoStateFromConfig,
    liveCardRef,
    timerLimitReached,
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

      <PromoSectionDialogs
        showStopConfirm={showStopConfirm}
        setShowStopConfirm={setShowStopConfirm}
        confirmStopCampaign={confirmStopCampaign}
        showGoOnAirConfirm={showGoOnAirConfirm}
        setShowGoOnAirConfirm={setShowGoOnAirConfirm}
        confirmGoOnAir={confirmGoOnAir}
        showTemplatesPopup={showTemplatesPopup}
        setShowTemplatesPopup={setShowTemplatesPopup}
        templatesFromBuild={templatesFromBuild}
        setTemplatesFromBuild={setTemplatesFromBuild}
        onTemplatesBack={onTemplatesBack}
        startFreshPromoCard={startFreshPromoCard}
        applyTemplate={applyTemplate}
        showDraftPopup={showDraftPopup}
        setShowDraftPopup={setShowDraftPopup}
        draftPopupCard={draftPopupCard}
        draftPopupLoading={draftPopupLoading}
        confirmDeleteDraft={confirmDeleteDraft}
        setConfirmDeleteDraft={setConfirmDeleteDraft}
        deleteDraft={deleteDraft}
        restoreDraftPromoCard={restoreDraftPromoCard}
        showVersionsPopup={showVersionsPopup}
        setShowVersionsPopup={setShowVersionsPopup}
        versions={versions}
        livePromoCard={livePromoCard}
        pendingDeleteId={pendingDeleteId}
        setPendingDeleteId={setPendingDeleteId}
        isLiveVersion={isLiveVersion}
        liveCardIsUnlisted={liveCardIsUnlisted}
        applyVersion={applyVersion}
        handleDeleteVersion={handleDeleteVersion}
        config={config}
        configRef={configRef}
        confirmCardReplace={confirmCardReplace}
      />
      <PromoEditorStyles />
      </>
    </PromoEditorProvider>
  );
}
