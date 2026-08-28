'use client';

import type { Dispatch, SetStateAction } from 'react';
import {
  ArrowRight,
  Check,
  ClipboardPaste,
  Copy,
} from 'lucide-react';
import type { PromoBrief } from '@/lib/promo/promoAiPrompt';
import {
  MODES,
  chipIsOn,
  toggleChip,
  type BriefQuestion,
} from '@/lib/promo/promoBrief';

interface PromoBriefStepProps {
  brief: PromoBrief;
  setAnswer: (key: keyof PromoBrief, value: string) => void;
  /** The questions for the chosen mode, and where we are in them. */
  /** Every question for this mode, and the one being asked. */
  questions: BriefQuestion[];
  question: BriefQuestion;
  questionIndex: number;
  setQuestionIndex: Dispatch<SetStateAction<number>>;
  /** The questions already answered, with their position, newest last. */
  answeredSoFar: { q: BriefQuestion; index: number }[];
  briefDone: boolean;
  /** The mode being briefed — what AI is allowed to touch. */
  activeMode: (typeof MODES)[number] | undefined;
  setAiStep: (step: 'what' | 'brief') => void;
  copyPrompt: () => void;
  promptCopied: boolean;
  setShowPaste: (show: boolean) => void;
  applied: boolean;
  expanded: boolean;
  onClose: () => void;
  toast: (
    message: string,
    isError?: boolean,
    action?: { label: string; onClick: () => void },
  ) => void;
}

/**
 * The brief: one question at a time, with chips for the common answers.
 *
 * One at a time rather than a form, because a brief that looks like paperwork
 * gets skipped — and a skipped brief is what produces the generic copy the
 * whole panel exists to avoid.
 */
