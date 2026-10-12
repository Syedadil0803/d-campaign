'use client';

import { History, Upload } from 'lucide-react';
import { useVideoStory } from '@/components/videoStory/VideoStoryContext';

/**
 * The action strip above the preview when Video Story is selected. Its own
 * file so the Smart Card toolbar stays untouched.
 *
 * Upload a video takes Improve with AI's place and style: a video story has no
 * text for AI to write. Template Hub and Styling Studio are left out — both
 * shape a text card's design and colours, which a video replaces.
 */
export function VideoStoryToolbar({
  setShowVersionsPopup,
  cardPositionPos,
  setCardPositionPos,
}: {
  setShowVersionsPopup: (show: boolean) => void;
  cardPositionPos: string | null;
  setCardPositionPos: (pos: string) => void;
}) {
  const { openPicker } = useVideoStory();

  return (
    <div className="flex shrink-0 flex-col gap-2 border-t border-border pt-3">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={openPicker}
          title="Upload the video for this story"
          className="ai-chip relative inline-flex h-9 items-center gap-1.5 overflow-hidden whitespace-nowrap rounded-lg border border-primary/40 bg-primary/[0.06] px-3 text-sm font-medium text-primary transition-colors duration-200 hover:border-primary/60 hover:bg-primary/[0.11] dark:bg-primary/[0.10] dark:hover:bg-primary/[0.16]"
        >
          <span aria-hidden="true" className="ai-sheen pointer-events-none absolute inset-0" />
          <Upload className="ai-spark relative h-4 w-4" />
          <span className="relative">Upload a video</span>
        </button>
        <span className="h-6 w-px shrink-0 bg-border" aria-hidden="true" />
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

      <div className="flex items-center justify-end gap-2">
        <span className="text-xs font-bold uppercase tracking-[0.08em] text-on-surface-variant">Position:</span>
        <select
          value={cardPositionPos || 'bottom-right'}
          onChange={(e) => setCardPositionPos(e.target.value)}
          className="rounded-lg border border-border bg-surface-subtle px-2.5 py-1.5 text-xs font-medium text-on-surface transition-colors hover:border-primary/60"
          title="Where the video sits on your website"
        >
          <option value="bottom-left">Bottom Left</option>
          <option value="bottom-right">Bottom Right</option>
        </select>
      </div>
    </div>
  );
}
