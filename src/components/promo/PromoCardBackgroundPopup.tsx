'use client';

import type { RefObject } from 'react';
import type { GradientStyle } from '@/types/campaign';
import { GradientControls } from '@/components/promo/GradientControls';
import { PopupDropdown } from '@/components/shared/PopupDropdown';
import { X } from 'lucide-react';

/**
 * The card background controls, floating beside the card in the preview.
 *
 * The only one of the promo editor's popups that has to know where it is. It
 * pins itself to the left edge of the canvas by measuring the card, so the
 * anchor arrives as a ref rather than as a position — the caller does not know
 * where the card will be either, and asking the DOM at render is the only
 * honest answer.
 *
 * Its vertical position is fixed when it opens rather than followed live, so
 * the panel does not crawl up the screen while a colour is being dragged.
 */
export function PromoCardBackgroundPopup({
  popupRef,
  anchorRef,
  top,
  background,
  onChange,
  onClose,
  typeDropdownOpen,
  onTypeDropdownOpen,
  onTypeDropdownClose,
  typeButtonRef,
  typeMenuRef,
  typeMenuPosition,
}: {
  popupRef: RefObject<HTMLDivElement | null>;
  /** The card itself — measured to place this beside it. */
  anchorRef: RefObject<HTMLDivElement | null>;
  top: number | null;
  background: GradientStyle;
  onChange: (patch: Partial<GradientStyle>) => void;
  onClose: () => void;
  typeDropdownOpen: boolean;
  /**
   * Opening the type list is the editor's business, not this popup's: it also
   * shuts every other dropdown and works out where the menu should sit.
   */
  onTypeDropdownOpen: () => void;
  onTypeDropdownClose: () => void;
  typeButtonRef: RefObject<HTMLButtonElement | null>;
  typeMenuRef: RefObject<HTMLDivElement | null>;
  typeMenuPosition: { top: number; left: number; width: number } | null;
}) {
  return (
    <div
      ref={popupRef}
      className="absolute z-30 w-[320px] bg-black/10 backdrop-blur-md border border-white/10 rounded-xl shadow-2xl p-3"
      style={(() => {
        const card = anchorRef.current;
        const canvas = card?.closest(
          "[data-promo-canvas]",
        ) as HTMLElement | null;
        const left =
          card && canvas
            ? `${Math.round(
                canvas.getBoundingClientRect().left +
                  8 -
                  card.getBoundingClientRect().left,
              )}px`
            : "8px";
        // Top fixed at open — see top.
        return { top: `${top ?? 8}px`, left };
      })()}
    >
      <button
        type="button"
        onMouseDown={(e) => {
          e.preventDefault();
          onClose();
        }}
        className="absolute -top-[28px] -right-[28px] inline-flex h-7 w-7 items-center justify-center rounded-full border border-border bg-surface-elevated text-on-surface-variant shadow-sm transition-colors hover:border-primary/70 hover:bg-primary/10 hover:text-primary focus:outline-none focus:ring-2 focus:ring-primary/40"
        aria-label="Close card background controls"
        title="Close"
      >
        <X className="h-3.5 w-3.5" />
      </button>
      {/* Change here to reflect color updates on the full promo card preview. */}
      <label className="text-xs font-semibold text-on-surface">
        Card Background
      </label>
      <div className="mt-2.5 space-y-2">
        <div className="grid grid-cols-3 gap-2">
          <div>
            <PopupDropdown
              label="Type"
              value={background.type}
              options={[
                { value: "solid", label: "Solid" },
                { value: "linear", label: "Linear" },
                { value: "radial", label: "Gradient" },
              ]}
              open={typeDropdownOpen}
              onOpen={onTypeDropdownOpen}
              onSelect={(v) => {
                onChange({ type: v as GradientStyle['type'] });
                onTypeDropdownClose();
              }}
              buttonRef={typeButtonRef}
              menuRef={typeMenuRef}
              menuPosition={typeMenuPosition}
              compact={true}
            />
          </div>
          <div className="col-span-2">
            {(background.type ===
              "linear" ||
              background.type ===
                "radial") && (
              <>
                <label className="block text-xs text-on-surface-variant mb-0.5">
                  Balance:{" "}
                  {background.midpoint ??
                    50}
                  %
                </label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={
                    background
                      .midpoint ?? 50
                  }
                  onChange={(e) =>
                    onChange({
                      midpoint: Number(e.target.value),
                    })
                  }
                  className="balance-slider mt-3"
                />
              </>
            )}
          </div>
        </div>
        <div className="mt-2 min-h-[56px]">
          <GradientControls
            background={background}
            onChange={onChange}
            keyPrefix="card"
          />
        </div>
      </div>
    </div>
  );
}
