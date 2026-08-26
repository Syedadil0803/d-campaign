'use client';

import type { RefObject } from 'react';
import { normalizeAngle } from '@/lib/gradientAngle';

/** The eight compass points, offered as one-tap shortcuts under the dial. */
const presetDirections = [
  { label: '↑', angle: 0 },
  { label: '↗', angle: 45 },
  { label: '→', angle: 90 },
  { label: '↘', angle: 135 },
  { label: '↓', angle: 180 },
  { label: '↙', angle: 225 },
  { label: '←', angle: 270 },
  { label: '↖', angle: 315 },
];

/**
 * The angle dial in the gradient picker — drag it, or nudge it with the arrow
 * keys, and it reports back a bearing in degrees.
 *
 * It lived inside the promo editor, which is 4,000 lines about campaigns and
 * had no reason to also know how to turn a pointer position into an angle. A
 * dial is a dial; it belongs beside the other pickers.
 *
 * The wheel element's ref is passed in rather than created here: the drag
 * handlers measure it on every mouse move, and the caller holds it because
 * the popup that contains the dial needs the same element for positioning.
 */
function getAngleFromPointer(
  clientX: number,
  clientY: number,
  wheelRef: RefObject<HTMLDivElement | null>,
): number | null {
  const wheel = wheelRef.current;
  if (!wheel) return null;
  const rect = wheel.getBoundingClientRect();
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;
  const dx = clientX - centerX;
  const dy = clientY - centerY;
  const distance = Math.hypot(dx, dy);
  if (distance < 10) return null;
  const raw = Math.atan2(dy, dx) * (180 / Math.PI);
  return normalizeAngle(raw + 90);
}

export function GradientDirectionWheel({
  angle,
  wheelRef,
  onAngleChange,
  keyPrefix,
}: {
  angle: number;
  wheelRef: RefObject<HTMLDivElement | null>;
  onAngleChange: (angle: number) => void;
  keyPrefix: string;
}) {
  const normalizedAngle = normalizeAngle(angle);

  return (
    <div
      ref={wheelRef}
      className="relative h-28 w-28 rounded-full border border-border/80 bg-[conic-gradient(from_0deg,_rgba(255,255,255,0.14),_rgba(255,255,255,0.03),_rgba(255,255,255,0.14))] shadow-inner cursor-grab active:cursor-grabbing"
      onMouseDown={(e) => {
        e.preventDefault();
        const updateFromMouse = (clientX: number, clientY: number) => {
          const nextAngle = getAngleFromPointer(
            clientX,
            clientY,
            wheelRef,
          );
          if (nextAngle !== null) onAngleChange(nextAngle);
        };
        updateFromMouse(e.clientX, e.clientY);
        const onMove = (moveEvent: MouseEvent) =>
          updateFromMouse(moveEvent.clientX, moveEvent.clientY);
        const onUp = () => {
          window.removeEventListener("mousemove", onMove);
          window.removeEventListener("mouseup", onUp);
        };
        window.addEventListener("mousemove", onMove);
        window.addEventListener("mouseup", onUp);
      }}
    >
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 z-40"
        style={{
          transform: `translateY(-50%) rotate(${normalizedAngle - 90}deg)`,
          transformOrigin: "left center",
        }}
      >
        <div className="h-[2px] w-6 bg-primary" />
        <div className="absolute right-0 top-1/2 h-0 w-0 -translate-y-1/2 translate-x-full border-y-4 border-y-transparent border-l-[6px] border-l-primary" />
      </div>
      <div className="pointer-events-none absolute left-1/2 top-1/2 z-50 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border border-primary bg-surface-elevated" />
      {presetDirections.map((preset) => (
        <button
          key={`${keyPrefix}-${preset.angle}`}
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onAngleChange(preset.angle);
          }}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          className={`absolute left-1/2 top-1/2 z-20 h-6 w-6 -translate-x-1/2 -translate-y-1/2 text-[12px] leading-none transition-colors ${
            Math.abs(normalizedAngle - preset.angle) < 0.6
              ? "font-semibold text-primary"
              : "text-on-surface-variant hover:text-primary"
          }`}
          style={{
            left: `calc(50% + ${Math.sin((preset.angle * Math.PI) / 180) * 37}px)`,
            top: `calc(50% - ${Math.cos((preset.angle * Math.PI) / 180) * 37}px)`,
          }}
          title={`${preset.angle}deg`}
        >
          {preset.label}
        </button>
      ))}
    </div>
  );
}
