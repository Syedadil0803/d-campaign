'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';

/**
 * The two menus on the announcement's styling controls: background type and
 * gradient direction.
 *
 * Takes no arguments at all, which is what makes it a boundary rather than a
 * pile of parameters — the same test usePromoDropdowns passes. Each menu owns
 * its trigger, its menu element, whether it is open, and where it sits, and
 * nothing outside needs any of that except to render it.
 *
 * Both are positioned in a layout effect rather than on the click, because the
 * measurement has to happen after the menu exists but before the browser
 * paints, or it appears at the previous position for a frame.
 */
export function useAnnouncementStyleDropdowns() {
  const [showBackgroundTypeDropdown, setShowBackgroundTypeDropdown] = useState(false);
  const [showDirectionDropdown, setShowDirectionDropdown] = useState(false);
  const [backgroundTypePos, setBackgroundTypePos] = useState<{ top: number; left: number; width: number } | null>(null);
  const [directionPos, setDirectionPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const backgroundTypeBtnRef = useRef<HTMLButtonElement>(null);
  const backgroundTypeMenuRef = useRef<HTMLDivElement>(null);
  const directionBtnRef = useRef<HTMLButtonElement>(null);
  const directionMenuRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (showBackgroundTypeDropdown && backgroundTypeBtnRef.current) {
      const rect = backgroundTypeBtnRef.current.getBoundingClientRect();
      setBackgroundTypePos({ top: rect.bottom + 6, left: rect.left, width: rect.width });
    }
  }, [showBackgroundTypeDropdown]);

  useLayoutEffect(() => {
    if (showDirectionDropdown && directionBtnRef.current) {
      const rect = directionBtnRef.current.getBoundingClientRect();
      const menuWidth = 180;
      const menuHeight = 320;
      const spaceRight = window.innerWidth - rect.right;
      const left = spaceRight >= menuWidth + 10 ? rect.right + 6 : rect.left - menuWidth - 6;
      // Offset: increase this value to move menu down, decrease to move up
      const verticalOffset = 80;
      const top = rect.bottom - menuHeight + verticalOffset;
      setDirectionPos({ top, left, width: menuWidth });
    }
  }, [showDirectionDropdown]);

  /**
   * Dismissal, on its own listener.
   *
   * It used to be two branches of the section's one mousedown handler, which
   * also served the link popup, the schedule popup and the row menu. Their
   * conditions are independent, so a separate listener behaves identically and
   * lets these two menus leave with their own dismissal instead of holding the
   * others hostage to this hook's dependencies.
   */
  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        showBackgroundTypeDropdown &&
        backgroundTypeMenuRef.current && !backgroundTypeMenuRef.current.contains(target) &&
        backgroundTypeBtnRef.current && !backgroundTypeBtnRef.current.contains(target)
      ) {
        setShowBackgroundTypeDropdown(false);
      }
      if (
        showDirectionDropdown &&
        directionMenuRef.current && !directionMenuRef.current.contains(target) &&
        directionBtnRef.current && !directionBtnRef.current.contains(target)
      ) {
        setShowDirectionDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, [showBackgroundTypeDropdown, showDirectionDropdown]);

  return {
    showBackgroundTypeDropdown,
    setShowBackgroundTypeDropdown,
    showDirectionDropdown,
    setShowDirectionDropdown,
    backgroundTypePos,
    directionPos,
    backgroundTypeBtnRef,
    backgroundTypeMenuRef,
    directionBtnRef,
    directionMenuRef,
  };
}
