'use client';

import { useRef, useState } from 'react';
import type { CampaignConfig, VideoStory } from '@/types/campaign';
import { videoStoryDiffers } from '@/lib/configSignature';

/**
 * The Video Story's half of the draft row: what is saved there, when, and how
 * it is written.
 *
 * Its own baseline rather than a share of the card's: the video has its own
 * column (/api/draft/video-story), and borrowing the card's flags is exactly
 * how a video edit used to light "Unpublished changes" on the Smart Card.
 * Kept out of useCampaignDraft so that file stays about the card and the bar.
 */
export function useVideoStoryDraftSync() {
  /** The Video Story as saved in the draft row; null when none is. */
  const [videoDraft, setVideoDraftState] = useState<VideoStory | null>(null);
  // Mirrored in a ref because saves are decided inside event handlers, often
  // straight after a write that has not re-rendered yet.
  const videoDraftRef = useRef<VideoStory | null>(null);
  const [videoSavedAt, setVideoSavedAt] = useState<Date | null>(null);
  /**
   * The editor's Video Story is not safe anywhere. Filled during render by
   * useEditorWorkStatus, the same way promoWorkNotInDraftRef is, so the exit
   * guards and idle sign-out can read it from their once-bound listeners.
   */
  const videoWorkNotInDraftRef = useRef(false);

  function setVideoDraft(vs: VideoStory | null) {
    const copy = vs ? structuredClone(vs) : null;
    videoDraftRef.current = copy;
    setVideoDraftState(copy);
  }

  /**
   * Unsaved means it differs from where it would come back from on the next
   * visit: the draft when one is saved, otherwise what is live.
   */
  function videoNeedsSaving(cfg: CampaignConfig, live: CampaignConfig | null): boolean {
    return videoStoryDiffers(cfg.videoStory, videoDraftRef.current ?? live?.videoStory);
  }

  function putVideoDraft(vs: VideoStory | undefined, keepalive = false): Promise<Response> {
    return fetch('/api/draft/video-story', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ videoStory: vs }),
      keepalive,
    });
  }

  /** A write landed: what was sent is now the baseline. */
  function markVideoSaved(cfg: CampaignConfig, at: Date) {
    setVideoDraft(cfg.videoStory ?? null);
    setVideoSavedAt(at);
  }

  /** The column was cleared — by a publish, or the whole row going. */
  function forgetVideoDraft() {
    setVideoDraft(null);
    setVideoSavedAt(null);
  }

  return {
    videoDraft,
    setVideoDraft,
    videoSavedAt,
    setVideoSavedAt,
    videoWorkNotInDraftRef,
    videoNeedsSaving,
    putVideoDraft,
    markVideoSaved,
    forgetVideoDraft,
  };
}
