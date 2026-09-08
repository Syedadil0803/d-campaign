'use client';

import type { RefObject } from 'react';
import type { GradientStyle } from '@/types/campaign';
import type { EditorSnapshot } from '@/lib/editor/historyManager';
import { PopupDropdown } from '@/components/shared/PopupDropdown';

type MenuPosition = { top: number; left: number; width: number } | null;

interface AnnouncementStylePanelProps {
  bg: GradientStyle;
  updateBg: (patch: Partial<GradientStyle>) => void;
  updateBgWithHistory: (patch: Partial<GradientStyle>) => void;
  pushImmediateState: (snapshot: EditorSnapshot) => void;
  getEditorSnapshot: () => EditorSnapshot;

  showDirectionDropdown: boolean;
  setShowDirectionDropdown: (open: boolean | ((prev: boolean) => boolean)) => void;
  directionBtnRef: RefObject<HTMLButtonElement | null>;
  directionMenuRef: RefObject<HTMLDivElement | null>;
  directionPos: MenuPosition;
  setPreviewDirection: (direction: string | null) => void;
}

const DIRECTIONS = [
  { value: 'to right', label: 'To Right →' },
  { value: 'to left', label: 'To Left ←' },
  { value: 'to bottom', label: 'To Bottom ↓' },
  { value: 'to top', label: 'To Top ↑' },
  { value: 'to bottom right', label: 'To Bottom Right ↘' },
  { value: 'to bottom left', label: 'To Bottom Left ↙' },
  { value: 'to top right', label: 'To Top Right ↗' },
  { value: 'to top left', label: 'To Top Left ↖' },
];

/** The three background modes — same values `bg.type` already takes. */
const BACKGROUND_TYPES: { value: NonNullable<GradientStyle['type']>; label: string }[] = [
  { value: 'solid', label: 'Solid' },
  { value: 'linear', label: 'Linear' },
  { value: 'radial', label: 'Gradient' },
];

/**
 * One labelled colour well.
 */
function ColorField({
  label,
  value,
  onChange,
  onFocus,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  onFocus: () => void;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-on-surface-variant mb-1.5">{label}</label>
      <input
        type="color"
        value={value}
        onFocus={onFocus}
        onChange={(e) => onChange(e.target.value)}
        className="bg-color-picker h-10 w-full rounded cursor-pointer"
      />
    </div>
  );
}

/**
 * Balance slider with percentage display - vertically centered
 */
function BalanceControl({
  value,
  onChange,
  onMouseDown,
}: {
  value: number;
  onChange: (value: number) => void;
  onMouseDown: () => void;
}) {
  return (
    <div className="flex items-center gap-3 h-10">
      <input
        type="range"
        min="0"
        max="100"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        onMouseDown={onMouseDown}
        className="balance-slider flex-1"
      />
      <span className="text-xs font-medium text-on-surface-variant min-w-[40px] text-right">
        {value}%
      </span>
    </div>
  );
}

export function AnnouncementStylePanel({
  bg,
  updateBg,
  updateBgWithHistory,
  pushImmediateState,
  getEditorSnapshot,
  showDirectionDropdown,
  setShowDirectionDropdown,
  directionBtnRef,
  directionMenuRef,
  directionPos,
  setPreviewDirection,
}: AnnouncementStylePanelProps) {
  const snapshot = () => pushImmediateState(getEditorSnapshot());
  const type = bg.type || 'solid';

  return (
    <div className="space-y-4">
      {/* Inset segmented control - full width */}
      <div role="group" aria-label="Background type" className="flex rounded-lg border border-border bg-surface-subtle p-0.5">
        {BACKGROUND_TYPES.map((opt) => {
          const active = opt.value === type;
          return (
            <button
              key={opt.value}
              type="button"
              aria-pressed={active}
              onClick={() => updateBgWithHistory({ type: opt.value })}
              className={`flex-1 rounded-md px-4 py-1.5 text-xs font-semibold transition-colors ${active ? 'bg-primary text-on-primary shadow-sm' : 'text-on-surface-variant hover:text-on-surface'
                }`}
            >
              {opt.label}
            </button>
          );
        })}
      </div>

      {/* Color fields - 2 columns with proper labels */}
      {type === 'solid' && (
        <div className="grid grid-cols-2 gap-4">
          <ColorField
            label="Background Color"
            value={bg.startColor}
            onFocus={snapshot}
            onChange={(startColor) => updateBg({ startColor })}
          />
        </div>
      )}

      {type === 'linear' && (
        <>
          <div className="grid grid-cols-2 gap-4">
            <ColorField
              label="START COLOR"
              value={bg.startColor}
              onFocus={snapshot}
              onChange={(startColor) => updateBg({ startColor })}
            />
            <ColorField
              label="END COLOR"
              value={bg.endColor}
              onFocus={snapshot}
              onChange={(endColor) => updateBg({ endColor })}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-on-surface-variant mb-1.5">DIRECTION</label>
              <PopupDropdown
                label=""
                buttonExtraClassName="h-10 w-full justify-between text-left"
                value={bg.direction || 'to right'}
                options={DIRECTIONS}
                open={showDirectionDropdown}
                onOpen={() => setShowDirectionDropdown((current) => !current)}
                onSelect={(nextDirection) => {
                  snapshot();
                  updateBg({ direction: nextDirection });
                  setShowDirectionDropdown(false);
                }}
                onHover={(dir) => setPreviewDirection(dir)}
                onHoverEnd={() => setPreviewDirection(null)}
                buttonRef={directionBtnRef}
                menuRef={directionMenuRef}
                menuPosition={directionPos}
                arrowDirection="right"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-on-surface-variant mb-1.5">BALANCE</label>
              <BalanceControl
                value={bg.midpoint ?? 50}
                onChange={(val) => updateBg({ midpoint: val })}
                onMouseDown={snapshot}
              />
            </div>
          </div>
        </>
      )}

      {type === 'radial' && (
        <>
          <div className="grid grid-cols-2 gap-4">
            <ColorField
              label="CENTER COLOR"
              value={bg.startColor}
              onFocus={snapshot}
              onChange={(startColor) => updateBg({ startColor })}
            />
            <ColorField
              label="OUTER COLOR"
              value={bg.endColor}
              onFocus={snapshot}
              onChange={(endColor) => updateBg({ endColor })}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-on-surface-variant mb-1.5">BALANCE</label>
            <div className="flex items-center gap-3 h-10">
              <input
                type="range"
                min="0"
                max="100"
                value={bg.midpoint ?? 50}
                onChange={(e) => updateBg({ midpoint: Number(e.target.value) })}
                onMouseDown={snapshot}
                className="balance-slider flex-1"
              />
              <span className="text-xs font-medium text-on-surface-variant min-w-[40px] text-right">
                {bg.midpoint ?? 50}%
              </span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}