'use client';

import { PopupDropdown } from '@/components/shared/PopupDropdown';
import { useAnchoredMenu } from '@/hooks/useAnchoredPopover';

const MENU_WIDTH = 150;
const OPTIONS = [
  { label: 'Bottom Left', value: 'bottom-left' },
  { label: 'Bottom Right', value: 'bottom-right' },
];

/**
 * The Position control shared by the Smart Card and Video Story toolbars: the
 * app's own dropdown (same trigger as Broadcasts' Animation style) rather than
 * a native select, which drew an OS menu that matched nothing around it. The
 * corner-clash note sits directly under it, so the fix is next to the cause.
 */
export function WidgetPositionControl({
  label,
  value,
  onChange,
  warning,
}: {
  /** Accessible name, e.g. "Video Story position". */
  label: string;
  value: string;
  onChange: (value: string) => void;
  /** From cornerClash; null when the corner is free. */
  warning: string | null;
}) {
  const { open, setOpen, triggerRef: btnRef, menuRef, position: pos } = useAnchoredMenu({ width: MENU_WIDTH });

  return (
    <div className="flex flex-col items-end gap-1">
      <div role="group" aria-label={label} className="flex items-center gap-2">
        <span className="text-xs font-bold uppercase tracking-[0.08em] text-on-surface-variant">Position:</span>
        <PopupDropdown
          labelClassName="sr-only"
          label={label}
          value={value}
          options={OPTIONS}
          open={open}
          onOpen={() => setOpen((o) => !o)}
          onSelect={(v) => {
            setOpen(false);
            onChange(v);
          }}
          buttonRef={btnRef}
          menuRef={menuRef}
          menuPosition={pos && { ...pos, width: MENU_WIDTH }}
          buttonClassName="flex h-7 items-center gap-1.5 rounded-lg border border-border bg-surface-subtle px-2.5 text-xs font-medium text-on-surface transition-colors hover:border-primary/60"
        />
      </div>
      {warning && (
        <p role="status" className="max-w-xs text-right text-[11px] text-amber-600 dark:text-amber-500">
          {warning}
        </p>
      )}
    </div>
  );
}
