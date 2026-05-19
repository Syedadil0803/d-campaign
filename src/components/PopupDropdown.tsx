'use client';

import { createPortal } from 'react-dom';
import type { RefObject } from 'react';

export type PopupDropdownOption = {
  label: string;
  value: string;
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
}: PopupDropdownProps) {
  const selectedLabel = options.find((option) => option.value === value)?.label ?? value;
  const popupWidth = menuPosition?.width ?? 260;

  return (
    <div>
      <label className="block text-xs text-on-surface-variant mb-1">{label}</label>
      <button
        ref={buttonRef}
        type="button"
        onMouseDown={(e) => {
          e.preventDefault();
          onOpen();
        }}
        className="flex w-full items-center justify-between gap-2 rounded-md border border-white/10 bg-black/10 p-2 text-left text-sm text-on-surface shadow-2xl backdrop-blur-md transition-colors hover:border-primary/70 hover:bg-black/10"
      >
        <span className="truncate">{selectedLabel}</span>
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
          style={{ position: 'fixed', zIndex: 9999, top: menuPosition?.top ?? 0, left: menuPosition?.left ?? 0, width: `${popupWidth}px` }}
          className="bg-black/10 backdrop-blur-md border border-white/10 shadow-2xl p-3 rounded-xl"
        >
          {options.map((option) => (
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
              className={`block w-full cursor-pointer border-0 bg-transparent px-3 py-2 text-left text-sm transition-colors hover:bg-surface-subtle ${option.value === value ? 'text-primary' : 'text-on-surface'}`}
            >
              {option.label}
            </div>
          ))}
        </div>,
        document.body
      )}
    </div>
  );
}
