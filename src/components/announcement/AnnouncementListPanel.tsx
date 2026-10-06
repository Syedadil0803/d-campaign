'use client';

import { useEffect, useRef, useState } from 'react';
import { CalendarClock, CalendarRange, Clock, Infinity as InfinityIcon, Lightbulb, Link2, Lock, Pencil, Trash2, TriangleAlert, X } from 'lucide-react';
import type { Announcement } from '@/types/campaign';
import type { CampaignConfig } from '@/types/campaign';
import { stripHtml } from '@/lib/utils';
import { isInvalidRange } from '@/lib/dateRange';
import { groupRows, rowState, rowDates, rowTiming, type ListRow, type RowState } from '@/lib/announcement/listSections';

/** One small icon per kind of date: upcoming, a window, open-ended, or none. */
function dateIcon(message: Announcement, state: RowState) {
  if (!message.startDate && !message.endDate) return InfinityIcon;
  if (state === 'scheduled') return CalendarClock;
  if (message.startDate && message.endDate) return CalendarRange;
  return Clock;
}

interface AnnouncementListPanelProps {
  config: CampaignConfig;
  /** The row loaded in the editor, if any. */
  selectedIndex: number | null;
  reorderAnnouncements: (fromIndex: number, toIndex: number) => void;
  draggedIndex: number | null;
  setDraggedIndex: (index: number | null) => void;
  /** Loads a row into the editor. */
  onEdit: (index: number) => void;
  /** Stops editing: clears the editor and deselects the row. */
  onCancelEdit: () => void;
  /** Deletes a row (undoable from its toast). */
  onDelete: (index: number) => void;
  /**
   * True while a message is staged. The list goes read-only: a staged edit
   * remembers its row by position, so deleting or dragging any row would shift
   * that position and Publish would overwrite the wrong message. Inspecting is
   * still allowed — it changes nothing.
   */
  locked: boolean;
  /** The row a staged edit will replace, so it can be marked. */
  stagedIndex: number | null;
}

type Filter = 'active' | 'scheduled';

/**
 * Status is carried by a small dot only; everything else stays in the app's
 * neutral and primary tokens. Red is kept for invalid dates, being an error.
 */
const STATE: Record<RowState | 'invalid', { label: string; dot: string }> = {
  active: { label: 'Active on site', dot: 'bg-emerald-500' },
  scheduled: { label: 'Upcoming', dot: 'bg-amber-500' },
  ended: { label: 'Ended', dot: 'bg-on-surface-variant/40' },
  invalid: { label: 'Invalid dates', dot: 'bg-red-500' },
};

/**
 * Manage Announcements: a master-detail card. The left pane lists and filters
 * the messages (dragging a live one changes the rotation); the right pane
 * inspects the one picked and holds its actions.
 */
