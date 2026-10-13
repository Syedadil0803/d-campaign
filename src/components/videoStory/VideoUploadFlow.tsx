'use client';

import { useState, type DragEvent, type ReactNode } from 'react';
import { CheckCircle2, ExternalLink, Upload } from 'lucide-react';
import { formatMB } from '@/lib/videoStory/videoUpload';
import { useVideoStory } from '@/components/videoStory/VideoStoryContext';

const PRIMARY = 'inline-flex h-8 items-center rounded-lg bg-primary px-3 text-xs font-semibold text-on-primary shadow-sm transition-opacity hover:opacity-95';
const SECONDARY = 'inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-border bg-surface-elevated px-3 text-xs font-medium text-on-surface transition-colors hover:bg-surface-subtle hover:text-primary';
// The dropzone and every state that replaces it share one box, so the area
// never jumps in shape as the clip moves from picked to uploaded.
const BOX = 'rounded-xl border p-4 text-sm';

const SPECS = ['MP4', 'Up to 15 s', 'Up to 10 MB', 'Vertical 9:16'];

/** Free editors that export a widget-ready clip; HandBrake gets its preset named. */
const EDITORS = [
  { name: 'CapCut', href: 'https://www.capcut.com' },
  { name: 'Canva video editor', href: 'https://www.canva.com/video-editor/' },
  { name: 'HandBrake', href: 'https://handbrake.fr', hint: 'preset: Fast 720p30' },
];

/** What to make and where to make it — the floor under every failure, and the "Edit it yourself" content. */
function EditorHelp() {
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-on-surface">MP4 · under 15 seconds · under 10 MB · 720p is plenty</p>
      <ul className="space-y-1.5 text-xs">
        {EDITORS.map((e) => (
          <li key={e.name}>
            <a href={e.href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-medium text-primary hover:underline">
              {e.name} <ExternalLink className="h-3 w-3" />
            </a>
            {e.hint && <span className="text-on-surface-variant"> — {e.hint}</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}

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
    case 'compressing':
    case 'uploading': {
      const pct = Math.round(step.progress * 100);
      body = (
        <Panel>
          <div className="flex items-center justify-between text-xs font-medium text-on-surface">
            <span className="tabular-nums">{step.name === 'compressing' ? 'Making it smaller…' : 'Uploading…'} {pct}%</span>
            {step.name === 'compressing' && (
              <button type="button" onClick={draft.cancel} className="text-on-surface-variant hover:text-primary hover:underline">Cancel</button>
            )}
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
          <EditorHelp />
          {step.detail && (
            <details className="text-[11px] text-on-surface-variant">
              <summary className="cursor-pointer">Technical detail</summary>
              <code className="mt-1 block break-words">{step.detail}</code>
            </details>
          )}
        </Panel>
      );
      break;
    case 'idle':
      body = draft.previewUrl || videoStory.videoUrl ? <ResultCard another={another} /> : <Dropzone />;
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
        {SPECS.map((s) => (
          <span key={s} className="rounded-full border border-border bg-surface-elevated px-2 py-0.5 text-[11px] font-medium text-on-surface-variant">{s}</span>
        ))}
      </span>
      <span className="text-xs text-on-surface-variant">Bigger or longer clips are shrunk and trimmed for you.</span>
    </button>
  );
}

/**
 * The clip in use. `info` is missing for a video saved earlier (only its
 * address is stored), so the card then says just that it is ready.
 */
function ResultCard({ another }: { another: ReactNode }) {
  const { info } = useVideoStory().draft;
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
          {info.note && <p>{info.note}</p>}
        </div>
      )}
      <details className="text-xs">
        <summary className="cursor-pointer font-medium text-on-surface-variant hover:text-primary">Edit it yourself</summary>
        <div className="mt-2"><EditorHelp /></div>
      </details>
    </Panel>
  );
}
