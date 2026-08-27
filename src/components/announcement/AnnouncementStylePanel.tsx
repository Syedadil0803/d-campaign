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

  showBackgroundTypeDropdown: boolean;
  setShowBackgroundTypeDropdown: (open: boolean | ((prev: boolean) => boolean)) => void;
  backgroundTypeBtnRef: RefObject<HTMLButtonElement | null>;
  backgroundTypeMenuRef: RefObject<HTMLDivElement | null>;
  backgroundTypePos: MenuPosition;

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

/** Empty grid cell, so the colour fields keep their columns across types. */
function Spacer() {
  return <div aria-hidden="true" />;
}

/**
 * One labelled colour well.
 *
 * Written out five times before this — solid's Background Color, linear's
 * Start and End, radial's Center and Outer — identical but for the label and
 * which end of the gradient it wrote to.
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
      <label className="block text-sm font-semibold text-on-surface mb-2">{label}</label>
      <input
        type="color"
        value={value}
        onFocus={onFocus}
        onChange={(e) => onChange(e.target.value)}
        className="bg-color-picker h-11 w-full rounded cursor-pointer"
      />
    </div>
  );
}

/**
 * How the announcement bar is painted: solid, linear or radial, and the
 * colours each of those needs.
 */
export function AnnouncementStylePanel({
  bg,
  updateBg,
  updateBgWithHistory,
  pushImmediateState,
  getEditorSnapshot,
  showBackgroundTypeDropdown,
  setShowBackgroundTypeDropdown,
  backgroundTypeBtnRef,
  backgroundTypeMenuRef,
  backgroundTypePos,
  showDirectionDropdown,
  setShowDirectionDropdown,
  directionBtnRef,
  directionMenuRef,
  directionPos,
  setPreviewDirection,
}: AnnouncementStylePanelProps) {
  const snapshot = () => pushImmediateState(getEditorSnapshot());
  const type = bg.type || 'solid';
  // Both gradients take a balance; solid has nothing to balance. The two
  // branches were written out separately and were identical.
  const hasBalance = type === 'linear' || type === 'radial';

  return (
    <div>
      <label className="block text-xl font-semibold leading-7 text-on-surface mb-4">Style Customization</label>

      {/* Type + inline control */}
      <div className="grid grid-cols-3 gap-4">
        <div>
          <PopupDropdown
            label="Background Type"
            value={type}
            options={[
              { value: 'solid', label: 'Solid' },
              { value: 'linear', label: 'Linear' },
              { value: 'radial', label: 'Gradient' },
            ]}
            open={showBackgroundTypeDropdown}
            onOpen={() => {
              setShowBackgroundTypeDropdown((current) => !current);
              setShowDirectionDropdown(false);
            }}
            onSelect={(nextType) => {
              // The dropdown is typed to plain strings; its options are
              // exactly the three background types, so this narrows to what
              // the list can actually produce.
              updateBgWithHistory({ type: nextType as GradientStyle['type'] });
              setShowBackgroundTypeDropdown(false);
            }}
            buttonRef={backgroundTypeBtnRef}
            menuRef={backgroundTypeMenuRef}
            menuPosition={backgroundTypePos}
          />
        </div>
        <div className="col-span-2">
          {hasBalance && (
            <div>
              <label className="block text-xs text-on-surface-variant mb-1">Balance: {bg.midpoint ?? 50}%</label>
              <input type="range" min="0" max="100" value={bg.midpoint ?? 50}
                onChange={(e) => updateBg({ midpoint: Number(e.target.value) })}
                onMouseDown={snapshot}
                className="balance-slider mt-3" />
            </div>
          )}
        </div>
      </div>

      {/* Colors + Direction (second line) */}
      <div className="mt-4 min-h-[96px]">
        {type === 'solid' && (
          <div className="grid grid-cols-3 gap-4">
            <ColorField
              label="Background Color"
              value={bg.startColor}
              onFocus={snapshot}
              onChange={(startColor) => updateBg({ startColor })}
            />
            <Spacer />
            <Spacer />
          </div>
        )}

        {type === 'linear' && (
          <div className="grid grid-cols-3 gap-4">
            <ColorField
              label="Start Color"
              value={bg.startColor}
              onFocus={snapshot}
              onChange={(startColor) => updateBg({ startColor })}
            />
            <ColorField
              label="End Color"
              value={bg.endColor}
              onFocus={snapshot}
              onChange={(endColor) => updateBg({ endColor })}
            />
            <div>
              <PopupDropdown
                label="Direction"
                labelClassName="block text-sm font-semibold text-on-surface mb-2"
                buttonExtraClassName="h-11"
                value={bg.direction || 'to right'}
                options={DIRECTIONS}
                open={showDirectionDropdown}
                onOpen={() => {
                  setShowDirectionDropdown((current) => !current);
                  setShowBackgroundTypeDropdown(false);
                }}
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
          </div>
        )}

        {type === 'radial' && (
          <div className="grid grid-cols-3 gap-4">
            <ColorField
              label="Center Color"
              value={bg.startColor}
              onFocus={snapshot}
              onChange={(startColor) => updateBg({ startColor })}
            />
            <ColorField
              label="Outer Color"
              value={bg.endColor}
              onFocus={snapshot}
              onChange={(endColor) => updateBg({ endColor })}
            />
            <Spacer />
          </div>
        )}
      </div>
    </div>
  );
}
