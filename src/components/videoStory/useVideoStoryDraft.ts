'use client';

import { useEffect, useRef, useState } from 'react';
import { VIDEO_MAX_BYTES } from '@/lib/videoStory/videoRules';
import { clipEnd, formatMB, needsShrink, shrinkNote, VIDEO_BITRATES } from '@/lib/videoStory/videoUpload';
import { compressClip, CompressionUnsupported, uploadClip, UploadError } from '@/components/videoStory/clipTransfer';

/**
 * What the result card says about the clip in hand: what was sent (size,
 * seconds) and, when it was re-encoded, the line saying what changed.
 */
interface ClipInfo { name: string; size: number; seconds: number; note: string | null }

/**
 * Where the upload flow is. Every step that is not 'idle' shows a panel with
 * a way forward — the flow never ends on a bare error.
 */
export type UploadStep =
  | { name: 'idle' }
  | { name: 'compressing'; progress: number }
  // `detail` is the raw error, kept for support behind a disclosure.
  | { name: 'help'; reason: string; detail?: string }
  | { name: 'uploading'; progress: number }
  | { name: 'uploadFailed'; message: string; blob: Blob };

/**
 * The clip chosen for a Video Story and its way to storage: check → (shrink)
 * → upload → `onUploaded(publicUrl)`, with no stop in between — the shrink is
 * the only fix on offer, so asking first would be a click with one answer.
 * Held by the Campaigns panel rather than the Video Story section, so
 * switching to Smart Card and back keeps it.
 *
 * `previewUrl` is a local object URL, so the preview plays at once and keeps
 * playing from memory while (and after) the upload runs.
 */
export function useVideoStoryDraft(onUploaded: (publicUrl: string) => void) {
  const [step, setStep] = useState<UploadStep>({ name: 'idle' });
  const [localUrl, setLocalUrl] = useState<string | null>(null);
  const [info, setInfo] = useState<ClipInfo | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  // Bumped by every new pick and by Start Fresh, so a compression or upload
  // still finishing for an abandoned clip cannot write over the new state.
  const runRef = useRef(0);
  // Object URLs hold the file in memory until revoked. Every URL made here
  // belongs to the current clip, so they all go when the clip does.
  const urlsRef = useRef<string[]>([]);
  const objectUrl = (blob: Blob) => {
    const url = URL.createObjectURL(blob);
    urlsRef.current.push(url);
    return url;
  };
  const revokeAll = () => { urlsRef.current.forEach((u) => URL.revokeObjectURL(u)); urlsRef.current = []; };
  useEffect(() => revokeAll, []);

  function reset() {
    runRef.current += 1;
    abortRef.current?.abort();
    revokeAll();
    setLocalUrl(null);
    setInfo(null);
    setStep({ name: 'idle' });
  }

  async function upload(blob: Blob, url = objectUrl(blob)) {
    const run = runRef.current;
    setLocalUrl(url);
    setStep({ name: 'uploading', progress: 0 });
    try {
      const publicUrl = await uploadClip(blob, (progress) => {
        if (run === runRef.current) setStep({ name: 'uploading', progress });
      });
      if (run !== runRef.current) return;
      onUploaded(publicUrl);
      setStep({ name: 'idle' });
    } catch (e) {
      if (run !== runRef.current) return;
      if (e instanceof UploadError && e.notSetUp) {
        setLocalUrl(null);
        setStep({ name: 'help', reason: e.message });
      } else {
        setStep({ name: 'uploadFailed', blob, message: e instanceof Error ? e.message : 'The upload failed. Try again.' });
      }
    }
  }

  function pick(file: File) {
    reset();
    // A dropped file skips the picker's accept="video/*", so check here.
    if (!file.type.startsWith('video/')) {
      setStep({ name: 'help', reason: `${file.name} is not a video. Choose an MP4 or a phone video.` });
      return;
    }
    const run = runRef.current;
    const probeUrl = objectUrl(file);
    const probe = document.createElement('video');
    probe.preload = 'metadata';
    // NaN = the browser cannot read it; the re-encode may still manage it.
    const decide = (seconds: number) => {
      if (run !== runRef.current) return;
      if (!needsShrink(file, seconds)) {
        setInfo({ name: file.name, size: file.size, seconds, note: null });
        void upload(file);
      } else void shrink(file, seconds);
    };
    probe.onloadedmetadata = () => decide(probe.duration);
    probe.onerror = () => decide(NaN);
    probe.src = probeUrl;
  }

  /** The re-encode, with one automatic retry at the lower bitrate if still over 10 MB; then straight to upload. */
  async function shrink(file: File, seconds: number) {
    const run = runRef.current;
    const abort = new AbortController();
    abortRef.current = abort;
    const started = performance.now();
    setStep({ name: 'compressing', progress: 0 });
    try {
      let blob: Blob | null = null;
      // A retry restarts the bar: the lower bitrate is a fresh pass.
      for (const bitrate of VIDEO_BITRATES) {
        blob = await compressClip(file, bitrate, (progress) => {
          if (run === runRef.current) setStep({ name: 'compressing', progress });
        }, abort.signal);
        if (blob.size <= VIDEO_MAX_BYTES) break;
      }
      if (run !== runRef.current || !blob) return;
      console.info(`[VideoStory] compressed ${formatMB(file.size)} → ${formatMB(blob.size)} in ${((performance.now() - started) / 1000).toFixed(1)} s`);
      if (blob.size > VIDEO_MAX_BYTES) {
        setStep({ name: 'help', reason: `Even made smaller, this video is ${formatMB(blob.size)} — the limit is 10 MB.` });
        return;
      }
      setInfo({ name: file.name, size: blob.size, seconds: clipEnd(seconds), note: shrinkNote({ type: file.type, size: file.size, seconds }) });
      void upload(blob);
    } catch (e) {
      if (run !== runRef.current) return;
      // Cancel leaves nothing half-done: back to the empty dropzone.
      if (abort.signal.aborted) { reset(); return; }
      console.error('[VideoStory] compression failed:', e);
      const detail = e instanceof Error ? e.message : String(e);
      if (e instanceof CompressionUnsupported) {
        // Most often an iPhone HEVC clip in a browser without an HEVC decoder.
        const reason = detail.includes('undecodable')
          ? "This browser can't open this video's format (often iPhone HEVC). Convert it in an editor below."
          : "This browser can't make the video smaller.";
        setStep({ name: 'help', reason, detail });
      }
      else setStep({ name: 'help', reason: 'The video could not be made smaller.', detail });
    }
  }

  function cancel() { abortRef.current?.abort(); }

  function retryUpload() { if (step.name === 'uploadFailed') void upload(step.blob, localUrl ?? undefined); }

  return {
    step,
    info,
    previewUrl: localUrl,
    pick, cancel, retryUpload, reset,
  };
}
