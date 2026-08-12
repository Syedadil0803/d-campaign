'use client';

/**
 * Guided promo flow: Start → Write content → Editor.
 *
 * This is a wrapper, deliberately. The editor (PromoSection) is rendered
 * unchanged as the final step — the flow decides WHEN to show it, never how it
 * looks. Returning users with a live campaign land straight on the editor, so
 * the wizard only appears when there's genuinely something new to create.
 */

import { useEffect, useState } from 'react';
import { CampaignConfig, PromoCard, defaultConfig } from '@/types/campaign';
import { PromoSection } from '@/components/PromoSection';
import { PromoStartStep, PromoStartChoice } from '@/components/PromoStartStep';
import { PromoContentStep } from '@/components/PromoContentStep';
import { SamplePromoTemplates, sampleTemplates } from '@/components/SamplePromoTemplates';
import { PromoMiniPreview } from '@/components/PromoMiniPreview';
import { applyTemplateFull, isCardEmpty } from '@/lib/promoTemplate';
import { listVersions, PromoVersion } from '@/lib/promoVersions';
import { getISODateWithOffset } from '@/lib/utils';
import { X } from 'lucide-react';

type Step = 'start' | 'content' | 'editor';

type PromoSectionProps = React.ComponentProps<typeof PromoSection>;

interface PromoFlowProps extends PromoSectionProps {
  /** Reports the active step so the page can hide Publish outside the editor. */
  onStepChange?: (step: Step) => void;
  /**
   * Where to land. The Dashboard's View/Edit are direct actions on an existing
   * campaign, so they open the editor; the Promo Card tab starts at the picker.
   */
  initialStep?: Step;
}

