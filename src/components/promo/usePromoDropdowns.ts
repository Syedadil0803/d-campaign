'use client';

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type RefObject,
  type SetStateAction,
} from 'react';

export type MenuPosition = { top: number; left: number; width: number } | null;

/**
 * The editor's dropdowns and the card-colour popup.
 *
 * Takes nothing. Every ref, flag and position below exists only to open and
 * close these menus, and the one effect only dismisses them — so unlike the
 * card-lifecycle group, which reads half the editor to do its job, this is a
 * boundary rather than a keyhole.
 *
 * Each dropdown is the same four things: the button it hangs off, the menu
 * itself, whether it is open, and where to put it.
 */
export function usePromoDropdowns() {
  const cardPositionBtnRef = useRef<HTMLButtonElement>(null);
  const cardPositionMenuRef = useRef<HTMLDivElement>(null);
  const [showCardPositionDropdown, setShowCardPositionDropdown] = useState(false);
  const [cardPositionPos, setCardPositionPos] = useState<MenuPosition>(null);

  const cardBgTypeBtnRef = useRef<HTMLButtonElement>(null);
  const cardBgTypeMenuRef = useRef<HTMLDivElement>(null);
  const [showCardBgTypeDropdown, setShowCardBgTypeDropdown] = useState(false);
  const [cardBgTypePos, setCardBgTypePos] = useState<MenuPosition>(null);

  const fieldBgTypeBtnRef = useRef<HTMLButtonElement>(null);
  const fieldBgTypeMenuRef = useRef<HTMLDivElement>(null);
  const [showFieldBgTypeDropdown, setShowFieldBgTypeDropdown] = useState(false);
  const [fieldBgTypePos, setFieldBgTypePos] = useState<MenuPosition>(null);

  const countryCodeBtnRef = useRef<HTMLButtonElement>(null);
  const countryCodeMenuRef = useRef<HTMLDivElement>(null);
  const [showCountryCodeDropdown, setShowCountryCodeDropdown] = useState(false);
  const [countryCodePos, setCountryCodePos] = useState<MenuPosition>(null);

  /** The card's own colours — a popup rather than a menu, dismissed with them. */
  const cardBgPopupBtnRef = useRef<HTMLButtonElement>(null);
  const cardBgPopupRef = useRef<HTMLDivElement>(null);
  const [showCardBgPopup, setShowCardBgPopup] = useState(false);
  const [cardBgPopupTop, setCardBgPopupTop] = useState<number | null>(null);

  /** Where a menu goes: under its button, aligned to its left edge. */
  const getDropdownPosition = useCallback(
    (button: HTMLButtonElement | null): MenuPosition => {
      if (!button) return null;
      const rect = button.getBoundingClientRect();
      return { top: rect.bottom + 6, left: rect.left, width: rect.width };
    },
    [],
  );

  const closeAllPromoDropdowns = useCallback(() => {
    setShowCardPositionDropdown(false);
    setShowCardBgTypeDropdown(false);
    setShowFieldBgTypeDropdown(false);
    setShowCountryCodeDropdown(false);
    setShowCardBgPopup(false);
  }, []);

  useEffect(() => {
    const onDocMouseDown = (e: MouseEvent) => {
      const target = e.target as Node;
      const pairs: Array<
        [
          RefObject<HTMLButtonElement | null>,
          RefObject<HTMLDivElement | null>,
          Dispatch<SetStateAction<boolean>>,
        ]
      > = [
        [cardPositionBtnRef, cardPositionMenuRef, setShowCardPositionDropdown],
        [cardBgTypeBtnRef, cardBgTypeMenuRef, setShowCardBgTypeDropdown],
        [fieldBgTypeBtnRef, fieldBgTypeMenuRef, setShowFieldBgTypeDropdown],
        [countryCodeBtnRef, countryCodeMenuRef, setShowCountryCodeDropdown],
      ];
      pairs.forEach(([btnRef, menuRef, setOpen]) => {
        if (
          btnRef.current?.contains(target) ||
          menuRef.current?.contains(target)
        )
          return;
        setOpen(false);
      });
      // Keep card background popup open until explicit close (X button).
    };
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, []);

  return {
    cardPositionBtnRef,
    cardPositionMenuRef,
    showCardPositionDropdown,
    setShowCardPositionDropdown,
    cardPositionPos,
    setCardPositionPos,
    cardBgTypeBtnRef,
    cardBgTypeMenuRef,
    showCardBgTypeDropdown,
    setShowCardBgTypeDropdown,
    cardBgTypePos,
    setCardBgTypePos,
    fieldBgTypeBtnRef,
    fieldBgTypeMenuRef,
    showFieldBgTypeDropdown,
    setShowFieldBgTypeDropdown,
    fieldBgTypePos,
    setFieldBgTypePos,
    countryCodeBtnRef,
    countryCodeMenuRef,
    showCountryCodeDropdown,
    setShowCountryCodeDropdown,
    countryCodePos,
    setCountryCodePos,
    cardBgPopupBtnRef,
    cardBgPopupRef,
    showCardBgPopup,
    setShowCardBgPopup,
    cardBgPopupTop,
    setCardBgPopupTop,
    getDropdownPosition,
    closeAllPromoDropdowns,
  };
}
