'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { X } from 'lucide-react';
import { CampaignConfig, defaultConfig } from '@/types/campaign';
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
  const normalizedTimerText = (promoCard.timerText || '')
    .replace(/<span[^>]*data-timer-placeholder="hhh"[^>]*>.*?<\/span>/gi, '{hh}')
    .replace(/<span[^>]*data-timer-placeholder="mmm"[^>]*>.*?<\/span>/gi, '{mm}')
    .replace(/<span[^>]*data-timer-placeholder="sss"[^>]*>.*?<\/span>/gi, '{ss}')
    .replace(/<span[^>]*data-timer-placeholder="ddd"[^>]*>.*?<\/span>/gi, '{d}')
    .replace(/<span[^>]*data-timer-placeholder="dd"[^>]*>.*?<\/span>/gi, '{d}')
    .replace(/<span[^>]*data-timer-placeholder="d"[^>]*>.*?<\/span>/gi, '{d}')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim() || 'Ends in {hh}:{mm}:{ss}';

  return {
    ...promoCard,
    timerText: normalizedTimerText,
  };
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
  const [hasChanges, setHasChanges] = useState(false);
  const [pendingDraftAction, setPendingDraftAction] = useState<
    | { type: 'tab'; tab: 'dashboard' | 'announcement' | 'promo' }
    | { type: 'logout' }
    | null
  >(null);
  const [pendingVariantSave, setPendingVariantSave] = useState<{
    config: CampaignConfig;
    versions: PromoVersion[];
  } | null>(null);
  const [selectedPromoVersionId, setSelectedPromoVersionId] = useState<string | null>(null);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastIsError, setToastIsError] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const mainScrollRef = useRef<HTMLElement>(null);
  const configRef = useRef(config);
  configRef.current = config;
  const hasChangesRef = useRef(hasChanges);
  hasChangesRef.current = hasChanges;
  const draftSignatureRef = useRef<string | null>(null);
  const savedPromoSignatureRef = useRef<string | null>(null);

  function getConfigSignature(cfg: CampaignConfig) {
    return JSON.stringify(cfg);
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

  // Wrap setActiveTab to prompt save-as-draft when switching tabs with unsaved edits since the last draft
  const handleTabSwitch = useCallback((tab: 'dashboard' | 'announcement' | 'promo') => {
    if (tab === activeTab) return;
    if (hasChangesSinceDraft()) {
      setPendingDraftAction({ type: 'tab', tab });
      return;
    }
    setActiveTab(tab);
  }, [activeTab]);

  function saveDraft(
    cfg: CampaignConfig,
    options: { markHandled?: boolean } = {},
  ) {
    localStorage.setItem('campaign-draft', JSON.stringify(cfg));
    if (options.markHandled !== false) {
      draftSignatureRef.current = getConfigSignature(cfg);
    }
  }

  function clearDraft() {
    localStorage.removeItem('campaign-draft');
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
  ) {
    try {
      const response = await fetch('/api/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cfg),
      });

      if (response.ok) {
        setHasChanges(false);
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

  async function savePendingVariantAndClose() {
    if (!pendingVariantSave) return;
    const cfg = pendingVariantSave.config;
    setPendingVariantSave(null);
    await savePromoVariant(cfg, true);
    await persistConfig(cfg, 'Settings saved and promo variant saved');
  }

  async function updateExistingVariantAndClose(versionId: string) {
    if (!pendingVariantSave) return;
    const cfg = pendingVariantSave.config;
    const version = pendingVariantSave.versions.find((item) => item.id === versionId);
    setPendingVariantSave(null);
    await updateVersion(versionId, cfg.promoCard, version?.label);
    setSelectedPromoVersionId(versionId);
    savedPromoSignatureRef.current = getPromoSignature(cfg);
    await persistConfig(cfg, 'Settings saved and promo variant updated');
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
      // Check for a saved draft first
      const draft = localStorage.getItem('campaign-draft');
      if (draft) {
        const parsed = JSON.parse(draft) as CampaignConfig;
        const migrated = migrateConfig(parsed, parsed.version);
        setConfig(migrated);
        draftSignatureRef.current = getConfigSignature(migrated);
        savedPromoSignatureRef.current = getPromoSignature(migrated);
        setHasChanges(true);
        toast('Restored from draft');
        return;
      }

      const response = await fetch('/api/config');
      if (response.ok) {
        const data = await response.json();
        const migrated = migrateConfig(data, data.version);
        setConfig(migrated);
        draftSignatureRef.current = getConfigSignature(migrated);
        savedPromoSignatureRef.current = getPromoSignature(migrated);
      }
    } catch (error) {
      console.error('Failed to load config:', error);
    }
  }

  async function handleSave() {
    const variantStatus = await getPromoVariantSaveStatus(config);
    if (variantStatus === 'pending') {
      setPendingVariantSave({ config, versions: await listVersions() });
      return;
    }

    if (variantStatus === 'ready') {
      await savePromoVariant(config);
      await persistConfig(config, 'Settings saved and promo variant saved');
      return;
    }

    await persistConfig(config);
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

  function markChanged() {
    setHasChanges(true);
  }

  const selectedPendingVariant = getSelectedPendingVariant();

  return (
    <div className="campaign-page-bg flex h-screen text-on-surface">
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        <Header
          activeTab={activeTab}
          setActiveTab={handleTabSwitch}
          hasChanges={hasChanges}
          isDarkMode={isDarkMode}
          toggleDarkMode={toggleDarkMode}
          handleSave={handleSave}
          handleLogout={handleLogout}
        />

        <main
          ref={mainScrollRef}
          className={`flex-1 overflow-y-auto bg-transparent px-6 pt-8 pb-6 ${
            activeTab === 'promo' || activeTab === 'announcement' ? 'campaign-custom-scrollbar' : ''
          }`}
        >
          <div className={`max-w-[1840px] mx-auto ${activeTab === 'promo' ? '' : 'space-y-8 pb-12'}`}>
            {activeTab === 'dashboard' && (
              <Dashboard config={config} setActiveTab={handleTabSwitch} />
            )}

            {activeTab === 'announcement' && (
              <AnnouncementSection
                config={config}
                setConfig={setConfig}
                markChanged={markChanged}
              />
            )}

            {activeTab === 'promo' && (
              <PromoSection
                config={config}
                setConfig={setConfig}
                markChanged={markChanged}
                toast={toast}
                onSelectedVersionChange={setSelectedPromoVersionId}
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

      <Toast show={showToast} message={toastMessage} isError={toastIsError} />
    </div>
  );
}
