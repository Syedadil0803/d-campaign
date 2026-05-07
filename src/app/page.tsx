'use client';

import { useState, useEffect, useRef } from 'react';
import { CampaignConfig, defaultConfig } from '@/types/campaign';
import { Header } from '@/components/Header';
import { Dashboard } from '@/components/Dashboard';
import { AnnouncementSection } from '@/components/AnnouncementSection';
import { PromoSection } from '@/components/PromoSection';
import { Toast } from '@/components/Toast';
import { Code, ChevronDown } from 'lucide-react';

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

function migrateConfig(config: any, version: string): CampaignConfig {
  let migrated = { ...config };
  
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
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastIsError, setToastIsError] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const mainScrollRef = useRef<HTMLElement>(null);

  useEffect(() => {
    loadConfig();
    
    const savedDarkMode = localStorage.getItem('darkMode');
    if (savedDarkMode !== null) {
      setIsDarkMode(savedDarkMode === 'true');
    } else {
      setIsDarkMode(window.matchMedia('(prefers-color-scheme: dark)').matches);
    }
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

  async function loadConfig() {
    try {
      const response = await fetch('/api/config');
      if (response.ok) {
        const data = await response.json();
        const migrated = migrateConfig(data, data.version);
        setConfig(migrated);
      }
    } catch (error) {
      console.error('Failed to load config:', error);
    }
  }

  async function handleSave() {
    try {
      const response = await fetch('/api/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });

      if (response.ok) {
        setHasChanges(false);
        toast('Settings saved successfully');
      } else {
        toast('Failed to save settings', true);
      }
    } catch (error) {
      console.error('Failed to save config:', error);
      toast('Failed to save settings', true);
    }
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
    // Clear any user session data
    localStorage.removeItem('authToken');
    localStorage.removeItem('userEmail');
    // Redirect to login page or handle logout logic
    window.location.href = '/login';
  }

  function markChanged() {
    setHasChanges(true);
  }

  return (
    <div className="flex h-screen bg-gray-50 font-sans text-gray-900 dark:bg-gray-900 dark:text-gray-100">
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        <Header
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          config={config}
          hasChanges={hasChanges}
          isDarkMode={isDarkMode}
          toggleDarkMode={toggleDarkMode}
          handleSave={handleSave}
          handleLogout={handleLogout}
        />

        <main ref={mainScrollRef} className="flex-1 overflow-y-auto bg-gray-50 p-6 dark:bg-gray-900">
          <div className="max-w-[1400px] mx-auto space-y-8 pb-12">
            {activeTab === 'dashboard' && (
              <Dashboard config={config} setActiveTab={setActiveTab} />
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
              />
            )}

            {/* Raw Data (Collapsed) */}
            <details className="group bg-white rounded-lg border border-gray-200 shadow-sm dark:bg-gray-800 dark:border-gray-700">
              <summary className="flex items-center justify-between p-4 cursor-pointer">
                <h3 className="text-sm font-medium text-gray-700 font-mono flex items-center dark:text-gray-300">
                  <Code className="w-4 h-4 mr-2" />
                  JSON Configuration
                </h3>
                <ChevronDown className="w-4 h-4 text-gray-400 group-open:rotate-180 transition-transform dark:text-gray-500" />
              </summary>
              <div className="p-4 bg-gray-50 border-t border-gray-200 font-mono text-xs overflow-x-auto text-gray-600 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300">
                <pre>{JSON.stringify(config, null, 2)}</pre>
              </div>
            </details>
          </div>
        </main>
      </div>

      <Toast show={showToast} message={toastMessage} isError={toastIsError} />
    </div>
  );
}