export function PromoFlow({ onStepChange, initialStep, ...editorProps }: PromoFlowProps) {
  const { config, setConfig, markChanged, toast } = editorProps;

  // Everyone lands on the picker, including returning users — the current
  // campaign is offered there as "Continue current campaign", so nothing is
  // hidden and the entry point is the same every time.
  const [step, setStep] = useState<Step>(initialStep ?? 'start');
  const [draftCard, setDraftCard] = useState<PromoCard | null>(null);
  const [draftSavedAt, setDraftSavedAt] = useState<string | null>(null);
  const [versions, setVersions] = useState<PromoVersion[]>([]);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showPublished, setShowPublished] = useState(false);

  function goTo(next: Step) {
    setStep(next);
  }

  // Keep the page in sync — Publish only belongs in the editor step.
  useEffect(() => {
    onStepChange?.(step);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  // Leaving the promo tab entirely shouldn't leave Publish hidden.
  useEffect(() => {
    return () => onStepChange?.('editor');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load what the Start step needs to offer.
  useEffect(() => {
    if (step !== 'start') return;
    let alive = true;
    fetch('/api/draft')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!alive) return;
        setDraftCard((d?.draft?.promoCard as PromoCard | undefined) ?? null);
        setDraftSavedAt((d?.draft?.lastUpdated as string | undefined) ?? null);
      })
      .catch(() => {});
    listVersions()
      .then((v) => alive && setVersions(v))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [step]);

  function withDefaultDates(card: PromoCard): PromoCard {
    if (card.startDate && card.endDate) return card;
    return {
      ...card,
      startDate: card.startDate || getISODateWithOffset(0),
      endDate: card.endDate || getISODateWithOffset(3),
    };
  }

  /** Apply a template and move to the content step. */
  function pickTemplate(template: PromoCard, name: string) {
    setConfig((prev) => ({
      ...prev,
      promoCard: withDefaultDates(applyTemplateFull(prev.promoCard, template)),
    }));
    markChanged();
    toast(`Template applied: ${name}`);
    goTo('content');
  }

  function handleChoose(choice: PromoStartChoice) {
    if (choice === 'current') {
      // Already the card in the editor — just open it, change nothing.
      goTo('editor');
      return;
    }
    if (choice === 'draft' && draftCard) {
      setConfig((prev) => ({ ...prev, promoCard: withDefaultDates({ ...draftCard }) }));
      markChanged();
      goTo('content');
      return;
    }
    if (choice === 'template') {
      setShowTemplates(true);
      return;
    }
    if (choice === 'published') {
      setShowPublished(true);
      return;
    }
    // Blank — a clean card, straight into the editor.
    setConfig((prev) => ({
      ...prev,
      promoCard: withDefaultDates({
        ...JSON.parse(JSON.stringify(defaultConfig.promoCard)),
        active: prev.promoCard.active,
        stoppedByUser: prev.promoCard.stoppedByUser,
      }),
    }));
    markChanged();
    goTo('editor');
  }

  if (step === 'editor') {
    return <PromoSection {...editorProps} onStartOver={() => goTo('start')} />;
  }

  return (
    <div className="pb-10">
      {step === 'start' && (
        <PromoStartStep
          currentCard={isCardEmpty(config.promoCard) ? null : config.promoCard}
          currentIsLive={config.promoCard.active}
          draftCard={draftCard}
          draftSavedAt={draftSavedAt}
          publishedCount={versions.length}
          templates={sampleTemplates as unknown as {
            id: string;
            name: string;
            promoCard: PromoCard;
          }[]}
          onPickTemplate={pickTemplate}
          onChoose={handleChoose}
          onSkipToEditor={() => goTo('editor')}
        />
      )}

      {step === 'content' && (
        <PromoContentStep
          config={config}
          setConfig={setConfig}
          markChanged={markChanged}
          toast={toast}
          onBack={() => goTo('start')}
          onOpenEditor={() => goTo('editor')}
        />
      )}

      {/* Template picker — starting fresh, so the template brings its copy too. */}
      {showTemplates && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0" onClick={() => setShowTemplates(false)} />
          <div className="relative z-10 flex max-h-[90vh] w-[92vw] max-w-[1500px] flex-col overflow-hidden rounded-xl border border-border shadow-2xl backdrop-blur-md">
            <div className="flex items-center justify-between px-6 py-2">
              <p className="text-sm text-on-surface-variant">
                Pick a template to start from — you can change the design later without losing
                your words.
              </p>
              <button
                type="button"
                onClick={() => setShowTemplates(false)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md text-on-surface-variant transition-colors hover:bg-primary/10 hover:text-primary"
                aria-label="Close templates"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="campaign-custom-scrollbar overflow-y-auto p-6">
              <SamplePromoTemplates
                onApplyTemplate={(template, name) => {
                  setShowTemplates(false);
                  pickTemplate(template, name);
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Reuse a published campaign */}
      {showPublished && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0" onClick={() => setShowPublished(false)} />
          <div className="relative z-10 flex max-h-[90vh] w-[92vw] max-w-[1200px] flex-col overflow-hidden rounded-xl border border-border shadow-2xl backdrop-blur-md">
            <div className="flex items-center justify-between px-6 py-2">
              <p className="text-sm text-on-surface-variant">
                Pick a published campaign to start from.
              </p>
              <button
                type="button"
                onClick={() => setShowPublished(false)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md text-on-surface-variant transition-colors hover:bg-primary/10 hover:text-primary"
                aria-label="Close published"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="campaign-custom-scrollbar grid grid-cols-1 gap-6 overflow-y-auto p-6 md:grid-cols-2 xl:grid-cols-3">
              {versions.length === 0 ? (
                <p className="p-10 text-center text-sm text-on-surface-variant">
                  No published campaigns yet.
                </p>
              ) : (
                [...versions].reverse().map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => {
                      setShowPublished(false);
                      setConfig((prev) => ({
                        ...prev,
                        promoCard: withDefaultDates({
                          ...JSON.parse(JSON.stringify(v.promoCard)),
                          active: prev.promoCard.active,
                          stoppedByUser: prev.promoCard.stoppedByUser,
                        }),
                      }));
                      markChanged();
                      toast(`Started from: ${v.label}`);
                      goTo('content');
                    }}
                    className="rounded-xl border border-gray-200 bg-white p-3 text-left shadow-sm transition-colors hover:border-primary hover:shadow-lg dark:border-gray-700 dark:bg-gray-900"
                  >
                    <p className="mb-2 truncate text-xs font-semibold text-gray-800 dark:text-gray-200">
                      {v.label}
                    </p>
                    <PromoMiniPreview promoCard={v.promoCard} />
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
