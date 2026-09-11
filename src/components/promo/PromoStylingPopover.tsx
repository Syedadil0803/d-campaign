'use client';

import { useEffect, useRef, useState, type RefObject, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, Palette, Settings2 } from 'lucide-react';
import type { CampaignConfig, PromoCard, GradientStyle } from '@/types/campaign';
import { getBackgroundStyle } from '@/lib/utils';
import { applyTemplateLook } from '@/lib/promo/promoTemplate';
import { lookSignature } from '@/lib/promo/promoAuthorship';
import { sampleTemplates } from '@/lib/promo/sampleTemplateCards';

type Tab = 'themes' | 'custom';

interface PromoStylingPopoverProps {
  triggerRef: RefObject<HTMLButtonElement | null>;
  open: boolean;
  onClose: () => void;
  // Config and state
  config: CampaignConfig;
  configRef: RefObject<CampaignConfig>;
  setConfig: (config: CampaignConfig | ((prev: CampaignConfig) => CampaignConfig)) => void;
  markChanged: () => void;
  pushPromoState: (options?: { replace?: boolean }) => void;
  toast: (message: string, isError?: boolean) => void;
  // Theme baseline and tracking
  themeBaseline: PromoCard['style'];
  onOwnDesign: boolean;
  baselineIsATheme: boolean;
  hasCurrentDesign: boolean;
  samplingThemeRef: RefObject<boolean>;
  // Callbacks when user enters custom mode or applies a theme
  onEnterCustomMode?: () => void;
  onApplyTheme?: (themeId: string) => void;
}

const POPOVER_WIDTH = 360;
const GAP = 6;
const MAX_HEIGHT = 220;

