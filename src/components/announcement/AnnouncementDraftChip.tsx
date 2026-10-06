'use client';

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { CalendarClock, ChevronDown, Clock, Link2, Pencil, Rocket, Trash2 } from 'lucide-react';
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
    /** Live messages in order, for the slot menu's labels. */
    liveTexts: string[];
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
        {position && position.max > 1 ? (
          <SplitPublish
            position={position}
            publishing={publishing}
            onPublish={onPublish}
            icon={<ActionIcon className="h-4 w-4" />}
          />
        ) : (
          <button
            type="button"
            onClick={onPublish}
            disabled={publishing}
            className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-on-primary shadow-sm transition-opacity hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <ActionIcon className="h-4 w-4" />
            {publishing ? busyLabel : actionLabel}
          </button>
        )}
      </div>
    </div>
  );
}


type PositionProp = NonNullable<AnnouncementDraftChipProps['position']>;

/** Short, one-line label for a message in the slot menu. */
function shortText(html: string): string {
  return chipExcerpt(html, 24);
}

/**
 * Split-action button: the left zone publishes to the chosen slot, the right
 * chevron opens the slot menu. Each zone has its own hover, with a divider
 * between them, so they never read as one button. The menu floats over the
 * page (portal) and never changes the card's height; it opens downward and
 * flips upward when there isn't room below.
 */
function SplitPublish({
  position,
  publishing,
  onPublish,
  icon,
}: {
  position: PositionProp;
  publishing: boolean;
  onPublish: () => void;
  icon: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [place, setPlace] = useState<{ right: number; bottom: number; width: number } | null>(null);
  const anchorRef = useRef<HTMLDivElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const { value, max, liveTexts } = position;

  const slotLabel = (n: number) =>
    n === 1 ? `Slot #1 (Top)` : n === max ? `Slot #${n} (End)` : `Slot #${n} (After ${shortText(liveTexts[n - 2])})`;

  // Opens above the button, lined up with its right edge (the ▾), floating
  // over the page so the card never grows.
  useLayoutEffect(() => {
    if (!open || !anchorRef.current) return;
    const r = anchorRef.current.getBoundingClientRect();
    setPlace({ right: window.innerWidth - r.right, bottom: window.innerHeight - r.top + 8, width: Math.round(r.width * 0.75) });
  }, [open]);

  // Close on outside click, Escape, or scroll/resize (the anchor moves).
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!menuRef.current?.contains(t) && !anchorRef.current?.contains(t)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    const close = () => setOpen(false);
    // Scrolling the menu's own list is fine; only the page moving the
    // button away closes it.
    const onScroll = (e: Event) => { if (!menuRef.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', close);
    window.addEventListener('scroll', onScroll, true);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', close);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [open]);

  return (
    <>
      <div ref={anchorRef} className="flex h-9 w-full overflow-hidden rounded-md bg-primary text-on-primary shadow-sm">
        {/* Zone A — publish */}
        <button
          type="button"
          onClick={onPublish}
          disabled={publishing}
          className="flex min-w-0 flex-1 items-center justify-center gap-2 px-4 text-sm font-semibold transition-colors hover:bg-black/20 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {icon}
          {publishing ? (
            <span className="truncate">Publishing to Slot #{value}…</span>
          ) : (
            <span className="flex min-w-0 items-baseline gap-1">
              <span className="shrink-0">Publish as</span>
              <span className="truncate">{slotLabel(value)}</span>
            </span>
          )}
        </button>
        {/* Zone B — slot menu */}
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          disabled={publishing}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-label="Change position in rotation"
          title="Change position in rotation"
          className="flex w-[72px] shrink-0 items-center justify-center border-l border-white/25 transition-colors hover:bg-black/25 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <ChevronDown className={`h-4 w-4 transition-transform ${open ? '' : 'rotate-180'}`} />
        </button>
      </div>

      {open && typeof document !== 'undefined' && createPortal(
        <div
          ref={menuRef}
          style={{ position: 'fixed', right: place?.right ?? -9999, bottom: place?.bottom, width: place?.width, zIndex: 60 }}
          className="overflow-hidden rounded-xl border border-border bg-surface-elevated shadow-xl"
        >
          {/* The heading sits outside the scroll, so it stays put and the
              options never slide under it. */}
          <p className="border-b border-border px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Select rotation slot</p>
          <div role="listbox" aria-label="Select rotation slot" className="campaign-custom-scrollbar max-h-[172px] overflow-y-auto">
          {Array.from({ length: max }, (_, i) => i + 1).map((n) => {
            const selected = n === value;
            const pushed = liveTexts[n - 1];
            const what =
              n === 1 ? 'Insert at start (Default)'
                : n === max ? 'Insert at end of rotation'
                  : `Insert after "${shortText(liveTexts[n - 2])}"`;
            return (
              <button
                key={n}
                type="button"
                role="option"
                aria-selected={selected}
                onClick={() => { position.onChange(n); setOpen(false); }}
                className={`flex w-full items-start gap-3 border-t border-border px-3 py-2.5 text-left transition-colors first:border-t-0 hover:bg-on-surface/5 ${selected ? 'bg-primary/5' : ''}`}
              >
                <span className={`mt-0.5 flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border ${selected ? 'border-primary' : 'border-on-surface/30'}`}>
                  {selected && <span className="h-1.5 w-1.5 rounded-full bg-primary" />}
                </span>
                <span className="min-w-0 flex-1 text-xs">
                  <span className="block">
                    <span className="font-semibold text-on-surface">
                      Slot #{n}{n === 1 ? ' (Top)' : n === max ? ' (End)' : ''}
                    </span>
                    <span className="text-on-surface-variant"> ── {what}</span>
                  </span>
                  {pushed && n < max && (
                    <span className="mt-0.5 block truncate text-[11px] text-on-surface-variant/70">
                      └─ Will push &quot;{shortText(pushed)}&quot; to #{n + 1}
                    </span>
                  )}
                </span>
              </button>
            );
          })}
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
