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
import { GuidedTour, markTourSeen, shouldShowTour } from '@/components/tour/GuidedTour';
import { useSignalEffect } from '@/hooks/useSignalEffect';
import { PROMO_DRAFT_TOUR, PROMO_TIMER_TOUR } from '@/components/tour/tours';

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
   * The countdown hint. Unlike the first-run tour this recurs: it fires each
   * time a different card lands on the canvas, because that's when "where do I
   * edit the timer?" is actually being asked. It retires when the user edits
   * the timer — not when they dismiss it.
   */
  const [showTimerHint, setShowTimerHint] = useState(false);

  /**
   * Does the canvas hold a card the hint could point at?
   *
   * The hint says "the countdown is edited on the card itself". On a blank
   * canvas there is no card on screen, so it describes something the user
   * cannot see or act on.
   */
  const cardHasContent = () => {
    const c = config.promoCard;
    const written = (v?: string) => Boolean((v || '').replace(/<[^>]*>/g, '').trim());
    return (
      written(c.title) ||
      written(c.subtitle) ||
      written(c.description) ||
      written(c.buttonText)
    );
  };

  /**
   * One way in for the hint, because there are three ways to reach a new
   * card — a swap in the editor, the build signal, and mounting straight onto
   * the build step — and each used to decide for itself whether to show it.
   * Guarding only the first left the other two raising it over a blank canvas.
   */
  const revealTimerHint = () => {
    if (!cardHasContent()) {
      setShowTimerHint(false);
      return;
    }
    if (shouldShowTour(PROMO_TIMER_TOUR)) setShowTimerHint(true);
  };

  const handleCardReplaced = () => {
    revealTimerHint();
  };

  /**
   * Clearing the canvas while the hint is up has to take it down too — it is
   * anchored to a card that is no longer there, so it would sit pointing at
   * empty space.
   */
  useEffect(() => {
    if (showTimerHint && !cardHasContent()) setShowTimerHint(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.promoCard, showTimerHint]);

  const handleTimerEdited = () => {
    markTourSeen(PROMO_TIMER_TOUR);
    setShowTimerHint(false);
  };
  /**
   * Bumped to open the editor's Template Hub. A signal rather than a boolean:
   * the popup owns its own open/closed state, and this only ever asks it to
   * open, so re-asking after the user closes it has to be distinguishable.
   */
  const [openTemplatesSignal, setOpenTemplatesSignal] = useState(0);

  useSignalEffect(openBuildSignal, () => {
    setPanelStage('mode');
    // Reaching the build stage IS a new card — the page resets the canvas
    // before sending us here, so PromoSection's own "card replaced" callbacks
    // never fire for this route.
    handleCardReplaced();
  });

  // The walkthrough explains the editor's draft model, so it waits until the
  // editor is actually on screen.
  useEffect(() => {
    if (shouldShowTour(PROMO_DRAFT_TOUR)) setShowTour(true);
    // Arriving straight on the build stage (dashboard → Create new) is a new
    // card too, and the signal above can't cover it: it's set in the same
    // batch as the tab switch, so this component mounts with it already raised.
    if (initialStep === 'build') revealTimerHint();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <PromoSection
        {...editorProps}
        onUseAi={() => setPanelStage('ai')}
        onCardReplaced={handleCardReplaced}
        onTimerEdited={handleTimerEdited}
        // The countdown has just appeared, and it is the one field edited on
        // the card rather than on the left — exactly the moment the hint is
        // worth showing.
        onTimerAutoEnabled={revealTimerHint}
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
          onApplied={() => {
            onAiApplied?.();
            // AI filling the card counts as a new card landing.
            handleCardReplaced();
          }}
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

      {/* Dismissing this one means "not now", so it isn't retired on close —
          only editing the timer retires it. Held back while the first-run tour
          or the build panel is up, so two marks never compete. */}
      <GuidedTour
        tour={PROMO_TIMER_TOUR}
        enabled={showTimerHint && !panelStage && !showTour}
        persistDismissal={false}
        onFinish={() => setShowTimerHint(false)}
      />
    </>
  );
}
