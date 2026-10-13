'use client';

import type { CSSProperties } from 'react';
import { ArrowRight, FolderOpen, Info, type LucideIcon } from 'lucide-react';
import type { PillTone, TileFact } from '@/lib/dashboard/tileSummary';
import { MICRO } from '@/components/dashboard/dashboardStyles';

const SLATE = 'bg-slate-100 text-slate-700 ring-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:ring-slate-700';
/** Colour always travels with the chip's words, never instead of them. */
const CHIP_CLASS: Record<PillTone, string> = {
  live: 'bg-emerald-50 text-emerald-800 ring-emerald-200 dark:bg-emerald-950 dark:text-emerald-200 dark:ring-emerald-800',
  attention: 'bg-amber-50 text-amber-900 ring-amber-200 dark:bg-amber-950 dark:text-amber-100 dark:ring-amber-800',
  off: SLATE,
  ended: SLATE,
  notCreated: SLATE,
};

interface DashboardSummaryTileProps {
  icon: LucideIcon;
  title: string;
  subtitle: string;
  pill: { tone: PillTone; label: string };
  /** This widget's entries from the dashboard's issues list, for the info tooltip. */
  issues: string[];
  fact: TileFact;
  lastSaved: string | null;
  actionLabel: string;
  /** Where the load stagger puts this tile, 0-based. */
  index: number;
  /** A click anywhere on the tile (or Enter / Space on it): show the full card. */
  onOpen: (tile: HTMLElement) => void;
  /** The button: straight into this widget's editor (Resume / Open / Create). */
  onAction: () => void;
}

/**
 * One widget at a glance: what it is, where it stands, when it was last saved,
 * and one way in. Clicking anywhere on it opens the full card
 * (DashboardCardOverlay); the button skips the card and goes straight to the
 * editor. The tile itself is not a button, so nothing nests.
 */
export function DashboardSummaryTile({
  icon: Icon,
  title,
  subtitle,
  pill,
  issues,
  fact,
  lastSaved,
  actionLabel,
  index,
  onOpen,
  onAction,
}: DashboardSummaryTileProps) {
  const issueList = issues.join('\n');
  return (
    <div
      role="group"
      aria-label={`Open ${title} details`}
      title={`Open ${title} details`}
      // Focusable itself, so the full card is reachable without a mouse now
      // that the button goes to the editor instead. Keys only count on the
      // tile, not when they bubble up from the button inside it.
      tabIndex={0}
      onClick={(e) => onOpen(e.currentTarget)}
      onKeyDown={(e) => {
        if (e.target !== e.currentTarget || (e.key !== 'Enter' && e.key !== ' ')) return;
        e.preventDefault();
        onOpen(e.currentTarget);
      }}
      className="dashboard-tile flex h-full cursor-pointer flex-col outline-none focus-visible:ring-2 focus-visible:ring-primary gap-4 rounded-2xl border border-border campaign-card-surface p-5 shadow-sm transition-[transform,box-shadow] duration-200 ease-out hover:shadow-lg motion-safe:hover:-translate-y-0.5"
      style={{ '--tile-delay': `${index * 60}ms` } as CSSProperties}
    >
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border bg-background">
          <Icon className="h-5 w-5 text-primary" />
        </div>
        <div className="flex min-w-0 flex-col gap-0.5">
          <h3 className="text-base font-semibold text-on-surface">{title}</h3>
          <p className={`${MICRO} text-on-surface-variant`}>{subtitle}</p>
        </div>
      </div>

      {/* Chip and fact share a line. If the tile is too narrow the fact wraps
          under the chip, and its leading dot — drawn in the gap before it — is
          then pulled off the left edge and clipped, so no line starts with "·". */}
      <div className="overflow-hidden py-0.5">
        <div className="-ml-4 flex flex-wrap items-center gap-y-1.5 text-[13px]">
          <span className={`ml-4 inline-flex items-center gap-1 whitespace-nowrap rounded-lg px-2 py-1 text-xs ring-1 ${CHIP_CLASS[pill.tone]}`}>
            <span className="font-semibold">Status:</span> {pill.label}
            {issues.length > 0 && (
              <span title={issueList} className="inline-flex">
                <Info className="h-3.5 w-3.5" aria-hidden />
                <span className="sr-only">{issueList}</span>
              </span>
            )}
          </span>
          {/* Not created already says it all — a fact would only repeat it. */}
          {pill.tone !== 'notCreated' && (
            <span className="relative whitespace-nowrap pl-4 text-on-surface before:absolute before:left-[5px] before:text-on-surface-variant/50 before:content-['·']">
              {fact.strong && <span className="font-bold tabular-nums">{fact.strong} </span>}
              {fact.text}
            </span>
          )}
        </div>
      </div>

      {/* Holds its line even when empty, so status and button line up across a row. */}
      <p className="min-h-5 text-[13px] leading-5 text-on-surface-variant">{lastSaved ?? '\u00a0'}</p>

      {/* mt-auto: the button sits on the tile's floor, at the same y as its
          row-mates'. Classes follow PRIMARY_BTN (dashboardStyles), sized to a
          44px single-line action. stopPropagation: the tile's own click would
          otherwise flash the card open on the way to the editor. */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onAction();
        }}
        className="group mt-auto flex h-11 w-full items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-on-primary transition-all hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 active:scale-[0.98]"
      >
        <FolderOpen className="h-4 w-4 shrink-0" aria-hidden />
        <span className="min-w-0 flex-1 truncate text-left">
          {actionLabel} {title}
        </span>
        <ArrowRight className="h-4 w-4 shrink-0 transition-transform group-hover:translate-x-0.5" aria-hidden />
      </button>
    </div>
  );
}
