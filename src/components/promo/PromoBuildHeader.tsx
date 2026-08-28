'use client';

import type { Dispatch, SetStateAction } from 'react';
import { ArrowLeft, Maximize2, Minimize2, Sparkles, X } from 'lucide-react';
import type { AiMode, PromoBrief } from '@/lib/promo/promoAiPrompt';
import type { BuildStage } from '@/lib/promo/promoBrief';

interface PromoBuildHeaderProps {
  stage: BuildStage;
  setStage: (stage: BuildStage) => void;
  aiStep: 'what' | 'brief';
  setAiStep: (step: 'what' | 'brief') => void;
  /** False on the first screen, where there is nothing behind to go back to. */
  canGoBack: boolean;
  cardHasCopy: boolean;
  mode: AiMode;
  brief: PromoBrief;
  expanded: boolean;
  setExpanded: Dispatch<SetStateAction<boolean>>;
  onClose: () => void;
}

/**
 * The panel's title bar: where you are, the way back, and the two ways out.
 */
export function PromoBuildHeader({
  stage,
  setStage,
  aiStep,
  setAiStep,
  canGoBack,
  cardHasCopy,
  mode,
  brief,
  expanded,
  setExpanded,
  onClose,
}: PromoBuildHeaderProps) {
  return (
    <div className="flex h-12 shrink-0 items-center gap-2 border-b border-border px-4">
      {stage === 'ai' && canGoBack ? (
        <button
          type="button"
          onClick={() =>
            aiStep === 'brief' ? setAiStep('what') : setStage('mode')
          }
          aria-label="Back"
          className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-on-surface-variant transition-colors hover:bg-primary/10 hover:text-primary"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
      ) : (
        stage === 'ai' && <Sparkles className="h-4 w-4 shrink-0 text-primary" />
      )}
      <p className="min-w-0 flex-1 truncate text-sm font-semibold text-on-surface">
        {stage === 'mode'
          ? 'How do you want to build it?'
          : aiStep === 'what'
            ? cardHasCopy
              ? 'What should AI change?'
              : 'What should AI create?'
            : 'Describe your campaign'}
      </p>
      {/* Two-dot stepper: enough to show there's a second step, without a
          "1 of 2" label competing with the title. */}
      {stage === 'ai' && (
        <span className="flex shrink-0 items-center gap-1" aria-hidden>
          <span
            className={`h-1 rounded-full transition-all ${
              aiStep === 'what' ? 'w-3 bg-primary' : 'w-1 bg-border'
            }`}
          />
          <span
            className={`h-1 rounded-full transition-all ${
              aiStep === 'brief' ? 'w-3 bg-primary' : 'w-1 bg-border'
            }`}
          />
        </span>
      )}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-label={expanded ? 'Shrink panel' : 'Expand panel'}
        title={expanded ? 'Shrink' : 'Expand'}
        className="inline-flex h-7 w-7 items-center justify-center rounded-md text-on-surface-variant transition-colors hover:bg-primary/10 hover:text-primary"
      >
        {expanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
      </button>
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="inline-flex h-7 w-7 items-center justify-center rounded-md text-on-surface-variant transition-colors hover:bg-primary/10 hover:text-primary"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
