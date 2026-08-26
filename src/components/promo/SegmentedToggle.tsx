'use client';

/**
 * Two-state segmented pill toggle (Off ◀ / ▶ On) with a sliding thumb.
 * Matches the status pills; replaces the old switch toggles.
 */
export function SegmentedToggle({
  value,
  onChange,
  offLabel = "Off",
  onLabel = "On",
}: {
  value: boolean;
  onChange: (next: boolean) => void;
  offLabel?: string;
  onLabel?: string;
}) {
  return (
    <div className="relative flex w-[96px] items-center rounded-full border border-border bg-surface-subtle p-0.5 text-[11px] font-semibold">
      <span
        aria-hidden
        className={`absolute inset-y-0.5 left-0.5 w-[calc(50%-2px)] rounded-full shadow-sm will-change-transform transition-[transform,background-color] duration-300 ease-in-out ${
          value ? "bg-primary" : "bg-surface"
        }`}
        style={{ transform: value ? "translateX(100%)" : "translateX(0)" }}
      />
      <button
        type="button"
        onClick={() => value && onChange(false)}
        className={`relative z-10 flex-1 rounded-full py-1 text-center transition-colors ${
          !value
            ? "text-on-surface cursor-default"
            : "text-on-surface-variant hover:text-on-surface cursor-pointer"
        }`}
      >
        {offLabel}
      </button>
      <button
        type="button"
        onClick={() => !value && onChange(true)}
        className={`relative z-10 flex-1 rounded-full py-1 text-center transition-colors ${
          value
            ? "text-on-primary cursor-default"
            : "text-on-surface-variant hover:text-on-surface cursor-pointer"
        }`}
      >
        {onLabel}
      </button>
    </div>
  );
}
