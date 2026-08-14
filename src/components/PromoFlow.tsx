'use client';

/**
 * The promo tab: the editor, plus the AI panel that opens over it.
 *
 * There used to be a start screen (reuse / start fresh / template strip) and a
 * separate AI screen in front of the editor. Both are gone:
 *
 *  - The start screen duplicated what the editor already offers — templates
 *    live in Template Hub, past campaigns in My Published — so it cost two
 *    clicks to reach the tool and showed nothing new.
 *  - The AI screen made "use AI" a place you navigate to. It's now a panel
 *    over the editor, so the card stays visible while AI fills it in.
 *
 * Whatever route you arrive by, the editor opens on the last edited state.
 */

import { useEffect, useState } from 'react';
import { PromoSection } from '@/components/PromoSection';
import { PromoBuildPanel, type BuildStage } from '@/components/PromoBuildPanel';
import { GuidedTour, shouldShowTour } from '@/components/tour/GuidedTour';
import { useSignalEffect } from '@/hooks/useSignalEffect';
import { PROMO_DRAFT_TOUR } from '@/components/tour/tours';

type PromoSectionProps = React.ComponentProps<typeof PromoSection>;

interface PromoFlowProps extends PromoSectionProps {
  /** Called when AI content is applied, so the page can react. */
  onAiApplied?: () => void;
  /**
   * 'ai' opens with the AI panel already up — used when the setup dialog's
   * "Generate with AI" sent the user straight here.
   */
  initialStep?: 'editor' | 'ai' | 'build';
  /**
   * Increment to open the build panel on an ALREADY-MOUNTED flow.
   *
   * `initialStep` is read once at mount, so it can't reopen the panel for
   * someone already sitting in the editor — which is every "Create new" from
   * the promo tab. A counter can.
   */
  openBuildSignal?: number;
}

export function PromoFlow({
  onAiApplied,
  initialStep,
  openBuildSignal,
  ...editorProps
}: PromoFlowProps) {
  const { config, setConfig, markChanged, toast } = editorProps;

  /** Which stage the panel opens at, or null when it's closed. */
  const [panelStage, setPanelStage] = useState<BuildStage | null>(
    initialStep === 'ai' ? 'ai' : initialStep === 'build' ? 'mode' : null,
  );
  const [showTour, setShowTour] = useState(false);
  /**
   * Bumped to open the editor's Template Hub. A signal rather than a boolean:
   * the popup owns its own open/closed state, and this only ever asks it to
   * open, so re-asking after the user closes it has to be distinguishable.
   */
  const [openTemplatesSignal, setOpenTemplatesSignal] = useState(0);

  useSignalEffect(openBuildSignal, () => setPanelStage('mode'));

  // The walkthrough explains the editor's draft model, so it waits until the
  // editor is actually on screen.
  useEffect(() => {
    if (shouldShowTour(PROMO_DRAFT_TOUR)) setShowTour(true);
  }, []);

  return (
    <>
      <PromoSection
        {...editorProps}
        onUseAi={() => setPanelStage('ai')}
        openTemplatesSignal={openTemplatesSignal}
        // Back out of the templates popup returns to the question that sent
        // the user there, rather than dumping them on the editor.
        onTemplatesBack={() => setPanelStage('mode')}
      />

      {panelStage && (
        <PromoBuildPanel
          config={config}
          setConfig={setConfig}
          markChanged={markChanged}
          toast={toast}
          onApplied={onAiApplied}
          initialStage={panelStage}
          onClose={() => setPanelStage(null)}
          onChooseManual={() => {
            setPanelStage(null);
            setOpenTemplatesSignal((n) => n + 1);
          }}
        />
      )}

      {/* Held back while the AI panel is up — two overlays competing for the
          same corner is noise, and the tour points at controls the panel
          covers. */}
      <GuidedTour
        tour={PROMO_DRAFT_TOUR}
        enabled={showTour && !panelStage}
        onFinish={() => setShowTour(false)}
      />
    </>
  );
}
