'use client';

import { useState, useEffect } from 'react';
import { CampaignConfig, defaultConfig } from '@/types/campaign';
import { Header } from '@/components/Header';
import { Dashboard } from '@/components/Dashboard';
import { AnnouncementSection } from '@/components/AnnouncementSection';
import { PromoSection } from '@/components/PromoSection';
import { Toast } from '@/components/Toast';

export default function Home() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'announcement' | 'promo'>('dashboard');
  const [config, setConfig] = useState<CampaignConfig>(defaultConfig);
  const [hasChanges, setHasChanges] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastIsError, setToastIsError] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);

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

  async function loadConfig() {
    try {
      const response = await fetch('/api/config');
      if (response.ok) {
        const data = await response.json();
        setConfig(data);
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
        />

        <main className="flex-1 overflow-y-auto bg-gray-50 p-6 dark:bg-gray-900">
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
          </div>
        </main>
      </div>

      <Toast show={showToast} message={toastMessage} isError={toastIsError} />
    </div>
  );
}
