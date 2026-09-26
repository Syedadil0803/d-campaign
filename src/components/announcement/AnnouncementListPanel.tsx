'use client';

import { useEffect, useRef } from 'react';
import type { ReactNode, RefObject } from 'react';
import { GripVertical, Lightbulb, Lock, MoreVertical, TriangleAlert } from 'lucide-react';
import type { CampaignConfig } from '@/types/campaign';
import { stripHtml } from '@/lib/utils';
import { isInvalidRange } from '@/lib/dateRange';
import { groupRows, rowTiming, type ListRow, type RowState } from '@/lib/announcement/listSections';

interface AnnouncementListPanelProps {
  config: CampaignConfig;
  selectedIndex: number | null;
  clearSelection: () => void;
  loadAnnouncementIntoSelection: (index: number) => string;
  detectFormatsForSelectMode: (html: string) => void;
  reorderAnnouncements: (fromIndex: number, toIndex: number) => void;
  draggedIndex: number | null;
  setDraggedIndex: (index: number | null) => void;
  openActionMenu: (index: number, button: HTMLButtonElement) => void;
  scheduleCloseActionMenu: () => void;
  cancelCloseActionMenu: () => void;
  richEditorRef: RefObject<HTMLDivElement | null>;
  /**
   * True while a message is staged. The list goes read-only: a staged edit
   * remembers its row by position, so deleting or dragging any row would shift
   * that position and Publish would overwrite the wrong message.
   */
  locked: boolean;
  /** The row a staged edit will replace, so it can be marked. */
  stagedIndex: number | null;
}

/**
 * Colours are the app's theme tokens, not the literal slate/white of the design
 * spec — the spec's values are light-only and would put a white card in dark
 * mode. Spacing, sizes and structure follow the spec.
 */
const BADGE: Record<RowState | 'invalid', { label: string; className: string; dot: string }> = {
  active: {
    label: 'Live',
    className: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/25',
    dot: 'bg-emerald-500',
  },
  scheduled: {
    label: 'Scheduled',
    className: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/25',
    dot: 'bg-amber-500',
  },
  ended: {
    label: 'Ended',
    className: 'bg-on-surface/5 text-on-surface-variant border-border',
    dot: 'bg-on-surface-variant/50',
  },
  invalid: {
    label: 'Invalid',
    className: 'bg-red-500/10 text-red-700 dark:text-red-300 border-red-500/30',
    dot: '',
  },
};

