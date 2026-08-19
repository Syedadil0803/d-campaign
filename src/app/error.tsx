'use client';

import { useEffect } from 'react';

/**
 * Catches a render error anywhere under the page.
 *
 * Without this file React unmounts the whole tree on an uncaught render
 * error and leaves an empty body — the "screen goes off" on a reload, with
 * nothing on screen saying what happened or offering a way back. A soft
 * reload hit it and a hard reload appeared to fix it, because the hard
 * reload changed the timing rather than the fault.
 *
 * Recovering with reset() re-renders the same tree, so a transient fault
 * (a mid-flight fetch, a value that was briefly missing) clears without a
 * reload and without losing the rest of the page.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // The overlay only appears in dev; this keeps the detail reachable in a
    // deployed build, where the user would otherwise just see the card.
    console.error('[campaign-admin] render error:', error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface p-6">
      <div className="w-full max-w-md rounded-xl border border-border bg-surface-elevated p-6 shadow-sm">
        <h1 className="text-lg font-semibold text-on-surface">
          Something went wrong loading this screen
        </h1>
        <p className="mt-2 text-sm text-on-surface-variant">
          Your saved campaign is untouched — this failed while drawing the page,
          not while storing anything.
        </p>

        {error?.message && (
          <pre className="mt-3 max-h-40 overflow-auto whitespace-pre-wrap rounded-md border border-border bg-surface p-2 text-[11px] text-on-surface-variant">
            {error.message}
            {error.digest ? `\n\ndigest: ${error.digest}` : ''}
          </pre>
        )}

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={reset}
            className="inline-flex h-9 items-center rounded-lg bg-primary px-3 text-sm font-semibold text-on-primary shadow-sm transition-opacity hover:opacity-95"
          >
            Try again
          </button>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="inline-flex h-9 items-center rounded-lg border border-border px-3 text-sm font-medium text-on-surface-variant transition-colors hover:border-primary/70 hover:text-primary"
          >
            Reload the page
          </button>
        </div>
      </div>
    </div>
  );
}
