'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowUpRight, X } from 'lucide-react';

/** Free editors that export a widget-ready video, with what each is for (the tooltip). */
const EDITORS = [
  {
    name: 'CapCut',
    href: 'https://www.capcut.com',
    tip: 'Trim, crop to 9:16 and export as MP4, on your phone or computer.',
  },
  {
    name: 'Canva',
    href: 'https://www.canva.com/video-editor/',
    tip: 'Resize to 9:16 and trim in your browser, then download as MP4.',
  },
  {
    name: 'HandBrake',
    href: 'https://handbrake.fr',
    tip: 'Make a large video smaller on your computer, keeping it MP4.',
  },
];

/**
 * "Edit it yourself": a button that opens the free apps to fix a video in.
 * A popup rather than an inline list, so the links never crowd the upload
 * card. Same panel as ConfirmDialog; each app is one row link.
 */
export function EditYourselfButton({ className }: { className: string }) {
  const [open, setOpen] = useState(false);
  // The app picked, waiting on the disclaimer before it opens.
  const [leaving, setLeaving] = useState<(typeof EDITORS)[number] | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  const close = () => {
    setOpen(false);
    setLeaving(null);
    triggerRef.current?.focus();
  };

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    // Escape steps back from the notice first, then closes.
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setLeaving((l) => { if (!l) close(); return null; });
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <>
      <button ref={triggerRef} type="button" onClick={() => setOpen(true)} className={className}>
        Edit it yourself
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0" onClick={close} />
          {/* The app's dialog panel, exactly as ConfirmDialog: no per-dialog colours. */}
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-yourself-title"
            className="relative z-10 w-full max-w-md rounded-xl border border-white/10 bg-black/10 p-5 text-on-surface shadow-2xl backdrop-blur-md"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 id="edit-yourself-title" className="text-base font-semibold">
                  {leaving ? `Opening ${leaving.name}` : 'Edit your video'}
                </h2>
                {!leaving && <p className="mt-1 text-sm text-on-surface-variant">Fix it in a free app, then upload it again.</p>}
              </div>
              <button
                ref={closeRef}
                type="button"
                onClick={close}
                aria-label="Close"
                className="rounded-md p-1 text-on-surface-variant transition-colors hover:text-primary"
              >
                <X className="h-4 w-4" />
              </button>
            </div>


            {/* Each app is one row link: 8px corners, 1px etch, orange only on hover. */}
            {leaving ? (
              /* The disclaimer, shown each time an app is picked: the app isn't
                 ours and we don't endorse it. Continue opens the app. */
              <div className="mt-4 text-sm text-on-surface-variant">
                <p>
                  {leaving.name} is a third-party app. We don&apos;t own or endorse it, and we
                  don&apos;t share your video or any of your data with it.
                </p>
                <div className="mt-4 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setLeaving(null)}
                    className="rounded-md border border-white/10 bg-transparent px-4 py-2 text-sm font-medium text-on-surface-variant transition-colors hover:border-primary/70 hover:text-primary"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    autoFocus
                    onClick={() => {
                      window.open(leaving.href, '_blank', 'noopener,noreferrer');
                      close();
                    }}
                    className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-on-primary shadow-sm transition-opacity hover:opacity-95"
                  >
                    Continue to {leaving.name}
                  </button>
                </div>
              </div>
            ) : (
              <>
                {/* Each row has a tooltip on hover saying what the app does, in the
                    Devlin site's style: a dark bubble below the link. Hover only,
                    so touch screens skip it. */}
            <ul className="mt-4 space-y-2">
              {EDITORS.map((e) => (
                <li key={e.name} className="group/tip relative">
                  <a
                    href={e.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    // The disclaimer comes first; Continue opens the app.
                    onClick={(ev) => { ev.preventDefault(); setLeaving(e); }}
                    className="group flex min-h-[44px] items-center gap-3 rounded-lg border border-border px-3 py-2.5 transition-colors hover:border-primary/70"
                  >
                    <span className="min-w-0 flex-1 text-sm font-medium text-on-surface group-hover:text-primary">{e.name}</span>
                    <ArrowUpRight className="h-4 w-4 shrink-0 text-on-surface-variant group-hover:text-primary" />
                  </a>
                  <span
                    role="tooltip"
                    className="pointer-events-none absolute left-1/2 top-[calc(100%+8px)] z-20 w-64 -translate-x-1/2 -translate-y-1 rounded-md bg-[#151515] px-4 py-2.5 text-center text-xs leading-relaxed text-white opacity-0 shadow-lg transition-all duration-200 group-hover/tip:visible group-hover/tip:translate-y-0 group-hover/tip:opacity-100 invisible [@media(hover:none)]:hidden"
                  >
                    {e.tip}
                    <span aria-hidden="true" className="absolute bottom-full left-1/2 -translate-x-1/2 border-[6px] border-transparent border-b-[#151515]" />
                  </span>
                </li>
              ))}
            </ul>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
