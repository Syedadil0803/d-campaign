'use client';

/**
 * Step 1 of the guided promo flow — the starting point picker.
 *
 * Two rows: the actions you can take (continue live/draft, reuse a past
 * campaign, start fresh), then every design as a horizontal strip. Designs sit
 * on the page rather than behind a popup — the page has the room, and it turns
 * "choose a template" from tile → popup → scroll into a single click.
 */

import { FilePlus2, History, ArrowRight } from 'lucide-react';
import { PromoCard } from '@/types/campaign';
import { PromoCardThumb } from '@/components/PromoCardThumb';

export type PromoStartChoice = 'current' | 'draft' | 'template' | 'published' | 'blank';

interface TemplateOption {
  id: string;
  name: string;
  promoCard: PromoCard;
}

interface PromoStartStepProps {
  /** The card already in the editor (live or in progress), when it has content. */
  currentCard: PromoCard | null;
  currentIsLive: boolean;
  /** The saved draft's card, when one exists. */
  draftCard: PromoCard | null;
  draftSavedAt?: string | null;
  /** How many saved variants exist in "My Published". */
  publishedCount: number;
  /** Every design, shown as a horizontal strip below the action cards. */
  templates: TemplateOption[];
  onPickTemplate: (template: PromoCard, name: string) => void;
  onChoose: (choice: PromoStartChoice) => void;
  onSkipToEditor: () => void;
}

function formatWhen(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function PromoStartStep({
  currentCard,
  currentIsLive,
  draftCard,
  draftSavedAt,
  publishedCount,
  templates,
  onPickTemplate,
  onChoose,
  onSkipToEditor,
}: PromoStartStepProps) {
  const cardBase =
    'group relative flex flex-col rounded-xl border border-border bg-surface p-4 text-left ' +
    'transition-all hover:-translate-y-0.5 hover:border-primary hover:shadow-lg';

  /**
   * Clickable card. Deliberately NOT a <button>: these cards embed a card
   * preview which itself renders a <button>, and nesting buttons is invalid
   * HTML (React throws a hydration error). role/tabIndex/keyboard handling
   * keep it operable from the keyboard.
   */
  function PickCard({
    onClick,
    disabled,
    title,
    className = '',
    children,
  }: {
    onClick: () => void;
    disabled?: boolean;
    title?: string;
    className?: string;
    children: React.ReactNode;
  }) {
    return (
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-disabled={disabled || undefined}
        title={title}
        onClick={disabled ? undefined : onClick}
        onKeyDown={(e) => {
          if (disabled) return;
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onClick();
          }
        }}
        className={`${cardBase} ${className} ${
          disabled
            ? 'cursor-not-allowed opacity-50 hover:translate-y-0 hover:border-border hover:shadow-none'
            : 'cursor-pointer focus:outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/40'
        }`}
      >
        {children}
      </div>
    );
  }

  const hasContinue = Boolean(currentCard || draftCard || publishedCount > 0);

  return (
    <div className="mx-auto w-full max-w-[1180px] pb-8">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl font-semibold text-on-surface">
            Create your promo card
          </h2>
          <p className="mt-1 text-sm text-on-surface-variant">
            Pick a starting point. You can change the look later without losing your words.
          </p>
        </div>
        <button
          type="button"
          onClick={onSkipToEditor}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-on-surface-variant transition-colors hover:text-primary"
        >
          Skip to editor <ArrowRight className="h-4 w-4" />
        </button>
      </div>

      {/* ── Row 1: what you can do ──────────────────────────────────── */}
      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {currentCard && (
          <PickCard onClick={() => onChoose('current')}>
            <span
              className={`absolute right-3 top-3 z-10 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                currentIsLive
                  ? 'bg-green-500/15 text-green-600 dark:text-green-400'
                  : 'bg-primary/15 text-primary'
              }`}
            >
              {currentIsLive ? 'ON AIR' : 'IN PROGRESS'}
            </span>
            <div className="mb-3">
              <PromoCardThumb promoCard={currentCard} />
            </div>
            <h3 className="text-sm font-semibold text-on-surface">
              {currentIsLive ? 'Continue your live campaign' : 'Continue current campaign'}
            </h3>
            <p className="mt-1 text-xs text-on-surface-variant">
              {currentIsLive
                ? "Edit what's running on your site right now."
                : 'Pick up the card you were working on.'}
            </p>
          </PickCard>
        )}

        {draftCard && (
          <PickCard onClick={() => onChoose('draft')}>
            <span className="absolute right-3 top-3 z-10 rounded-full bg-green-500/15 px-2 py-0.5 text-[10px] font-bold text-green-600 dark:text-green-400">
              DRAFT
            </span>
            <div className="mb-3">
              <PromoCardThumb promoCard={draftCard} />
            </div>
            <h3 className="text-sm font-semibold text-on-surface">Continue where you left off</h3>
            <p className="mt-1 text-xs text-on-surface-variant">
              {draftSavedAt
                ? `Your saved draft from ${formatWhen(draftSavedAt)}.`
                : 'Your saved draft, exactly as you left it.'}
            </p>
          </PickCard>
        )}

        <PickCard
          onClick={() => onChoose('published')}
          disabled={publishedCount === 0}
          title={publishedCount === 0 ? "You haven't published a campaign yet." : undefined}
        >
          <div className="mb-3 grid h-24 place-items-center rounded-lg bg-gradient-to-br from-cyan-600 to-cyan-800 text-white">
            <History className="h-7 w-7" />
          </div>
          <h3 className="text-sm font-semibold text-on-surface">Reuse a past campaign</h3>
          <p className="mt-1 text-xs text-on-surface-variant">
            {publishedCount === 0
              ? 'Nothing published yet.'
              : `Start from one of your ${publishedCount} published card${publishedCount > 1 ? 's' : ''}.`}
          </p>
        </PickCard>

        <PickCard onClick={() => onChoose('blank')}>
          <div className="mb-3 grid h-24 place-items-center rounded-lg border-2 border-dashed border-border bg-surface-subtle text-on-surface-variant">
            <FilePlus2 className="h-7 w-7" />
          </div>
          <h3 className="text-sm font-semibold text-on-surface">Start fresh</h3>
          <p className="mt-1 text-xs text-on-surface-variant">
            A blank card, built from scratch in the editor.
          </p>
        </PickCard>
      </div>

      {/* ── Row 2: every design, scrolled horizontally ──────────────── */}
      <h3 className="mb-2 text-[11px] font-bold uppercase tracking-wide text-on-surface-variant">
        Templates - Pick any one to start editing - Scroll to see all {templates.length}
      </h3>

      <div className="campaign-custom-scrollbar -mx-2 flex items-start gap-4 overflow-x-auto px-2 pb-4 pt-2">
        {templates.map((t) => (
          <PickCard
            key={t.id}
            onClick={() => onPickTemplate(t.promoCard, t.name)}
            className="w-[400px] shrink-0"
          >
            <PromoCardThumb promoCard={t.promoCard} size="lg" />
            <p className="mt-2.5 truncate text-sm font-semibold text-on-surface">{t.name}</p>
          </PickCard>
        ))}
      </div>

      {!hasContinue && (
        <p className="mt-6 text-center text-xs text-on-surface-variant">
          Nothing is applied until you pick one — your site stays as it is.
        </p>
      )}
    </div>
  );
}
