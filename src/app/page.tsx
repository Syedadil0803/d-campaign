'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { X, Loader2 } from 'lucide-react';
import { CampaignConfig, defaultConfig } from '@/types/campaign';
import { normalizeLegacyTimerTokens, TIMER_FIXED_TOKEN } from '@/lib/timerUtils';
import { fieldOverflows } from '@/lib/promoFit';
import { Header } from '@/components/Header';
import { Dashboard } from '@/components/Dashboard';
import { AnnouncementSection } from '@/components/AnnouncementSection';
import { PromoFlow } from '@/components/PromoFlow';
import { PromoSetupDialog } from '@/components/PromoSetupDialog';
import { Toast } from '@/components/Toast';
import { getISODateWithOffset } from '@/lib/utils';
import {
  listVersions,
  MAX_VERSIONS,
  saveVersion,
  updateVersion,
  type PromoVersion,
} from '@/lib/promoVersions';

// Migration functions
function migrateAnnouncements(config: any): CampaignConfig['announcementBar']['announcements'] {
  if (!Array.isArray(config.announcementBar.announcements)) {
    // Convert old string format to new object format
    const oldAnnouncements = config.announcementBar.announcements;
    return oldAnnouncements.map((text: string, index: number) => ({
      text,
      richText: false
    }));
  }
  return config.announcementBar.announcements;
}

function normalizePromoCardFontSizes(promoCard: any): CampaignConfig['promoCard'] {
  // Ensure all text fields have explicit font-size in HTML
  const fieldsToNormalize = ['title', 'subtitle', 'description', 'buttonText'] as const;
  const normalized = { ...promoCard };
  
  fieldsToNormalize.forEach(field => {
    if (normalized[field] && typeof normalized[field] === 'string') {
      // Wrap bare text with default font size if no font-size spans exist
      if (!normalized[field].includes('font-size')) {
        normalized[field] = `<span style="font-size: 1rem;">${normalized[field]}</span>`;
      }
    }
  });
  
  return normalized;
}

function migrateTimerText(promoCard: any): CampaignConfig['promoCard'] {
  const raw = (promoCard.timerText || '').trim();

  // Already in the new fixed-block format (chip span or {timer} marker) — leave
  // it untouched so the per-word structure/styling survives reloads.
  if (raw.includes('data-timer-fixed') || raw.includes(TIMER_FIXED_TOKEN)) {
    return { ...promoCard, timerText: promoCard.timerText };
  }

  // Empty → countdown only (placeholders guide the rest); no "Ends in" default.
  if (!raw) {
    return { ...promoCard, timerText: TIMER_FIXED_TOKEN };
  }

  // Legacy token / placeholder-span template → flatten to plain text, collapse
  // the {hh}:{mm}:{ss} run into a single {timer}, keep surrounding text as prefix.
  const flattened = raw
    .replace(/<span[^>]*data-timer-placeholder="hhh"[^>]*>.*?<\/span>/gi, '{hh}')
    .replace(/<span[^>]*data-timer-placeholder="mmm"[^>]*>.*?<\/span>/gi, '{mm}')
    .replace(/<span[^>]*data-timer-placeholder="sss"[^>]*>.*?<\/span>/gi, '{ss}')
    .replace(/<span[^>]*data-timer-placeholder="(?:ddd|dd|d)"[^>]*>.*?<\/span>/gi, '{d}')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  const collapsed = normalizeLegacyTimerTokens(flattened);
  const withMarker = collapsed.includes(TIMER_FIXED_TOKEN)
    ? collapsed
    : `${collapsed ? collapsed + ' ' : ''}${TIMER_FIXED_TOKEN}`;

  return { ...promoCard, timerText: withMarker };
}

function migrateButtonStyle(promoCard: any): CampaignConfig['promoCard'] {
  // Add default buttonStyle if missing
  if (!promoCard.style.buttonStyle) {
    return {
      ...promoCard,
      style: {
        ...promoCard.style,
        buttonStyle: {
          background: { type: 'solid', startColor: '#3f8f47', endColor: '#3f8f47' },
          textColor: '#ffffff',
          textAlign: 'center'
        }
      }
    };
  }
  return promoCard;
}

function migrateButtonFullWidth(promoCard: any): CampaignConfig['promoCard'] {
  // Add default buttonFullWidth if missing
  if (promoCard.buttonFullWidth === undefined) {
    return {
      ...promoCard,
      buttonFullWidth: true
    };
  }
  return promoCard;
}

function normalizeAnnouncementBackgroundType(config: any): CampaignConfig['announcementBar'] {
  const announcementBar = { ...config.announcementBar };
  const background = announcementBar?.style?.background;

  if (!background) return announcementBar;

  const normalizedBackground = { ...background };
  const validTypes = ['solid', 'linear', 'radial'];

  if (!validTypes.includes(normalizedBackground.type)) {
    normalizedBackground.type = 'solid';
  }

  // Root-level normalization: same start/end color should persist as solid type.
  if (normalizedBackground.startColor === normalizedBackground.endColor) {
    normalizedBackground.type = 'solid';
  }

  return {
    ...announcementBar,
    style: {
      ...announcementBar.style,
      background: normalizedBackground,
    },
  };
}

function migrateConfig(config: any, version: string): CampaignConfig {
  let migrated = { ...config };

  // Always normalize announcement background style regardless of version.
  migrated.announcementBar = normalizeAnnouncementBackgroundType(migrated);
  
  // Check version and apply appropriate migrations
  if (!version || version === '1.0') {
    // Apply all v1.0+ migrations
    migrated.announcementBar.announcements = migrateAnnouncements(migrated);
    migrated.promoCard = normalizePromoCardFontSizes(migrated.promoCard);
    migrated.promoCard = migrateTimerText(migrated.promoCard);
    migrated.promoCard = migrateButtonStyle(migrated.promoCard);
    migrated.promoCard = migrateButtonFullWidth(migrated.promoCard);
    
    // Update version
    migrated.version = '1.1';
  }
  
  return migrated;
}

