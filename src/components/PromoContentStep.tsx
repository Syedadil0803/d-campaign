'use client';

/**
 * Step 2 of the guided promo flow — the campaign's schedule and copy.
 *
 * Deliberately limited: dates, words, and which template look to use. Styling,
 * placement and per-field colours belong to the editor, so this step hands off
 * to it rather than offering Publish — publishing from here would mean
 * committing a card the user hasn't had the chance to style.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, CalendarDays, ClipboardPaste, Copy, Pencil, Sparkles, X } from 'lucide-react';
import { CampaignConfig, PromoCard } from '@/types/campaign';
import { PromoMiniPreview } from '@/components/PromoMiniPreview';
import { PromoDatePicker } from '@/components/PromoDatePicker';
import { sampleTemplates } from '@/components/SamplePromoTemplates';
import { applyTemplateLook } from '@/lib/promoTemplate';
import {
  CARD_MAX_WIDTH,
  fieldOverflows,
  fitWarning,
  PromoFitField,
  requiredCardWidth,
} from '@/lib/promoFit';
import { parseAiPromo, applyAiPromo, AI_PROMO_SCHEMA_PROMPT } from '@/lib/promoImport';
import {
  toPlainText,
  setPlainText,
  hasMixedStyling,
  splitRuns,
  applyWordPattern,
  patternTotalWords,
  type TextRun,
} from '@/lib/promoRichText';
import { getBackgroundStyle } from '@/lib/utils';

/** Where the card's button sends people. Mirrors the editor's CTA options. */
const CTA_TYPES: { value: 'whatsapp' | 'link' | 'text'; label: string }[] = [
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'link', label: 'Link' },
  { value: 'text', label: 'No link' },
];

/** Common campaign lengths, offered before any calendar appears. */
const DURATIONS = [
  { days: 3, label: '3 days' },
  { days: 7, label: '1 week' },
  { days: 14, label: '2 weeks' },
  { days: 30, label: '1 month' },
];

interface PromoContentStepProps {
  config: CampaignConfig;
  setConfig: (config: CampaignConfig | ((prev: CampaignConfig) => CampaignConfig)) => void;
  markChanged: () => void;
  toast: (message: string, isError?: boolean) => void;
  onBack: () => void;
  onOpenEditor: () => void;
}

/**
 * Plain-text field over a rich-text value. The editor owns per-word styling;
 * here the user edits words and the surrounding markup is preserved.
 */
function TextField({
  label,
  value,
  onChange,
  warning,
  multiline,
  placeholder,
  optional,
  lines,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  warning?: string | null;
  multiline?: boolean;
  placeholder?: string;
  optional?: boolean;
  /** How many lines this field gets on the card, shown as a hint. */
  lines?: number;
}) {
  const cls =
    'w-full rounded-lg border border-border bg-surface-subtle px-3 py-2 text-sm text-on-surface ' +
    'outline-none transition-colors focus:border-primary';
  return (
    <div className="mb-3">
      <label className="mb-1.5 flex items-baseline gap-1.5 text-[11px] font-bold uppercase tracking-wide text-on-surface-variant">
        {label}
        {optional && (
          <span className="font-medium normal-case tracking-normal text-on-surface-variant/60">
            optional
          </span>
        )}
        {lines && (
          <span className="ml-auto font-medium normal-case tracking-normal text-on-surface-variant/60">
            {lines} line{lines > 1 ? 's' : ''} on the card
          </span>
        )}
      </label>
      {multiline ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={3}
          className={`${cls} resize-none`}
        />
      ) : (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={cls}
        />
      )}
      {warning && (
        <p className="mt-1.5 rounded-md bg-amber-500/15 px-2.5 py-1.5 text-xs font-medium text-amber-700 dark:text-amber-400">
          {warning}
        </p>
      )}
    </div>
  );
}

/**
 * Shown when the text runs past the design's styled pattern.
 *
 * Worded as an invitation, not a limit: the extra words simply haven't been
 * styled *yet*, and the editor can style any word however the user likes.
 */