function StatusBadge({ kind }: { kind: RowState | 'invalid' }) {
  const badge = BADGE[kind];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-semibold shrink-0 ${badge.className}`}>
      {kind === 'invalid'
        ? <TriangleAlert className="h-3 w-3" />
        : <span className={`h-1.5 w-1.5 rounded-full ${badge.dot}`} aria-hidden="true" />}
      {badge.label}
    </span>
  );
}

function SectionLabel({ tone, children }: { tone: 'neutral' | 'active' | 'scheduled'; children: ReactNode }) {
  const toneClass = {
    neutral: 'text-on-surface-variant/60',
    active: 'text-emerald-600 dark:text-emerald-400',
    scheduled: 'text-amber-600 dark:text-amber-400',
  }[tone];
  return (
    <p className={`mb-1 px-1 flex shrink-0 items-center gap-1.5 text-[10px] leading-4 font-bold uppercase tracking-wider ${toneClass}`}>
      {tone === 'active' && <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden="true" />}
      {tone === 'scheduled' && <span className="h-1.5 w-1.5 rounded-full bg-amber-500" aria-hidden="true" />}
      {children}
    </p>
  );
}

export function AnnouncementListPanel({
  config,
  selectedIndex,
  clearSelection,
  loadAnnouncementIntoSelection,
  detectFormatsForSelectMode,
  reorderAnnouncements,
  draggedIndex,
  setDraggedIndex,
  openActionMenu,
  scheduleCloseActionMenu,
  cancelCloseActionMenu,
  richEditorRef,
  locked,
  stagedIndex,
}: AnnouncementListPanelProps) {
  const announcements = config.announcementBar.announcements;
  const panelRef = useRef<HTMLDivElement | null>(null);
  const prevLengthRef = useRef(announcements.length);

  /**
   * A newly published message is appended to the stored list, but it can land
   * in either section — and Scheduled sorts by start date, so it is not
   * necessarily last there. Find the row itself and scroll the section that
   * holds it, only as far as needed to show it.
   */
  useEffect(() => {
    if (announcements.length > prevLengthRef.current && panelRef.current) {
      const row = panelRef.current.querySelector<HTMLElement>(
        `[data-row-index="${announcements.length - 1}"]`,
      );
      const scroller = row?.parentElement;
      if (row && scroller) {
        const top =
          row.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop;
        const visible = top >= scroller.scrollTop && top + row.offsetHeight <= scroller.scrollTop + scroller.clientHeight;
        if (!visible) scroller.scrollTo({ top: top + row.offsetHeight - scroller.clientHeight, behavior: 'smooth' });
      }
    }
    prevLengthRef.current = announcements.length;
  }, [announcements.length]);

  const { active, scheduled } = groupRows(announcements);
  const hasScheduled = scheduled.length > 0;
  const isEmpty = announcements.length === 0;
  // Ended rows keep their place in the rotation section but are not on air,
  // so they are counted apart rather than inflating the live number.
  const liveCount = active.filter((row) => row.state === 'active').length;
  const endedCount = active.length - liveCount;

  function editRow(index: number) {
    if (selectedIndex === index) return clearSelection();
    const html = loadAnnouncementIntoSelection(index);
    if (richEditorRef.current) {
      richEditorRef.current.innerHTML = html;
      richEditorRef.current.blur();
    }
    window.getSelection()?.removeAllRanges();
    detectFormatsForSelectMode(html);
  }

  function renderRow(row: ListRow) {
    const { message, index, state } = row;
    const invalid = isInvalidRange(message.startDate, message.endDate);
    // Scheduled rows are ordered by the calendar, so they are never dragged.
    const canDrag = !locked && state !== 'scheduled';
    const text = stripHtml(message.text);
    const timing = rowTiming(message, state);
    const hasStagedEdit = stagedIndex === index;

    const tone = invalid
      ? 'border-red-500/60 bg-red-500/5'
      : selectedIndex === index
        ? 'border-primary/80 bg-primary/10'
        : state === 'scheduled'
          ? 'border-amber-500/25 bg-amber-500/5 hover:bg-amber-500/10'
          : 'border-border bg-on-surface/[0.03] hover:bg-on-surface/5 hover:border-on-surface/20';

    return (
      <div
        key={index}
        data-row-index={index}
        draggable={canDrag}
        onDragStart={canDrag ? (e) => {
          setDraggedIndex(index);
          e.dataTransfer.effectAllowed = 'move';
        } : undefined}
        onDragOver={canDrag ? (e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
        } : undefined}
        onDrop={canDrag ? (e) => {
          e.preventDefault();
          if (draggedIndex !== null) reorderAnnouncements(draggedIndex, index);
          setDraggedIndex(null);
        } : undefined}
        onDragEnd={canDrag ? () => setDraggedIndex(null) : undefined}
        // The menu opens from the ⋮ button only. Opening it on hover popped a
        // menu on every row the pointer crossed on its way down the list.
        onMouseEnter={locked ? undefined : cancelCloseActionMenu}
        onMouseLeave={locked ? undefined : scheduleCloseActionMenu}
        onClick={locked ? undefined : () => editRow(index)}
        title={
          invalid
            ? 'This message ends before it starts — open it and fix or clear the schedule.'
            : hasStagedEdit
              ? 'An edit to this message is staged. It changes here when you publish.'
              : undefined
        }
        className={`group mb-1.5 last:mb-0 flex h-9 shrink-0 items-center rounded-lg border px-3 text-xs shadow-[0_1px_1px_rgb(0_0_0/0.03)] transition-all duration-150 ${tone} ${
          hasStagedEdit ? 'border-dashed !border-primary/60' : ''
        } ${locked ? 'cursor-default' : 'cursor-pointer'} ${draggedIndex === index ? 'opacity-60' : ''}`}
      >
        {/* Col 1 — drag handle, on every row. Where dragging isn't allowed it
            stays, dimmed and with a not-allowed cursor, rather than vanishing:
            an empty column read as the handle having been removed. */}
        <div
          className="flex w-5 shrink-0 justify-center"
          title={
            canDrag
              ? 'Drag to reorder'
              : state === 'scheduled'
                ? 'Scheduled messages are ordered by start date'
                : 'Publish or discard the staged message to reorder'
          }
        >
          <GripVertical
            className={`h-3.5 w-3.5 transition-colors ${
              canDrag
                ? 'cursor-grab text-on-surface-variant/60 hover:text-on-surface active:cursor-grabbing'
                : 'cursor-not-allowed text-on-surface-variant/20'
            }`}
            aria-hidden="true"
          />
        </div>

        {/* Col 2 — message, clipped to one line */}
        <div
          className={`min-w-0 flex-1 truncate pr-2 text-xs font-medium ${state === 'ended' ? 'text-on-surface-variant' : 'text-on-surface'}`}
          title={text}
        >
          {text}
        </div>

        {/* Col 3 — status and timing */}
        <div className="flex shrink-0 items-center gap-2">
          <StatusBadge kind={invalid ? 'invalid' : state} />
          {timing && (
            <>
              <span className="text-on-surface-variant/40" aria-hidden="true">•</span>
              <span className="max-w-[160px] truncate text-[11px] text-on-surface-variant">{timing}</span>
            </>
          )}
        </div>

        {/* Col 4 — row menu. Hidden while the list is locked. */}
        <div className="flex w-7 shrink-0 justify-end">
          {!locked && (
            <button
              type="button"
              data-action-btn
              onClick={(e) => {
                e.stopPropagation();
                openActionMenu(index, e.currentTarget);
              }}
              className="rounded-md p-1 text-on-surface-variant/50 transition-colors hover:bg-on-surface/5 hover:text-on-surface"
              title="More options"
            >
              <MoreVertical className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      {/*
        Capped, not fixed: at most 415px, and never under 180px. Side by side,
        the grid stretches it to the editor's 415px; stacked on a narrow
        screen, it hugs its rows.

          card 415 − border 2 − padding 60 − header 52 − divider 41 − footer 28
            = 232 for the body (sized to the live-only view, exactly)

        With both sections: pb 8 + label 20 + two rows 78 + divider 25
          + label 20 + two rows 78 = 229  → 3px to spare
        Live only: pb 8 + label 20 + five rows 204 = 232  → exact fit
      */}
      <div ref={panelRef} className="box-border flex h-full min-h-[180px] max-h-[415px] flex-col rounded-2xl border border-border campaign-card-surface px-6 py-[30px] shadow-sm transition-all hover:border-primary/70 hover:shadow-md hover:shadow-primary/20">

        {/* Header — identical to the editor card's, so the two titles and
            divider lines sit level across the pair. */}
        <div className="flex shrink-0 flex-col gap-1">
          <h4 className="text-xl font-bold leading-[28px] text-on-surface">
            Manage Announcements
          </h4>
          <p className="text-sm leading-[20px] text-on-surface-variant">Your messages, in the order they rotate.</p>
        </div>
        <div className="my-5 h-[1px] w-full shrink-0 bg-border" />

        {/*
          Body. Each section scrolls on its own, so Scheduled never gets pushed
          out of sight by a long active list: it is pinned at the bottom, sized
          to its rows up to one row plus a sliver of the next (the sliver is the
          cue that it scrolls), and Active Now takes whatever height is left.
          Section labels sit outside the scrollers so they never scroll away.
        */}
        <div className="flex min-h-0 flex-1 flex-col pb-2">
          {isEmpty ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-1 text-center">
              <p className="text-xs font-medium text-on-surface">Published messages will appear here.</p>
              <p className="text-[11px] text-on-surface-variant">Write one on the left, stage it, then publish.</p>
            </div>
          ) : (
            <>
              <SectionLabel tone={hasScheduled ? 'active' : 'neutral'}>
                Live now ({liveCount}){endedCount > 0 && ` · ${endedCount} ended`}
              </SectionLabel>
              {/* Whole rows only (36px rows, 6px gaps), never a half-cut one:
                  two when Scheduled sits below (2×36 + 6 = 78), five on its
                  own (5×36 + 4×6 = 204). The count in the label says the rest. */}
              <div
                className={`campaign-custom-scrollbar flex-none overflow-y-auto pr-1 ${hasScheduled ? 'max-h-[78px]' : 'max-h-[204px]'}`}
                style={{ scrollbarGutter: 'stable' }}
              >
                {active.map(renderRow)}
              </div>

              {hasScheduled && (
                <div className="shrink-0">
                  <div className="my-3 border-b border-dashed border-border" />
                  <SectionLabel tone="scheduled">Scheduled ({scheduled.length})</SectionLabel>
                  {/* Two whole rows (2×36 + 6 = 78) of the three allowed; the
                      third scrolls. One row hid too much behind a tiny scroller. */}
                  <div
                    className="campaign-custom-scrollbar max-h-[78px] overflow-y-auto pr-1"
                    style={{ scrollbarGutter: 'stable' }}
                  >
                    {scheduled.map(renderRow)}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer — pinned under the scroll */}
        {!isEmpty && (
          <div className="flex h-7 shrink-0 items-center justify-between gap-3 border-t border-border pt-2 text-[11px] font-medium text-on-surface-variant">
            {/* The lock note lives here rather than above the rows: in the body
                it cost 24px and pushed the third row out of view. */}
            {locked ? (
              <span className="flex min-w-0 items-center gap-1.5">
                <Lock className="h-3 w-3 shrink-0" />
                <span className="truncate">Publish or discard the staged message to change this list.</span>
              </span>
            ) : hasScheduled ? (
              <span className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
                {liveCount} Live
                <span className="text-on-surface-variant/40" aria-hidden="true">•</span>
                <span className="h-1.5 w-1.5 rounded-full bg-amber-500" aria-hidden="true" />
                {scheduled.length} Scheduled
              </span>
            ) : (
              <span className="flex items-center gap-1.5">
                <Lightbulb className="h-3 w-3 shrink-0" />
                Sequence position defines rotation priority.
              </span>
            )}

          </div>
        )}
      </div>

    </div>
  );
}
