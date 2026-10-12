'use client';

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { VIDEO_ACCEPT } from '@/lib/videoStory/videoRules';
import { useVideoStoryDraft } from '@/components/videoStory/useVideoStoryDraft';

/** The two kinds of campaign the Campaigns tab builds. */
export type CampaignKind = 'card' | 'video';

/**
 * Video Story state shared by the three places that need it: the panel on
 * the left, the toolbar's Upload button and the preview on the right. Kept in
 * its own context, apart from the promo editor's, so the card code and the
 * video code never share state or names.
 */
function useVideoStoryState() {
  const [kind, setKind] = useState<CampaignKind>('card');
  const draft = useVideoStoryDraft();
  const inputRef = useRef<HTMLInputElement>(null);
  const openPicker = useCallback(() => inputRef.current?.click(), []);
  return { kind, setKind, draft, inputRef, openPicker };
}

const VideoStoryContext = createContext<ReturnType<typeof useVideoStoryState> | null>(null);

export function VideoStoryProvider({ children }: { children: ReactNode }) {
  const value = useVideoStoryState();
  return (
    <VideoStoryContext.Provider value={value}>
      {/* One file input for every "Upload a video" control. */}
      <input
        ref={value.inputRef}
        type="file"
        accept={VIDEO_ACCEPT}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) value.draft.pick(file);
          e.target.value = ''; // so choosing the same file again still fires
        }}
      />
      {children}
    </VideoStoryContext.Provider>
  );
}

export function useVideoStory() {
  const ctx = useContext(VideoStoryContext);
  if (!ctx) throw new Error('useVideoStory must be used inside VideoStoryProvider');
  return ctx;
}
