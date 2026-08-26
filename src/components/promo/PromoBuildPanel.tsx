'use client';

/**
 * The build panel — how a promo card gets started, over the editor.
 *
 * Two stages:
 *   'mode' → Write myself or Generate with AI (new card, after the dashboard
 *            has asked for the schedule)
 *   'ai'   → write a brief, take the prompt away, bring the reply back
 *
 * "Write myself" hands off to the editor's own Template Hub rather than
 * showing a second, smaller template grid here.
 *
 * The brief screen is a numbered stepper because the flow genuinely leaves the
 * app and comes back: write a brief → copy the prompt → paste it into ChatGPT,
 * Claude or Gemini → bring the reply back. Numbers make that hand-off legible
 * in a way a flat form doesn't, and steps 2 and 3 stay dimmed until the prompt
 * has been copied, so the panel also shows where you are. Explanations stay to
 * one line each — the earlier version's paragraphs are what made it scroll.
 *
 * Mini tucks into the canvas corner and leaves the editor's own preview
 * visible beside it. Expanded covers the canvas outright — the card behind is
 * hidden rather than dimmed — and carries its own copy of the card in a
 * right-hand column so it stays in view while AI fills it in.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ClipboardPaste,
  Copy,
  Maximize2,
  Minimize2,
  Palette,
  PenLine,
  Sparkles,
  Type,
  Wand2,
  X,
} from 'lucide-react';
import { CampaignConfig, PromoCard } from '@/types/campaign';
import type { PromoBrief } from '@/lib/promoAiPrompt';
import { sampleTemplates } from '@/components/promo/SamplePromoTemplates';
import { PromoMiniPreview } from '@/components/shared/PromoMiniPreview';
import { parseAiPromo, applyAiPromo } from '@/lib/promoImport';
import {
  buildGuidedPromoPrompt,
  stripStyleFields,
  stripContentFields,
  type AiMode,
} from '@/lib/promoAiPrompt';

/** Does the card already carry the user's own copy? */
function hasCopy(card: PromoCard): boolean {
  const plain = (h?: string) => String(h ?? '').replace(/<[^>]*>/g, '').trim();
  return Boolean(plain(card.title) || plain(card.subtitle) || plain(card.description));
}

/**
 * The first thing asked, not a setting buried under the brief: deciding what
 * AI may touch is the reason someone opens this panel, and it changes what the
 * brief should even say.
 */
const MODES: {
  value: AiMode;
  label: string;
  /**
   * Two hints per mode: one for a card that already has the user's content and
   * a chosen design, one for a brand-new card that has neither. "Keeps the
   * design you picked" is a lie on a first card — nothing has been picked yet.
   */
  hint: string;
  newCardHint: string;
  icon: typeof Palette;
}[] = [
  {
    value: 'design',
    label: 'Colors only',
    hint: 'Your content stays exactly as written.',
    newCardHint: 'Sets a palette now; you write the content yourself.',
    icon: Palette,
  },
  {
    // Not "Copy only": this panel has a "Copy prompt" button, and the two
    // readings collide. "Content" is also what the editor calls this column.
    value: 'copy',
    label: 'Content only',
    hint: 'Keeps the design you picked.',
    newCardHint: "Keeps the card's current look.",
    icon: Type,
  },
  {
    value: 'both',
    label: 'Content and colors',
    hint: 'AI writes the content and proposes a palette.',
    newCardHint: 'AI writes the content and proposes a palette.',
    icon: Wand2,
  },
];

/**
 * One question per step. `chips` are one-tap answers that fill the field —
 * most campaigns can be briefed without typing a word, and the field stays
 * editable for anything the chips don't cover.
 */
