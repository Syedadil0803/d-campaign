'use client';

/**
 * Guided promo flow: Start → (setup) → Editor, or Start → (setup) → AI → Editor.
 *
 * The editor (PromoSection) is rendered unchanged as the final step — this
 * wrapper only decides WHEN to show it. Between the two sits a single setup
 * dialog asking when the campaign runs and how the copy gets written; picking
 * "write myself" goes straight to the editor, so there's no second editor to
 * pass through.
 *
 * Paths that already have copy — continuing a live card or a saved draft — skip
 * the dialog entirely and open the editor.
 */

import { useEffect, useState } from 'react';
import { CampaignConfig, PromoCard, defaultConfig } from '@/types/campaign';
import { PromoSection } from '@/components/PromoSection';
import { PromoStartStep, PromoStartChoice } from '@/components/PromoStartStep';
import { PromoAiStep } from '@/components/PromoAiStep';
import { PromoSetupDialog, BuildMethod } from '@/components/PromoSetupDialog';
import { GuidedTour, shouldShowTour } from '@/components/tour/GuidedTour';
import { PROMO_DRAFT_TOUR } from '@/components/tour/tours';
import { sampleTemplates } from '@/components/SamplePromoTemplates';
import { PromoMiniPreview } from '@/components/PromoMiniPreview';
import { applyTemplateFull } from '@/lib/promoTemplate';
import { listVersions, PromoVersion } from '@/lib/promoVersions';
import { getISODateWithOffset } from '@/lib/utils';
import { X } from 'lucide-react';

type Step = 'start' | 'ai' | 'editor';

type PromoSectionProps = React.ComponentProps<typeof PromoSection>;

interface PromoFlowProps extends PromoSectionProps {
  /** Reports the active step so the page can hide Publish outside the editor. */
  onStepChange?: (step: Step) => void;
  /** Called when AI content is applied, so the page can save it to the draft. */
  onAiApplied?: () => void;
  /**
   * Where to land. The Dashboard's View/Edit are direct actions on an existing
   * campaign, so they open the editor; the Promo Card tab starts at the picker.
   */
  initialStep?: Step;
}