export function PromoStylingPopover({
  triggerRef,
  open,
  onClose,
  config,
  configRef,
  setConfig,
  markChanged,
  pushPromoState,
  toast,
  themeBaseline,
  onOwnDesign,
  baselineIsATheme,
  hasCurrentDesign,
  samplingThemeRef,
  onEnterCustomMode,
  onApplyTheme,
}: PromoStylingPopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null);
  const themesContainerRef = useRef<HTMLDivElement>(null);
  const wasOpenRef = useRef(false);
  const lastActiveTabRef = useRef<Tab>('themes');
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('themes');

  // Initialize tab ONLY when popover opens (closed → open transition)
  // Restore to the last active tab, not always reset to 'themes'
  useEffect(() => {
    if (open && !wasOpenRef.current) {
      setActiveTab(lastActiveTabRef.current);
    }
    wasOpenRef.current = open;
  }, [open]);

  // Calculate popover position
  const calculatePosition = useCallback(() => {
    if (!triggerRef.current) return null;

    const rect = triggerRef.current.getBoundingClientRect();
    let left = rect.left;

    if (left + POPOVER_WIDTH > window.innerWidth - 8) {
      left = window.innerWidth - POPOVER_WIDTH - 8;
    }

    return {
      top: rect.bottom + GAP,
      left: Math.max(8, left),
    };
  }, [triggerRef]);

  // Set position when popover opens
  useEffect(() => {
    if (!open) return;

    const newPosition = calculatePosition();
    if (newPosition) {
      setPosition(newPosition);
    }
  }, [open, calculatePosition]);

  // Auto-scroll to active theme
  useEffect(() => {
    if (!open || activeTab !== 'themes' || !position) return;
    if (!themesContainerRef.current) return;

    const container = themesContainerRef.current;

    const scrollToActive = () => {
      const activeButton = container.querySelector(
        'button[aria-selected="true"]',
      ) as HTMLButtonElement | null;

      if (activeButton) {
        const containerRect = container.getBoundingClientRect();
        const buttonRect = activeButton.getBoundingClientRect();

        const scrollOffset =
          buttonRect.top -
          containerRect.top -
          containerRect.height / 2 +
          buttonRect.height / 2;

        container.scrollTo({
          top: container.scrollTop + scrollOffset,
          behavior: 'instant',
        });
      }
    };

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        scrollToActive();
      });
    });
  }, [open, activeTab, config.promoCard.style, position]);

  // Reposition on scroll/resize
  useEffect(() => {
    if (!open) return;

    const handleReposition = (event: Event) => {
      if (popoverRef.current?.contains(event.target as Node)) {
        return;
      }
      const newPosition = calculatePosition();
      if (newPosition) {
        setPosition(newPosition);
      }
    };

    window.addEventListener('scroll', handleReposition, true);
    window.addEventListener('resize', handleReposition);

    return () => {
      window.removeEventListener('scroll', handleReposition, true);
      window.removeEventListener('resize', handleReposition);
    };
  }, [open, calculatePosition]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;

    const handleOutsideClick = (event: MouseEvent) => {
      const target = event.target as Node;

      const isInsidePopover = popoverRef.current?.contains(target);
      const isInsideTrigger = triggerRef.current?.contains(target);

      if (!isInsidePopover && !isInsideTrigger) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [open, onClose, triggerRef]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [open, onClose]);

  const handleTabChange = (tab: Tab) => {
    setActiveTab(tab);
    lastActiveTabRef.current = tab;
    // When switching to "Build Your Own" tab, enter custom mode immediately
    if (tab === 'custom') {
      onEnterCustomMode?.();
    }
  };

  if (!open || !position) return null;

  return createPortal(
    <div
      ref={popoverRef}
      className="rounded-2xl border border-white/10 bg-black/10 backdrop-blur-md shadow-2xl overflow-hidden"
      style={{
        position: 'fixed',
        top: position.top,
        left: position.left,
        width: POPOVER_WIDTH,
        zIndex: 9990,
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <span className="text-xs font-bold uppercase tracking-[0.08em] text-on-surface-variant">
          Customizer
        </span>
        <button
          type="button"
          onClick={onClose}
          className="flex items-center justify-center w-6 h-6 rounded-md text-on-surface-variant hover:bg-surface-subtle hover:text-on-surface transition-colors"
          aria-label="Close styling panel"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'themes'}
          onClick={() => handleTabChange('themes')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold transition-colors ${
            activeTab === 'themes'
              ? 'text-primary border-b-2 border-primary'
              : 'text-on-surface-variant hover:text-on-surface'
          }`}
        >
          <Palette className="w-3.5 h-3.5" />
          Themes
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'custom'}
          onClick={() => handleTabChange('custom')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold transition-colors ${
            activeTab === 'custom'
              ? 'text-primary border-b-2 border-primary'
              : 'text-on-surface-variant hover:text-on-surface'
          }`}
        >
          <Settings2 className="w-3.5 h-3.5" />
          Build Your Own
        </button>
      </div>

      {/* Content */}
      <div className="p-4">
        {activeTab === 'themes' ? (
          <div
            ref={themesContainerRef}
            className="campaign-custom-scrollbar overflow-y-auto"
            style={{ maxHeight: MAX_HEIGHT }}
          >
            <div className="grid grid-cols-2 gap-3">
                  {sampleTemplates.map((t) => {
                    const on =
                      (!onOwnDesign || baselineIsATheme) &&
                      lookSignature((t.promoCard as PromoCard).style) ===
                        lookSignature(config.promoCard.style);
                    return (
                      <div key={t.id} className="flex flex-col items-center gap-1">
                        <button
                          type="button"
                          role="option"
                          aria-selected={on}
                          title={t.name}
                          onClick={() => {
                            if (on) return;
                            onApplyTheme?.(t.id);
                            pushPromoState({ replace: true });
                            samplingThemeRef.current = true;
                            setConfig({
                              ...configRef.current,
                              promoCard: applyTemplateLook(
                                configRef.current.promoCard,
                                t.promoCard as PromoCard,
                              ),
                            });
                            markChanged();
                          }}
                          style={{
                            background: getBackgroundStyle(
                              (t.promoCard as PromoCard).style.background,
                            ),
                          }}
                          className={`h-10 w-full rounded-lg transition-all flex items-center justify-center border ${
                            on
                              ? 'border-primary ring-1 ring-primary/60'
                              : 'border-border hover:border-primary/50'
                          }`}
                        />
                        <span className="text-xs font-medium text-on-surface text-center">
                          {t.name}
                        </span>
                      </div>
                    );
                  })}
              </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Background type selector - Solid/Linear/Radial */}
            <div role="group" aria-label="Background type" className="flex rounded-lg border border-border bg-surface-subtle p-0.5">
              {[
                { value: 'solid', label: 'Solid' },
                { value: 'linear', label: 'Linear' },
                { value: 'radial', label: 'Gradient' },
              ].map((opt) => {
                const active = opt.value === config.promoCard.style.background.type;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    aria-pressed={active}
                    onClick={() => {
                      onEnterCustomMode?.();
                      pushPromoState();
                      setConfig({
                        ...configRef.current,
                        promoCard: {
                          ...configRef.current.promoCard,
                          style: {
                            ...configRef.current.promoCard.style,
                            background: {
                              ...configRef.current.promoCard.style.background,
                              type: opt.value as GradientStyle['type'],
                            },
                          },
                        },
                      });
                      markChanged();
                    }}
                    className={`flex-1 rounded-md px-4 py-1.5 text-xs font-semibold transition-colors ${
                      active
                        ? 'bg-primary text-on-primary shadow-sm'
                        : 'text-on-surface-variant hover:text-on-surface'
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>

            {/* Color controls */}
            <div className="space-y-3">
              {config.promoCard.style.background.type === 'solid' && (
                <div>
                  <label className="block text-xs font-medium text-on-surface-variant mb-2">
                    BACKGROUND COLOR
                  </label>
                  <input
                    type="color"
                    value={config.promoCard.style.background.startColor || '#ffffff'}
                    onChange={(e) => {
                      onEnterCustomMode?.();
                      pushPromoState();
                      setConfig({
                        ...configRef.current,
                        promoCard: {
                          ...configRef.current.promoCard,
                          style: {
                            ...configRef.current.promoCard.style,
                            background: {
                              ...configRef.current.promoCard.style.background,
                              startColor: e.target.value,
                            },
                          },
                        },
                      });
                      markChanged();
                    }}
                    className="bg-color-picker h-10 w-full rounded cursor-pointer"
                  />
                </div>
              )}

              {(config.promoCard.style.background.type === 'linear' ||
                config.promoCard.style.background.type === 'radial') && (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-medium text-on-surface-variant mb-2">
                        {config.promoCard.style.background.type === 'linear' ? 'START' : 'CENTER'}
                      </label>
                      <input
                        type="color"
                        value={config.promoCard.style.background.startColor || '#ffffff'}
                        onChange={(e) => {
                          pushPromoState();
                          setConfig({
                            ...configRef.current,
                            promoCard: {
                              ...configRef.current.promoCard,
                              style: {
                                ...configRef.current.promoCard.style,
                                background: {
                                  ...configRef.current.promoCard.style.background,
                                  startColor: e.target.value,
                                },
                              },
                            },
                          });
                          markChanged();
                        }}
                        className="bg-color-picker h-10 w-full rounded cursor-pointer"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-on-surface-variant mb-2">
                        {config.promoCard.style.background.type === 'linear' ? 'END' : 'OUTER'}
                      </label>
                      <input
                        type="color"
                        value={config.promoCard.style.background.endColor || '#000000'}
                        onChange={(e) => {
                          onEnterCustomMode?.();
                          pushPromoState();
                          setConfig({
                            ...configRef.current,
                            promoCard: {
                              ...configRef.current.promoCard,
                              style: {
                                ...configRef.current.promoCard.style,
                                background: {
                                  ...configRef.current.promoCard.style.background,
                                  endColor: e.target.value,
                                },
                              },
                            },
                          });
                          markChanged();
                        }}
                        className="bg-color-picker h-10 w-full rounded cursor-pointer"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-on-surface-variant mb-2">
                      BALANCE
                    </label>
                    <div className="flex items-center gap-3 h-10">
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={config.promoCard.style.background.midpoint ?? 50}
                        onChange={(e) => {
                          setConfig({
                            ...configRef.current,
                            promoCard: {
                              ...configRef.current.promoCard,
                              style: {
                                ...configRef.current.promoCard.style,
                                background: {
                                  ...configRef.current.promoCard.style.background,
                                  midpoint: Number(e.target.value),
                                },
                              },
                            },
                          });
                          markChanged();
                        }}
                        className="balance-slider flex-1"
                      />
                      <span className="text-xs font-medium text-on-surface-variant min-w-[40px] text-right">
                        {config.promoCard.style.background.midpoint ?? 50}%
                      </span>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