interface BriefQuestion {
  key: keyof PromoBrief;
  title: string;
  /** What a good answer contains — a vague question produces a vague brief. */
  help: string;
  placeholder: string;
  chips?: string[];
  /**
   * 'multi' lets the answers stack — "Bold, Premium, Urgent" describes a voice
   * far better than any single word, and a brief that says all three gets copy
   * that reads that way. 'single' is for questions with one true answer (is
   * there a countdown, where does the button go), where a second pick replaces
   * the first rather than contradicting it.
   */
  chipMode?: 'single' | 'multi';
  /**
   * Multi-select chips that mean "and nothing else" — picking one clears the
   * rest, and picking another chip clears it. "You choose" alongside "Warm
   * tones" is an instruction that argues with itself.
   */
  exclusiveChips?: string[];
  optional?: boolean;
}

const CONTENT_QUESTIONS: BriefQuestion[] = [
  {
    key: 'offer',
    title: 'What’s the offer, and what’s it on?',
    help: 'The product or collection, plus the deal — a discount, a bundle, free delivery, a code. Tap what applies, then add your own detail.',
    placeholder: '20% off all handwoven rugs, plus free UK delivery. Code RUGS20.',
    chipMode: 'multi',
    chips: [
      'Percentage off',
      'Buy one get one',
      'Free delivery',
      'Clearance',
      'New arrivals',
      'Members only',
      'Discount code',
    ],
  },
  {
    key: 'tone',
    title: 'Who are you selling to, and how should it read?',
    help: 'Your shoppers, and the voice. Pick as many words as fit — “Bold, Premium, Urgent” shapes the copy more than any one of them alone.',
    placeholder: 'Returning customers who bought last winter. Warm, confident, not pushy.',
    chipMode: 'multi',
    // Eight, not ten: a tenth chip wrapped to another row and pushed the step
    // past the panel's height, and this panel never scrolls. 'Warm' and
    // 'Confident' went — the nearest neighbours of 'Friendly' and 'Bold'.
    chips: [
      'Bold',
      'Elegant',
      'Playful',
      'Urgent',
      'Friendly',
      'Premium',
      'Minimal',
      'No hard sell',
    ],
  },
  {
    key: 'timer',
    title: 'Should the card show a countdown?',
    help: 'Your dates are already set — this is only the wording that sits around the timer.',
    placeholder: 'Yes, with “Offer ends in”',
    chips: [
      'Yes — “Ends in”',
      'Yes — “Hurry, ends in”',
      'Yes — “Only … left”',
      'No countdown',
    ],
  },
  {
    key: 'cta',
    title: 'Where should the button send people?',
    help: 'A shop link, a WhatsApp number, or plain text with no link. It can be left off.',
    placeholder: 'My sale page: example.com/sale',
    chips: ['Link to my shop', 'WhatsApp me', 'Text only, no link', 'No button'],
  },
];

const COLOR_QUESTION: BriefQuestion = {
  key: 'colors',
  title: 'Which colors should it use?',
  help: 'Brand colors (hex codes help), a season or a mood — or hand the palette to AI. Stack as many as you like.',
  placeholder: 'Brand green #0f766e with warm cream, dark text',
  chipMode: 'multi',
  exclusiveChips: ['You choose', 'Match my template'],
  chips: [
    'You choose',
    'Match my template',
    'Warm tones',
    'Cool tones',
    'High contrast',
    'Dark background',
    'Light background',
    'Gradient',
    'Festive',
  ],
};

const EXTRA_QUESTION: BriefQuestion = {
  key: 'extra',
  title: 'Anything it must say — or must avoid?',
  help: 'Optional. Claims you can’t make, words to steer clear of, a phrase you want included.',
  placeholder: 'Don’t say “cheap”. Do mention free 30-day returns.',
  optional: true,
  chipMode: 'multi',
  chips: [
    'Mention free returns',
    'Avoid the word “cheap”',
    'No pushy language',
    'Keep it very short',
    'Include the code',
    'Mention limited stock',
  ],
};

/** Answers are stored as one readable phrase — chips are just a fast way to build it. */
function answerParts(answer: string | undefined): string[] {
  return (answer ?? '')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
}

function sameChip(a: string, b: string): boolean {
  return a.toLowerCase() === b.toLowerCase();
}

