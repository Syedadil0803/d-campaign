'use client';

import { RotateCcw } from 'lucide-react';
import { useVideoStory } from '@/components/videoStory/VideoStoryContext';
import { VideoUploadFlow } from '@/components/videoStory/VideoUploadFlow';

/**
 * The Content section for a Video Story. Same heading, spacing and Start
 * Fresh button as the Smart Card's Content section. Below them, the whole
 * upload (VideoUploadFlow); the clip itself plays in the preview.
 * The schedule and call to action below it are its own (VideoStorySchedule,
 * VideoStoryCta).
 */
export function VideoStoryContent() {
  const { draft, videoStory, updateVideoStory } = useVideoStory();
  const hasVideo = Boolean(draft.previewUrl || videoStory.videoUrl);
  // Start Fresh drops the stored address too; the upload in R2 is left
  // behind (a later cleanup's job — it costs fractions of a cent).
  const clear = () => { draft.reset(); updateVideoStory({ videoUrl: '' }); };

  return (
    <>
      <div className="!mt-8 flex items-end justify-between gap-3">
        <div>
          <h4 className="text-2xl font-semibold leading-8 text-on-surface">Content</h4>
          <p className="mt-2 text-sm text-on-surface-variant">
            Short vertical video shown in the widget.
          </p>
        </div>
        <button
          type="button"
          onClick={clear}
          disabled={!hasVideo && draft.step.name === 'idle'}
          className="tool-chip relative inline-flex h-8 shrink-0 items-center gap-1.5 overflow-hidden whitespace-nowrap rounded-lg border border-on-surface-variant/25 px-2.5 text-xs font-medium text-on-surface-variant/80 transition-colors hover:border-primary/70 hover:bg-primary/10 hover:text-primary disabled:cursor-not-allowed disabled:opacity-40"
          title={hasVideo ? 'Remove the video and start again' : 'Nothing to refresh — no video yet.'}
        >
          <span aria-hidden="true" className="ai-sheen pointer-events-none absolute inset-0" />
          <RotateCcw className="h-3.5 w-3.5" />
          Start Fresh
        </button>
      </div>

      <VideoUploadFlow />
    </>
  );
}
