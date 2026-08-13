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
import { Toast } from '@/components/Toast';
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
  const [draftBanner, setDraftBanner] = useState<{ date: string } | null>(null);
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
  const [promoFlowStep, setPromoFlowStep] = useState<'start' | 'ai' | 'editor'>('editor');
  // Where the promo tab opens. Dashboard's View/Edit act on an existing
  // campaign, so they go straight to the editor; the nav tab starts fresh.
  const [promoEntryStep, setPromoEntryStep] = useState<'start' | 'editor'>('start');
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

  // Browser close/refresh can only show the native unload warning. Drafting is
  // manual now (explicit "Save as draft" only) — this just warns, it never
  // writes a draft on its own.
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasChangesRef.current) {
        e.preventDefault();
        e.returnValue = '';
      }
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

  // View vs Edit mode for the editors. Dashboard "View" opens read-only; "Edit" opens editable.
  const [editorMode, setEditorMode] = useState<'view' | 'edit'>('edit');
  // Consent before discarding a draft (destructive).
  const [confirmDiscardDraft, setConfirmDiscardDraft] = useState(false);

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
    (tab: 'dashboard' | 'announcement' | 'promo', mode: 'view' | 'edit' = 'edit') => {
      if (tab === activeTab) return;
      if (tab === 'promo') setPromoEntryStep('start');
      setEditorMode(mode);
      setActiveTab(tab);
    },
    [activeTab],
  );

  // "Create promo card" on an empty dashboard is a NEW campaign, so unlike the
  // View/Edit shortcuts it opens the guided start screen.
  const handleCreatePromo = useCallback(() => {
    setPromoEntryStep('start');
    setEditorMode('edit');
    setActiveTab('promo');
  }, []);

  // Dashboard shortcuts (View / Edit / the card itself) open an existing
  // campaign, so they bypass the guided picker and land in the editor.
  const handleDashboardTabSwitch = useCallback(
    (tab: 'dashboard' | 'announcement' | 'promo', mode: 'view' | 'edit' = 'edit') => {
      if (tab === activeTab) return;
      if (tab === 'promo') setPromoEntryStep('editor');
      setEditorMode(mode);
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
          toast('Draft saved');
        } else {
          toast('Failed to save draft', true);
        }
      })
      .catch(() => toast('Failed to save draft', true))
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
    if (saveDraft(configRef.current)) toast('Draft saved');
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
          setDraftBanner({ date: migrated.lastUpdated || new Date().toISOString() });
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

  function dismissDraftBanner() {
    setDraftBanner(null);
  }

  async function discardDraft() {
    clearDraft();
    setDraftBanner(null);
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
    toast('Draft discarded');
  }

  function reviewDraft() {
    setDraftBanner(null);
    // The draft is already loaded into `config`; open it in the editor rather
    // than the start picker, which would offer to start over instead.
    setPromoEntryStep('editor');
    setEditorMode('edit');
    setActiveTab('promo');
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

  return (
    <div className="campaign-page-bg flex h-screen text-on-surface">
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        <Header
          activeTab={activeTab}
          setActiveTab={handleTabSwitch}
          editorMode={editorMode}
          onEnterEdit={() => setEditorMode('edit')}
          hasAnnouncementChanges={hasAnnouncementChanges}
          hasPromoChanges={hasPromoChanges}
          readyToPublishAnnouncement={readyToPublishAnnouncement}
          promoDateInvalid={promoDateRangeInvalid}
          hideActions={activeTab === 'promo' && promoFlowStep !== 'editor'}
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
                onStopPromo={stopPromoNow}
                onGoOnAirPromo={goOnAirPromoNow}
                onStopAnnouncement={stopAnnouncementNow}
                onGoOnAirAnnouncement={goOnAirAnnouncementNow}
                promoUnpublished={hasPromoChanges}
                announcementUnpublished={hasAnnouncementChanges || readyToPublishAnnouncement}
              />
            )}

            {activeTab === 'announcement' && (
              <div
                className={editorMode === 'view' ? 'pointer-events-none select-none opacity-70' : ''}
                aria-hidden={editorMode === 'view'}
              >
                <AnnouncementSection
                  config={config}
                  setConfig={setConfig}
                  markChanged={markAnnouncementChanged}
                  canReactivate={announcementCanReactivate}
                  onStop={stopAnnouncementNow}
                  onGoOnAir={goOnAirAnnouncementNow}
                />
              </div>
            )}

            {activeTab === 'promo' && (
              <div
                className={editorMode === 'view' ? 'pointer-events-none select-none opacity-70' : ''}
                aria-hidden={editorMode === 'view'}
              >
                <PromoFlow
                  onStepChange={setPromoFlowStep}
                  initialStep={promoEntryStep}
                  config={config}
                  setConfig={setConfig}
                  markChanged={markPromoChanged}
                  toast={toast}
                  onSelectedVersionChange={setSelectedPromoVersionId}
                  canReactivate={promoCanReactivate}
                  onStop={stopPromoNow}
                  onGoOnAir={goOnAirPromoNow}
                  dateErrorPing={promoDateErrorPing}
                  hasUnsavedChanges={hasPromoChanges}
                  activeTab={activeTab}
                  setActiveTab={handleTabSwitch}
                  onSaveDraft={handleSaveAsDraft}
                  savingDraft={savingDraft}
                  onDeleteDraft={clearDraft}
                  draftUpToDate={
                    savedDraftSignature !== null &&
                    savedDraftSignature === getConfigSignature(config)
                  }
                  draftExists={savedDraftSignature !== null}
                  onRemoveLive={removeLivePromo}
                />
              </div>
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
                  You have changes that are not saved as a draft yet.
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
                Continue without draft
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
                Save Draft
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

      {/* Welcome Back — Unpublished Draft Popup. pointer-events-none on the
          full-screen container: it's an informational banner, and an invisible
          full-screen layer here was silently swallowing every click on the
          page (e.g. clicks into the promo timer never focused it → no caret).
          Only the dialog itself accepts pointer events. */}
      {draftBanner && activeTab === 'promo' && (
        <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="pointer-events-auto relative w-full max-w-md rounded-xl border border-white/10 bg-black/10 p-5 text-on-surface shadow-2xl backdrop-blur-md">
            {/* Dismiss without deciding: keep working on the draft. The two
                action buttons are commitments (discard / publish); the ✕ is
                the "not now" the banner otherwise lacked. */}
            <button
              type="button"
              onClick={() => setDraftBanner(null)}
              aria-label="Dismiss"
              className="absolute top-3 right-4 text-on-surface-variant transition-colors hover:text-on-surface"
            >
              ✕
            </button>
            <p className="text-base font-semibold">
              <span className="mr-1.5">💡</span>Welcome back
            </p>
            <p className="mt-2 text-sm text-on-surface-variant">
              You have an unpublished draft from{' '}
              <span className="font-semibold text-on-surface">
                {new Date(draftBanner.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
              </span>.
              These changes haven&apos;t gone live yet.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmDiscardDraft(true)}
                className="rounded-md border border-white/10 bg-transparent px-4 py-2 text-sm font-medium text-on-surface-variant transition-colors hover:border-primary/70 hover:text-primary"
              >
                Discard Draft
              </button>
              <button
                type="button"
                onClick={reviewDraft}
                className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-on-primary shadow-sm transition-opacity hover:opacity-95"
              >
                Review & Publish
              </button>
            </div>
          </div>
        </div>
      )}

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

      {/* Discard Draft consent — deleting a draft is destructive, so confirm first */}
      {confirmDiscardDraft && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0" onClick={() => setConfirmDiscardDraft(false)} />
          <div className="relative z-10 w-full max-w-md rounded-xl border border-white/10 bg-black/10 p-5 text-on-surface shadow-2xl backdrop-blur-md">
            <h2 className="text-base font-semibold">Discard draft?</h2>
            <p className="mt-2 text-sm text-on-surface-variant">
              Your draft will be deleted and you&apos;ll start fresh from what&apos;s currently published. This
              can&apos;t be undone.
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
                Discard draft
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
                Replace draft
              </button>
            </div>
          </div>
        </div>
      )}

      <Toast show={showToast} message={toastMessage} isError={toastIsError} />
    </div>
  );
}