function chipIsOn(answer: string | undefined, chip: string, q: BriefQuestion): boolean {
  if ((q.chipMode ?? 'single') === 'single') return (answer ?? '').trim() === chip;
  return answerParts(answer).some((part) => sameChip(part, chip));
}

/**
 * What the answer becomes when a chip is tapped.
 *
 * Chips used to overwrite the whole answer, so a second tap threw the first one
 * away — you could say "Bold" or "Premium" but never both, and anything typed
 * was wiped by the next tap. Multi questions now add and remove instead, and
 * keep whatever was typed alongside them.
 */
function toggleChip(answer: string | undefined, chip: string, q: BriefQuestion): string {
  const on = chipIsOn(answer, chip, q);
  if ((q.chipMode ?? 'single') === 'single') return on ? '' : chip;
  if (q.exclusiveChips?.some((x) => sameChip(x, chip))) {
    // "You choose" means exactly that — it replaces the rest.
    return on ? '' : chip;
  }
  const kept = answerParts(answer).filter(
    (part) => !q.exclusiveChips?.some((x) => sameChip(x, part)),
  );
  const next = on
    ? kept.filter((part) => !sameChip(part, chip))
    : [...kept, chip];
  return next.join(', ');
}

export type BuildStage = 'mode' | 'ai';

interface PromoBuildPanelProps {
  config: CampaignConfig;
  setConfig: (config: CampaignConfig | ((prev: CampaignConfig) => CampaignConfig)) => void;
  markChanged: () => void;
  toast: (
    message: string,
    isError?: boolean,
    action?: { label: string; onClick: () => void },
  ) => void;
  /** Fires once AI content lands, so the page can react to it. */
  onApplied?: () => void;
  onClose: () => void;
  /** "Write it myself" — closes the panel and opens Template Hub. */
  onChooseManual: () => void;
  /** 'mode' for a new card; 'ai' when opened by "Improve with AI". */
  initialStage?: BuildStage;
}