function PatternNotice({
  covers,
  unstyledText,
  onEditInEditor,
}: {
  covers: number;
  unstyledText: string;
  onEditInEditor: () => void;
}) {
  const over = unstyledText.length > 0;
  const shown =
    unstyledText.length > 28 ? `${unstyledText.slice(0, 28).trimEnd()}…` : unstyledText;
  return (
    <div
      className={`-mt-1.5 mb-3 flex flex-wrap items-center gap-2 rounded-md border px-2.5 py-2 ${
        over ? 'border-primary/30 bg-primary/[0.06]' : 'border-border bg-surface-subtle'
      }`}
    >
      <span className="text-[11px] text-on-surface-variant">
        This design covers {covers} word{covers > 1 ? 's' : ''}
        {over ? (
          <>
            {' — '}
            <span className="font-semibold text-on-surface">“{shown}”</span> stays plain.
          </>
        ) : (
          '.'
        )}{' '}
        Style any word in the editor.
      </span>
      <button
        type="button"
        onClick={onEditInEditor}
        className={`ml-auto inline-flex shrink-0 items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-semibold transition-opacity hover:opacity-95 ${
          over
            ? 'bg-primary text-on-primary'
            : 'border border-border bg-surface text-on-surface-variant hover:text-primary'
        }`}
      >
        <Pencil className="h-3 w-3" /> Style in editor
      </button>
    </div>
  );
}

/**
 * An optional part of the card with a switch. Off removes it from the card
 * entirely; on reveals its wording field.
 */
