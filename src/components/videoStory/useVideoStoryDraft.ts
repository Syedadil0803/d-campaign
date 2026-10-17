'use client';

import { useEffect, useRef, useState } from 'react';
import { clipProblem, VIDEO_UPLOADS_ENABLED } from '@/lib/videoStory/videoUpload';
import { isAcceptedVideo, VIDEO_MAX_BYTES, videoContentType } from '@/lib/videoStory/videoRules';
import { uploadClip, UploadError } from '@/components/videoStory/clipTransfer';

/** What the result card says about the clip in hand. */
/** `name` is the file the owner picked, even when what is kept is an MP4 made from it. */
interface ClipInfo { name: string; size: number; seconds: number; width?: number; height?: number; soundRemoved?: boolean }

/**
 * Where the upload flow is. Every step that is not 'idle' shows a panel with
 * a way forward — the flow never ends on a bare error.
 */
export type UploadStep =
  | { name: 'idle' }
  // `detail` is the raw error behind a failed conversion, for whoever helps the owner.
  | { name: 'help'; reason: string; detail?: string }
  // The MP4 being made from a MOV or HEVC clip. The UI calls it preparing:
  // the owner picked a video, and how it is made to play everywhere is ours to handle.
  | { name: 'converting'; progress: number }
  | { name: 'uploading'; progress: number }
  | { name: 'uploadFailed'; message: string; file: File };

/**
 * The clip chosen for a Video Story and its way to storage: check → upload →
 * `onUploaded(publicUrl)`. A clip outside the rules (MP4 or MOV, up to VIDEO_MAX_BYTES) is
 * refused with the reason. The one change made to a video: it becomes an
 * H.264 MP4 first when it isn't one (movToMp4) — an H.264 MOV re-wrapped,
 * the same frames in a box every browser plays, or an HEVC clip re-encoded
 * in this browser when it can.
 * Held by the Campaigns panel rather than the Video Story section, so
 * switching to Smart Card and back keeps it.
 *
 * `localUrl` is a local object URL, so the preview plays at once and keeps
 * playing from memory while (and after) the upload runs.
 *
 * Once the clip is in, a small silent copy for the widget is made in the
 * background (makePreview) and uploaded after it: `onPreview(url)`, and
 * `localPreviewUrl` for the editor. The full clip never waits for it.
 */
export function useVideoStoryDraft(onUploaded: (publicUrl: string) => void, onPreview: (publicUrl: string) => void) {
  const [step, setStep] = useState<UploadStep>({ name: 'idle' });
  const [localUrl, setLocalUrl] = useState<string | null>(null);
  const [localPreviewUrl, setLocalPreviewUrl] = useState<string | null>(null);
  const [info, setInfo] = useState<ClipInfo | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  // Bumped by every new pick and by Start Fresh, so an upload
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
    setLocalPreviewUrl(null);
    setInfo(null);
    setStep({ name: 'idle' });
  }

  async function upload(file: File, url = objectUrl(file)) {
    const run = runRef.current;
    setLocalUrl(url);
    // Browser-only mode: the clip stays in this tab for the preview.
    if (!VIDEO_UPLOADS_ENABLED) { setStep({ name: 'idle' }); void preview(file, run); return; }
    setStep({ name: 'uploading', progress: 0 });
    try {
      const publicUrl = await uploadClip(file, (progress) => {
        if (run === runRef.current) setStep({ name: 'uploading', progress });
      });
      if (run !== runRef.current) return;
      onUploaded(publicUrl);
      setStep({ name: 'idle' });
      void preview(file, run);
    } catch (e) {
      if (run !== runRef.current) return;
      if (e instanceof UploadError && e.notSetUp) {
        setLocalUrl(null);
        setStep({ name: 'help', reason: e.message });
      } else {
        setStep({ name: 'uploadFailed', file, message: e instanceof Error ? e.message : 'Upload failed. Please try again.' });
      }
    }
  }

  async function pick(picked: File) {
    reset();
    let file = picked;
    // A dropped file skips the picker's accept list, so check here. An
    // MP4/MOV with no reported type still counts (isAcceptedVideo); any
    // other video goes on to clipProblem for the full reason.
    if (!isAcceptedVideo(file) && !file.type.startsWith('video/')) {
      setStep({ name: 'help', reason: "This file isn't a video. Choose an MP4 or MOV." });
      return;
    }
    const run = runRef.current;
    let mov: Pick<ClipInfo, 'soundRemoved'> = {};
    const type = videoContentType(file);
    if (type) {
      const isMp4 = type === 'video/mp4';
      // The size rule applies before converting (no point reading 2 GB) and
      // again to the result, through movToMp4 and clipProblem below.
      if (file.size > VIDEO_MAX_BYTES) { setStep({ name: 'help', reason: clipProblem(file, 0)! }); return; }
      // A MOV is always converted, so its bar shows at once; an MP4 only
      // gets one if it turns out to be HEVC.
      if (!isMp4) setStep({ name: 'converting', progress: 0 });
      const abort = new AbortController();
      abortRef.current = abort;
      try {
        const { movToMp4 } = await import('@/components/videoStory/movToMp4');
        const result = await movToMp4(file, {
          isMp4,
          signal: abort.signal,
          onProgress: (progress) => { if (run === runRef.current) setStep({ name: 'converting', progress }); },
        });
        if (run !== runRef.current) return;
        if ('refuse' in result) { setStep({ name: 'help', reason: result.refuse, detail: result.detail }); return; }
        if ('file' in result) {
          file = result.file;
          mov = { soundRemoved: result.soundRemoved };
        }
      } catch {
        if (run !== runRef.current) return;
        // An MP4 only went in to be checked for HEVC; if that check fails
        // it carries on as picked, as it did before the check existed.
        if (!isMp4) {
          setStep({ name: 'help', reason: "This video couldn't be converted. Export as H.264 MP4." });
          return;
        }
      }
    }
    const probeUrl = objectUrl(file);
    const probe = document.createElement('video');
    probe.preload = 'metadata';
    // NaN = the browser cannot read it.
    const decide = (seconds: number, width = 0, height = 0) => {
      if (run !== runRef.current) return;
      const problem = clipProblem(file, seconds);
      if (problem) { setStep({ name: 'help', reason: problem }); return; }
      setInfo({ name: picked.name, size: file.size, seconds, width, height, ...mov });
      void upload(file);
    };
    probe.onloadedmetadata = () => decide(probe.duration, probe.videoWidth, probe.videoHeight);
    probe.onerror = () => decide(NaN);
    probe.src = probeUrl;
  }

  /** Makes the widget's preview copy and, when uploads are on, stores it. Failures are silent: the full clip covers. */
  async function preview(file: File, run: number) {
    const abort = new AbortController();
    abortRef.current = abort;
    const { makePreview } = await import('@/components/videoStory/movToMp4');
    const small = await makePreview(file, abort.signal);
    if (!small || run !== runRef.current) return;
    setLocalPreviewUrl(objectUrl(small));
    if (!VIDEO_UPLOADS_ENABLED) return;
    try {
      const publicUrl = await uploadClip(small, () => {});
      if (run === runRef.current) onPreview(publicUrl);
    } catch { /* the widget plays the full clip instead */ }
  }

  function retryUpload() { if (step.name === 'uploadFailed') void upload(step.file, localUrl ?? undefined); }

  return {
    step,
    info,
    localUrl,
    localPreviewUrl,
    pick, retryUpload, reset,
  };
}
