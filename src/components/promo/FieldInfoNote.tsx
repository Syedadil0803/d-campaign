'use client';

import type { ReactNode } from 'react';

/**
 * The short note under a field explaining how much text it is meant to hold.
 *
 * One per editable field, written out three times before with only the
 * sentence changing. The two buttons are the point: "Got it" closes it for
 * now, "Don't show again" closes it for good.
 */
export function FieldInfoNote({
  open,
  onDismiss,
  onNeverShow,
  children,
}: {
  open: boolean;
  onDismiss: () => void;
  onNeverShow: () => void;
  children: ReactNode;
}) {
  if (!open) return null;

  return (
    <div className="mb-2 p-3 rounded-lg bg-surface border border-border shadow-md text-[12px] text-on-surface/80 leading-relaxed">
      <p>{children}</p>
      <div className="flex gap-2 mt-2">
        <button
          onClick={onDismiss}
          className="px-3 py-1 rounded-md bg-primary/10 hover:bg-primary/20 text-primary text-[11px] font-medium transition-colors"
        >
          Got it
        </button>
        <button
          onClick={onNeverShow}
          className="px-3 py-1 rounded-md bg-primary/10 hover:bg-primary/20 text-primary text-[11px] font-medium transition-colors"
        >
          Don&apos;t show again
        </button>
      </div>
    </div>
  );
}
