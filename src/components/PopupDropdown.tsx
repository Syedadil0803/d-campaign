'use client';

import { createPortal } from 'react-dom';
import { useEffect, useRef, useState } from 'react';
import type { ReactNode, RefObject } from 'react';

export type PopupDropdownOption = {
  label: string;
  value: string;
  /** Leading visual — the country picker passes a flag image. */
  icon?: React.ReactNode;
  /** Trailing detail, right-aligned: the dial code, a count, a hint. */
  meta?: string;
  /** Extra text the filter should match but the row doesn't display. */
  searchText?: string;
};

interface PopupDropdownProps {
  label: string;
  value: string;
  options: PopupDropdownOption[];
  open: boolean;
  onOpen: () => void;
  onSelect: (value: string) => void;
  onHover?: (value: string) => void;
  onHoverEnd?: () => void;
  buttonRef: RefObject<HTMLButtonElement | null>;
  menuRef: RefObject<HTMLDivElement | null>;
  menuPosition: { top: number; left: number; width: number } | null;
  arrowDirection?: 'down' | 'right';
  compact?: boolean;
  // Optional overrides so the trigger can line up with neighbouring fields
  // (e.g. match a color-picker's label style and height).
  labelClassName?: string;
  buttonExtraClassName?: string;
  /** Replaces the trigger's own content — e.g. a flag beside a dial code. */
  triggerContent?: ReactNode;
  /** Replaces the trigger's base classes outright, for a trigger that has to
   *  sit inside another control's shell rather than look like a field. */
  buttonClassName?: string;
  /** Caps the menu and lets it scroll. Needed once a list runs to 66 rows. */
  menuMaxHeight?: number;
  /** Open upward when there isn't room below — long lists near the fold. */
  flip?: boolean;
  /**
   * Adds a filter box above the list. Matches label, meta and searchText, so a
   * country picker can be searched by name as well as by dialling code.
   * Worth showing only past a handful of rows.
   */
  searchable?: boolean;
  searchPlaceholder?: string;
}

