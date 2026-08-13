'use client';

/**
 * The AI screen — only reached by choosing "Generate with AI".
 *
 * No heading or method toggle: the choice was already made in the setup
 * dialog, so this is just the three steps. The editor stays locked until the
 * AI's reply has actually been applied — there's nothing to refine before then.
 */

import { useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, ClipboardPaste, Copy, Sparkles, X } from 'lucide-react';
import { CampaignConfig, PromoCard } from '@/types/campaign';
import { PromoMiniPreview } from '@/components/PromoMiniPreview';
import { sampleTemplates } from '@/components/SamplePromoTemplates';
import { applyTemplateLook } from '@/lib/promoTemplate';
import { parseAiPromo, applyAiPromo } from '@/lib/promoImport';
import {
  buildGuidedPromoPrompt,
  stripStyleFields,
  stripContentFields,
  type AiMode,
} from '@/lib/promoAiPrompt';
import { getBackgroundStyle } from '@/lib/utils';

/** Does the card already carry the user's own copy? */
function hasCopy(card: PromoCard): boolean {
  const plain = (h?: string) => String(h ?? '').replace(/<[^>]*>/g, '').trim();
  return Boolean(plain(card.title) || plain(card.subtitle) || plain(card.description));
}

const MODES: { value: AiMode; label: string; hint: string }[] = [
  {
    value: 'design',
    label: 'Keep my content',
    hint: 'Your words stay exactly as written — AI only changes the colours.',
  },
  {
    value: 'copy',
    label: 'Keep the design',
    hint: 'AI writes the content into the design you picked.',
  },
  {
    value: 'both',
    label: 'Content and colours',
    hint: 'AI writes the content and proposes its own palette.',
  },
];

interface PromoAiStepProps {
  config: CampaignConfig;
  setConfig: (config: CampaignConfig | ((prev: CampaignConfig) => CampaignConfig)) => void;
  markChanged: () => void;
  toast: (message: string, isError?: boolean) => void;
  onBack: () => void;
  onOpenEditor: () => void;
  /** Fires once AI content lands, so it can be saved before the user leaves. */
  onApplied?: () => void;
  /**
   * What Back returns to. Arriving from the editor, it must be obvious you can
   * leave without pasting anything — otherwise the step reads as a one-way door.
   */
  backLabel?: string;
}

