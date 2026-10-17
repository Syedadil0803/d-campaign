'use client';

import { Check, Palette } from 'lucide-react';
import { useAnchoredMenu } from '@/hooks/useAnchoredPopover';
import type { VideoTitleColor } from '@/lib/videoStory/videoTitle';
import { PALETTE_BTN } from '@/components/promo/fieldStyles';

const COLOURS = [
  { value: 'white', label: 'White', swatch: 'bg-white border-border' },
  { value: 'black', label: 'Black', swatch: 'bg-black border-black' },
] as const;

const MENU_WIDTH = 140;

/**
 * The colour of text drawn over the video — the title and the countdown —
 * opened from a palette icon beside the label, the same place the Smart
 * Card's text fields keep theirs. Two colours only: the text sits on moving
 * footage, and the shade behind each (videoTitle.ts) is what keeps it
 * readable.
 */
export function OverlayColorPicker({
  value,
  onChange,
  label,
}: {
  value: VideoTitleColor;
  onChange: (next: VideoTitleColor) => void;
  /** Names the control, e.g. "Title colour". */
  label: string;
}) {
  const { open, setOpen, close, triggerRef, menuRef, position } = useAnchoredMenu({ width: MENU_WIDTH });

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        title={label}
        aria-label={label}
        className={PALETTE_BTN}
      >
        <Palette className="h-3.5 w-3.5" />
      </button>
      {open && position && (
        <div
          ref={menuRef}
          role="menu"
          aria-label={label}
          style={{ position: 'fixed', top: position.top, left: position.left, width: MENU_WIDTH }}
          className="z-50 rounded-xl border border-border bg-surface p-1 shadow-lg"
        >
          {COLOURS.map((c) => (
            <button
              key={c.value}
              type="button"
              role="menuitemradio"
              aria-checked={value === c.value}
              onClick={() => {
                onChange(c.value);
                close();
                triggerRef.current?.focus();
              }}
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm text-on-surface transition-colors hover:bg-surface-subtle"
            >
              <span className={`h-4 w-4 rounded-full border ${c.swatch}`} aria-hidden="true" />
              <span className="flex-1 text-left">{c.label}</span>
              {value === c.value && <Check className="h-3.5 w-3.5 text-primary" aria-hidden="true" />}
            </button>
          ))}
        </div>
      )}
    </>
  );
}
