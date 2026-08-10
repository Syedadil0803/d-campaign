'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { X, Loader2 } from 'lucide-react';
import { CampaignConfig, defaultConfig } from '@/types/campaign';
import { normalizeLegacyTimerTokens, TIMER_FIXED_TOKEN } from '@/lib/timerUtils';
import { Header } from '@/components/Header';
import { Dashboard } from '@/components/Dashboard';
import { AnnouncementSection } from '@/components/AnnouncementSection';
import { PromoSection } from '@/components/PromoSection';
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
          background: { type: 'solid', startColor: '#6366f1', endColor: '#6366f1' },
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
  const [config, setConfig] = useState<CampaignConfig>(defaultConfig);
  const [hasAnnouncementChanges, setHasAnnouncementChanges] = useState(false);
  const [hasPromoChanges, setHasPromoChanges] = useState(false);
  const [readyToPublishAnnouncement, setReadyToPublishAnnouncement] = useState(false);
  const [readyToPublishPromo, setReadyToPublishPromo] = useState(false);
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
  const mainScrollRef = useRef<HTMLElement>(null);
  const configRef = useRef(config);
  configRef.current = config;
  const hasChangesRef = useRef(hasChanges);
  hasChangesRef.current = hasChanges;
  const draftSignatureRef = useRef<string | null>(null);
  const savedPromoSignatureRef = useRef<string | null>(null);
  const publishedConfigRef = useRef<string | null>(null);

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
    return JSON.stringify({
      ...cfg,
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
    if (savedPromoSignatureRef.current === promoSignature) return 'skipped';

    const existingVersions = await listVersions();
    const matchingVersion = existingVersions.some(
      (version) => JSON.stringify(version.promoCard) === promoSignature,
    );
    if (matchingVersion) {
      savedPromoSignatureRef.current = promoSignature;
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

  // Browser close/refresh can only show the native unload warning. Keep drafting,
  // but do not mark the draft prompt as handled unless the user chooses an in-app action.
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasChangesRef.current) {
        saveDraft(configRef.current, { markHandled: false });
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  // Auto-save as draft to localStorage when tool/tab becomes hidden (timeout, switch away)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden' && hasChangesSinceDraft()) {
        saveDraft(configRef.current, { markHandled: false });
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
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

  // Wrap setActiveTab to prompt save-as-draft when switching tabs with unsaved edits since the last draft
  const handleTabSwitch = useCallback(
    (tab: 'dashboard' | 'announcement' | 'promo', mode: 'view' | 'edit' = 'edit') => {
      if (tab === activeTab) return;
      if (hasChangesSinceDraft()) {
        saveDraft(configRef.current);
        toast('Draft saved');
      }
      setEditorMode(mode);
      setActiveTab(tab);
    },
    [activeTab],
  );

  function saveDraft(
    cfg: CampaignConfig,
    options: { markHandled?: boolean } = {},
  ) {
    localStorage.setItem('campaign-draft', JSON.stringify(cfg));
    localStorage.setItem('campaign-draft-date', new Date().toISOString());
    if (options.markHandled !== false) {
      draftSignatureRef.current = getConfigSignature(cfg);
    }
  }

  function clearDraft() {
    localStorage.removeItem('campaign-draft');
    localStorage.removeItem('campaign-draft-date');
    draftSignatureRef.current = null;
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
    saveDraft(configRef.current);
    toast('Draft saved');
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
        if (scope === 'announcement') setHasAnnouncementChanges(false);
        else if (scope === 'promo') setHasPromoChanges(false);
        else { setHasAnnouncementChanges(false); setHasPromoChanges(false); }
        publishedConfigRef.current = getConfigSignature(cfg);
        clearDraft();
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
        setReadyToPublishPromo(false);
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
        setReadyToPublishPromo(false);
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
      const draft = localStorage.getItem('campaign-draft');
      const draftDate = localStorage.getItem('campaign-draft-date');

      // Always fetch the published config from API
      const response = await fetch('/api/config');
      let publishedCfg: CampaignConfig | null = null;
      if (response.ok) {
        const data = await response.json();
        publishedCfg = migrateConfig(data, data.version);
        publishedConfigRef.current = getConfigSignature(publishedCfg);
      }

      if (draft) {
        const parsed = JSON.parse(draft) as CampaignConfig;
        const migrated = migrateConfig(parsed, parsed.version);
        // Only show banner if draft differs from published
        if (publishedCfg && getConfigSignature(migrated) !== getConfigSignature(publishedCfg)) {
          setConfig(migrated);
          draftSignatureRef.current = getConfigSignature(migrated);
          savedPromoSignatureRef.current = getPromoSignature(migrated);
          setHasAnnouncementChanges(true);
          setHasPromoChanges(true);
          setReadyToPublishAnnouncement(true);
          setReadyToPublishPromo(true);
          setDraftBanner({ date: draftDate || new Date().toISOString() });
          return;
        }
        // Draft matches published — discard it silently
        clearDraft();
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

  const ANNOUNCEMENT_PUBLISH_PROMPT = {
    title: 'Changes saved',
    message: 'How do you want to proceed?',
    confirmLabel: 'Publish now',
    cancelLabel: 'Save as draft',
  };

  async function handleSaveAnnouncement() {
    saveDraft(config);
    setHasAnnouncementChanges(false);
    setReadyToPublishAnnouncement(true);
    toast('Changes saved — please publish to go live');
    // Right after saving, ask whether to publish now (publish-later otherwise).
    setPublishConfirm({
      warnings: [],
      onConfirm: handlePublishAnnouncement,
      ...ANNOUNCEMENT_PUBLISH_PROMPT,
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

  // Immediate status changes from the on-air chip — no Save → Publish. Stopping
  // takes the campaign off now; "Go on air" reactivates the same content now.
  async function stopAnnouncementNow() {
    const next = {
      ...configRef.current,
      announcementBar: { ...configRef.current.announcementBar, active: false },
    };
    setConfig(next);
    await persistConfig(next, 'Campaign switched off — no longer on your website', 'announcement');
    setReadyToPublishAnnouncement(false);
  }

  async function goOnAirAnnouncementNow() {
    const next = {
      ...configRef.current,
      announcementBar: { ...configRef.current.announcementBar, active: true },
    };
    setConfig(next);
    await persistConfig(next, 'Campaign is live on your website', 'announcement');
    setReadyToPublishAnnouncement(false);
  }

  async function handleSavePromo() {
    saveDraft(config);
    setHasPromoChanges(false);
    setReadyToPublishPromo(true);
    toast('Changes saved — please publish to go live');
    // Step 1 popup: simple "publish now?" prompt (no Heads-up here). "Publish
    // now" defers to the validation Heads-up popup (Step 2) rather than
    // publishing directly; "Not yet" leaves it saved as Unpublished changes.
    setPublishConfirm({
      warnings: [],
      onConfirm: promoPublishFromSavePrompt,
      deferPublish: true,
      title: 'Changes saved',
      message: 'How do you want to proceed?',
      confirmLabel: 'Publish now',
      cancelLabel: 'Save as draft',
    });
  }

  // Turning a stopped promo back on from the status chip: flip it on
  // provisionally and ask whether to go live. Publish → live; Cancel → revert
  // to the previous (stopped) state.
  // Immediate status changes from the promo status chip — no Save → Publish.
  // Stopping takes the card off now; "Go on air" reactivates the same content.
  async function stopPromoNow() {
    const next = {
      ...configRef.current,
      promoCard: { ...configRef.current.promoCard, active: false, stoppedByUser: true },
    };
    setConfig(next);
    await persistConfig(next, 'Campaign switched off — no longer on your website', 'promo');
    setReadyToPublishPromo(false);
  }

  async function goOnAirPromoNow() {
    const next = {
      ...configRef.current,
      promoCard: { ...configRef.current.promoCard, active: true, stoppedByUser: false },
    };
    setConfig(next);
    await persistConfig(next, 'Campaign is live on your website', 'promo');
    setReadyToPublishPromo(false);
  }

  // Step 1 "Publish now" → if validation has anything to report, open the
  // Heads-up validator popup (Step 2); otherwise publish straight away.
  async function promoPublishFromSavePrompt() {
    const warnings = validatePromo();
    if (warnings.length > 0) {
      handlePublishPromoWithValidation();
      return;
    }
    setIsPublishing(true);
    await handlePublishPromo();
    await new Promise(r => setTimeout(r, 500));
    setIsPublishing(false);
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
      setReadyToPublishPromo(false);
      return;
    }

    await persistConfig(cfgToSave, successMsg, 'promo');
    setConfig(cfgToSave);
    setReadyToPublishPromo(false);
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

    // 1b. DOM overflow check (pixel-perfect mirror)
    const fieldMaxLines: Record<string, number> = { title: 1, subtitle: 2, description: 3 };
    // Measure at the card's ACTUAL content width (the card auto-widens 400→440),
    // not a fixed narrow width, and neutralize letter-spacing (the live preview
    // strips it). Otherwise this warns "may overflow" for text that actually fits.
    const contentWidth = (pc.cardWidth || 400) - 56; // card padding (40) + field padding (16)
    (['title', 'subtitle', 'description'] as const).forEach((field) => {
      const html = pc[field];
      if (!strip(html || '')) return;
      const ghost = document.createElement('div');
      ghost.style.cssText = `
        position:absolute;visibility:hidden;pointer-events:none;
        width:${contentWidth}px;padding:0;font-family:inherit;line-height:24px;letter-spacing:normal;
        word-break:break-word;overflow-wrap:break-word;
      `;
      ghost.innerHTML = '<span style="font-size:1rem">&nbsp;</span>';
      document.body.appendChild(ghost);
      const singleLineHeight = ghost.offsetHeight;
      ghost.innerHTML = html;
      ghost.querySelectorAll('*').forEach((el) => { (el as HTMLElement).style.letterSpacing = 'normal'; });
      const contentHeight = ghost.offsetHeight;
      document.body.removeChild(ghost);
      const maxHeight = singleLineHeight * fieldMaxLines[field] + (singleLineHeight * 0.5);
      if (contentHeight > maxHeight) {
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
    const warnings = validatePromo();
    setPublishConfirm({ warnings, onConfirm: handlePublishPromo });
  }

  function handlePublishAnnouncementWithValidation() {
    // Same confirmation popup as the post-save prompt (Step 3).
    setPublishConfirm({
      warnings: [],
      onConfirm: handlePublishAnnouncement,
      ...ANNOUNCEMENT_PUBLISH_PROMPT,
    });
  }

  async function handleSave() {
    let cfgToSave = config;

    const variantStatus = await getPromoVariantSaveStatus(cfgToSave);
    if (variantStatus === 'pending') {
      setPendingVariantSave({ config: cfgToSave, versions: await listVersions(), mode: 'save' });
      return;
    }

    if (variantStatus === 'ready') {
      await savePromoVariant(cfgToSave);
      await persistConfig(cfgToSave, 'Settings saved and promo variant saved');
      return;
    }

    await persistConfig(cfgToSave);
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
    setReadyToPublishPromo(false);
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
      }
    } catch (e) {
      console.error('Failed to reload config:', e);
    }
    toast('Draft discarded');
  }

  function reviewDraft() {
    setDraftBanner(null);
    setActiveTab('promo');
  }

  function markChanged() {
    setHasAnnouncementChanges(true);
    setHasPromoChanges(true);
    setReadyToPublishAnnouncement(false);
    setReadyToPublishPromo(false);
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
      setReadyToPublishPromo(false);
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
          readyToPublishPromo={readyToPublishPromo}
          isPublishing={isPublishing}
          isDarkMode={isDarkMode}
          toggleDarkMode={toggleDarkMode}
          handleSaveAnnouncement={handleSaveAnnouncement}
          handleSavePromo={handleSavePromo}
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
                config={config}
                setActiveTab={handleTabSwitch}
                onStopPromo={stopPromoNow}
                onGoOnAirPromo={goOnAirPromoNow}
                onStopAnnouncement={stopAnnouncementNow}
                onGoOnAirAnnouncement={goOnAirAnnouncementNow}
                promoUnpublished={hasPromoChanges || readyToPublishPromo}
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
                <PromoSection
                  config={config}
                  setConfig={setConfig}
                  markChanged={markPromoChanged}
                  toast={toast}
                  onSelectedVersionChange={setSelectedPromoVersionId}
                  canReactivate={promoCanReactivate}
                  onStop={stopPromoNow}
                  onGoOnAir={goOnAirPromoNow}
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

      <Toast show={showToast} message={toastMessage} isError={toastIsError} />
    </div>
  );
}
