'use client';

import { useRef } from 'react';
import type { GradientStyle } from '@/types/campaign';
import { directionToAngle, normalizeAngle, angleToCssDirection } from '@/lib/gradientAngle';
import { GradientDirectionWheel } from './GradientDirectionWheel';

/**
 * The colour swatches under a background type selector, and the direction dial
 * when the type has a direction.
 *
 * Written out twice in the promo editor, once for the card's background and
 * once for the selected field's — 273 lines that are byte-identical once
 * formatting and a trailing comma are set aside. Two copies of a colour picker
 * is two places to change when a swatch gets a label.
 *
 * The angle is not a prop. It is derived from `background.direction`, which is
 * the value being edited anyway, so passing it separately would create a second
 * source for the same fact. The wheel's ref belongs here too — nothing outside
 * measured it.
 *
 * The balance slider is deliberately not here. It sits in a different
 * container in the panel, above the swatches rather than with them, so
 * pulling it in would have changed the markup around it.
 */
export function GradientControls({
  background,
  onChange,
  /** Distinguishes the two dials' keys when both are on the page. */
  keyPrefix,
}: {
  background: GradientStyle;
  onChange: (patch: Partial<GradientStyle>) => void;
  keyPrefix: string;
}) {
  const wheelRef = useRef<HTMLDivElement>(null);
  const angle = directionToAngle(background.direction);
  const angleNormalized = normalizeAngle(angle);

  const swatch = (label: string, key: 'startColor' | 'endColor') => (
    <div>
      <label className="block text-xs text-on-surface-variant mb-0.5">{label}</label>
      <input
        type="color"
        value={background[key]}
        onChange={(e) => onChange({ [key]: e.target.value })}
        className="bg-color-picker h-9 w-full rounded cursor-pointer"
      />
    </div>
  );

  return (
    <>
      {background.type === 'solid' && (
        // The two empty cells keep the single swatch the same width as the
        // three-column layouts, so the panel does not jump when the type
        // changes.
        <div className="grid grid-cols-3 gap-2">
          {swatch('Background', 'startColor')}
          <div aria-hidden="true" />
          <div aria-hidden="true" />
        </div>
      )}

      {background.type === 'linear' && (
        <div className="grid grid-cols-2 gap-2">
          {swatch('Start', 'startColor')}
          {swatch('End', 'endColor')}
          <div className="col-span-2 mt-2 rounded-md border border-border/70 bg-surface/30 p-3">
            <div className="mb-1 flex items-center justify-between">
              <label className="block text-xs text-on-surface-variant">Gradient Direction</label>
              <span className="text-[11px] font-medium text-on-surface-variant">
                {Math.round(angleNormalized)}deg
              </span>
            </div>
            <div className="flex items-center justify-center">
              <GradientDirectionWheel
                angle={angle}
                wheelRef={wheelRef}
                onAngleChange={(next) => onChange({ direction: angleToCssDirection(next) })}
                keyPrefix={`${keyPrefix}-wheel`}
              />
            </div>
          </div>
        </div>
      )}

      {/* A radial gradient spreads from the centre outwards, so it has no
          direction to set — hence no dial here. */}
      {background.type === 'radial' && (
        <div className="grid grid-cols-3 gap-2">
          {swatch('Center', 'startColor')}
          {swatch('Outer', 'endColor')}
          <div aria-hidden="true" />
        </div>
      )}
    </>
  );
}