function OptionalBlock({
  label,
  enabled,
  onToggle,
  children,
}: {
  label: string;
  enabled: boolean;
  onToggle: (on: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-3 rounded-xl border border-border bg-surface-subtle p-3">
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        onClick={() => onToggle(!enabled)}
        className="flex w-full items-center justify-between gap-3 text-left"
      >
        <span className="text-sm font-semibold text-on-surface">{label}</span>
        <span className="flex items-center gap-2">
          <span className="text-[11px] font-medium text-on-surface-variant">
            {enabled ? 'Shown' : 'Hidden'}
          </span>
          <span
            className={`relative h-5 w-9 rounded-full transition-colors ${
              enabled ? 'bg-primary' : 'bg-on-surface-variant/30'
            }`}
          >
            <span
              className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${
                enabled ? 'left-[1.125rem]' : 'left-0.5'
              }`}
            />
          </span>
        </span>
      </button>
      {enabled && <div className="mt-3">{children}</div>}
    </div>
  );
}

export function PromoContentStep({
  config,
  setConfig,
  markChanged,
  toast,
  onBack,
  onOpenEditor,
}: PromoContentStepProps) {
  const pc = config.promoCard;
  const [useAi, setUseAi] = useState(false);
  const [brief, setBrief] = useState('');
  const [promptCopied, setPromptCopied] = useState(false);
  const [showPaste, setShowPaste] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [pasteError, setPasteError] = useState('');
  const [customDates, setCustomDates] = useState(false);
  // The design's word-by-word style pattern per field, captured once so it
  // survives even if the user clears the line completely and retypes it.
  const [patterns, setPatterns] = useState<Partial<Record<PromoFitField, TextRun[]>>>({});
  // Fields the user has actually typed in. The styling hint only matters once
  // they start changing the words — showing it on arrival is just noise.
  const [touched, setTouched] = useState<Partial<Record<PromoFitField, boolean>>>({});

  const dateRangeInvalid = Boolean(pc.startDate && pc.endDate && pc.startDate > pc.endDate);

  // Capture each field's word-by-word style pattern the first time we see one.
  // It must be recorded BEFORE the user edits, because their first keystroke
  // rewrites the field and the original run structure would be gone.
  useEffect(() => {
    (['title', 'subtitle', 'description'] as const).forEach((f) => {
      if (patterns[f] || !hasMixedStyling(pc[f])) return;
      const runs = splitRuns(pc[f]);
      if (runs) setPatterns((prev) => (prev[f] ? prev : { ...prev, [f]: runs }));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pc.title, pc.subtitle, pc.description]);

  function updateCard(patch: Partial<PromoCard>) {
    setConfig((prev) => ({ ...prev, promoCard: { ...prev.promoCard, ...patch } }));
    markChanged();
  }

  /**
   * Write a copy field, refusing input that would overflow the card.
   *
   * Measured at the card's widest (440px), so the user can still fill the
   * stretched card — the width effect widens it as they go. Deletions and
   * edits that shorten the text always pass, so nobody gets stuck when a
   * template or AI reply arrives already too long.
   */
  function setCopy(field: PromoFitField, plain: string) {
    const current = pc[field];
    const pattern = patterns[field];
    // Re-apply the design's per-word styling positionally, so the look holds
    // even after the line is deleted and retyped.
    const nextHtml = pattern ? applyWordPattern(pattern, plain) : setPlainText(current, plain);
    const isGrowing = plain.length > toPlainText(current).length;
    if (isGrowing && fieldOverflows(nextHtml, field, CARD_MAX_WIDTH)) return;
    if (!touched[field]) setTouched((prev) => ({ ...prev, [field]: true }));
    updateCard({ [field]: nextHtml } as Partial<PromoCard>);
  }

  /**
   * A copy field. Templates now arrive as an empty element carrying one style,
   * so there's no per-word styling to preserve and a single box is correct.
   */
  function copyField(field: PromoFitField, label: string, lines: number, placeholder: string) {
    const pattern = patterns[field];
    const designWords = pattern ? patternTotalWords(pattern) : 0;
    const words = toPlainText(pc[field]).split(/\s+/).filter(Boolean);
    // A design can leave words plain on purpose, so only speak up once the
    // user has written MORE than the design's own copy carried.
    const beyondDesign = words.length > designWords;
    const unstyled = beyondDesign ? words.slice(designWords).join(' ') : '';
    return (
      <div key={field}>
        <TextField
          label={label}
          lines={lines}
          placeholder={placeholder}
          multiline={field === 'description'}
          value={toPlainText(pc[field])}
          warning={warnings[field]}
          onChange={(v) => setCopy(field, v)}
        />
        {designWords > 0 && touched[field] && beyondDesign && (
          <PatternNotice
            covers={designWords}
            unstyledText={unstyled}
            onEditInEditor={onOpenEditor}
          />
        )}
      </div>
    );
  }

  /** Days between start and end, when both are set and in order. */
  const runLength = useMemo(() => {
    if (!pc.startDate || !pc.endDate || dateRangeInvalid) return null;
    const ms =
      new Date(`${pc.endDate}T00:00:00`).getTime() - new Date(`${pc.startDate}T00:00:00`).getTime();
    return Math.round(ms / 86_400_000);
  }, [pc.startDate, pc.endDate, dateRangeInvalid]);

  /** Set the end date N days after the start (defaulting the start to today). */
  function setRunLength(days: number) {
    const start = pc.startDate || new Date().toISOString().split('T')[0];
    const end = new Date(`${start}T00:00:00`);
    end.setDate(end.getDate() + days);
    updateCard({ startDate: start, endDate: end.toISOString().split('T')[0] });
  }

  /** Plain-language confirmation of when the campaign will actually run. */
  const scheduleSummary = useMemo(() => {
    if (!pc.startDate || !pc.endDate || dateRangeInvalid) return null;
    const fmt = (d: string) =>
      new Date(`${d}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    const today = new Date().toISOString().split('T')[0];
    const when = pc.startDate > today ? 'Scheduled' : 'Runs';
    return `${when} ${fmt(pc.startDate)} → ${fmt(pc.endDate)}${
      runLength ? ` · ${runLength} day${runLength > 1 ? 's' : ''}` : ''
    }`;
  }, [pc.startDate, pc.endDate, dateRangeInvalid, runLength]);

  // The card stretches 400→440 when the copy needs the room. The editor does
  // this for itself; mirror it so this preview matches what publishes.
  useEffect(() => {
    const needed = requiredCardWidth({
      title: pc.title,
      subtitle: pc.subtitle,
      description: pc.description,
    });
    if ((pc.cardWidth || 400) !== needed) {
      setConfig((prev) => ({ ...prev, promoCard: { ...prev.promoCard, cardWidth: needed } }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pc.title, pc.subtitle, pc.description]);

  const warnings = useMemo(() => {
    const out: Partial<Record<PromoFitField, string | null>> = {};
    (['title', 'subtitle', 'description'] as const).forEach((f) => {
      out[f] = fitWarning(pc[f], f, pc.cardWidth);
    });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pc.title, pc.subtitle, pc.description, pc.cardWidth]);

  const activeTemplateId = useMemo(() => {
    const cur = JSON.stringify(pc.style);
    return sampleTemplates.find((t) => JSON.stringify(t.promoCard.style) === cur)?.id ?? null;
  }, [pc.style]);

  /**
   * The design the card arrived with (from a template, a variant, or AI).
   * Kept as the first swatch so trying other looks is never a one-way door —
   * without it, one click would discard a design you can't get back.
   */
  const baselineStyleRef = useRef<PromoCard['style']>(pc.style);
  const onBaselineStyle =
    JSON.stringify(pc.style) === JSON.stringify(baselineStyleRef.current);

  function copyPrompt() {
    const prompt = brief.trim()
      ? `${AI_PROMO_SCHEMA_PROMPT}\n\nThe campaign is about: ${brief.trim()}`
      : AI_PROMO_SCHEMA_PROMPT;
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
    setConfig((prev) => {
      const next = applyAiPromo(prev.promoCard, result.data);
      // AI may bring its own design — that becomes the one "Current" restores.
      baselineStyleRef.current = next.style;
      return { ...prev, promoCard: next };
    });
    markChanged();
    setShowPaste(false);
    setPasteText('');
    setPasteError('');
    toast('Content applied from AI.');
  }

  // Campaigns can't start in the past — same rule as the editor's calendar.
  const todayISO = new Date().toISOString().split('T')[0];

  return (
    <div className="flex h-[calc(100vh-7.5rem)] w-full flex-col overflow-hidden">
      {/* Header */}
      <div className="shrink-0 pb-3">
        <h2 className="font-display text-xl font-semibold text-on-surface">
          Set up your campaign
        </h2>
        <p className="text-sm text-on-surface-variant">
          When it runs and what it says. You&apos;ll style and place the card in the next step.
        </p>
      </div>

      {/* Body — 55/45 split so neither side leaves dead space. The preview keeps
          a 472px floor (a 440px card plus padding) so the card is never scaled
          down; below that the columns stack. Only the form scrolls. */}
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-6 lg:grid-cols-[minmax(0,55fr)_minmax(472px,45fr)]">
        <div className="campaign-custom-scrollbar min-h-0 overflow-y-auto pr-2">
          {/* Schedule first — a campaign is defined by when it runs. */}
          <div className="mb-4 rounded-xl border border-border bg-surface-subtle p-4">
            <p className="mb-1 flex items-center gap-1.5 text-sm font-semibold text-on-surface">
              <CalendarDays className="h-4 w-4" /> When should it run?
            </p>
            <p className="mb-3 text-xs text-on-surface-variant">
              Starts today by default. Use <span className="font-medium">Custom dates</span> to
              schedule it ahead — it stays off your site until the start date.
            </p>
            {/* Duration first — the calendars only appear if you need them. */}
            <div className="flex flex-wrap gap-1.5">
              {DURATIONS.map((d) => {
                const on = !customDates && runLength === d.days;
                return (
                  <button
                    key={d.days}
                    type="button"
                    onClick={() => {
                      setCustomDates(false);
                      setRunLength(d.days);
                    }}
                    className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                      on
                        ? 'border-primary bg-primary text-on-primary'
                        : 'border-border text-on-surface-variant hover:border-primary/70 hover:text-primary'
                    }`}
                  >
                    {d.label}
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => setCustomDates(true)}
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                  customDates
                    ? 'border-primary bg-primary text-on-primary'
                    : 'border-border text-on-surface-variant hover:border-primary/70 hover:text-primary'
                }`}
              >
                Custom dates
              </button>
            </div>

            {customDates && (
              <div className="mt-3 grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-on-surface-variant">
                    Start date
                  </label>
                  <PromoDatePicker
                    value={pc.startDate || ''}
                    onChange={(v) => updateCard({ startDate: v })}
                    minDate={todayISO}
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-on-surface-variant">
                    End date
                  </label>
                  <PromoDatePicker
                    value={pc.endDate || ''}
                    onChange={(v) => updateCard({ endDate: v })}
                    align="right"
                    minDate={todayISO}
                    invalid={dateRangeInvalid}
                  />
                </div>
              </div>
            )}

            {dateRangeInvalid ? (
              <p className="mt-2 text-xs font-medium text-red-500">
                End date must be on or after the start date.
              </p>
            ) : (
              scheduleSummary && (
                <p className="mt-2 text-xs font-medium text-on-surface-variant">{scheduleSummary}</p>
              )
            )}
          </div>

          {/* Compact segmented switch — two full-size cards ate the space the
              preview needs. */}
          <div className="mb-3 flex rounded-lg border border-border bg-surface-subtle p-1">
            <button
              type="button"
              onClick={() => setUseAi(false)}
              className={`flex-1 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                !useAi
                  ? 'bg-primary text-on-primary shadow-sm'
                  : 'text-on-surface-variant hover:text-primary'
              }`}
            >
              Write it myself
            </button>
            <button
              type="button"
              onClick={() => setUseAi(true)}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                useAi
                  ? 'bg-primary text-on-primary shadow-sm'
                  : 'text-on-surface-variant hover:text-primary'
              }`}
            >
              <Sparkles className="h-3.5 w-3.5" /> Use AI help
            </button>
          </div>
          {useAi && (
            <p className="-mt-1 mb-3 text-xs text-on-surface-variant">
              Describe your campaign once — AI writes the copy and picks a matching design.
            </p>
          )}

          {useAi && (
            <div className="mb-4 rounded-xl border border-border bg-surface-subtle p-4">
              <div className="flex gap-3 border-b border-dashed border-border pb-3">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-primary text-xs font-bold text-on-primary">
                  1
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-on-surface">Describe your campaign</p>
                  <p className="mb-2 text-xs text-on-surface-variant">
                    The offer, the audience, the mood — AI picks the wording and a design to suit.
                  </p>
                  <textarea
                    value={brief}
                    onChange={(e) => setBrief(e.target.value)}
                    rows={2}
                    placeholder="e.g. Monsoon clearance on rugs, up to 60% off, warm and friendly, ends Sunday."
                    className="w-full resize-none rounded-lg border border-border bg-surface px-3 py-2 text-sm text-on-surface outline-none focus:border-primary"
                  />
                  <button
                    type="button"
                    onClick={copyPrompt}
                    className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-on-primary transition-opacity hover:opacity-95"
                  >
                    <Copy className="h-3.5 w-3.5" /> Copy prompt for AI
                  </button>
                </div>
              </div>

              <div className={`flex gap-3 border-b border-dashed border-border py-3 ${promptCopied ? '' : 'opacity-55'}`}>
                <span
                  className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-bold ${
                    promptCopied ? 'bg-primary text-on-primary' : 'bg-border text-on-surface-variant'
                  }`}
                >
                  2
                </span>
                <div>
                  <p className="text-sm font-semibold text-on-surface">Paste it into any AI tool</p>
                  <p className="text-xs text-on-surface-variant">
                    ChatGPT, Claude, Gemini — whichever you use. Copy its reply.
                  </p>
                </div>
              </div>

              <div className={`flex gap-3 pt-3 ${promptCopied ? '' : 'opacity-55'}`}>
                <span
                  className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-bold ${
                    promptCopied ? 'bg-primary text-on-primary' : 'bg-border text-on-surface-variant'
                  }`}
                >
                  3
                </span>
                <div>
                  <p className="text-sm font-semibold text-on-surface">Paste the reply back</p>
                  <p className="mb-2 text-xs text-on-surface-variant">
                    The fields and preview fill in automatically.
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
          )}

          {/* Inputs are the card's own content width, so a line that wraps here
              is a line that wraps there — the field stops promising more room
              than the card actually has. */}
          {copyField('title', 'Headline', 1, 'Summer Splash Sale')}
          {copyField('subtitle', 'Subheading', 2, 'Buy 2 Get 1 Free')}
          {copyField('description', 'Description', 3, 'What makes this offer worth clicking?')}

          {/* Optional parts: switch them off entirely, or keep them and edit
              the wording. Off hides them from the card and the preview.
              Ordered as they appear on the card — timer, then button. */}
          <OptionalBlock
            label="Countdown timer"
            enabled={pc.showTimer !== false}
            onToggle={(on) => updateCard({ showTimer: on })}
          >
            <TextField
              label="Timer text"
              value={toPlainText(pc.timerText)}
              onChange={(v) => updateCard({ timerText: setPlainText(pc.timerText, v) })}
              placeholder="Ends in {timer}"
            />
          </OptionalBlock>

          <OptionalBlock
            label="Button"
            enabled={pc.showButton !== false}
            onToggle={(on) => updateCard({ showButton: on })}
          >
            <TextField
              label="Button text"
              value={toPlainText(pc.buttonText)}
              onChange={(v) => updateCard({ buttonText: setPlainText(pc.buttonText, v) })}
              placeholder="Shop now"
            />

            {/* Where the button goes. Same three options the editor offers. */}
            <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-on-surface-variant">
              Button action
            </label>
            <div className="mb-2 flex rounded-lg border border-border bg-surface p-1">
              {CTA_TYPES.map((c) => {
                const on = (pc.ctaType || 'whatsapp') === c.value;
                return (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => updateCard({ ctaType: c.value })}
                    className={`flex-1 rounded-md px-2 py-1.5 text-xs font-semibold transition-colors ${
                      on
                        ? 'bg-primary text-on-primary shadow-sm'
                        : 'text-on-surface-variant hover:text-primary'
                    }`}
                  >
                    {c.label}
                  </button>
                );
              })}
            </div>

            {(pc.ctaType || 'whatsapp') === 'link' && (
              <input
                type="text"
                value={pc.buttonUrl || ''}
                onChange={(e) => updateCard({ buttonUrl: e.target.value })}
                placeholder="https://yourstore.com/collections/sale"
                className="w-full rounded-lg border border-border bg-surface-subtle px-3 py-2 text-sm text-on-surface outline-none transition-colors focus:border-primary"
              />
            )}
            {(pc.ctaType || 'whatsapp') === 'whatsapp' && (
              <input
                type="text"
                inputMode="numeric"
                value={pc.whatsappNumber || ''}
                onChange={(e) => updateCard({ whatsappNumber: e.target.value })}
                placeholder="WhatsApp number, e.g. 7700900123"
                className="w-full rounded-lg border border-border bg-surface-subtle px-3 py-2 text-sm text-on-surface outline-none transition-colors focus:border-primary"
              />
            )}
            {(pc.ctaType || 'whatsapp') === 'text' && (
              <p className="text-xs text-on-surface-variant">
                Shown as a styled label — clicking it does nothing.
              </p>
            )}
          </OptionalBlock>
        </div>

        {/* Preview column — fixed, never scrolls */}
        <div className="flex min-h-0 flex-col">
          <div className="campaign-custom-scrollbar flex min-h-0 flex-1 items-center justify-center overflow-auto rounded-xl border border-border bg-surface-subtle p-4">
            {/* Rendered at the card's real width — never scaled or squeezed,
                so this is exactly what the site will show. */}
            <div className="shrink-0" style={{ width: `${pc.cardWidth || 400}px` }}>
              <PromoMiniPreview promoCard={pc} faithful />
            </div>
          </div>
          <p className="mb-1.5 mt-3 shrink-0 text-[11px] font-bold uppercase tracking-wide text-on-surface-variant">
            Design — swapping keeps your text
          </p>
          {/* Captions sit in normal flow under each swatch — absolute
              positioning here overlapped whatever followed the row. */}
          <div className="flex shrink-0 flex-wrap gap-x-2 gap-y-1">
            {/* The design you came in with — always first, so nothing is lost. */}
            <div className="flex flex-col items-center gap-1">
              <button
                type="button"
                title="Current design"
                onClick={() => {
                  setConfig((prev) => ({
                    ...prev,
                    promoCard: {
                      ...prev.promoCard,
                      style: JSON.parse(
                        JSON.stringify(baselineStyleRef.current),
                      ) as PromoCard['style'],
                    },
                  }));
                  markChanged();
                }}
                style={{ background: getBackgroundStyle(baselineStyleRef.current.background) }}
                className={`h-8 w-12 rounded-md ring-offset-2 ring-offset-surface transition-all hover:scale-105 ${
                  onBaselineStyle
                    ? 'ring-2 ring-primary'
                    : 'ring-1 ring-border hover:ring-primary/60'
                }`}
              />
              <span className="text-[9px] font-medium leading-none text-on-surface-variant">
                Current
              </span>
            </div>

            {sampleTemplates.map((t) => {
              const on = t.id === activeTemplateId;
              return (
                <div key={t.id} className="flex flex-col items-center gap-1">
                  <button
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
                  {/* Spacer keeps every swatch the same height as "Current". */}
                  <span className="text-[9px] leading-none">&nbsp;</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-3 flex shrink-0 items-center gap-2 border-t border-border pt-3">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border px-4 py-2 text-sm font-semibold text-on-surface-variant transition-colors hover:border-primary/70 hover:text-primary"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
        <button
          type="button"
          onClick={onOpenEditor}
          disabled={dateRangeInvalid}
          title={dateRangeInvalid ? 'Fix the date range to continue.' : undefined}
          className="ml-auto inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-on-primary shadow-sm transition-opacity hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Continue to editor <ArrowRight className="h-4 w-4" />
        </button>
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