export default function Home() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'announcement' | 'promo'>('dashboard');
  // `config` is the editing/draft state (what the editors show). `publishedConfig`
  // is what's actually LIVE on the website — the Dashboard renders this so it
  // never shows unpublished draft content as if it were live.
  const [config, setConfig] = useState<CampaignConfig>(defaultConfig);
  const [publishedConfig, setPublishedConfig] = useState<CampaignConfig>(defaultConfig);
  const [hasAnnouncementChanges, setHasAnnouncementChanges] = useState(false);
  const [hasPromoChanges, setHasPromoChanges] = useState(false);
  // Announcement still stages via Save → Publish (promo saves straight to a
  // draft from the tab strip instead, so it has no staged/"ready" state).
  const [readyToPublishAnnouncement, setReadyToPublishAnnouncement] = useState(false);
  const hasChanges = hasAnnouncementChanges || hasPromoChanges;
  const [pendingDraftAction, setPendingDraftAction] = useState<
    | { type: 'tab'; tab: 'dashboard' | 'announcement' | 'promo' }
    | { type: 'logout' }
    | null
  >(null);
  const [pendingVariantSave, setPendingVariantSave] = useState<{
    config: CampaignConfig;
    versions: PromoVersion[];
    // Whether this dialog was opened from a plain Save or from Publish — Publish
    // must finish going live after the variant is stored, not just save.
    mode: 'save' | 'publish';
  } | null>(null);
  const [selectedPromoVersionId, setSelectedPromoVersionId] = useState<string | null>(null);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastIsError, setToastIsError] = useState(false);
  const [publishConfirm, setPublishConfirm] = useState<{
    warnings: string[];
    onConfirm: () => Promise<void> | void;
    title?: string;
    message?: string;
    confirmLabel?: string;
    cancelLabel?: string;
    // When true, confirm runs onConfirm as-is (e.g. to open a follow-up popup)
    // WITHOUT the "Publishing…" state — avoids a flicker when chaining popups.
    deferPublish?: boolean;
    // Runs when the popup is dismissed (Cancel / backdrop) — e.g. to revert a
    // provisional state change.
    onCancel?: () => void;
  } | null>(null);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  // Explicit "Save as draft" — writing in progress, and the replace-confirm
  // shown when a draft already exists (only one draft slot).
  const [savingDraft, setSavingDraft] = useState(false);
  const [confirmReplaceDraft, setConfirmReplaceDraft] = useState(false);
  // Signature of the draft actually stored in the DB (null = no draft). Kept
  // in state, not a ref, so the "Save as draft" button can disable itself when
  // the editor already matches the draft — re-saving identical content only
  // produces a pointless "Replace saved draft?" prompt.
  const [savedDraftSignature, setSavedDraftSignature] = useState<string | null>(null);
  // Which guided-flow step the promo tab is on. Publish is an editor action, so
  // the header hides it while the user is still picking a start or writing copy.
  // Where the promo tab opens. Dashboard's View/Edit act on an existing
  // campaign, so they go straight to the editor; the nav tab starts fresh.
  // Includes 'ai' so the dashboard's create dialog can send someone straight
  // to the AI screen without passing through the editor first.
  // Where the promo tab opens: the editor, or the editor with the AI panel
  // already up. There is no separate start screen any more.
  const [promoEntryStep, setPromoEntryStep] = useState<'ai' | 'build' | 'editor'>('editor');
  const mainScrollRef = useRef<HTMLElement>(null);
  const configRef = useRef(config);
  configRef.current = config;
  const hasChangesRef = useRef(hasChanges);
  hasChangesRef.current = hasChanges;
  // Any pending draft work (unsaved edits OR a staged-but-unpublished
  // announcement) — a live on-air toggle must preserve this, not discard it.
  const pendingDraft = hasChanges || readyToPublishAnnouncement;
  const pendingDraftRef = useRef(pendingDraft);
  pendingDraftRef.current = pendingDraft;
  const draftSignatureRef = useRef<string | null>(null);
  const savedPromoSignatureRef = useRef<string | null>(null);
  const publishedConfigRef = useRef<string | null>(null);
  // The published config object (not just its signature) — lets draft checks
  // compare the announcement against what's live.
  const publishedConfigObjRef = useRef<CampaignConfig | null>(null);

  function getConfigSignature(cfg: CampaignConfig) {
    // `active` / `stoppedByUser` are live on/off flags managed by Go-on-air /
    // Stop, not content. Exclude them so the Save/dirty check reflects real
    // content changes only — e.g. re-applying an already-live variant (which
    // flips active) must not read as "unsaved changes". Mirrors the reactivate
    // comparison below.
    const strip = (o: Record<string, unknown>) => {
      const clone = { ...o };
      delete clone.active;
      delete clone.stoppedByUser;
      return clone;
    };
    // `lastUpdated` is rewritten on every save, so including it made two
    // identical configs compare as different — which meant a draft could never
    // match what's published, and the "Welcome back" banner fired for drafts
    // holding no real changes.
    const { lastUpdated: _ignored, ...content } = cfg;
    return JSON.stringify({
      ...content,
      announcementBar: strip(cfg.announcementBar as unknown as Record<string, unknown>),
      promoCard: strip(cfg.promoCard as unknown as Record<string, unknown>),
    });
  }

  function hasChangesSinceDraft() {
    return hasChangesRef.current && draftSignatureRef.current !== getConfigSignature(configRef.current);
  }

  function getPromoSignature(cfg: CampaignConfig) {
    return JSON.stringify(cfg.promoCard);
  }

  function getAutoVariantLabel() {
    return `Saved ${new Date().toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })}`;
  }

  async function getPromoVariantSaveStatus(cfg: CampaignConfig) {
    const promoSignature = getPromoSignature(cfg);
    // The saved-signature cache is only trustworthy when the card is ACTUALLY in
    // the saved list. loadConfig seeds savedPromoSignatureRef from the *published*
    // card — which is NOT itself a saved variant — so an early ref short-circuit
    // makes publishing a freshly loaded card return 'skipped' and record nothing
    // in My Published (the reported "empty after publishing" bug). Consult the
    // list itself as the source of truth instead.
    const existingVersions = await listVersions();
    const match = existingVersions.find(
      (version) => JSON.stringify(version.promoCard) === promoSignature,
    );
    if (match) {
      savedPromoSignatureRef.current = promoSignature;
      // Already recorded — make sure it's the highlighted "Live" entry.
      setSelectedPromoVersionId(match.id);
      return 'skipped';
    }

    return existingVersions.length >= MAX_VERSIONS ? 'pending' : 'ready';
  }

  async function savePromoVariant(cfg: CampaignConfig, allowOverflow = false) {
    const updatedVersions = await saveVersion(cfg.promoCard, getAutoVariantLabel(), { allowOverflow });
    setSelectedPromoVersionId(updatedVersions[updatedVersions.length - 1]?.id ?? null);
    savedPromoSignatureRef.current = getPromoSignature(cfg);
  }

  useEffect(() => {
    loadConfig();
    
    const savedDarkMode = localStorage.getItem('darkMode');
    if (savedDarkMode !== null) {
      setIsDarkMode(savedDarkMode === 'true');
    } else {
      setIsDarkMode(window.matchMedia('(prefers-color-scheme: dark)').matches);
    }
  }, []);

  /**
   * Drafting is manual — except when the work is about to be lost.
   *
   * On tab close or refresh we take one rescue copy so unsaved work survives,
   * and warn with the native prompt. saveDraft's own guard keeps this from
   * creating phantom drafts: nothing is written unless there's restorable
   * work, and a blank card clears the slot instead.
   *
   * markHandled: false so this never counts as the user having decided —
   * they'll still be offered the draft on return.
   */
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!hasChangesRef.current) return;
      saveDraft(configRef.current, { markHandled: false });
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  useEffect(() => {
    mainScrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, [activeTab]);

  // Consent before discarding a draft (destructive).
  const [confirmDiscardDraft, setConfirmDiscardDraft] = useState(false);
  // Consent before throwing away unpublished edits (also destructive).
  const [confirmDiscardChanges, setConfirmDiscardChanges] = useState(false);
  /**
   * A dashboard action held back because the editor has work that isn't in the
   * draft. Both entries lead somewhere that replaces the canvas, so the user
   * is offered the save here rather than losing it silently.
   */
  const [pendingDashboardAction, setPendingDashboardAction] = useState<
    'create' | 'published' | null
  >(null);
  /**
   * True when the editor holds promo work that is NOT in the saved draft.
   *
   * A ref because the dashboard handlers are stable callbacks — reading state
   * inside them would capture whatever it was when they were created.
   */
  const promoWorkNotInDraftRef = useRef(false);
  // Bumped to open the build panel when the flow is already mounted.
  const [openBuildSignal, setOpenBuildSignal] = useState(0);
  // A picker the editor should open as soon as it mounts, set by the
  // dashboard's "Edit published". Cleared by the editor once acted on.
  const [pendingPromoPopup, setPendingPromoPopup] = useState<'published' | 'draft' | null>(null);
  // The schedule dialog serves two intents, and they end differently:
  //   'new'      → starting a campaign, so it continues to the build panel
  //   'schedule' → an existing card just missing dates, so it returns to work
  const [createIntent, setCreateIntent] = useState<'new' | 'schedule'>('new');
  const [showCreateSetup, setShowCreateSetup] = useState(false);
  const [createStart, setCreateStart] = useState('');
  const [createEnd, setCreateEnd] = useState('');
  /** Bumped to remount the editors so they re-read a reverted config. */
  const [editorResetKey, setEditorResetKey] = useState(0);

  // Invalid promo schedule = both dates set and start is after end. Blocks
  // Save/Publish (disabled CTA); the ping triggers PromoSection's scroll+flash
  // fallback if a save is somehow still attempted.
  const promoDateRangeInvalid = (() => {
    const s = config.promoCard.startDate;
    const e = config.promoCard.endDate;
    return !!(s && e && s > e);
  })();
  const [promoDateErrorPing, setPromoDateErrorPing] = useState(0);
  // Returns true (and fires the fallback guard) when a promo save/publish must
  // be blocked because the date range is invalid.
  function blockPromoSaveIfInvalidRange(): boolean {
    const s = configRef.current.promoCard.startDate;
    const e = configRef.current.promoCard.endDate;
    if (s && e && s > e) {
      setPromoDateErrorPing((n) => n + 1);
      return true;
    }
    return false;
  }

  // Tab switches no longer auto-save a draft — drafting is explicit only
  // ("Save as draft"), so switching tabs just switches tabs.
  const handleTabSwitch = useCallback(
    (tab: 'dashboard' | 'announcement' | 'promo') => {
      if (tab === activeTab) return;
      // The Promo Card tab goes straight into the editor on the last edited
      // state — same as every other route into promo.
      if (tab === 'promo') {
        setPromoEntryStep('editor');
        // Reaching the editor by the tab used to skip the schedule question
        // entirely, so a card started this way had no dates — while the editor
        // marks Campaign Duration REQUIRED and Publish refuses without it.
        // Ask here too, so the date step can't be missed whichever door is used.
        const pc = configRef.current.promoCard;
        if (!pc.startDate || !pc.endDate) {
          setCreateIntent('schedule');
          setCreateStart(pc.startDate || getISODateWithOffset(0));
          setCreateEnd(pc.endDate || '');
          setShowCreateSetup(true);
        }
      }
      setActiveTab(tab);
    },
    [activeTab],
  );

  /**
   * AI content landed on the card. Nothing is saved here — drafting stays
   * explicit — but the promo tab should now reopen on the editor rather than
   * the start picker, so leaving and coming back keeps the generated card.
   */
  const handleAiApplied = useCallback(() => {
    setPromoEntryStep('editor');
  }, []);

  /**
   * "Create promo card" on an empty dashboard. The schedule + build-method
   * dialog opens HERE, over the dashboard, rather than sending the user to a
   * picker first — there's nothing to pick from on a first run.
   */
  const handleCreatePromo = useCallback(() => {
    if (promoWorkNotInDraftRef.current) {
      setPendingDashboardAction('create');
      return;
    }
    startCreatePromo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** The actual create flow, once nothing is at risk. */
  const startCreatePromo = useCallback(() => {
    setCreateIntent('new');
    setCreateStart(getISODateWithOffset(0));
    setCreateEnd('');
    setShowCreateSetup(true);
  }, []);

  /**
   * Dashboard → the editor with a picker already open.
   *
   * The choice of WHICH card belongs in front of the canvas it loads onto, so
   * these entries don't load anything themselves — they open My Published or
   * My Draft and let the user pick there.
   */
  const handleOpenPublishedPromo = useCallback(() => {
    if (promoWorkNotInDraftRef.current) {
      setPendingDashboardAction('published');
      return;
    }
    openPublishedPicker();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Opens My Published in the editor, once nothing is at risk. */
  const openPublishedPicker = useCallback(() => {
    setPromoEntryStep('editor');
    setActiveTab('promo');
    setPendingPromoPopup('published');
    toast('Pick a published campaign to work from — or use Improve with AI.');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Commits the schedule from the dashboard dialog and opens the editor with
   * the build panel up. The dashboard asks WHEN; the editor asks HOW, next to
   * the card that the answer applies to.
   */
  function startNewPromo() {
    setConfig((prev) => ({
      ...prev,
      promoCard: { ...prev.promoCard, startDate: createStart, endDate: createEnd },
    }));
    markPromoChanged();
    setShowCreateSetup(false);
    // "Create new" always continues to the build panel — that's the point of
    // it. The schedule-only prompt returns to the card it interrupted, unless
    // that card is blank, in which case building is what comes next anyway.
    const hasContent = promoHasVisibleContent(configRef.current.promoCard);
    const goToBuild = createIntent === 'new' || !hasContent;
    setPromoEntryStep(goToBuild ? 'build' : 'editor');
    // Covers the case where the promo tab is already open: initialStep is only
    // read at mount, so without this the dialog closed onto nothing.
    if (goToBuild) setOpenBuildSignal((n) => n + 1);
    setActiveTab('promo');
  }

  // Dashboard shortcuts (Edit / the card itself) open an existing campaign, so
  // they bypass the guided picker and land in the editor.
  const handleDashboardTabSwitch = useCallback(
    (tab: 'dashboard' | 'announcement' | 'promo') => {
      if (tab === activeTab) return;
      if (tab === 'promo') setPromoEntryStep('editor');
      setActiveTab(tab);
    },
    [activeTab],
  );

  // A draft is only worth persisting/restoring when it carries real content —
  // visible text in a promo field or an announcement message. A blank card
  // (e.g. right after Start Fresh, which sets the dirty flag but has no text)
  // differs from published only by defaults (dates/style), which isn't work
  // worth a "You have an unpublished draft" banner.
  function htmlHasVisibleText(html: string | undefined): boolean {
    if (!html) return false;
    return html
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/[\u200B\u200C\u200D\uFEFF]/g, '')
      .trim().length > 0;
  }
  function promoHasVisibleContent(pc: CampaignConfig['promoCard']): boolean {
    return (
      htmlHasVisibleText(pc.title) ||
      htmlHasVisibleText(pc.subtitle) ||
      htmlHasVisibleText(pc.description) ||
      htmlHasVisibleText(pc.buttonText)
    );
  }
  // Announcement signature (live on/off excluded) — to tell a real announcement
  // edit apart from the default messages.
  function announcementSignature(cfg: CampaignConfig): string {
    const ann = { ...(cfg.announcementBar as unknown as Record<string, unknown>) };
    delete ann.active;
    return JSON.stringify(ann);
  }
  // Authoritative: is a draft worth restoring (→ show the banner)? Yes only if
  // the promo has authored text, OR the announcement actually differs from
  // what's published. A blank promo (Start Fresh) with unchanged announcements
  // is NOT restorable work, even though the announcement carries its messages.
  function draftHasRestorableWork(
    draft: CampaignConfig,
    published: CampaignConfig | null,
  ): boolean {
    if (promoHasVisibleContent(draft.promoCard)) return true;
    if (!published) return false;
    return announcementSignature(draft) !== announcementSignature(published);
  }

  // Persist the draft only if it carries restorable work — real promo text or a
  // changed announcement. A fresh/blank promo (even one that replaced a full
  // published card) is trivially recreatable, so it's not worth a draft.
  // Returns whether a draft was actually written.
  // The draft lives in the DB via /api/draft. The DB write is fired without
  // awaiting (with keepalive so it survives page unload); the decision — save
  // vs skip, and the returned boolean the callers use for the toast — stays
  // synchronous so call sites don't change.
  function saveDraft(
    cfg: CampaignConfig,
    options: { markHandled?: boolean } = {},
  ): boolean {
    if (!draftHasRestorableWork(cfg, publishedConfigObjRef.current)) {
      clearDraft();
      return false;
    }
    fetch('/api/draft', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cfg),
      keepalive: true,
    }).catch(() => {});
    setSavedDraftSignature(getConfigSignature(cfg));
    if (options.markHandled !== false) {
      draftSignatureRef.current = getConfigSignature(cfg);
    }
    return true;
  }

  function clearDraft() {
    fetch('/api/draft', { method: 'DELETE', keepalive: true }).catch(() => {});
    draftSignatureRef.current = null;
    setSavedDraftSignature(null);
  }

  // Explicit "Save as draft" — the ONLY way a draft is ever written now.
  // Unlike the automatic saveDraft() above, this always writes what's in the
  // editor: an explicit click means the user wants it saved, blank or not.
  function writeDraftNow() {
    const cfg = configRef.current;
    setSavingDraft(true);
    fetch('/api/draft', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cfg),
    })
      .then((res) => {
        if (res.ok) {
          draftSignatureRef.current = getConfigSignature(cfg);
          setSavedDraftSignature(getConfigSignature(cfg));
          toast('Saved draft updated');
        } else {
          toast('Couldn’t save your draft', true);
        }
      })
      .catch(() => toast('Couldn’t save your draft', true))
      .finally(() => setSavingDraft(false));
  }

  // There's only one draft slot — if it's already occupied, confirm before
  // overwriting it.
  async function handleSaveAsDraft() {
    setSavingDraft(true);
    let exists = false;
    try {
      const res = await fetch('/api/draft');
      const data = res.ok ? await res.json() : null;
      exists = Boolean(data?.draft);
    } catch {
      // Can't tell — fall through and just write; worst case is an
      // unconfirmed overwrite, better than silently failing to save.
    }
    setSavingDraft(false);
    if (exists) {
      setConfirmReplaceDraft(true);
      return;
    }
    writeDraftNow();
  }

  function completePendingDraftAction(action = pendingDraftAction) {
    if (!action) return;
    setPendingDraftAction(null);
    if (action.type === 'tab') {
      setActiveTab(action.tab);
      return;
    }
    performLogout();
  }

  function saveDraftAndContinue() {
    if (saveDraft(configRef.current)) toast('Saved draft updated');
    completePendingDraftAction();
  }

  function continueWithoutDraft() {
    draftSignatureRef.current = getConfigSignature(configRef.current);
    completePendingDraftAction();
  }

  async function persistConfig(
    cfg: CampaignConfig,
    successMessage = 'Settings saved successfully',
    scope?: 'announcement' | 'promo',
    options: { preserveDraft?: boolean } = {},
  ) {
    try {
      // Build the button destination from the CTA type
      const cfgToSend = { ...cfg };
      const pc = cfgToSend.promoCard;
      const cta = pc.ctaType || 'whatsapp';
      if (cta === 'whatsapp' && pc.whatsappNumber) {
        const code = (pc.whatsappCountryCode || '+44').replace('+', '');
        const num = pc.whatsappNumber.replace(/\D/g, '');
        cfgToSend.promoCard = { ...pc, buttonUrl: `https://wa.me/${code}${num}` };
      } else if (cta === 'text') {
        // Plain text CTA: styled button with no link
        cfgToSend.promoCard = { ...pc, buttonUrl: '' };
      }

      const response = await fetch('/api/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cfgToSend),
      });

      if (response.ok) {
        // Whatever we just persisted IS the live site now — the Dashboard reads this.
        setPublishedConfig(cfg);
        publishedConfigRef.current = getConfigSignature(cfg);
        publishedConfigObjRef.current = cfg;
        // A live on-air toggle (preserveDraft) must not clear the pending draft
        // or reset the "unpublished changes" flags — only a real publish does.
        if (!options.preserveDraft) {
          if (scope === 'announcement') setHasAnnouncementChanges(false);
          else if (scope === 'promo') setHasPromoChanges(false);
          else { setHasAnnouncementChanges(false); setHasPromoChanges(false); }
          clearDraft();
        }
        toast(successMessage);
      } else {
        toast('Failed to save settings', true);
      }
    } catch (error) {
      console.error('Failed to save config:', error);
      toast('Failed to save settings', true);
    }
  }

  // The variant popup closes on click and the publish continues in the
  // background — so in publish mode we light up the header Publish button's
  // loader (isPublishing) until the persist finishes, exactly like a direct
  // publish. Otherwise the publish would run with no in-progress feedback.
  async function savePendingVariantAndClose() {
    if (!pendingVariantSave) return;
    const { config: cfg, mode } = pendingVariantSave;
    setPendingVariantSave(null);
    if (mode === 'publish') setIsPublishing(true);
    try {
      await savePromoVariant(cfg, true);
      if (mode === 'publish') {
        // cfg already has active:true — finish going live, don't re-prompt to publish.
        await persistConfig(cfg, 'Campaign is live on your website', 'promo');
      } else {
        await persistConfig(cfg, 'Settings saved and promo variant saved');
      }
    } finally {
      if (mode === 'publish') setIsPublishing(false);
    }
  }

  async function updateExistingVariantAndClose(versionId: string) {
    if (!pendingVariantSave) return;
    const { config: cfg, mode, versions } = pendingVariantSave;
    const version = versions.find((item) => item.id === versionId);
    setPendingVariantSave(null);
    if (mode === 'publish') setIsPublishing(true);
    try {
      await updateVersion(versionId, cfg.promoCard, version?.label);
      setSelectedPromoVersionId(versionId);
      savedPromoSignatureRef.current = getPromoSignature(cfg);
      if (mode === 'publish') {
        await persistConfig(cfg, 'Campaign is live on your website', 'promo');
      } else {
        await persistConfig(cfg, 'Settings saved and promo variant updated');
      }
    } finally {
      if (mode === 'publish') setIsPublishing(false);
    }
  }

  function cancelPendingVariantSave() {
    setPendingVariantSave(null);
  }

  function getSelectedPendingVariant() {
    if (!pendingVariantSave || !selectedPromoVersionId) return null;
    return (
      pendingVariantSave.versions.find(
        (version) => version.id === selectedPromoVersionId,
      ) ?? null
    );
  }

  async function loadConfig() {
    try {
      // Always fetch the published config + the saved draft from the DB.
      const [response, draftResponse] = await Promise.all([
        fetch('/api/config'),
        fetch('/api/draft'),
      ]);
      let publishedCfg: CampaignConfig | null = null;
      if (response.ok) {
        const data = await response.json();
        publishedCfg = migrateConfig(data, data.version);
        publishedConfigRef.current = getConfigSignature(publishedCfg);
        publishedConfigObjRef.current = publishedCfg;
        // Dashboard always mirrors the live/published config, even when a draft
        // is restored into the editors below.
        setPublishedConfig(publishedCfg);
      }

      let draft: CampaignConfig | null = null;
      if (draftResponse.ok) {
        const draftData = await draftResponse.json();
        draft = (draftData?.draft as CampaignConfig | null) ?? null;
      }

      if (draft) {
        const migrated = migrateConfig(draft, draft.version);
        // A draft with no restorable work (e.g. a blank promo from Start Fresh,
        // announcements unchanged) isn't worth a banner — discard it silently.
        if (!draftHasRestorableWork(migrated, publishedCfg)) {
          clearDraft();
        } else if (publishedCfg && getConfigSignature(migrated) !== getConfigSignature(publishedCfg)) {
          // Only show banner if the draft has content AND differs from published
          setConfig(migrated);
          draftSignatureRef.current = getConfigSignature(migrated);
          setSavedDraftSignature(getConfigSignature(migrated));
          savedPromoSignatureRef.current = getPromoSignature(migrated);
          setHasAnnouncementChanges(true);
          setHasPromoChanges(true);
          setReadyToPublishAnnouncement(true);
          // Work in progress exists, so the promo tab opens on it, not the picker.
          setPromoEntryStep('editor');
          return;
        } else {
          // Draft matches published — discard it silently
          clearDraft();
        }
      }

      if (publishedCfg) {
        setConfig(publishedCfg);
        draftSignatureRef.current = getConfigSignature(publishedCfg);
        savedPromoSignatureRef.current = getPromoSignature(publishedCfg);
      }
    } catch (error) {
      console.error('Failed to load config:', error);
    }
  }

  // Stage the announcement for publish. No automatic draft write here —
  // drafting is explicit-only ("Save as draft" in the Promo tab strip, which
  // covers the full config including the announcement) — this just flips the
  // header to "ready to Publish" and asks whether to publish now.
  function handleSaveAnnouncement() {
    setHasAnnouncementChanges(false);
    setReadyToPublishAnnouncement(true);
    toast('Changes saved — please publish to go live');
    setPublishConfirm({
      warnings: [],
      onConfirm: handlePublishAnnouncement,
      title: 'Changes saved',
      message: 'Ready to publish, or you can review and publish later.',
      confirmLabel: 'Publish now',
      cancelLabel: 'Publish later',
    });
  }

  // Publishing content turns the campaign On Air (BR: "On Air starts the moment
  // you click Publish"). New/edited content always goes live on publish.
  async function handlePublishAnnouncement() {
    const next = {
      ...config,
      announcementBar: { ...config.announcementBar, active: true },
    };
    // Flip the chip to On Air only AFTER the publish finishes — so it appears
    // when the "Publishing…" loader completes, not at the start.
    await persistConfig(next, 'Campaign is live on your website', 'announcement');
    setConfig(next);
    setReadyToPublishAnnouncement(false);
  }

  // Immediate live on/off from the status chip / Dashboard — no Save → Publish.
  // Toggles ONLY the active flag on the PUBLISHED content (never pushes an
  // unpublished draft live) and preserves any pending draft. `active` is
  // excluded from the dirty signature, so mirroring it into the editing config
  // doesn't create phantom "unsaved changes".
  async function setLiveActive(scope: 'promo' | 'announcement', active: boolean) {
    const pending = pendingDraftRef.current;
    const base = publishedConfigObjRef.current ?? configRef.current;
    const next: CampaignConfig =
      scope === 'promo'
        ? { ...base, promoCard: { ...base.promoCard, active, stoppedByUser: !active } }
        : { ...base, announcementBar: { ...base.announcementBar, active } };
    setConfig((c) =>
      scope === 'promo'
        ? { ...c, promoCard: { ...c.promoCard, active, stoppedByUser: !active } }
        : { ...c, announcementBar: { ...c.announcementBar, active } },
    );
    // Optimistically reflect the live status on the Dashboard right away;
    // persistConfig re-confirms it on a successful write.
    setPublishedConfig(next);
    publishedConfigObjRef.current = next;
    await persistConfig(
      next,
      active
        ? 'Campaign is live on your website'
        : 'Campaign switched off — no longer on your website',
      scope,
      { preserveDraft: pending },
    );
  }

  async function stopAnnouncementNow() {
    await setLiveActive('announcement', false);
  }

  async function goOnAirAnnouncementNow() {
    await setLiveActive('announcement', true);
  }

  // Turning a stopped promo back on from the status chip: flip it on
  // provisionally and ask whether to go live. Publish → live; Cancel → revert
  // to the previous (stopped) state.
  // Immediate status changes from the promo status chip — no Save → Publish.
  // Stopping takes the card off now; "Go on air" reactivates the same content.
  async function stopPromoNow() {
    await setLiveActive('promo', false);
  }

  // Deleting the live card from "My Published" is a real removal, not a Stop:
  // besides taking it off air we clear its content from the published config so
  // /api/config and the R2 copy stop carrying it. Unlike Stop, this can't be
  // undone with "Go on air" — the content is gone from the live config.
  async function removeLivePromo() {
    const base = publishedConfigObjRef.current ?? configRef.current;
    const next: CampaignConfig = {
      ...base,
      promoCard: {
        ...defaultConfig.promoCard,
        active: false,
        stoppedByUser: true,
      },
    };
    setPublishedConfig(next);
    publishedConfigObjRef.current = next;
    await persistConfig(next, 'Removed from your website', 'promo', {
      preserveDraft: pendingDraftRef.current,
    });
  }

  async function goOnAirPromoNow() {
    await setLiveActive('promo', true);
  }

  async function handlePublishPromo() {
    // Publishing content turns the campaign On Air ("On Air starts the moment
    // you click Publish"). Off is reached via the Stop chip, not by publishing.
    const cfgToSave = {
      ...config,
      promoCard: { ...config.promoCard, active: true, stoppedByUser: false },
    };
    const successMsg = 'Campaign is live on your website';

    const variantStatus = await getPromoVariantSaveStatus(cfgToSave);
    if (variantStatus === 'pending') {
      // Variant decision dialog handles the actual publish next.
      setConfig(cfgToSave);
      setPendingVariantSave({ config: cfgToSave, versions: await listVersions(), mode: 'publish' });
      return;
    }

    // Flip the chip to On Air only AFTER the publish finishes — so it appears
    // when the "Publishing…" loader completes, not at the start.
    if (variantStatus === 'ready') {
      await savePromoVariant(cfgToSave);
      await persistConfig(cfgToSave, successMsg, 'promo');
      setConfig(cfgToSave);
      return;
    }

    await persistConfig(cfgToSave, successMsg, 'promo');
    setConfig(cfgToSave);
  }

  function validatePromo(): string[] {
    const warnings: string[] = [];
    const pc = config.promoCard;
    const strip = (html: string) => html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
    const formatDate = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

    // 1. Content fields
    if (!strip(pc.title || '')) warnings.push('Title is empty');
    if (!strip(pc.subtitle || '')) warnings.push('Subtitle is empty');
    if (!strip(pc.description || '')) warnings.push('Description is empty');

    // 1b. DOM overflow check — shared with the guided flow's live fit warnings
    // so the publish gate and the inline hints can never disagree.
    (['title', 'subtitle', 'description'] as const).forEach((field) => {
      if (fieldOverflows(pc[field], field, pc.cardWidth)) {
        warnings.push(`${field.charAt(0).toUpperCase() + field.slice(1)} text may overflow the card layout`);
      }
    });

    // 2. Schedule — publishing turns the card On Air, so it will run.
    if (!pc.startDate || !pc.endDate) {
      warnings.push('Start date or end date is not set');
    } else {
      const today = new Date().toISOString().split('T')[0];
      if (pc.endDate < today) {
        warnings.push('End date is in the past');
      } else if (pc.startDate <= today) {
        warnings.push(`Campaign will run from ${formatDate(pc.startDate)} – ${formatDate(pc.endDate)} (starts immediately)`);
      } else {
        warnings.push(`Campaign is scheduled for ${formatDate(pc.startDate)} – ${formatDate(pc.endDate)}`);
      }
    }

    // 3. Timer text
    if (pc.showTimer) {
      const timerPlain = strip(pc.timerText || '').replace(/\{timer\}/gi, '').trim();
      if (!timerPlain) warnings.push('Timer has no prefix or suffix — you can add text like "Ends in" or "Hurry!" around the countdown');
    }

    // 4. CTA
    if (pc.showButton) {
      const btnText = strip(pc.buttonText || '');
      const ctaType = pc.ctaType || 'whatsapp';
      if (ctaType === 'text') {
        if (!btnText) warnings.push('Button text is empty');
      } else if (ctaType === 'whatsapp') {
        const num = pc.whatsappNumber?.trim() || '';
        const code = pc.whatsappCountryCode || '+44';
        if (!btnText && !num) {
          warnings.push('Button text and WhatsApp number are empty');
        } else if (!btnText) {
          warnings.push('Button text is empty');
        } else if (!num) {
          warnings.push('WhatsApp number is empty');
        } else {
          warnings.push(`WhatsApp number: ${code} ${num}`);
        }
      } else {
        const url = pc.buttonUrl?.trim() || '';
        if (!btnText && !url) {
          warnings.push('Button text and URL are empty');
        } else if (!btnText) {
          warnings.push('Button text is empty');
        } else if (!url) {
          warnings.push('Button URL is empty');
        }
      }
    }

    return warnings;
  }

  function handlePublishPromoWithValidation() {
    if (blockPromoSaveIfInvalidRange()) return;
    const warnings = validatePromo();
    setPublishConfirm({ warnings, onConfirm: handlePublishPromo });
  }

  function handlePublishAnnouncementWithValidation() {
    setPublishConfirm({ warnings: [], onConfirm: handlePublishAnnouncement });
  }

  function toast(message: string, isError = false) {
    setToastMessage(message);
    setToastIsError(isError);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  }

  function toggleDarkMode() {
    const newMode = !isDarkMode;
    setIsDarkMode(newMode);
    localStorage.setItem('darkMode', newMode.toString());
  }

  function handleLogout() {
    if (hasChangesSinceDraft()) {
      setPendingDraftAction({ type: 'logout' });
      return;
    }
    performLogout();
  }

  function performLogout() {
    // Clear any user session data
    localStorage.removeItem('authToken');
    localStorage.removeItem('userEmail');
    // Redirect to login page or handle logout logic
    window.location.href = '/login';
  }

  async function discardDraft() {
    clearDraft();
    setHasAnnouncementChanges(false);
    setHasPromoChanges(false);
    setReadyToPublishAnnouncement(false);
    // Reload published config
    try {
      const response = await fetch('/api/config');
      if (response.ok) {
        const data = await response.json();
        const migrated = migrateConfig(data, data.version);
        setConfig(migrated);
        draftSignatureRef.current = getConfigSignature(migrated);
        savedPromoSignatureRef.current = getPromoSignature(migrated);
        publishedConfigRef.current = getConfigSignature(migrated);
        publishedConfigObjRef.current = migrated;
      }
    } catch (e) {
      console.error('Failed to reload config:', e);
    }
    toast('Saved draft deleted');
  }

  /**
   * Throw away unpublished edits for one section and go back to what's live.
   *
   * The gap this fills: edits survive tab switches (they're React state) and a
   * tab close writes them to the saved draft, so before this there was no way
   * back to the published version short of deleting the draft.
   *
   * Only the active section is reverted — discarding promo work because you
   * wanted to undo an announcement edit would be its own bug. The editors read
   * their content into local state on mount, so the remount key forces them to
   * re-read; without it the reverted config wouldn't reach the contentEditable
   * fields.
   */
  async function discardEditorChanges(section: 'promo' | 'announcement') {
    const live = publishedConfigObjRef.current;
    if (!live) return;

    /**
     * Always back to LIVE — one meaning, no guessing which version you land on.
     * An earlier version fell back to the saved draft, but the draft already
     * has its own way back (My Draft), so routing Discard through it made the
     * button mean two different things depending on hidden state.
     *
     * The draft itself is never touched here.
     */
    const base: CampaignConfig = live;

    const next: CampaignConfig =
      section === 'promo'
        ? { ...configRef.current, promoCard: JSON.parse(JSON.stringify(base.promoCard)) }
        : {
            ...configRef.current,
            announcementBar: JSON.parse(JSON.stringify(base.announcementBar)),
          };

    setConfig(next);
    configRef.current = next;
    draftSignatureRef.current = getConfigSignature(next);

    // Landing on a saved draft still leaves unpublished work, so the dirty
    // flag has to reflect what we landed on — reporting "all published" while
    // showing draft content would be a lie the Publish button acts on.
    const matchesLive = getConfigSignature(next) === publishedConfigRef.current;

    if (section === 'promo') {
      setHasPromoChanges(!matchesLive);
      savedPromoSignatureRef.current = getPromoSignature(next);
      // The remount below restarts PromoFlow at `initialStep`. Without this it
      // restarts at the picker, so discarding looked like it did nothing —
      // the reverted card was never shown.
      setPromoEntryStep('editor');
    } else {
      setHasAnnouncementChanges(!matchesLive);
      setReadyToPublishAnnouncement(false);
    }

    // The saved draft is deliberately NOT deleted here. Discard undoes the
    // edits made since it was saved; destroying the draft as well would throw
    // away work the user explicitly chose to keep.
    setEditorResetKey((k) => k + 1);
    toast('Changes discarded — back to what’s live');
  }

  function markAnnouncementChanged() {
    // If config matches published state, no actual changes
    setTimeout(() => {
      if (publishedConfigRef.current && publishedConfigRef.current === getConfigSignature(configRef.current)) {
        setHasAnnouncementChanges(false);
        return;
      }
      setHasAnnouncementChanges(true);
      setReadyToPublishAnnouncement(false);
    }, 0);
  }

  function markPromoChanged() {
    // If config matches published state, no actual changes
    setTimeout(() => {
      if (publishedConfigRef.current && publishedConfigRef.current === getConfigSignature(configRef.current)) {
        setHasPromoChanges(false);
        return;
      }
      setHasPromoChanges(true);
    }, 0);
  }

  const selectedPendingVariant = getSelectedPendingVariant();

  // "Go on air" is a one-click reactivation, allowed only when the announcement
  // is off AND its content matches what's currently published (same content,
  // not new/edited). Otherwise the user must Save → Publish.
  const announcementCanReactivate = (() => {
    if (config.announcementBar.active) return false;
    if (!publishedConfigRef.current) return false;
    try {
      const pub = JSON.parse(publishedConfigRef.current) as CampaignConfig;
      const sig = (ab: CampaignConfig['announcementBar']) => {
        const clone: Record<string, unknown> = { ...ab };
        delete clone.active;
        return JSON.stringify(clone);
      };
      return sig(config.announcementBar) === sig(pub.announcementBar);
    } catch {
      return false;
    }
  })();

  // Same rule for the promo card (ignore active + stoppedByUser status flags).
  const promoCanReactivate = (() => {
    if (config.promoCard.active) return false;
    if (!publishedConfigRef.current) return false;
    try {
      const pub = JSON.parse(publishedConfigRef.current) as CampaignConfig;
      const sig = (pc: CampaignConfig['promoCard']) => {
        const clone: Record<string, unknown> = { ...pc };
        delete clone.active;
        delete clone.stoppedByUser;
        return JSON.stringify(clone);
      };
      return sig(config.promoCard) === sig(pub.promoCard);
    } catch {
      return false;
    }
  })();

  // Work worth protecting: the promo differs from what's live AND isn't the
  // thing already sitting in the draft.
  promoWorkNotInDraftRef.current =
    hasPromoChanges && savedDraftSignature !== getConfigSignature(config);

  return (
    <div className="campaign-page-bg flex h-screen text-on-surface">
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        <Header
          activeTab={activeTab}
          setActiveTab={handleTabSwitch}
          hasAnnouncementChanges={hasAnnouncementChanges}
          hasPromoChanges={hasPromoChanges}
          readyToPublishAnnouncement={readyToPublishAnnouncement}
          promoDateInvalid={promoDateRangeInvalid}
          onDiscardChanges={() => setConfirmDiscardChanges(true)}
          /**
           * Discard goes back to what's LIVE, so it only exists when something
           * is live. A saved draft doesn't qualify: it has its own way back
           * (My Draft), the same way published work does (My Published).
           * Without this, a first card would be wiped to an empty default with
           * nothing to restore.
           */
          canDiscard={
            activeTab === 'promo'
              ? promoHasVisibleContent(publishedConfig.promoCard)
              : publishedConfig.announcementBar.announcements.length > 0
          }
          isPublishing={isPublishing}
          isDarkMode={isDarkMode}
          toggleDarkMode={toggleDarkMode}
          handleSaveAnnouncement={handleSaveAnnouncement}
          handlePublishAnnouncement={handlePublishAnnouncementWithValidation}
          handlePublishPromo={handlePublishPromoWithValidation}
          handleLogout={handleLogout}
        />

        <main
          ref={mainScrollRef}
          className={`flex-1 overflow-y-auto bg-transparent px-6 pt-8 pb-6 ${
            activeTab === 'promo' || activeTab === 'announcement' ? 'campaign-custom-scrollbar' : ''
          }`}
        >
          <div className={`max-w-[1840px] mx-auto ${activeTab === 'promo' || activeTab === 'dashboard' ? '' : 'space-y-8 pb-12'}`}>
            {activeTab === 'dashboard' && (
              <Dashboard
                config={publishedConfig}
                setActiveTab={handleDashboardTabSwitch}
                onCreatePromo={handleCreatePromo}
                onOpenPublishedPromo={handleOpenPublishedPromo}
                onStopPromo={stopPromoNow}
                onGoOnAirPromo={goOnAirPromoNow}
                onStopAnnouncement={stopAnnouncementNow}
                onGoOnAirAnnouncement={goOnAirAnnouncementNow}
                promoUnpublished={hasPromoChanges}
                announcementUnpublished={hasAnnouncementChanges || readyToPublishAnnouncement}
              />
            )}

            {activeTab === 'announcement' && (
              <AnnouncementSection
                key={`announcement-${editorResetKey}`}
                config={config}
                setConfig={setConfig}
                markChanged={markAnnouncementChanged}
                canReactivate={announcementCanReactivate}
                onStop={stopAnnouncementNow}
                onGoOnAir={goOnAirAnnouncementNow}
              />
            )}

            {activeTab === 'promo' && (
              <PromoFlow
                  key={`promo-${editorResetKey}`}
                  onAiApplied={handleAiApplied}
                  openBuildSignal={openBuildSignal}
                  pendingPopup={pendingPromoPopup}
                  onPendingPopupHandled={() => setPendingPromoPopup(null)}
                  initialStep={promoEntryStep}
                  config={config}
                  setConfig={setConfig}
                  markChanged={markPromoChanged}
                  toast={toast}
                  onSelectedVersionChange={setSelectedPromoVersionId}
                  canReactivate={promoCanReactivate}
                  livePromoCard={publishedConfig.promoCard}
                  onStop={stopPromoNow}
                  onGoOnAir={goOnAirPromoNow}
                  dateErrorPing={promoDateErrorPing}
                  hasUnsavedChanges={hasPromoChanges}
                  activeTab={activeTab}
                  setActiveTab={handleTabSwitch}
                  onSaveDraft={handleSaveAsDraft}
                  // Writes the draft with no replace-confirm of its own — the
                  // template dialogs already asked, and asking twice for one
                  // decision reads as a bug.
                  onSaveDraftDirect={writeDraftNow}
                  savingDraft={savingDraft}
                  onDeleteDraft={clearDraft}
                  draftUpToDate={
                    savedDraftSignature !== null &&
                    savedDraftSignature === getConfigSignature(config)
                  }
                  draftExists={savedDraftSignature !== null}
                onRemoveLive={removeLivePromo}
              />
            )}
          </div>
        </main>
      </div>

      {pendingDraftAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-transparent p-4">
          <div
            className="absolute inset-0"
            onClick={() => setPendingDraftAction(null)}
          />
          <div className="relative z-10 w-full max-w-md rounded-xl border border-white/10 bg-black/10 p-5 text-on-surface shadow-2xl backdrop-blur-md">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-base font-semibold">
                  Save changes as draft?
                </h2>
                <p className="mt-1 text-sm text-on-surface-variant">
                  These edits aren&apos;t in your saved draft yet.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPendingDraftAction(null)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md text-on-surface-variant transition-colors hover:bg-primary/10 hover:text-primary"
                aria-label="Close draft prompt"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={continueWithoutDraft}
                className="rounded-md border border-white/10 bg-transparent px-4 py-2 text-sm font-medium text-on-surface-variant transition-colors hover:border-primary/70 hover:text-primary"
              >
                Continue without saving
              </button>
              <button
                type="button"
                onClick={() => setPendingDraftAction(null)}
                className="rounded-md border border-white/10 bg-black/10 px-4 py-2 text-sm font-medium text-on-surface transition-colors hover:border-primary/70"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveDraftAndContinue}
                className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-on-primary shadow-sm transition-opacity hover:opacity-95"
              >
                Save as draft
              </button>
            </div>
          </div>
        </div>
      )}

      {pendingVariantSave && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-transparent p-4">
          <div
            className="absolute inset-0"
            onClick={cancelPendingVariantSave}
          />
          <div className="relative z-10 w-full max-w-md rounded-xl border border-white/10 bg-black/10 p-5 text-on-surface shadow-2xl backdrop-blur-md">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-base font-semibold">
                  Save promo variant?
                </h2>
                <p className="mt-1 text-sm text-on-surface-variant">
                  You already have {MAX_VERSIONS} variants. Update the selected variant or replace the oldest.
                </p>
              </div>
              <button
                type="button"
                onClick={cancelPendingVariantSave}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md text-on-surface-variant transition-colors hover:bg-primary/10 hover:text-primary"
                aria-label="Close variant prompt"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-2">
              {selectedPendingVariant && (
                <button
                  type="button"
                  onClick={() =>
                    updateExistingVariantAndClose(selectedPendingVariant.id)
                  }
                  className="flex w-full items-center justify-between gap-3 rounded-md border border-primary/40 bg-primary/10 px-4 py-2 text-left text-sm font-medium text-on-surface transition-colors hover:border-primary/70 hover:bg-primary/15"
                >
                  <span>Update Selected</span>
                  <span className="min-w-0 truncate text-xs text-on-surface-variant">
                    {selectedPendingVariant.label}
                  </span>
                </button>
              )}
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={cancelPendingVariantSave}
                  className="rounded-md border border-white/10 bg-transparent px-4 py-2 text-sm font-medium text-on-surface-variant transition-colors hover:border-primary/70 hover:text-primary"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={savePendingVariantAndClose}
                  className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-on-primary shadow-sm transition-opacity hover:opacity-95"
                >
                  Save and Replace Oldest
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* No "welcome back" popup. Saving a draft is a deliberate act, so
          announcing it back on every load interrupts the one moment someone
          wants to start working. The draft is restored into the editor
          silently and the My Draft chip carries a dot instead. */}

      {/* Publish Confirmation */}
      {publishConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0" onClick={() => { if (isConfirming) return; publishConfirm.onCancel?.(); setPublishConfirm(null); }} />
          <div className="relative z-10 w-full max-w-md rounded-xl border border-white/10 bg-black/10 p-5 text-on-surface shadow-2xl backdrop-blur-md">
            <h2 className="text-base font-semibold">{publishConfirm.title ?? 'Publish to website?'}</h2>
            <p className="mt-2 text-sm text-on-surface-variant">
              {publishConfirm.message ?? 'These changes will go live on your website immediately.'}
            </p>
            {publishConfirm.warnings.length > 0 && (
              <div className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
                <p className="text-xs font-semibold text-amber-600 dark:text-amber-400 mb-1.5">Heads up</p>
                <ul className="space-y-1">
                  {publishConfirm.warnings.map((w, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-on-surface-variant">
                      <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                      {w}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                disabled={isConfirming}
                onClick={() => { publishConfirm.onCancel?.(); setPublishConfirm(null); }}
                className="rounded-md border border-white/10 bg-transparent px-4 py-2 text-sm font-medium text-on-surface-variant transition-colors hover:border-primary/70 hover:text-primary disabled:opacity-50"
              >
                {publishConfirm.cancelLabel ?? 'Cancel'}
              </button>
              <button
                type="button"
                disabled={isConfirming}
                onClick={async () => {
                  const onConfirm = publishConfirm.onConfirm;
                  const defer = publishConfirm.deferPublish;
                  if (defer) {
                    // Chaining to a follow-up popup — don't show "Publishing…".
                    setPublishConfirm(null);
                    await onConfirm();
                    return;
                  }
                  // Keep the popup open with a loader on this button until the
                  // publish finishes, then close it.
                  setIsConfirming(true);
                  setIsPublishing(true);
                  await onConfirm();
                  await new Promise(r => setTimeout(r, 500));
                  setIsConfirming(false);
                  setIsPublishing(false);
                  setPublishConfirm(null);
                }}
                className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-semibold text-on-primary shadow-sm transition-opacity hover:opacity-95 disabled:opacity-80"
              >
                {isConfirming && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {isConfirming ? 'Publishing…' : (publishConfirm.confirmLabel ?? 'Publish Now')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* First-run campaign setup, opened from the dashboard's "Create promo
          card". Same dialog the guided flow uses, so the questions asked are
          identical wherever a campaign starts. */}
      {showCreateSetup && (
        <PromoSetupDialog
          sourceLabel="a blank card"
          scheduleOnly
          onContinue={startNewPromo}
          startDate={createStart}
          endDate={createEnd}
          onChangeStart={setCreateStart}
          onChangeEnd={setCreateEnd}
          onChoose={() => startNewPromo()}
          onClose={() => setShowCreateSetup(false)}
        />
      )}

      {/* Unsaved promo work, caught at the dashboard before an action that
          would replace the canvas. Saving is offered, never required — the
          same rule as Clear Canvas. */}
      {pendingDashboardAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0" onClick={() => setPendingDashboardAction(null)} />
          <div className="relative z-10 w-full max-w-xl rounded-xl border border-white/10 bg-black/10 p-5 text-on-surface shadow-2xl backdrop-blur-md">
            <h2 className="text-base font-semibold">You have unsaved changes</h2>
            <p className="mt-2 text-sm text-on-surface-variant">
              Your promo card has edits that aren&apos;t in{' '}
              <span className="font-semibold text-on-surface">My Draft</span>.{' '}
              {pendingDashboardAction === 'create'
                ? 'Starting a new campaign replaces them.'
                : 'Opening a published campaign replaces them.'}{' '}
              {savedDraftSignature !== null ? (
                <>
                  Saving now replaces the card currently in{' '}
                  <span className="font-semibold text-on-surface">My Draft</span>.
                </>
              ) : (
                <>
                  Save them to <span className="font-semibold text-on-surface">My Draft</span> to
                  keep a copy.
                </>
              )}
            </p>
            <div className="mt-5 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setPendingDashboardAction(null)}
                className="shrink-0 whitespace-nowrap rounded-md px-2 py-2 text-sm font-medium text-on-surface-variant transition-colors hover:text-primary"
              >
                Cancel
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const action = pendingDashboardAction;
                    setPendingDashboardAction(null);
                    if (action === 'create') startCreatePromo();
                    else openPublishedPicker();
                  }}
                  className="whitespace-nowrap rounded-md border border-white/15 bg-transparent px-4 py-2 text-sm font-medium text-on-surface-variant transition-colors hover:border-red-400/70 hover:text-red-500"
                >
                  Continue anyway
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const action = pendingDashboardAction;
                    setPendingDashboardAction(null);
                    writeDraftNow();
                    if (action === 'create') startCreatePromo();
                    else openPublishedPicker();
                  }}
                  className="whitespace-nowrap rounded-md bg-primary px-4 py-2 text-sm font-semibold text-on-primary shadow-sm transition-opacity hover:opacity-95"
                >
                  {savedDraftSignature !== null ? 'Replace draft & continue' : 'Save & continue'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Discard unpublished edits — destructive and easy to hit by accident
          from the header, so it states exactly what survives. */}
      {confirmDiscardChanges && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0" onClick={() => setConfirmDiscardChanges(false)} />
          <div className="relative z-10 w-full max-w-md rounded-xl border border-white/10 bg-black/10 p-5 text-on-surface shadow-2xl backdrop-blur-md">
            <h2 className="text-base font-semibold">Discard these changes?</h2>
            <p className="mt-2 text-sm text-on-surface-variant">
              The {activeTab === 'promo' ? 'promo card' : 'announcement bar'} goes back to
              what&apos;s live on your website right now. Edits you haven&apos;t published will be
              lost, and this can&apos;t be undone.
              {savedDraftSignature !== null && (
                <>
                  {' '}
                  Your saved draft is untouched — reopen it from{' '}
                  <span className="font-semibold text-on-surface">My Draft</span>.
                </>
              )}
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmDiscardChanges(false)}
                className="rounded-md border border-white/10 bg-transparent px-4 py-2 text-sm font-medium text-on-surface-variant transition-colors hover:border-primary/70 hover:text-primary"
              >
                Keep editing
              </button>
              <button
                type="button"
                onClick={() => {
                  setConfirmDiscardChanges(false);
                  discardEditorChanges(activeTab === 'promo' ? 'promo' : 'announcement');
                }}
                className="rounded-md bg-red-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-95"
              >
                Discard changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Discard Draft consent — deleting a draft is destructive, so confirm first */}
      {confirmDiscardDraft && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0" onClick={() => setConfirmDiscardDraft(false)} />
          <div className="relative z-10 w-full max-w-md rounded-xl border border-white/10 bg-black/10 p-5 text-on-surface shadow-2xl backdrop-blur-md">
            <h2 className="text-base font-semibold">Delete your saved draft?</h2>
            <p className="mt-2 text-sm text-on-surface-variant">
              Your saved draft will be deleted and you&apos;ll start fresh from what&apos;s currently
              published. This can&apos;t be undone.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmDiscardDraft(false)}
                className="rounded-md border border-white/10 bg-transparent px-4 py-2 text-sm font-medium text-on-surface-variant transition-colors hover:border-primary/70 hover:text-primary"
              >
                Keep editing
              </button>
              <button
                type="button"
                onClick={() => {
                  setConfirmDiscardDraft(false);
                  discardDraft();
                }}
                className="rounded-md bg-red-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-95"
              >
                Delete saved draft
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Replace-draft consent — there's only one draft slot, so saving again
          overwrites whatever's already there. */}
      {confirmReplaceDraft && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-transparent p-4">
          <div className="absolute inset-0" onClick={() => setConfirmReplaceDraft(false)} />
          <div className="relative z-10 w-full max-w-md rounded-xl border border-white/10 bg-black/10 p-5 text-on-surface shadow-2xl backdrop-blur-md">
            <h2 className="text-base font-semibold">Replace saved draft?</h2>
            <p className="mt-2 text-sm text-on-surface-variant">
              You already have a saved draft. Saving now will replace it with what&apos;s currently in the editor.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmReplaceDraft(false)}
                className="rounded-md border border-white/10 bg-transparent px-4 py-2 text-sm font-medium text-on-surface-variant transition-colors hover:border-primary/70 hover:text-primary"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setConfirmReplaceDraft(false);
                  writeDraftNow();
                }}
                className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-on-primary shadow-sm transition-opacity hover:opacity-95"
              >
                Replace saved draft
              </button>
            </div>
          </div>
        </div>
      )}

      <Toast show={showToast} message={toastMessage} isError={toastIsError} />
    </div>
  );
}
