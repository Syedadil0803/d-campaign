'use client';

import { useCallback, useEffect, useState, type DependencyList, type RefObject } from 'react';

/**
 * A popover pinned under its trigger: placed on open (kept inside the window),
 * re-placed on page scroll or resize (scrolls inside the popover don't count),
 * and closed by an outside click or Escape. Returns its position, or null until
 * placed. Shared by the announcement and promo styling popovers.
 */
export function useAnchoredPopover({
  open,
  triggerRef,
  popoverRef,
  width,
  gap,
  onClose,
}: {
  open: boolean;
  triggerRef: RefObject<HTMLElement | null>;
  popoverRef: RefObject<HTMLElement | null>;
  width: number;
  gap: number;
  onClose: () => void;
}) {
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);

  const place = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const left = Math.min(rect.left, window.innerWidth - width - 8);
    setPosition({ top: rect.bottom + gap, left: Math.max(8, left) });
  }, [triggerRef, width, gap]);

  useEffect(() => {
    if (!open) return;
    place();
    const onMove = (e: Event) => {
      if (!popoverRef.current?.contains(e.target as Node)) place();
    };
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!popoverRef.current?.contains(t) && !triggerRef.current?.contains(t)) onClose();
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('scroll', onMove, true);
    window.addEventListener('resize', onMove);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('scroll', onMove, true);
      window.removeEventListener('resize', onMove);
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, place, onClose, popoverRef, triggerRef]);

  return position;
}

/**
 * Scrolls `containerRef` so its selected option (aria-selected="true") sits in
 * the middle — after layout settles, hence the two frames. Runs while `active`.
 */
export function useCenterSelected(
  containerRef: RefObject<HTMLElement | null>,
  active: boolean,
  deps: DependencyList,
) {
  useEffect(() => {
    if (!active) return;
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const container = containerRef.current;
      const selected = container?.querySelector('button[aria-selected="true"]');
      if (!container || !selected) return;
      const c = container.getBoundingClientRect();
      const b = selected.getBoundingClientRect();
      container.scrollTo({ top: container.scrollTop + b.top - c.top - c.height / 2 + b.height / 2, behavior: 'instant' });
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, ...deps]);
}
