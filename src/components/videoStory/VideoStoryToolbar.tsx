'use client';

import { History } from 'lucide-react';
import { useVideoStory } from '@/components/videoStory/VideoStoryContext';
import { WidgetPositionControl } from '@/components/shared/WidgetPositionControl';

/**
 * The action strip above the preview when Video Story is selected. Its own
 * file so the Smart Card toolbar stays untouched.
 *
 * Uploading lives in the Content section, beside its messages, not here.
 * Template Hub and Styling Studio are left out — both shape a text card's
 * design and colours, which a video replaces.
 */
export function VideoStoryToolbar({
  setShowVersionsPopup,
}: {
  setShowVersionsPopup: (show: boolean) => void;
}) {
  const { updateVideoStory, videoStory, positionWarning } = useVideoStory();

  return (
    <div className="flex shrink-0 flex-col gap-2 border-t border-border pt-3">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setShowVersionsPopup(true)}
          className="tool-chip relative inline-flex h-9 items-center gap-1.5 overflow-hidden whitespace-nowrap rounded-lg border border-on-surface-variant/40 px-3 py-2 text-sm font-medium text-on-surface-variant transition-colors hover:border-primary/70 hover:bg-primary/10 hover:text-primary"
          title="Saved variants of this campaign"
        >
          <span aria-hidden="true" className="ai-sheen pointer-events-none absolute inset-0" />
          <History className="h-4 w-4" /> My Published
        </button>
      </div>

      <div className="flex justify-end">
        <WidgetPositionControl
          label="Video Story position"
          value={videoStory.position}
          onChange={(v) => updateVideoStory({ position: v as typeof videoStory.position })}
          warning={positionWarning}
        />
      </div>
    </div>
  );
}