export function PromoBuildPanel({
  config,
  setConfig,
  markChanged,
  toast,
  onApplied,
  onClose,
  onChooseManual,
  initialStage = 'ai',
}: PromoBuildPanelProps) {
  const [stage, setStage] = useState<BuildStage>(initialStage);
  const pc = config.promoCard;
  /**
   * The interview WE run, instead of instructing the AI to run it.
   *
   * Handing the questions to ChatGPT meant five messages of back-and-forth in
   * someone else's product before anything came back. Asking here means one
   * copy, one paste, one result.
   */
  const [brief, setBrief] = useState<PromoBrief>({});
  const setAnswer = (key: keyof PromoBrief, value: string) =>
    setBrief((prev) => ({ ...prev, [key]: value }));
  const [promptCopied, setPromptCopied] = useState(false);
  const [showPaste, setShowPaste] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [pasteError, setPasteError] = useState('');
  const [applied, setApplied] = useState(false);
  const [expanded, setExpanded] = useState(false);
  /** What AI is being asked for. Defaults to restyling when the card already
   *  has copy — opened from the editor, the words are the user's own. */
  const cardHasCopy = hasCopy(pc);
  const [mode, setMode] = useState<AiMode>(() => (cardHasCopy ? 'design' : 'copy'));
  /**
   * Two steps inside the AI stage: choose what AI may change, then brief it.
   * Always starts on the choice — it's what the user came here to decide.
   */
  const [aiStep, setAiStep] = useState<'what' | 'brief'>('what');
  /** Which interview question is showing, and whether they're all answered. */
  const [questionIndex, setQuestionIndex] = useState(0);
  // All three, always. "Colors only" used to be hidden on a new card because
  // there was no content to preserve — but choosing a palette before writing
  // is a legitimate way to start, and hiding an option makes the step look
  // different depending on history.
  const availableModes = MODES;
  const activeMode = MODES.find((m) => m.value === mode);
  /**
   * Back exists wherever there's a previous step: the brief returns to the
   * choice, and the choice returns to "how do you want to build it?" — but
   * only when the panel started there. Opened straight from "Improve with AI",
   * the choice IS the first screen and a dead Back would be a lie.
   */
  const canGoBack = aiStep === 'brief' || initialStage === 'mode';

  /**
   * The editor's white canvas and the window, measured live on rAF: the canvas
   * moves when the window resizes, when the card switches between its 400/440
   * widths, and when panels above it grow.
   */
  const [canvas, setCanvas] = useState<{
    top: number;
    left: number;
    width: number;
    height: number;
  } | null>(null);
  const [viewportH, setViewportH] = useState(0);
  /** Natural content height, used to lift the panel rather than scroll it. */
  const bodyRef = useRef<HTMLDivElement>(null);
  const [contentH, setContentH] = useState(0);


  useEffect(() => {
    let frame = 0;
    const tick = () => {
      const el = document.querySelector<HTMLElement>('[data-promo-canvas]');
      if (el) {
        const r = el.getBoundingClientRect();
        setCanvas((prev) =>
          prev &&
          prev.top === r.top &&
          prev.left === r.left &&
          prev.width === r.width &&
          prev.height === r.height
            ? prev
            : { top: r.top, left: r.left, width: r.width, height: r.height },
        );
      }
      setViewportH((prev) => (prev === window.innerHeight ? prev : window.innerHeight));
      if (bodyRef.current) {
        // scrollHeight is the content's natural height even while clamped;
        // + 48 for the panel's header row.
        const wanted = bodyRef.current.scrollHeight + 48;
        setContentH((prev) => (Math.abs(prev - wanted) < 2 ? prev : wanted));
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

  /**
   * Escape steps back out, one layer at a time: the paste dialog, then the
   * expanded size, then the panel itself. With the background now inert, this
   * is the keyboard way out — clicking outside deliberately does nothing.
   */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (showPaste) setShowPaste(false);
      else if (expanded) setExpanded(false);
      else onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showPaste, expanded, onClose]);

  /** Inset from the canvas edge, so the panel sits in it rather than on it. */
  const PAD = 16;
  /** How far expanding reaches past the canvas, up and to the left. */
  const EXPAND_UP = 104;
  const EXPAND_LEFT = 200;
  /** Never under the sticky app header — the tabs must stay reachable. */
  const HEADER_SAFE = 76;

  const panelBox: React.CSSProperties = (() => {
    if (!canvas) {
      return { top: '7rem', left: '2rem', width: expanded ? 720 : 400, maxHeight: '78vh' };
    }

    // Height is auto so the panel fits its content. When it wouldn't fit below
    // its preferred top, it slides UP toward the header instead of scrolling.
    const topFor = (preferred: number) =>
      Math.min(preferred, Math.max(HEADER_SAFE, (viewportH || 0) - 16 - contentH));

    if (!expanded) {
      const top = topFor(canvas.top + PAD);
      return {
        top,
        left: canvas.left + PAD,
        width: Math.min(400, canvas.width - PAD * 2),
        maxHeight: Math.max(240, (viewportH || 0) - top - 16),
      };
    }

    const top = topFor(Math.max(HEADER_SAFE, canvas.top - EXPAND_UP));
    const left = Math.max(24, canvas.left - EXPAND_LEFT);
    return {
      top,
      left,
      width: canvas.left + canvas.width - 8 - left,
      // Covers the canvas, so the card behind is genuinely out of sight rather
      // than dimmed behind a scrim. The stepper fills this height with real
      // content, which is what makes the coverage look deliberate.
      minHeight: Math.min(
        Math.max(320, canvas.top + canvas.height - top),
        Math.max(320, (viewportH || 0) - top - 16),
      ),
      maxHeight: Math.max(320, (viewportH || 0) - top - 16),
    };
  })();

  const activeTemplateId = useMemo(() => {
    const cur = JSON.stringify(pc.style);
    return sampleTemplates.find((t) => JSON.stringify(t.promoCard.style) === cur)?.id ?? null;
  }, [pc.style]);

  /** The questions this mode needs, in order, then the optional catch-all. */
  const questions: BriefQuestion[] = [
    ...(mode === 'design' ? [] : CONTENT_QUESTIONS),
    ...(mode === 'copy' ? [] : [COLOR_QUESTION]),
    EXTRA_QUESTION,
  ];

  /**
   * Past the last question the interview is done and the prompt is ready.
   * Clamped so the visible question never runs off the end of the list.
   */
  const briefDone = questionIndex >= questions.length;
  const question = questions[Math.min(questionIndex, questions.length - 1)];
  /** Answers already given, with their position so "Edit" can jump back. */
  const answeredSoFar = questions
    .map((q, index) => ({ q, index }))
    .filter(({ q, index }) => index < questionIndex && (brief[q.key] ?? '').trim());

  /** One question, used by both layouts. */
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

  function copyPrompt() {
    const prompt = buildGuidedPromoPrompt({
      card: pc,
      templateName: sampleTemplates.find((t) => t.id === activeTemplateId)?.name,
      mode,
      brief,
    });
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
    // An AI reply replaces the card wholesale, so it needs the same one-tap way
    // back as a template or a variant. Ctrl+Z doesn't reach it: this is a swap,
    // not an edit, and the editor's history is cleared across swaps.
    const before = JSON.parse(JSON.stringify(config.promoCard)) as PromoCard;
    setConfig((prev) => ({ ...prev, promoCard: applyAiPromo(prev.promoCard, data) }));
    markChanged();
    setApplied(true);
    onApplied?.();
    setShowPaste(false);
    setPasteText('');
    setPasteError('');
    toast('Applied to your card.', false, {
      label: 'Undo',
      onClick: () => {
        setConfig((prev) => ({ ...prev, promoCard: before }));
        markChanged();
        setApplied(false);
      },
    });
  }

  /** Numbered marker for the hand-off steps; fills in once that step is live. */
  const stepBubble = (n: number, on: boolean) => (
    <span
      className={`grid h-5 w-5 shrink-0 place-items-center rounded-full text-[10px] font-bold transition-colors ${
        on ? 'bg-primary text-on-primary' : 'bg-border text-on-surface-variant'
      }`}
    >
      {n}
    </span>
  );

  /** Step 1 — the decision the user actually opened this for. */
  const aiWhat = (
    <div
      className={`gap-2 ${
        expanded ? 'grid flex-1 grid-cols-3 content-center' : 'flex flex-col'
      }`}
    >
      {availableModes.map((m) => {
        const Icon = m.icon;
        const on = mode === m.value;
        return (
          <button
            key={m.value}
            type="button"
            onClick={() => {
              setMode(m.value);
              setAiStep('brief');
            }}
            className={`rounded-xl border p-3 text-left transition-all hover:-translate-y-0.5 hover:shadow-md ${
              on
                ? 'border-primary bg-primary/[0.06]'
                : 'border-border bg-surface hover:border-primary/70'
            }`}
          >
            <Icon className={`mb-1.5 h-5 w-5 ${on ? 'text-primary' : 'text-on-surface-variant'}`} />
            <p className="text-sm font-semibold text-on-surface">{m.label}</p>
            <p className="mt-0.5 text-xs leading-snug text-on-surface-variant">
              {cardHasCopy ? m.hint : m.newCardHint}
            </p>
          </button>
        );
      })}
    </div>
  );

  /** Step 2 — brief it, take the prompt away, bring the reply back. */
  const aiForm = (
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

  return (
    <>
      {/* Invisible click-blocker so the editor behind is inert while the panel
          is open — a click landing on a field you can't see is worse than no
          click. Deliberately NOT dimmed: expanded hides the card underneath by
          covering it, and a dark scrim on top of that is just gloom.

          Clicking it shrinks an expanded panel and otherwise does nothing:
          this panel holds a half-written brief, so a stray click outside must
          not discard it. Escape and ✕ are the ways out. */}
      <div
        className="fixed inset-0 z-30 bg-transparent"
        onClick={() => expanded && setExpanded(false)}
        aria-hidden
      />

      <div
        className="fixed z-40 flex flex-col overflow-hidden rounded-2xl border border-border bg-surface-elevated shadow-2xl ring-1 ring-black/5 transition-all duration-200"
        style={panelBox}
        role="dialog"
        aria-label="Build your promo card"
      >
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

        <div
          ref={bodyRef}
          className={`campaign-custom-scrollbar min-h-0 flex-1 overflow-y-auto ${
            expanded ? 'flex flex-col p-5' : 'p-4'
          }`}
        >
          {stage === 'mode' && (
            <div
              className={`gap-3 ${
                expanded ? 'grid flex-1 grid-cols-2 content-center' : 'flex flex-col'
              }`}
            >
              <button
                type="button"
                onClick={onChooseManual}
                className="rounded-xl border border-border bg-surface p-3 text-left transition-all hover:-translate-y-0.5 hover:border-primary hover:shadow-md"
              >
                <PenLine className="mb-1.5 h-5 w-5 text-on-surface-variant" />
                <p className="text-sm font-semibold text-on-surface">Write it myself</p>
                <p className="mt-0.5 text-xs text-on-surface-variant">
                  Choose a design, then add your own content.
                </p>
              </button>
              <button
                type="button"
                onClick={() => setStage('ai')}
                className="rounded-xl border border-primary/40 bg-primary/[0.06] p-3 text-left transition-all hover:-translate-y-0.5 hover:border-primary hover:shadow-md"
              >
                <Sparkles className="mb-1.5 h-5 w-5 text-primary" />
                <p className="text-sm font-semibold text-on-surface">Generate with AI</p>
                <p className="mt-0.5 text-xs text-on-surface-variant">
                  We prepare the prompt for ChatGPT, Claude or Gemini — paste the
                  reply back to fill the card.
                </p>
              </button>
            </div>
          )}

          {stage === 'ai' &&
            (expanded ? (
              /* Right column is sized off the card's real width, which the
                 editor swaps between 400 and 440 — a fixed 360 column cropped
                 the wider one. */
              <div
                className="grid min-h-0 flex-1 items-stretch gap-6"
                style={{
                  gridTemplateColumns: `minmax(0,1fr) minmax(300px, ${(pc.cardWidth || 400) + 40}px)`,
                }}
              >
                {aiStep === 'what' ? aiWhat : aiForm}
                {/* Expanded covers the editor's preview, so the card comes along. */}
                <div className="flex min-h-0 flex-col gap-2">
                  <p className="shrink-0 text-[11px] font-bold uppercase tracking-wide text-on-surface-variant">
                    Your card
                  </p>
                  {/* The card sits in the middle of its column rather than at
                      the top: the panel is taller than the card, and pinning it
                      up top left the whole gap stacked underneath. */}
                  <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto rounded-xl border border-border bg-surface-subtle p-3">
                    <div className="w-full shrink-0" style={{ maxWidth: `${pc.cardWidth || 400}px` }}>
                      {/* Scaffold on a blank card, so a new campaign previews
                          as the shape AI is about to fill rather than an
                          empty box — same as the editor's own canvas. */}
                      <PromoMiniPreview promoCard={pc} faithful scaffold={!cardHasCopy} />
                    </div>
                  </div>
                </div>
              </div>
            ) : aiStep === 'what' ? (
              aiWhat
            ) : (
              aiForm
            ))}
        </div>
      </div>

      {showPaste && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0" onClick={() => setShowPaste(false)} />
          <div className="relative z-10 w-full max-w-lg rounded-2xl border border-border bg-surface-elevated p-5 text-on-surface shadow-2xl">
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
              className="mt-4 w-full resize-y rounded-lg border border-border bg-surface px-3 py-2 font-mono text-xs text-on-surface outline-none focus:border-primary"
            />
            {pasteError && <p className="mt-2 text-xs font-medium text-red-500">{pasteError}</p>}
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowPaste(false)}
                className="rounded-md border border-border px-4 py-2 text-sm font-medium text-on-surface-variant transition-colors hover:border-primary/70 hover:text-primary"
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
    </>
  );
}
