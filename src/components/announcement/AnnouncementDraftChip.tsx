'use client';

import { useEffect, useState } from 'react';
import { CalendarClock, Clock, Link2, Minus, Pencil, Plus, Rocket, Trash2 } from 'lucide-react';
import type { Announcement } from '@/types/campaign';
import { chipExcerpt, describeWindow, startsLater } from '@/lib/announcement/stagedDraft';

interface AnnouncementDraftChipProps {
  staged: Announcement;
  /** True when this will replace a published message instead of adding one. */
  replacing?: boolean;
  onEdit: () => void;
  onDiscard: () => void;
  onPublish: () => void;
  publishing?: boolean;
  /**
   * Order picker for a new live message: where it will sit, 1 = top.
   * Omitted for edits (they keep their place) and upcoming messages (ordered
   * by start date).
   */
  position?: {
    value: number;
    /** Live messages + 1 — the slot after the last one. */
    max: number;
    onChange: (value: number) => void;
  };
}

/**
 * The staged message, shown in place of the input once it has been added.
 *
 * It stands in for the editor rather than sitting beside it: while a message
 * is staged there is nothing to type, and the three actions here are the only
 * ways forward.
 *
 * It fills the card as a review step — the whole message, when it runs and
 * where it links, with the action pinned at the bottom — rather than a small
 * box floating above empty space. The message is shown as plain text: its
 * colours are chosen for the bar's background and can be unreadable here.
 */
export function AnnouncementDraftChip({
  staged,
  replacing = false,
  onEdit,
  onDiscard,
  onPublish,
  publishing = false,
  position,
}: AnnouncementDraftChipProps) {
  /**
   * A future-dated message is not published into view — it is scheduled. The
   * chip says so, and its action says what will actually happen, so the user
   * is never told "publish now" about something that goes out next week.
   */
  const scheduled = startsLater(staged.startDate);
  const ActionIcon = scheduled ? CalendarClock : Rocket;
  const actionLabel = scheduled
    ? 'Schedule message'
    : replacing
      ? 'Publish changes now'
      : 'Publish message now';
  const busyLabel = scheduled ? 'Scheduling…' : 'Publishing…';

  return (
    <div className="flex min-h-0 flex-1 flex-col rounded-xl border border-amber-400/40 bg-amber-400/5 p-3">
      <div className="flex shrink-0 items-start justify-between gap-3">
        <span className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-amber-500">
          <span className="h-2 w-2 rounded-full bg-amber-400" aria-hidden="true" />
          {scheduled ? 'Ready to schedule' : 'Ready to publish'}
          {replacing && (
            <span className="font-normal normal-case tracking-normal text-on-surface-variant/70">
              · edit of a published message
            </span>
          )}
        </span>

        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={onEdit}
            disabled={publishing}
            className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium text-on-surface-variant transition-colors hover:text-primary disabled:opacity-50"
          >
            <Pencil className="h-3.5 w-3.5" />
            Edit
          </button>
          <button
            type="button"
            onClick={onDiscard}
            disabled={publishing}
            className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium text-on-surface-variant transition-colors hover:text-red-500 disabled:opacity-50"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Discard
          </button>
        </div>
      </div>

      {/* The whole message, not a snippet — this is the last look before it goes out. */}
      <p className="mt-2 flex min-h-10 shrink-0 items-center break-words rounded-lg border border-border bg-surface-subtle px-3 py-2 text-sm leading-5 text-on-surface">
        <span className="line-clamp-2">{chipExcerpt(staged.text, 120)}</span>
      </p>

      {/* Two columns, so the summary spans the card instead of leaving the
          right half empty. A long link truncates; hover shows it in full. */}
      <dl className="mt-2 grid shrink-0 grid-cols-2 gap-4 text-xs">
        <div className="min-w-0">
          <dt className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-on-surface-variant/60">When</dt>
          <dd className="flex items-center gap-1.5 text-on-surface-variant">
            {scheduled
              ? <CalendarClock className="h-3.5 w-3.5 shrink-0" />
              : <Clock className="h-3.5 w-3.5 shrink-0" />}
            <span className="truncate">{describeWindow(staged.startDate, staged.endDate)}</span>
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-on-surface-variant/60">Link</dt>
          <dd className="flex min-w-0 items-center gap-1.5 text-on-surface-variant">
            <Link2 className="h-3.5 w-3.5 shrink-0" />
            {staged.url
              ? <span className="truncate" title={staged.url}>{staged.url}</span>
              : <span className="text-on-surface-variant/60">No link</span>}
          </dd>
        </div>
      </dl>

      {/* Pinned to the bottom of the card, however long the message is. */}
      <div className="mt-auto shrink-0 border-t border-amber-400/20 pt-2">
        <div className="flex items-center gap-3">
        {position && position.max > 1 && (
          // Position: − / + around plain text, one control beside Publish.
          <div className="flex h-9 min-w-0 flex-1 items-center justify-between rounded-md border border-on-surface/25 text-on-surface-variant" role="group" aria-label="Order">
            <button
              type="button"
              onClick={() => position.onChange(position.value - 1)}
              disabled={publishing || position.value <= 1}
              aria-label="Move up in the order"
              className="flex h-full items-center px-3 transition-colors hover:text-primary disabled:cursor-not-allowed disabled:opacity-30"
            >
              <Minus className="h-3.5 w-3.5" />
            </button>
            {/* The number reads as plain text but can be typed into, so a far
                position is one entry rather than many clicks. */}
            <span className="flex items-center text-sm font-medium tabular-nums text-on-surface">
              Order
              <PositionInput position={position} disabled={publishing} />
              of {position.max}
            </span>
            <button
              type="button"
              onClick={() => position.onChange(position.value + 1)}
              disabled={publishing || position.value >= position.max}
              aria-label="Move down in the order"
              className="flex h-full items-center px-3 transition-colors hover:text-primary disabled:cursor-not-allowed disabled:opacity-30"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
        <button
          type="button"
          onClick={onPublish}
          disabled={publishing}
          className="inline-flex h-9 min-w-0 flex-1 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-on-primary shadow-sm transition-opacity hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <ActionIcon className="h-4 w-4" />
          {publishing ? busyLabel : actionLabel}
        </button>
        </div>
      </div>
    </div>
  );
}

/**
 * The typeable number. Applies as you type — no Enter to discover — and falls
 * back to the last valid position if left empty or out of range.
 */
function PositionInput({
  position,
  disabled,
}: {
  position: { value: number; max: number; onChange: (value: number) => void };
  disabled: boolean;
}) {
  const [text, setText] = useState(String(position.value));
  // Follow − / + presses made while not typing.
  useEffect(() => setText(String(position.value)), [position.value]);

  return (
    <input
      type="text"
      inputMode="numeric"
      value={text}
      disabled={disabled}
      aria-label={`Order, 1 to ${position.max}`}
      title="Click to type a number"
      onFocus={(e) => e.target.select()}
      onChange={(e) => {
        const digits = e.target.value.replace(/\D/g, '');
        setText(digits);
        const n = parseInt(digits, 10);
        if (n >= 1 && n <= position.max) position.onChange(n);
      }}
      onBlur={() => setText(String(position.value))}
      style={{ width: `${String(position.max).length + 1}ch` }}
      className="mx-1 cursor-text border-b-2 border-primary/60 bg-transparent text-center font-semibold text-primary outline-none hover:border-primary focus:border-primary"
    />
  );
}
