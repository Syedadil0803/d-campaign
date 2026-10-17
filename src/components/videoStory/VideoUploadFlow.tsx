'use client';

import { useState, type DragEvent, type ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, Upload } from 'lucide-react';
import { formatMB, shapeTip, VIDEO_UPLOADS_ENABLED } from '@/lib/videoStory/videoUpload';
import { VIDEO_SPECS } from '@/lib/videoStory/videoRules';
import { EditYourselfButton } from '@/components/videoStory/EditYourselfDialog';
import { useVideoStory } from '@/components/videoStory/VideoStoryContext';

const PRIMARY = 'inline-flex h-8 items-center rounded-lg bg-primary px-3 text-xs font-semibold text-on-primary shadow-sm transition-opacity hover:opacity-95';
const SECONDARY = 'inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-border bg-surface-elevated px-3 text-xs font-medium text-on-surface transition-colors hover:bg-surface-subtle hover:text-primary';
// The dropzone and every state that replaces it share one box, so the area
// never jumps in shape as the clip moves from picked to uploaded.
const BOX = 'rounded-xl border p-4 text-sm';


function Panel({ children, tone = 'plain' }: { children: ReactNode; tone?: 'plain' | 'warn' }) {
  return (
    <div
      role="status"
      className={`${BOX} space-y-3 ${tone === 'warn' ? 'border-amber-500/40 bg-amber-500/[0.06]' : 'border-border bg-surface-subtle'}`}
    >
      {children}
    </div>
  );
}

/**
 * The Video Story upload in one place, under the Content heading: an empty
 * dropzone, the progress of the clip in hand, or the clip in use — one box
 * that changes, so the user never looks elsewhere for what happened.
 */
export function VideoUploadFlow() {
  const { draft, openPicker, videoStory } = useVideoStory();
  const { step } = draft;
  // Start Fresh (and every new pick) resets first, so "Choose another" only
  // needs the picker; the pick itself cancels whatever was running.
  const another = <button type="button" onClick={openPicker} className={SECONDARY}>Choose another</button>;

  let body: ReactNode;
  switch (step.name) {
    // Both are a label and a bar; the MP4 conversion comes first, then the upload.
    case 'converting':
    case 'uploading': {
      const pct = Math.round(step.progress * 100);
      // One word for every re-wrap and re-encode: the owner only needs to know the video is nearly ready.
      const label = step.name === 'uploading' ? 'Uploading…' : 'Preparing your video…';
      body = (
        <Panel>
          <div className="flex items-center justify-between gap-3 text-xs font-medium text-on-surface">
            <span className="tabular-nums">{label} {pct}%</span>
            {/* Re-encoding can take minutes; reset stops it and brings back the dropzone. */}
            {step.name === 'converting' && <button type="button" onClick={draft.reset} className={SECONDARY}>Cancel</button>}
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-border" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
            <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${pct}%` }} />
          </div>
        </Panel>
      );
      break;
    }
    case 'uploadFailed':
      body = (
        <Panel tone="warn">
          <p className="text-on-surface">{step.message}</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={draft.retryUpload} className={PRIMARY}>Try again</button>
            {another}
          </div>
        </Panel>
      );
      break;
    case 'help':
      body = (
        <Panel tone="warn">
          <div className="flex items-start justify-between gap-3">
            <p className="text-on-surface">{step.reason}</p>
            {another}
          </div>
          <div><EditYourselfButton className={SECONDARY} /></div>
          {step.detail && (
            <details className="text-xs text-on-surface-variant">
              <summary className="cursor-pointer select-none">Technical detail</summary>
              <p className="mt-1 break-words font-mono">{step.detail}</p>
            </details>
          )}
        </Panel>
      );
      break;
    case 'idle':
      body = draft.localUrl || videoStory.videoUrl ? <ResultCard another={another} /> : <Dropzone />;
  }

  return <div className="!mt-4">{body}</div>;
}

/** The empty state. The whole box is one button, so Enter/Space open the picker for free. */
function Dropzone() {
  const { draft, openPicker } = useVideoStory();
  const [over, setOver] = useState(false);
  const onDrag = (e: DragEvent) => { e.preventDefault(); setOver(true); };

  return (
    <button
      type="button"
      onClick={openPicker}
      onDragEnter={onDrag}
      onDragOver={onDrag}
      // Leaving onto a child also fires dragleave; only a real exit clears it.
      onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOver(false); }}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        const file = e.dataTransfer.files[0];
        if (file) draft.pick(file);
      }}
      className={`${BOX} flex w-full flex-col items-center gap-2 border-2 border-dashed text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${
        over ? 'border-primary bg-primary/[0.06]' : 'border-border bg-surface-subtle hover:border-primary/50'
      }`}
    >
      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Upload className="h-5 w-5" />
      </span>
      <span>
        <span className="font-semibold text-primary">Upload a video</span>
        <span className="text-on-surface-variant"> or drag a file here</span>
      </span>
      <span className="flex flex-wrap justify-center gap-1.5">
        {VIDEO_SPECS.map((s) => (
          <span key={s} className="rounded-full border border-border bg-surface-elevated px-2 py-0.5 text-[11px] font-medium text-on-surface-variant">{s}</span>
        ))}
      </span>
    </button>
  );
}

/**
 * The clip in use. `info` is missing for a video saved earlier (only its
 * address is stored), so the card then says just that it is ready.
 */
function ResultCard({ another }: { another: ReactNode }) {
  const { info } = useVideoStory().draft;
  const shape = info && shapeTip(info.width ?? 0, info.height ?? 0);
  return (
    <Panel>
      <div className="flex items-center justify-between gap-3">
        <p className="inline-flex items-center gap-1.5 font-semibold text-on-surface">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" /> Video ready
        </p>
        {another}
      </div>
      {info && (
        <div className="space-y-1 text-xs text-on-surface-variant">
          <p className="flex min-w-0 gap-2">
            <span className="shrink-0 tabular-nums text-on-surface">
              {formatMB(info.size)}{Number.isFinite(info.seconds) ? ` · ${Math.round(info.seconds)} s` : ''}
            </span>
            <span className="truncate" title={info.name}>{info.name}</span>
          </p>
          {/* Said because, unlike the quiet MP4 conversion, it changes what the owner hears. */}
          {info.soundRemoved && <p>Audio removed (unsupported format).</p>}
        </div>
      )}
      {/* Accepted, but said loudly: a wide video loses its sides in the vertical widget. */}
      {shape && (
        <div role="alert" className="flex gap-2 rounded-lg border border-amber-500/40 bg-amber-500/[0.08] p-3 text-sm text-amber-800 dark:text-amber-300">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <p>{shape}</p>
        </div>
      )}
      {!VIDEO_UPLOADS_ENABLED && (
        <p className="text-xs text-amber-700 dark:text-amber-400">
          Preview only. Uploads aren&apos;t enabled yet.
        </p>
      )}
      <div><EditYourselfButton className={SECONDARY} /></div>
    </Panel>
  );
}