export function PromoAiStep({
  config,
  setConfig,
  markChanged,
  toast,
  onBack,
  onOpenEditor,
  onApplied,
  backLabel = 'Back',
}: PromoAiStepProps) {
  const pc = config.promoCard;
  const [brief, setBrief] = useState('');
  const [promptCopied, setPromptCopied] = useState(false);
  const [showPaste, setShowPaste] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [pasteError, setPasteError] = useState('');
  /** The editor only opens once AI copy has actually landed on the card. */
  const [applied, setApplied] = useState(false);
  /** What AI is being asked for. Defaults to restyling when the card already
   *  has copy — arriving from the editor, the words are the user's own. */
  const cardHasCopy = hasCopy(pc);
  const [mode, setMode] = useState<AiMode>(() => (cardHasCopy ? 'design' : 'copy'));

  const activeTemplateId = useMemo(() => {
    const cur = JSON.stringify(pc.style);
    return sampleTemplates.find((t) => JSON.stringify(t.promoCard.style) === cur)?.id ?? null;
  }, [pc.style]);

  function copyPrompt() {
    if (!brief.trim()) {
      toast('Describe your campaign first, then copy the prompt.', true);
      return;
    }
    const prompt = `${buildGuidedPromoPrompt({
      card: pc,
      templateName: sampleTemplates.find((t) => t.id === activeTemplateId)?.name,
      mode,
    })}\n\nThe campaign is about: ${brief.trim()}`;
    navigator.clipboard
      ?.writeText(prompt)
      .then(() => {
        setPromptCopied(true);
        toast('Prompt copied — paste it into any AI tool you like.');
      })
      .catch(() => toast("Couldn't copy the prompt — please try again.", true));
  }

  function applyPaste() {
    const result = parseAiPromo(pasteText);
    if (!result.ok) {
      setPasteError(result.error);
      return;
    }
    // Enforce the choice in code — the prompt asks, but a model can ignore it.
    const data =
      mode === 'copy'
        ? stripStyleFields(result.data)
        : mode === 'design'
          ? stripContentFields(result.data)
          : result.data;
    setConfig((prev) => ({ ...prev, promoCard: applyAiPromo(prev.promoCard, data) }));
    markChanged();
    setApplied(true);
    onApplied?.();
    setShowPaste(false);
    setPasteText('');
    setPasteError('');
    toast('Content applied from AI.');
  }

  const stepBubble = (n: number, on: boolean) => (
    <span
      className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-bold ${
        on ? 'bg-primary text-on-primary' : 'bg-border text-on-surface-variant'
      }`}
    >
      {n}
    </span>
  );

  return (
    <div className="flex h-[calc(100vh-7.5rem)] w-full flex-col overflow-hidden">
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-6 lg:grid-cols-[minmax(0,55fr)_minmax(472px,45fr)]">
        {/* Steps */}
        <div className="campaign-custom-scrollbar min-h-0 overflow-y-auto pr-2">
          <div className="rounded-xl border border-border bg-surface-subtle p-4">
            <div className="flex gap-3 border-b border-dashed border-border pb-4">
              {stepBubble(1, true)}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-on-surface">
                  {mode === 'design' ? 'Describe the look you want' : 'Describe your campaign'}
                </p>
                <p className="mb-2 text-xs text-on-surface-variant">
                  {mode === 'design'
                    ? 'The mood, a season, brand colours — AI restyles around your words.'
                    : 'The offer, the audience, the mood — AI writes the copy to match.'}
                </p>
                <textarea
                  value={brief}
                  onChange={(e) => setBrief(e.target.value)}
                  rows={3}
                  placeholder={
                    mode === 'design'
                      ? 'e.g. warm autumn tones, premium feel, easy on the eye'
                      : 'e.g. Monsoon clearance on rugs, up to 60% off, warm and friendly, ends Sunday.'
                  }
                  className="w-full resize-none rounded-lg border border-border bg-surface px-3 py-2 text-sm text-on-surface outline-none focus:border-primary"
                />
                <p className="mb-1.5 mt-3 text-[11px] font-bold uppercase tracking-wide text-on-surface-variant">
                  What should AI do?
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {MODES.filter((m) => m.value !== 'design' || cardHasCopy).map((m) => (
                    <button
                      key={m.value}
                      type="button"
                      onClick={() => setMode(m.value)}
                      className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-all ${
                        mode === m.value
                          ? 'border-primary bg-primary/10 text-primary ring-1 ring-primary/30'
                          : 'border-border text-on-surface-variant hover:border-primary/70 hover:text-primary'
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
                <p className="mt-1.5 text-[11px] text-on-surface-variant">
                  {MODES.find((m) => m.value === mode)?.hint}
                </p>

                <button
                  type="button"
                  onClick={copyPrompt}
                  className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-on-primary transition-opacity hover:opacity-95"
                >
                  <Copy className="h-3.5 w-3.5" /> Copy prompt for AI
                </button>
              </div>
            </div>

            <div className={`flex gap-3 border-b border-dashed border-border py-4 ${promptCopied ? '' : 'opacity-55'}`}>
              {stepBubble(2, promptCopied)}
              <div>
                <p className="text-sm font-semibold text-on-surface">Paste it into any AI tool</p>
                <p className="text-xs text-on-surface-variant">
                  ChatGPT, Claude, Gemini — whichever you use. Copy its reply.
                </p>
              </div>
            </div>

            <div className={`flex gap-3 pt-4 ${promptCopied ? '' : 'opacity-55'}`}>
              {stepBubble(3, applied)}
              <div>
                <p className="text-sm font-semibold text-on-surface">Paste the reply back</p>
                <p className="mb-2 text-xs text-on-surface-variant">
                  {mode === 'design'
                    ? 'The new colours apply — your words are untouched.'
                    : 'Your card fills in, and you can refine it in the editor.'}
                </p>
                <button
                  type="button"
                  onClick={() => setShowPaste(true)}
                  className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-on-surface-variant transition-colors hover:border-primary/70 hover:text-primary"
                >
                  <ClipboardPaste className="h-3.5 w-3.5" /> Paste result
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Preview, with the designs below it */}
        <div className="flex min-h-0 flex-col">
          <div className="campaign-custom-scrollbar flex min-h-0 flex-1 items-center justify-center overflow-auto rounded-xl border border-border bg-surface-subtle p-4">
            <div className="shrink-0" style={{ width: `${pc.cardWidth || 400}px` }}>
              <PromoMiniPreview promoCard={pc} faithful />
            </div>
          </div>

          <p className="mb-1.5 mt-3 shrink-0 text-[11px] font-bold uppercase tracking-wide text-on-surface-variant">
            Themes - Click any to change the look - Your text stays
          </p>
          <div className="flex shrink-0 flex-wrap gap-2">
            {sampleTemplates.map((t) => {
              const on = t.id === activeTemplateId;
              return (
                <button
                  key={t.id}
                  type="button"
                  title={t.name}
                  onClick={() => {
                    setConfig((prev) => ({
                      ...prev,
                      promoCard: applyTemplateLook(prev.promoCard, t.promoCard as PromoCard),
                    }));
                    markChanged();
                  }}
                  style={{
                    background: getBackgroundStyle((t.promoCard as PromoCard).style.background),
                  }}
                  className={`h-8 w-12 rounded-md ring-offset-2 ring-offset-surface transition-all hover:scale-105 ${
                    on ? 'ring-2 ring-primary' : 'ring-1 ring-border hover:ring-primary/60'
                  }`}
                />
              );
            })}
          </div>
        </div>
      </div>

      <div className="mt-3 flex shrink-0 items-center gap-2 border-t border-border pt-3">
        {/* Once the reply is applied both buttons would lead to the editor, so
            only the primary one remains — before that, this is the way out. */}
        {!applied && (
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-4 py-2 text-sm font-semibold text-on-surface-variant transition-colors hover:border-primary/70 hover:text-primary"
          >
            <ArrowLeft className="h-4 w-4" /> {backLabel}
          </button>
        )}
        {/* Nothing to refine until AI copy has landed, so this appears only then. */}
        {applied && (
          <button
            type="button"
            onClick={onOpenEditor}
            className="ml-auto inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-on-primary shadow-sm transition-opacity hover:opacity-95"
          >
            <Sparkles className="h-4 w-4" /> Enhance further in the editor
            <ArrowRight className="h-4 w-4" />
          </button>
        )}
      </div>

      {showPaste && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0" onClick={() => setShowPaste(false)} />
          <div className="relative z-10 w-full max-w-lg rounded-xl border border-white/10 bg-black/10 p-5 text-on-surface shadow-2xl backdrop-blur-md">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-base font-semibold">Paste from AI</h2>
                <p className="mt-1 text-sm text-on-surface-variant">
                  Paste the JSON your AI tool gave you.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowPaste(false)}
                aria-label="Close"
                className="inline-flex h-8 w-8 flex-none items-center justify-center rounded-md text-on-surface-variant transition-colors hover:bg-primary/10 hover:text-primary"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <textarea
              value={pasteText}
              onChange={(e) => {
                setPasteText(e.target.value);
                if (pasteError) setPasteError('');
              }}
              spellCheck={false}
              rows={7}
              placeholder='{"title": "Summer Sale", "buttonText": "Shop now", ...}'
              className="mt-4 w-full resize-y rounded-lg border border-white/10 bg-black/10 px-3 py-2 font-mono text-xs text-on-surface outline-none focus:border-primary"
            />
            {pasteError && <p className="mt-2 text-xs font-medium text-red-500">{pasteError}</p>}
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowPaste(false)}
                className="rounded-md border border-white/10 px-4 py-2 text-sm font-medium text-on-surface-variant transition-colors hover:border-primary/70 hover:text-primary"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={applyPaste}
                disabled={!pasteText.trim()}
                className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-on-primary shadow-sm transition-opacity hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Apply to my card
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