export function PromoFlow({
  onStepChange,
  onAiApplied,
  initialStep,
  ...editorProps
}: PromoFlowProps) {
  const { config, setConfig, markChanged, toast } = editorProps;

  const [step, setStep] = useState<Step>(initialStep ?? 'start');
  const [versions, setVersions] = useState<PromoVersion[]>([]);
  const [showPublished, setShowPublished] = useState(false);
  /** Open once a starting point is chosen that still needs copy written. */
  const [showSetup, setShowSetup] = useState(false);
  /** Set when AI was chosen upfront — the dialog then only asks the schedule. */
  const [forcedMethod, setForcedMethod] = useState<BuildMethod | undefined>(undefined);
  /**
   * The card chosen in the picker, held here until the setup dialog is
   * confirmed. Writing it straight into `config` made a template you merely
   * clicked look like work in progress, and left its dates behind so the next
   * attempt skipped the schedule question.
   */
  const [pendingCard, setPendingCard] = useState<PromoCard | null>(null);
  /** How the dialog should describe what's being built from. */
  const [pendingSource, setPendingSource] = useState('a blank card');
  /** Where the AI step's Back should return to — it's reachable from both. */
  const [aiBackTo, setAiBackTo] = useState<Step>('start');
  const [pendingStart, setPendingStart] = useState('');
  const [pendingEnd, setPendingEnd] = useState('');
  /**
   * First-run walkthrough. Held in state rather than read inline so that
   * marking it seen (inside the tour) doesn't make it vanish mid-step, and so
   * the localStorage read never runs during SSR.
   */
  const [showTour, setShowTour] = useState(false);

  function goTo(next: Step) {
    setStep(next);
  }

  useEffect(() => {
    onStepChange?.(step);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  /**
   * The walkthrough explains the editor's draft model, so it waits for the
   * editor — firing it on the picker would teach saving before there's
   * anything to save.
   */
  useEffect(() => {
    if (step === 'editor' && shouldShowTour(PROMO_DRAFT_TOUR)) setShowTour(true);
  }, [step]);

  // Leaving the promo tab entirely shouldn't leave Publish hidden.
  useEffect(() => {
    return () => onStepChange?.('editor');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (step !== 'start') return;
    let alive = true;
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

  /**
   * A starting point that still needs copy. Nothing is applied yet — the card
   * waits here until the dialog is confirmed, so closing it changes nothing.
   * The schedule starts fresh each time (today, no end date) so every attempt
   * asks how long it should run.
   */
  function startWithSetup(card: PromoCard, source: string, method?: BuildMethod) {
    setPendingCard(card);
    setPendingSource(source);
    setPendingStart(getISODateWithOffset(0));
    setPendingEnd('');
    setForcedMethod(method);
    setShowSetup(true);
  }

  function cancelSetup() {
    setShowSetup(false);
    setPendingCard(null);
  }

  /** Commit the pending card and its schedule, then head to the right step. */
  function handleBuildMethod(method: BuildMethod) {
    const card = pendingCard ?? config.promoCard;
    setConfig((prev) => ({
      ...prev,
      promoCard: { ...card, startDate: pendingStart, endDate: pendingEnd },
    }));
    markChanged();
    setShowSetup(false);
    setPendingCard(null);
    if (method === 'ai') setAiBackTo('start');
    goTo(method === 'ai' ? 'ai' : 'editor');
  }

  function pickTemplate(template: PromoCard, name: string) {
    startWithSetup(applyTemplateFull(config.promoCard, template), 'the selected template');
    toast(`Selected: ${name}`);
  }

  function handleChoose(choice: PromoStartChoice) {
    // AI picks the design itself, so it starts from whatever's on the card.
    if (choice === 'ai') {
      startWithSetup(config.promoCard, 'your card', 'ai');
      return;
    }
    if (choice === 'published') {
      setShowPublished(true);
      return;
    }
    // Start fresh — a blank card that still needs copy.
    startWithSetup(
      {
        ...(JSON.parse(JSON.stringify(defaultConfig.promoCard)) as PromoCard),
        active: config.promoCard.active,
        stoppedByUser: config.promoCard.stoppedByUser,
      },
      'a blank card',
    );
  }

  if (step === 'editor') {
    return (
      <>
        <PromoSection
          {...editorProps}
          onUseAi={() => {
            setAiBackTo('editor');
            goTo('ai');
          }}
        />
        <GuidedTour
          tour={PROMO_DRAFT_TOUR}
          enabled={showTour}
          onFinish={() => setShowTour(false)}
        />
      </>
    );
  }

  return (
    <div className="pb-10">
      {step === 'start' && (
        <PromoStartStep
          publishedCount={versions.length}
          templates={
            sampleTemplates as unknown as { id: string; name: string; promoCard: PromoCard }[]
          }
          onPickTemplate={pickTemplate}
          onChoose={handleChoose}
          onSkipToEditor={() => goTo('editor')}
        />
      )}

      {step === 'ai' && (
        <PromoAiStep
          config={config}
          setConfig={setConfig}
          markChanged={markChanged}
          toast={toast}
          onApplied={onAiApplied}
          onBack={() => goTo(aiBackTo)}
          backLabel={aiBackTo === 'editor' ? 'Back to editor' : 'Back'}
          onOpenEditor={() => goTo('editor')}
        />
      )}

      {showSetup && (
        <PromoSetupDialog
          sourceLabel={pendingSource}
          forcedMethod={forcedMethod}
          startDate={pendingStart}
          endDate={pendingEnd}
          onChangeStart={setPendingStart}
          onChangeEnd={setPendingEnd}
          onChoose={handleBuildMethod}
          onClose={cancelSetup}
        />
      )}

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
                [...versions].reverse().map((v) => {
                  const choose = () => {
                    setShowPublished(false);
                    startWithSetup(
                      {
                        ...(JSON.parse(JSON.stringify(v.promoCard)) as PromoCard),
                        active: config.promoCard.active,
                        stoppedByUser: config.promoCard.stoppedByUser,
                      },
                      'your past campaign',
                    );
                    toast(`Selected: ${v.label}`);
                  };
                  return (
                    // Not a <button>: PromoMiniPreview renders the card's own
                    // CTA button, and nesting buttons is invalid HTML (React
                    // throws a hydration error).
                    <div
                      key={v.id}
                      role="button"
                      tabIndex={0}
                      onClick={choose}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          choose();
                        }
                      }}
                      className="cursor-pointer rounded-xl border border-gray-200 bg-white p-3 text-left shadow-sm transition-colors hover:border-primary hover:shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 dark:border-gray-700 dark:bg-gray-900"
                    >
                      <p className="mb-2 truncate text-xs font-semibold text-gray-800 dark:text-gray-200">
                        {v.label}
                      </p>
                      <PromoMiniPreview promoCard={v.promoCard} />
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
