'use client';

import { useEffect, useRef, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Clapperboard, Gift } from 'lucide-react';
import type { CampaignKind } from '@/types/campaign';
import { useAnchoredMenu } from '@/hooks/useAnchoredPopover';

/**
 * The campaign types, in menu order. Adding a type is one entry here: the
 * menu grows by one row and nothing on any page moves.
 */
const CAMPAIGN_TYPES: { kind: CampaignKind; label: string; Icon: typeof Gift }[] = [
  { kind: 'card', label: 'Smart Card', Icon: Gift },
  { kind: 'video', label: 'Video Story', Icon: Clapperboard },
];

const MENU_WIDTH = 168;

const menuItems = (menu: HTMLElement | null) =>
  Array.from(menu?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);

/**
 * "Campaigns" in the top menu, opening onto its types. The types live here
 * rather than on the page, so the editor keeps its full width and any type is
 * one click away from every tab.
 */
export function CampaignsNavMenu({
  active,
  kind,
  onSelect,
}: {
  /** The Campaigns tab is the one showing. */
  active: boolean;
  kind: CampaignKind;
  onSelect: (kind: CampaignKind) => void;
}) {
  const { open, setOpen, triggerRef, menuRef, position } = useAnchoredMenu({ width: MENU_WIDTH });

  // Opens on hover; click and tap open it too (touch, keyboard). It never
  // toggles shut on click, since hover has already opened it by then. Leaving
  // closes it after a short pause, so moving from the word to the menu across
  // the gap between them does not shut it.
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelLeave = () => {
    if (leaveTimer.current) clearTimeout(leaveTimer.current);
    leaveTimer.current = null;
  };
  const hoverOpen = () => {
    cancelLeave();
    setOpen(true);
  };
  const hoverLeave = () => {
    cancelLeave();
    leaveTimer.current = setTimeout(() => setOpen(false), 150);
  };
  useEffect(() => cancelLeave, []);

  // Keyboard: a click or Enter puts focus on the first type, the arrows move
  // between types, Escape closes back onto "Campaigns", and Tab closes and
  // carries on from it. Hover alone never moves focus — the pointer is only
  // passing. The menu mounts a frame after `open` (once placed), so a focus
  // asked for before then waits for it.
  const focusFirstOnOpen = useRef(false);
  const items = () => menuItems(menuRef.current);
  const openWithFocus = () => {
    cancelLeave();
    const first = items()[0];
    if (first) first.focus();
    else focusFirstOnOpen.current = true;
    setOpen(true);
  };
  useEffect(() => {
    if (!open || !position || !focusFirstOnOpen.current) return;
    focusFirstOnOpen.current = false;
    menuItems(menuRef.current)[0]?.focus();
  }, [open, position, menuRef]);
  useEffect(() => {
    if (!open) focusFirstOnOpen.current = false;
  }, [open]);

  const onMenuKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const list = items();
    const at = list.indexOf(document.activeElement as HTMLElement);
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const step = e.key === 'ArrowDown' ? 1 : -1;
      list[(at + step + list.length) % list.length]?.focus();
    } else if (e.key === 'Escape') {
      setOpen(false);
      triggerRef.current?.focus();
    } else if (e.key === 'Tab') {
      // Back onto the trigger before the browser's own Tab runs, so focus
      // moves on from "Campaigns" rather than from the end of the page, where
      // the portalled menu sits.
      setOpen(false);
      triggerRef.current?.focus();
    }
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={openWithFocus}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            openWithFocus();
          }
        }}
        onMouseEnter={hoverOpen}
        onMouseLeave={hoverLeave}
        aria-haspopup="menu"
        aria-expanded={open}
        className={`flex items-center gap-1 rounded-md border-b-2 px-1.5 py-2 text-[13px] sm:px-3 sm:text-sm font-semibold leading-5 transition-colors ${active
          ? 'border-primary text-primary'
          : 'border-transparent text-on-surface-variant hover:text-on-surface'
          }`}
      >
        Campaigns
        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>

      {/* Portalled: the nav is transformed and scrolls sideways, which would
          clip a menu drawn inside it. */}
      {open && position && typeof document !== 'undefined' && createPortal(
        <div
          ref={menuRef}
          role="menu"
          aria-label="Campaign types"
          onKeyDown={onMenuKeyDown}
          onMouseEnter={cancelLeave}
          onMouseLeave={hoverLeave}
          style={{ position: 'fixed', top: position.top, left: position.left, width: MENU_WIDTH }}
          className="z-50 rounded-xl border border-border bg-surface p-1 shadow-lg"
        >
          {CAMPAIGN_TYPES.map(({ kind: k, label, Icon }) => {
            const current = active && kind === k;
            return (
              <button
                key={k}
                type="button"
                role="menuitem"
                tabIndex={-1}
                aria-current={current ? 'page' : undefined}
                onClick={() => {
                  setOpen(false);
                  onSelect(k);
                }}
                className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors ${current
                  ? 'bg-primary/10 text-primary'
                  : 'text-on-surface hover:bg-surface-subtle'
                  }`}
              >
                <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span className="min-w-0 flex-1 text-sm font-semibold">{label}</span>
              </button>
            );
          })}
        </div>,
        document.body,
      )}
    </>
  );
}