export function AnnouncementListPanel({
  config,
  selectedIndex,
  reorderAnnouncements,
  draggedIndex,
  setDraggedIndex,
  onEdit,
  onCancelEdit,
  onDelete,
  locked,
  stagedIndex,
}: AnnouncementListPanelProps) {
  const announcements = config.announcementBar.announcements;
  const [filter, setFilter] = useState<Filter>('active');
  const [inspectedIndex, setInspectedIndex] = useState<number | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const prevLengthRef = useRef(announcements.length);

  const { active, scheduled } = groupRows(announcements);
  const liveRows = active.filter((row) => row.state === 'active');
  const rows = filter === 'active' ? liveRows : scheduled;

  // The picked row, or the first one in view — the inspector is never blank
  // while there is something to show.
  const inspected = rows.find((row) => row.index === inspectedIndex) ?? rows[0] ?? null;
  const isEmpty = announcements.length === 0;

  /**
   * A newly published message is added at the top of the stored list. Show it: switch
   * to All (the current filter may hide it), inspect it, and scroll the list
   * to it — Scheduled sorts by date, so it is not necessarily last.
   */
  useEffect(() => {
    if (announcements.length > prevLengthRef.current) {
      const newIndex = 0; // new messages are added at the top
      // Open the tab that holds it, so an upcoming one isn't hidden.
      setFilter(rowState(announcements[0]) === 'scheduled' ? 'scheduled' : 'active');
      setInspectedIndex(newIndex);
      requestAnimationFrame(() => {
        const list = listRef.current;
        const row = list?.querySelector<HTMLElement>(`[data-row-index="${newIndex}"]`);
        if (list && row) {
          const top = row.getBoundingClientRect().top - list.getBoundingClientRect().top + list.scrollTop;
          list.scrollTo({ top: top + row.offsetHeight - list.clientHeight, behavior: 'smooth' });
        }
      });
    }
    prevLengthRef.current = announcements.length;
  }, [announcements]); // runs on edits too, but acts only when the list grew

  function renderRow(row: ListRow) {
    const { message, index, state } = row;
    const invalid = isInvalidRange(message.startDate, message.endDate);
    const look = STATE[invalid ? 'invalid' : state];
    // Scheduled rows are ordered by the calendar, so they are never dragged.
    const canDrag = !locked && state !== 'scheduled';
    const isInspected = inspected?.index === index;
    const timing = rowTiming(message, state);
    const DateIcon = dateIcon(message, state);

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
        onClick={() => setInspectedIndex(index)}
        title={canDrag ? 'Drag to change its place in the rotation' : undefined}
        className={`flex h-[50px] cursor-pointer flex-col justify-center rounded-lg border px-2 transition-colors ${
          isInspected
            ? 'border-primary/60 bg-primary/10'
            : 'border-transparent bg-on-surface/[0.03] hover:bg-on-surface/[0.06]'
        } ${stagedIndex === index ? 'outline outline-1 outline-dashed outline-primary/60' : ''} ${
          draggedIndex === index ? 'opacity-60' : ''
        }`}
      >
        <div className="flex items-center gap-1.5">
          <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${look.dot}`} aria-hidden="true" />
          <span className={`min-w-0 flex-1 truncate text-xs font-semibold ${state === 'ended' ? 'text-on-surface-variant' : 'text-on-surface'}`}>
            {stripHtml(message.text)}
          </span>
          {selectedIndex === index && (
            <span className="shrink-0 text-[9px] font-bold uppercase tracking-wide text-primary">Editing</span>
          )}
        </div>
        {/* Dates only. An undated message just runs, so it has no second line. */}
        {timing && (
          <div className={`mt-0.5 flex items-center gap-1 pl-3 text-[10px] ${invalid ? 'text-red-600 dark:text-red-400' : 'text-on-surface-variant'}`}>
            <DateIcon className="h-2.5 w-2.5 shrink-0" aria-hidden="true" />
            <span className="truncate">{timing}</span>
          </div>
        )}
      </div>
    );
  }

  function renderInspector(row: ListRow) {
    const { message, index, state } = row;
    const invalid = isInvalidRange(message.startDate, message.endDate);
    const look = STATE[invalid ? 'invalid' : state];
    const slot = liveRows.findIndex((r) => r.index === index);
    // A plain number in the order, 1 = top. A message that isn't running
    // (upcoming or ended) has no place in it yet, so it reads 0.
    const order = state === 'active' ? slot + 1 : 0;
    const DateIcon = dateIcon(message, state);

    return (
      <div className="flex min-h-0 flex-1 flex-col justify-between pl-1">
        {/* The whole message — up to the 120-character limit, which runs to
            three lines here — growing with it rather than clipping. The pane
            exists to read the message, so nothing else gets that height. */}
        <div className="rounded-xl border border-border bg-surface-subtle px-3 py-2.5">
          <p className="break-words text-xs font-semibold leading-snug text-on-surface">
            {stripHtml(message.text)}
          </p>
        </div>

        <dl className="space-y-1 text-[11px]">
          <div className="flex items-center justify-between gap-3">
            <dt className="text-on-surface-variant/70">Status</dt>
            <dd className={`flex items-center gap-1.5 font-medium ${invalid ? 'text-red-600 dark:text-red-400' : 'text-on-surface'}`}>
              {invalid
                ? <TriangleAlert className="h-3 w-3" />
                : <span className={`h-1.5 w-1.5 rounded-full ${look.dot}`} aria-hidden="true" />}
              {look.label}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="text-on-surface-variant/70">Dates</dt>
            <dd className="flex min-w-0 items-center gap-1 font-medium text-on-surface">
              <DateIcon className="h-3 w-3 shrink-0 text-on-surface-variant" />
              <span className="truncate" title={rowDates(message, state)}>{rowDates(message, state)}</span>
            </dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="text-on-surface-variant/70">Order</dt>
            <dd className="font-medium tabular-nums text-on-surface">{order}</dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="text-on-surface-variant/70">Link</dt>
            <dd className="flex min-w-0 items-center gap-1 font-medium text-on-surface">
              <Link2 className="h-3 w-3 shrink-0 text-on-surface-variant" />
              {message.url
                ? <span className="truncate" title={message.url}>{message.url}</span>
                : <span className="text-on-surface-variant/60">No link</span>}
            </dd>
          </div>
        </dl>

        <div className="flex items-center gap-2 border-t border-border pt-2">
          {selectedIndex === index ? (
            <button
              type="button"
              onClick={onCancelEdit}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-primary/10 py-1.5 text-xs font-semibold text-primary transition-colors hover:bg-primary/15"
            >
              <X className="h-3.5 w-3.5" />
              Cancel edit
            </button>
          ) : (
            <button
              type="button"
              disabled={locked}
              onClick={() => onEdit(index)}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-on-surface/5 py-1.5 text-xs font-semibold text-on-surface transition-colors hover:bg-on-surface/10 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Pencil className="h-3.5 w-3.5" />
              Edit
            </button>
          )}
          <button
            type="button"
            disabled={locked}
            onClick={() => onDelete(index)}
            title="Delete (Undo from the notice)"
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-on-surface/5 py-1.5 text-xs font-semibold text-on-surface transition-colors hover:bg-red-500/10 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete
          </button>
        </div>
      </div>
    );
  }

  const tabs: { value: Filter; label: string; dot?: string }[] = [
    { value: 'active', label: `Active ${liveRows.length}`, dot: 'bg-emerald-500' },
    { value: 'scheduled', label: `Upcoming ${scheduled.length}`, dot: 'bg-amber-500' },
  ];

  return (
    <div className="h-full w-full">
      <div className="box-border flex h-[370px] flex-col overflow-hidden rounded-2xl border border-border campaign-card-surface p-5 shadow-sm transition-all hover:border-primary/70 hover:shadow-md hover:shadow-primary/20">
        {/* Header — the original title and description, same as the editor
            card's, so the two titles and divider rules sit level. */}
        <div className="flex shrink-0 items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <h4 className="text-xl font-bold leading-[28px] text-on-surface">Manage Announcements</h4>
            <p className="text-sm leading-[20px] text-on-surface-variant">View, reorder, and manage your messages.</p>
          </div>
        </div>
        <div className="my-5 h-[1px] w-full shrink-0 bg-border" />

        {isEmpty ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-1 text-center">
            <p className="text-xs font-medium text-on-surface">Published messages will appear here.</p>
            <p className="text-[11px] text-on-surface-variant">Write one on the left, stage it, then publish.</p>
          </div>
        ) : (
          <div className="grid min-h-0 flex-1 grid-cols-12 gap-4 pb-3">
            {/* Left pane: filters and the list (5/12). */}
            <div className="col-span-5 flex min-h-0 flex-col border-r border-border pr-3">
              <div className="mb-2 flex shrink-0 items-center gap-1 rounded-lg bg-on-surface/5 p-0.5 text-[10px] font-semibold">
                {tabs.map((tab) => (
                  <button
                    key={tab.value}
                    type="button"
                    onClick={() => setFilter(tab.value)}
                    className={`flex min-w-0 flex-1 items-center justify-center gap-1 whitespace-nowrap rounded-md px-1 py-1 transition-colors ${
                      filter === tab.value
                        ? 'bg-surface-elevated text-on-surface shadow-sm'
                        : 'text-on-surface-variant hover:text-on-surface'
                    }`}
                  >
                    {tab.dot && <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${tab.dot}`} aria-hidden="true" />}
                    {tab.label}
                  </button>
                ))}
              </div>
              {/* Exactly three whole rows (3×50 + 2×6 = 162): the fourth sits fully
                  below the fold, never half-shown. */}
              <div ref={listRef} className="campaign-custom-scrollbar h-[162px] flex-none space-y-1.5 overflow-y-auto pr-1">
                {rows.length > 0
                  ? rows.map(renderRow)
                  : <p className="px-1 py-4 text-center text-[11px] text-on-surface-variant">Nothing here yet.</p>}
              </div>
            </div>

            {/* Right pane: the picked message (7/12). */}
            <div className="col-span-7 flex min-h-0 flex-col">
              {inspected
                ? renderInspector(inspected)
                : <p className="m-auto text-[11px] text-on-surface-variant">Pick a message to see it here.</p>}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex shrink-0 items-center justify-between gap-3 border-t border-border pt-2 text-[11px] leading-4 text-on-surface-variant">
          {locked ? (
            <span className="flex min-w-0 items-center gap-1.5">
              <Lock className="h-3 w-3 shrink-0" />
              <span className="truncate">Publish or discard the staged message to change this list.</span>
            </span>
          ) : (
            <span className="flex min-w-0 items-center gap-1.5">
              <Lightbulb className="h-3 w-3 shrink-0" />
              <span className="truncate">Drag active messages to change the rotation order.</span>
            </span>
          )}
          <span className="shrink-0 font-medium">{liveRows.length} active on site</span>
        </div>
      </div>
    </div>
  );
}
