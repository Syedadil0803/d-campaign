'use client';

import { useState, useEffect } from 'react';
import { Gift, X } from 'lucide-react';
import { CampaignConfig, PromoCard } from '@/types/campaign';
import { getBackgroundStyle } from '@/lib/utils';
import { SamplePromoTemplates } from './SamplePromoTemplates';

interface PromoSectionProps {
  config: CampaignConfig;
  setConfig: (config: CampaignConfig) => void;
  markChanged: () => void;
  toast: (message: string, isError?: boolean) => void;
}

export function PromoSection({ config, setConfig, markChanged, toast }: PromoSectionProps) {
  const [currentTime, setCurrentTime] = useState(Date.now());

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  function toggleActive() {
    setConfig({
      ...config,
      promoCard: {
        ...config.promoCard,
        active: !config.promoCard.active,
      },
    });
    markChanged();
  }

  function updateField(field: keyof PromoCard, value: any) {
    setConfig({
      ...config,
      promoCard: {
        ...config.promoCard,
        [field]: value,
      },
    });
    markChanged();
  }

  function calculateTimeRemaining(): string {
    if (!config.promoCard.startDate || !config.promoCard.endDate) {
      return '00:00:00';
    }

    const now = new Date(currentTime);
    const start = new Date(config.promoCard.startDate);
    const end = new Date(config.promoCard.endDate);

    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);

    if (now < start) {
      const diff = start.getTime() - now.getTime();
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);
      return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }

    if (now > end) {
      return '00:00:00';
    }

    const remaining = end.getTime() - now.getTime();
    const hours = Math.floor(remaining / (1000 * 60 * 60));
    const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((remaining % (1000 * 60)) / 1000);
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }

  function getFormattedTimerText(): string {
    const timerValue = calculateTimeRemaining();
    const [hours, minutes, seconds] = timerValue.split(':');
    const template = config.promoCard.timerText || '';
    
    return template
      .replace(/\{hh\}/g, hours + 'h')
      .replace(/\{h\}/g, hours + 'h')
      .replace(/\{mm\}/g, minutes + 'm')
      .replace(/\{m\}/g, minutes + 'm')
      .replace(/\{ss\}/g, seconds + 's')
      .replace(/\{s\}/g, seconds + 's');
  }

  function applyTemplate(template: PromoCard, templateName: string) {
    setConfig({
      ...config,
      promoCard: JSON.parse(JSON.stringify(template)),
    });
    markChanged();
    toast(`Template applied: ${templateName}`);
  }

  return (
    <section className="bg-white shadow rounded-lg border border-gray-200 overflow-hidden dark:bg-gray-800 dark:border-gray-700">
      <div className="px-6 py-3 border-b border-gray-200 bg-gray-50/50 flex items-center justify-between dark:border-gray-700 dark:bg-gray-700/50">
        <div className="flex items-center">
          <div className="p-2 bg-pink-100 rounded-lg mr-4">
            <Gift className="w-5 h-5 text-pink-600" />
          </div>
          <div>
            <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-gray-100">Promo Card</h3>
            <p className="mt-1 max-w-2xl text-sm text-gray-500 dark:text-gray-400">Floating widget for special offers.</p>
          </div>
        </div>

        <button
          onClick={toggleActive}
          className={`relative inline-flex flex-shrink-0 h-6 w-11 border-2 border-transparent rounded-full cursor-pointer transition-colors ease-in-out duration-200 ${
            config.promoCard.active ? 'bg-indigo-600' : 'bg-gray-200'
          }`}
        >
          <span
            className={`pointer-events-none relative inline-block h-5 w-5 rounded-full bg-white shadow transform transition ${
              config.promoCard.active ? 'translate-x-5' : 'translate-x-0'
            }`}
          ></span>
        </button>
      </div>

      <div className="p-4 grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Title</label>
              <input
                type="text"
                value={config.promoCard.title}
                onChange={(e) => updateField('title', e.target.value)}
                className="mt-1 block w-full border-gray-300 rounded-md p-2 border bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
                placeholder="Get 20% OFF"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Subtitle</label>
              <input
                type="text"
                value={config.promoCard.subtitle}
                onChange={(e) => updateField('subtitle', e.target.value)}
                className="mt-1 block w-full border-gray-300 rounded-md p-2 border bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
                placeholder="Limited time offer"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Description</label>
            <textarea
              value={config.promoCard.description}
              onChange={(e) => updateField('description', e.target.value)}
              rows={3}
              className="mt-1 block w-full border-gray-300 rounded-md p-2 border bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
              placeholder="Sign up for our newsletter today!"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Start Date</label>
              <input
                type="date"
                value={config.promoCard.startDate}
                onChange={(e) => updateField('startDate', e.target.value)}
                className="mt-1 block w-full border-gray-300 rounded-md p-2 border bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">End Date</label>
              <input
                type="date"
                value={config.promoCard.endDate}
                onChange={(e) => updateField('endDate', e.target.value)}
                className="mt-1 block w-full border-gray-300 rounded-md p-2 border bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
              />
            </div>
          </div>

          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Enable Timer</label>
            <button
              onClick={() => updateField('showTimer', !config.promoCard.showTimer)}
              className={`relative inline-flex h-6 w-11 border-2 border-transparent rounded-full transition-colors ${
                config.promoCard.showTimer ? 'bg-indigo-600' : 'bg-gray-200'
              }`}
            >
              <span
                className={`inline-block h-5 w-5 rounded-full bg-white shadow transform transition ${
                  config.promoCard.showTimer ? 'translate-x-5' : 'translate-x-0'
                }`}
              ></span>
            </button>
          </div>

          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Enable Button</label>
            <button
              onClick={() => updateField('showButton', !config.promoCard.showButton)}
              className={`relative inline-flex h-6 w-11 border-2 border-transparent rounded-full transition-colors ${
                config.promoCard.showButton ? 'bg-indigo-600' : 'bg-gray-200'
              }`}
            >
              <span
                className={`inline-block h-5 w-5 rounded-full bg-white shadow transform transition ${
                  config.promoCard.showButton ? 'translate-x-5' : 'translate-x-0'
                }`}
              ></span>
            </button>
          </div>

          {config.promoCard.showButton && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Button Text</label>
                <input
                  type="text"
                  value={config.promoCard.buttonText}
                  onChange={(e) => updateField('buttonText', e.target.value)}
                  className="mt-1 block w-full border-gray-300 rounded-md p-2 border bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
                  placeholder="Shop Now"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Button URL</label>
                <input
                  type="text"
                  value={config.promoCard.buttonUrl}
                  onChange={(e) => updateField('buttonUrl', e.target.value)}
                  className="mt-1 block w-full border-gray-300 rounded-md p-2 border bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
                />
              </div>
            </div>
          )}
        </div>

        <div className="bg-gray-100 rounded-lg p-4 relative min-h-[260px] border border-gray-200 dark:bg-gray-700 dark:border-gray-600">
          <div className="absolute inset-0 flex items-center justify-center text-gray-400 text-sm font-medium pointer-events-none">
            Website Content Area
          </div>

          {config.promoCard.active && (
            <div
              className={`relative z-10 w-[400px] rounded-xl shadow-2xl p-5 flex flex-col ${
                config.promoCard.style.position === 'bottom-right' ? 'ml-auto mt-auto' :
                config.promoCard.style.position === 'bottom-left' ? 'mr-auto mt-auto' :
                config.promoCard.style.position === 'top-right' ? 'ml-auto mb-auto' :
                'mr-auto mb-auto'
              }`}
              style={{ background: getBackgroundStyle(config.promoCard.style.background) }}
            >
              <button className="absolute top-2 right-2 opacity-60 hover:opacity-100 p-1">
                <X className="w-4 h-4" />
              </button>

              <h3
                className="text-base font-normal mb-1 px-2 py-1 rounded break-words"
                style={{
                  background: getBackgroundStyle(config.promoCard.style.titleStyle.background),
                  color: config.promoCard.style.titleStyle.textColor,
                  textAlign: config.promoCard.style.titleStyle.textAlign || 'center',
                }}
                dangerouslySetInnerHTML={{ __html: config.promoCard.title || 'Title' }}
              />

              {config.promoCard.subtitle && (
                <h4
                  className="text-base font-normal mb-2 px-2 py-1 rounded break-words"
                  style={{
                    background: getBackgroundStyle(config.promoCard.style.subheadingStyle.background),
                    color: config.promoCard.style.subheadingStyle.textColor,
                    textAlign: config.promoCard.style.subheadingStyle.textAlign || 'center',
                  }}
                  dangerouslySetInnerHTML={{ __html: config.promoCard.subtitle }}
                />
              )}

              <p
                className="text-base font-normal mb-2 px-2 py-1 rounded break-words"
                style={{
                  background: getBackgroundStyle(config.promoCard.style.descriptionStyle.background),
                  color: config.promoCard.style.descriptionStyle.textColor,
                  textAlign: config.promoCard.style.descriptionStyle.textAlign || 'left',
                }}
                dangerouslySetInnerHTML={{ __html: config.promoCard.description || 'Description' }}
              />

              {config.promoCard.showTimer && (
                <div
                  className="text-base mb-4 px-2 py-1 rounded break-words"
                  style={{
                    background: getBackgroundStyle(config.promoCard.style.dateStyle.background),
                    color: config.promoCard.style.dateStyle.textColor,
                    textAlign: config.promoCard.style.dateStyle.textAlign || 'center',
                  }}
                  dangerouslySetInnerHTML={{ __html: getFormattedTimerText() }}
                />
              )}

              {config.promoCard.showButton && config.promoCard.buttonText && (
                <div className={config.promoCard.buttonFullWidth ? '' : 'flex justify-center'}>
                  <button
                    className={`py-2 px-4 rounded-lg text-base font-semibold ${
                      config.promoCard.buttonFullWidth ? 'w-full' : ''
                    }`}
                    style={{
                      background: getBackgroundStyle(config.promoCard.style.buttonStyle.background),
                      color: config.promoCard.style.buttonStyle.textColor,
                    }}
                    dangerouslySetInnerHTML={{ __html: config.promoCard.buttonText }}
                  />
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <SamplePromoTemplates onApplyTemplate={applyTemplate} />
    </section>
  );
}
