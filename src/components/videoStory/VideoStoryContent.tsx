'use client';

import { RotateCcw } from 'lucide-react';
import { useVideoStory } from '@/components/videoStory/VideoStoryContext';
import { VideoUploadFlow } from '@/components/videoStory/VideoUploadFlow';
import { VideoTitleEditor } from '@/components/videoStory/VideoTitleEditor';
import { useState } from 'react';
import { FieldInfoNote } from '@/components/promo/FieldInfoNote';
import { hideFieldInfo, readHiddenFieldInfos } from '@/lib/promo/fieldInfoNotes';
import { SHAPES_ACCEPTED_NOTE } from '@/lib/videoStory/videoUpload';

/**
 * The Content section for a Video Story. Same heading, spacing and Start
 * Fresh button as the Smart Card's Content section. Below them, the whole
 * upload (VideoUploadFlow), then the title drawn over the top of the clip;
 * the clip itself plays in the preview.
 * The schedule and call to action below it are its own (VideoStorySchedule,
 * VideoStoryCta).
 */
export function VideoStoryContent() {
  const [hiddenNotes, setHiddenNotes] = useState(readHiddenFieldInfos);
  const [shapesNoteClosed, setShapesNoteClosed] = useState(false);
  const { draft, videoStory, updateVideoStory } = useVideoStory();
  const hasVideo = Boolean(draft.localUrl || videoStory.videoUrl);
  // Start Fresh drops the stored address too; the upload in R2 is left
  // behind (a later cleanup's job — it costs fractions of a cent).
  const clear = () => { draft.reset(); updateVideoStory({ videoUrl: '', previewUrl: '' }); };

  return (
    <>
      <div className="!mt-8 flex items-end justify-between gap-3">
        <div>
          <h4 className="text-2xl font-semibold leading-8 text-on-surface">Video &amp; Title</h4>
          <p className="mt-2 text-sm text-on-surface-variant">
            Upload the video shown on your site.
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

      {/* What the upload takes, the Smart Card's info note: "Got it" for now,
          "Don't show again" for good (remembered in this browser). */}
      <FieldInfoNote
        open={!shapesNoteClosed && !hiddenNotes.has('video-shapes')}
        onDismiss={() => setShapesNoteClosed(true)}
        onNeverShow={() => setHiddenNotes((h) => hideFieldInfo(h, 'video-shapes'))}
      >
        {SHAPES_ACCEPTED_NOTE}
      </FieldInfoNote>
      <VideoUploadFlow />

      {/* Its own sub-block, styled like "Campaign Duration", so the title
          reads as part of this section rather than a field left after the upload. */}
      <VideoTitleEditor />
    </>
  );
}