export function PopupDropdown({
  label,
  value,
  options,
  open,
  onOpen,
  onSelect,
  onHover,
  onHoverEnd,
  buttonRef,
  menuRef,
  menuPosition,
  arrowDirection = 'down',
  compact = false,
  labelClassName,
  buttonExtraClassName,
  triggerContent,
  buttonClassName,
  menuMaxHeight,
  flip = false,
  searchable = false,
  searchPlaceholder = 'Search…',
}: PopupDropdownProps) {
  const [query, setQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);
  const selectedLabel = options.find((option) => option.value === value)?.label ?? value;
  const popupWidth = menuPosition?.width ?? 260;
  const [livePosition, setLivePosition] = useState<{
    top: number;
    left: number;
    width: number;
    /** Set instead of top for an upward menu — see placeVertically. */
    bottom?: number;
  } | null>(menuPosition);
  const initialButtonRectRef = useRef<{ top: number; left: number } | null>(null);
  /** Which way this menu opened; null until the first placement decides. */
  const opensUpwardRef = useRef<boolean | null>(null);
  const initialMenuPosRef = useRef<{ top: number; left: number; width: number } | null>(null);

  /**
   * Below the trigger, or above it when there isn't room.
   *
   * Only matters for long lists: a 66-row country list opened at the bottom of
   * the column ran off the viewport, and the menu is portalled to the body so
   * nothing clipped or scrolled it back into view.
   */
  function placeVertically(rect: DOMRect): number {
    const below = rect.bottom + 6;
    if (!flip) return below;

    const height = menuRef.current?.offsetHeight ?? menuMaxHeight ?? 0;

    /**
     * The side is chosen once, when the menu opens, and held for as long as
     * it stays open.
     *
     * Re-deciding on every reflow made a filtered list jump: narrowing 66 rows
     * to one freed up room below, so the menu that had opened upward flipped
     * under the trigger mid-search — the list moving out from under the cursor
     * while typing. Only the offset is recomputed after that, so an upward
     * menu stays glued to the top of the trigger as it shrinks.
     */
    if (opensUpwardRef.current === null) {
      const room = window.innerHeight - rect.bottom - 12;
      opensUpwardRef.current = Boolean(height) && room < height;
    }

    if (opensUpwardRef.current) {
      // Anchored by its bottom edge, not by top-minus-height: measuring the
      // height means the menu shrinks away from the trigger when the list is
      // filtered, leaving a gap the size of the rows that went. Pinning the
      // bottom lets it grow and shrink upward, always touching the trigger.
      return -1;
    }
    return below;
  }

  useEffect(() => {
    setLivePosition(menuPosition);
  }, [menuPosition]);

  // A filter that survives closing would silently hide most of the list the
  // next time the menu opened.
  useEffect(() => {
    if (!open) {
      setQuery('');
      opensUpwardRef.current = null;
      return;
    }
    if (searchable) {
      const id = window.setTimeout(() => searchInputRef.current?.focus(), 0);
      return () => window.clearTimeout(id);
    }
  }, [open, searchable]);

  const needle = query.trim().toLowerCase();
  /**
   * `searchText` wins outright when a row supplies one: the country pickers
   * want name-only matching, and the two of them disagree about which slot
   * the name is in — one shows the name and the code in meta, the other the
   * reverse. Matching label+meta would have made both searchable by code.
   */
  const visibleOptions = needle
    ? options.filter((o) =>
        (o.searchText ?? `${o.label} ${o.meta ?? ''}`)
          .toLowerCase()
          .includes(needle),
      )
    : options;

  useEffect(() => {
    if (!open) return;

    const initialRect = buttonRef.current?.getBoundingClientRect();
    // A flipping menu can't use the caller's anchor: that path replays the
    // opening offset on every scroll, which would pin an upward menu below the
    // trigger again. It re-measures instead.
    if (initialRect && menuPosition && !flip) {
      initialButtonRectRef.current = { top: initialRect.top, left: initialRect.left };
      initialMenuPosRef.current = { ...menuPosition };
    }

    const updatePosition = () => {
      const rect = buttonRef.current?.getBoundingClientRect();
      if (!rect) return;

      // Preserve original popup placement (e.g., right-side custom anchor) and
      // move it by the same delta as the trigger button while scrolling.
      if (initialButtonRectRef.current && initialMenuPosRef.current) {
        const deltaTop = rect.top - initialButtonRectRef.current.top;
        const deltaLeft = rect.left - initialButtonRectRef.current.left;
        setLivePosition({
          top: initialMenuPosRef.current.top + deltaTop,
          left: initialMenuPosRef.current.left + deltaLeft,
          width: initialMenuPosRef.current.width,
        });
        return;
      }

      // Fallback when no initial anchor info is provided.
      const top = placeVertically(rect);
      setLivePosition(
        top === -1
          ? {
              top: 0,
              bottom: Math.max(8, window.innerHeight - rect.top + 6),
              left: rect.left,
              width: menuPosition?.width ?? rect.width,
            }
          : { top, left: rect.left, width: menuPosition?.width ?? rect.width },
      );
    };

    updatePosition();

    /**
     * An upward menu is placed from its own height, so it has to be re-placed
     * whenever that height changes. Filtering does exactly that: narrowing 66
     * rows to one left the menu floating where the full list used to start,
     * with a gap the size of the rows that had been filtered away.
     */
    const observer =
      typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(() => updatePosition())
        : null;
    if (observer && menuRef.current) observer.observe(menuRef.current);

    window.addEventListener('scroll', updatePosition, true);
    window.addEventListener('resize', updatePosition);
    return () => {
      observer?.disconnect();
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
      initialButtonRectRef.current = null;
      initialMenuPosRef.current = null;
    };
  }, [open, buttonRef, menuPosition?.width]);

  return (
    <div>
      <label className={labelClassName ?? (compact ? 'block text-[10px] text-on-surface-variant mb-0.5' : 'block text-xs text-on-surface-variant mb-1')}>{label}</label>
      <button
        ref={buttonRef}
        type="button"
        onMouseDown={(e) => {
          e.preventDefault();
          onOpen();
        }}
        className={`${buttonClassName ?? (compact
          ? 'flex h-9 w-full items-center justify-between gap-2 rounded-md border border-white/10 bg-black/10 px-2 py-1 text-left text-xs text-on-surface shadow-2xl backdrop-blur-md transition-colors hover:border-primary/70 hover:bg-black/10'
          : 'flex w-full items-center justify-between gap-2 rounded-md border border-white/10 bg-black/10 p-2 text-left text-sm text-on-surface shadow-2xl backdrop-blur-md transition-colors hover:border-primary/70 hover:bg-black/10')}${buttonExtraClassName ? ' ' + buttonExtraClassName : ''}`}
      >
        {triggerContent ?? <span className="truncate">{selectedLabel}</span>}
        <svg
          className={`h-4 w-4 flex-shrink-0 text-on-surface-variant transition-transform duration-200 ${arrowDirection === 'right' ? (open ? 'rotate-180' : 'rotate-0') : (open ? 'rotate-180' : 'rotate-0')}`}
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
        >
          {arrowDirection === 'right' ? (
            <path d="M8 6l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
          ) : (
            <path d="M6 8l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
          )}
        </svg>
      </button>

      {open && typeof document !== 'undefined' && createPortal(
        <div
          ref={menuRef}
          onMouseDown={(e) => e.stopPropagation()}
          onMouseLeave={() => onHoverEnd?.()}
          style={{
            position: 'fixed',
            zIndex: 9999,
            ...(livePosition?.bottom !== undefined
              ? { bottom: livePosition.bottom }
              : { top: livePosition?.top ?? menuPosition?.top ?? 0 }),
            left: livePosition?.left ?? menuPosition?.left ?? 0,
            minWidth: `${livePosition?.width ?? popupWidth}px`,
            width: 'auto',
            ...(menuMaxHeight
              ? { maxHeight: `${menuMaxHeight}px`, overflowY: 'auto' as const }
              : null),
          }}
          className={`bg-black/10 backdrop-blur-md border border-white/10 shadow-2xl rounded-xl ${menuMaxHeight ? 'p-1 campaign-custom-scrollbar' : 'p-3'}`}
        >
          {searchable && (
            <div className="sticky top-0 z-10 mb-0.5 bg-surface-elevated">
              <input
                ref={searchInputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onMouseDown={(e) => e.stopPropagation()}
                onKeyDown={(e) => {
                  // Enter on a single match picks it — the common case after
                  // typing a country name.
                  if (e.key === 'Enter' && visibleOptions.length === 1) {
                    e.preventDefault();
                    onSelect(visibleOptions[0].value);
                  }
                }}
                placeholder={searchPlaceholder}
                className="w-full rounded-md border border-border bg-surface px-2 py-1 text-sm text-on-surface outline-none placeholder:text-on-surface-variant focus:border-primary/70"
              />
            </div>
          )}
          {searchable && visibleOptions.length === 0 && (
            <p className="px-3 py-2 text-sm text-on-surface-variant">
              No matches for &ldquo;{query.trim()}&rdquo;
            </p>
          )}
          {visibleOptions.map((option) => (
            <div
              key={option.value}
              role="button"
              tabIndex={0}
              style={{ borderRadius: '0.375rem' }}
              onMouseEnter={() => onHover?.(option.value)}
              onMouseDown={(e) => {
                e.preventDefault();
                onSelect(option.value);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onSelect(option.value);
                }
              }}
              className={`flex w-full cursor-pointer items-center gap-2 rounded-md border-0 bg-transparent px-2.5 py-1.5 text-left text-sm whitespace-nowrap transition-colors hover:bg-surface-subtle ${option.value === value ? 'text-primary font-semibold' : 'text-on-surface'}`}
            >
              {option.icon}
              <span className="min-w-0 flex-1 truncate">{option.label}</span>
              {option.meta && (
                <span className="shrink-0 tabular-nums text-on-surface-variant">
                  {option.meta}
                </span>
              )}
            </div>
          ))}
        </div>,
        document.body
      )}
    </div>
  );
}
