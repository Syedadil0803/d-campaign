'use client';

import { useCallback, useEffect, useState } from 'react';
import { checkVideoDuration, checkVideoFile } from '@/lib/videoStory/videoRules';

export interface VideoStoryClip {
  name: string;
  /** A local object URL — the clip has not been uploaded anywhere yet. */
  url: string;
  seconds: number;
}

/**
 * The clip chosen for a Video Story, held by the Campaigns panel rather than
 * the Video Story section, so switching to Smart Card and back keeps it.
 *
 * Local only for now: uploading to storage is the next step, and it will
 * replace `url` with the stored address.
 */
export function useVideoStoryDraft() {
  const [clip, setClip] = useState<VideoStoryClip | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Object URLs hold the file in memory until revoked.
  useEffect(() => () => { if (clip) URL.revokeObjectURL(clip.url); }, [clip]);

  const pick = useCallback((file: File) => {
    const problem = checkVideoFile(file);
    if (problem) { setError(problem); return; }
    const url = URL.createObjectURL(file);
    const probe = document.createElement('video');
    probe.preload = 'metadata';
    probe.onloadedmetadata = () => {
      const tooLong = checkVideoDuration(probe.duration);
      if (tooLong) { URL.revokeObjectURL(url); setError(tooLong); return; }
      setError(null);
      setClip({ name: file.name, url, seconds: probe.duration });
    };
    probe.onerror = () => { URL.revokeObjectURL(url); setError(checkVideoDuration(NaN)); };
    probe.src = url;
  }, []);

  const clear = useCallback(() => { setClip(null); setError(null); }, []);

  return { clip, error, pick, clear };
}

