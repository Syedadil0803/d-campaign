'use client';

import type { ReactNode } from 'react';

/**
 * The two-button confirmation the campaign screens use.
 *
 * Written out twice in Promo and twice in Announcement, identical apart from
 * which handler ran — 66 lines of the same overlay, panel, backdrop and button
 * pair. Four copies means a change to the panel styling has to be made four
 * times, and the fourth is the one that gets missed.
 *
 * Deliberately narrow. There are fourteen dialogs across this app using the
 * same overlay, and most of them are not this shape — a settings panel, a
 * template picker, a draft chooser. Widening this to cover all of them would
 * need a prop per difference and a flag per exception, which reads worse than
 * the repetition it replaced. This one covers the case it was named for:
 * a question, a short explanation, No or Yes.
 */
export function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel,
  onConfirm,
  onCancel,
  /** `danger` for anything that takes a campaign off the website. */
  tone = 'primary',
  cancelLabel = 'No',
}: {
  open: boolean;
  title: string;
  children: ReactNode;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  tone?: 'primary' | 'danger';
  cancelLabel?: string;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Clicking away is the same as saying No — the same escape the
          originals offered, kept rather than tidied away. */}
      <div className="absolute inset-0" onClick={onCancel} />
      <div className="relative z-10 w-full max-w-md rounded-xl border border-white/10 bg-black/10 p-5 text-on-surface shadow-2xl backdrop-blur-md">
        <h2 className="text-base font-semibold">{title}</h2>
        {children}
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-white/10 bg-transparent px-4 py-2 text-sm font-medium text-on-surface-variant transition-colors hover:border-primary/70 hover:text-primary"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={
              tone === 'danger'
                ? 'rounded-md bg-red-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-opacity hover:bg-red-600'
                : 'rounded-md bg-primary px-4 py-2 text-sm font-semibold text-on-primary shadow-sm transition-opacity hover:opacity-95'
            }
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