export function PromoBriefStep({
  brief,
  setAnswer,
  questions,
  question,
  questionIndex,
  setQuestionIndex,
  answeredSoFar,
  briefDone,
  activeMode,
  setAiStep,
  copyPrompt,
  promptCopied,
  setShowPaste,
  applied,
  expanded,
  onClose,
  toast,
}: PromoBriefStepProps) {
    const renderQuestion = (q: BriefQuestion) => (
      <div key={q.key} className="min-w-0">
        <p className="text-sm font-semibold text-on-surface">{q.title}</p>
        <p className="mt-0.5 text-xs leading-snug text-on-surface-variant">{q.help}</p>
        {q.chips && (
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {q.chips.map((chip) => {
              const on = chipIsOn(brief[q.key], chip, q);
              return (
                <button
                  key={chip}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setAnswer(q.key, toggleChip(brief[q.key], chip, q))}
                  className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-all ${
                    on
                      ? 'border-primary bg-primary text-on-primary'
                      : 'border-border text-on-surface-variant hover:border-primary/70 hover:text-primary'
                  }`}
                >
                  {chip}
                </button>
              );
            })}
          </div>
        )}
        <textarea
          value={brief[q.key] ?? ''}
          onChange={(e) => setAnswer(q.key, e.target.value)}
          rows={2}
          placeholder={q.placeholder}
          className="mt-1.5 w-full resize-y rounded-lg border border-border bg-surface px-3 py-2 text-sm text-on-surface outline-none placeholder:text-on-surface-variant/70 focus:border-primary"
        />
      </div>
    );

    const stepBubble = (n: number, on: boolean) => (
      <span
        className={`grid h-5 w-5 shrink-0 place-items-center rounded-full text-[10px] font-bold transition-colors ${
          on ? 'bg-primary text-on-primary' : 'bg-border text-on-surface-variant'
        }`}
      >
        {n}
      </span>
    );

  return (
    <div className="flex flex-col gap-3">
      {/* What was chosen in step 1, and the way back to change it. */}
      <div className="flex items-center justify-between gap-2 rounded-lg border border-border bg-surface px-2.5 py-1.5">
        <span className="inline-flex min-w-0 items-center gap-1.5 text-[11px] font-semibold text-on-surface">
          {activeMode && <activeMode.icon className="h-3.5 w-3.5 shrink-0 text-primary" />}
          <span className="truncate">{activeMode?.label}</span>
        </span>
        <button
          type="button"
          onClick={() => setAiStep('what')}
          className="shrink-0 text-[11px] font-semibold text-on-surface-variant transition-colors hover:text-primary"
        >
          Change
        </button>
      </div>

      {/* Numbered steps: this is a hand-off to another tool and back, and the
          numbers are what make that shape obvious. Each step lights up as it
          becomes reachable, so the panel also reports where you are. */}
      <ol className="flex flex-col gap-3">
        <li className="flex gap-2.5">
          {stepBubble(1, briefDone)}
          <div className="min-w-0 flex-1">
            {/* One question at a time, at every size. Showing all six at once
                turned a guided flow into a form to fill in — the whole point
                of asking is that you're led through it. */}
            {renderQuestion(question)}
            <div className="mt-3 flex items-center gap-2">
              {questionIndex > 0 && (
                <button
                  type="button"
                  onClick={() => setQuestionIndex((i) => i - 1)}
                  className="rounded-lg px-2 py-1.5 text-xs font-medium text-on-surface-variant transition-colors hover:text-primary"
                >
                  Back
                </button>
              )}
              {!briefDone ? (
                <button
                  type="button"
                  onClick={() => {
                    if (!question.optional && !(brief[question.key] ?? '').trim()) {
                      toast('Answer this one first — it goes into the prompt.', true);
                      return;
                    }
                    setQuestionIndex((i) => i + 1);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-on-primary transition-opacity hover:opacity-95"
                >
                  Next <ArrowRight className="h-3.5 w-3.5" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={copyPrompt}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-on-primary transition-opacity hover:opacity-95"
                >
                  <Copy className="h-3.5 w-3.5" /> Copy prompt
                </button>
              )}
              <span className="ml-auto text-[10px] font-medium tabular-nums text-on-surface-variant">
                {Math.min(questionIndex + 1, questions.length)} of {questions.length}
              </span>
            </div>

            {/* What AI will be told, so far. Click a line to go back and fix it. */}
            {expanded && answeredSoFar.length > 0 && (
              <dl className="mt-3 space-y-1 border-t border-dashed border-border pt-2">
                {answeredSoFar.map(({ q, index: qi }) => (
                  <div key={q.key} className="flex gap-2 text-[11px] leading-snug">
                    <dt className="w-24 shrink-0 font-semibold text-on-surface-variant">
                      {q.key === 'extra' ? 'Notes' : q.key}
                    </dt>
                    <dd className="min-w-0 flex-1 truncate text-on-surface">
                      {brief[q.key]}
                    </dd>
                    <button
                      type="button"
                      onClick={() => setQuestionIndex(qi)}
                      className="shrink-0 font-semibold text-on-surface-variant transition-colors hover:text-primary"
                    >
                      Edit
                    </button>
                  </div>
                ))}
              </dl>
            )}
          </div>
        </li>

        <li className={`flex gap-2.5 ${promptCopied ? '' : 'opacity-55'}`}>
          {stepBubble(2, promptCopied)}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-on-surface">Paste it into your AI tool</p>
            <p className="text-xs text-on-surface-variant">
              ChatGPT, Claude or Gemini — then copy its reply.
            </p>
          </div>
        </li>

        <li className={`flex gap-2.5 ${promptCopied ? '' : 'opacity-55'}`}>
          {stepBubble(3, applied)}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-on-surface">Bring the reply back</p>
            <button
              type="button"
              onClick={() => setShowPaste(true)}
              className="mt-1.5 inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-on-surface-variant transition-colors hover:border-primary/70 hover:text-primary"
            >
              <ClipboardPaste className="h-3.5 w-3.5" /> Paste reply
            </button>
            {applied && (
              <div className="mt-2 flex flex-col items-start gap-2">
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                  <Check className="h-3.5 w-3.5" /> Applied to your card
                </span>
                {/* The step ended but the task didn't: closing the panel is
                    what returns you to the card to refine it, and nothing was
                    saying so. */}
                <button
                  type="button"
                  onClick={onClose}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-on-primary transition-opacity hover:opacity-95"
                >
                  Continue in the editor <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>
        </li>
      </ol>
    </div>
  );
}
