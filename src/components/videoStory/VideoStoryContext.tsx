'use client';

import { createContext, useCallback, useContext, useRef, type ReactNode } from 'react';
import { defaultVideoStory, type CampaignKind, type PromoCard, type VideoStory } from '@/types/campaign';
import { cornerClash } from '@/lib/videoStory/placeWidgets';
import { usePromoEditor } from '@/components/promo/PromoEditorContext';
import { useVideoStoryDraft } from '@/components/videoStory/useVideoStoryDraft';

interface VideoStoryProviderProps {
  /** Owned by the page, which needs it to decide what Publish publishes. */
  kind: CampaignKind;
  setKind: (kind: CampaignKind) => void;
  /** The card on the website — the video warns when it picks the card's corner. */
  livePromoCard?: PromoCard;
  children: ReactNode;
}

/**
 * Video Story state shared by the three places that need it: the panel on
 * the left, the toolbar above the preview and the preview itself. Kept in its
 * own context, apart from the promo editor's, so the card code and the video
 * code never share state or names.
 */
function useVideoStoryState({ kind, setKind, livePromoCard }: Omit<VideoStoryProviderProps, 'children'>) {
  const { config, setConfig } = usePromoEditor();
  // The upload's last step stores the clip's address, which is what drafts,
  // Publish and validateVideoStory read.
  const draft = useVideoStoryDraft((videoUrl) => updateVideoStory({ videoUrl }));
  const inputRef = useRef<HTMLInputElement>(null);
  const openPicker = useCallback(() => inputRef.current?.click(), []);

  // Configs saved before the Video Story existed have none; the default stands in.
  const videoStory = config.videoStory ?? defaultVideoStory;

  /**
   * The one way the Video Story is written. Functional, so two patches in the
   * same event (a date and the countdown it switches off) both land.
   *
   * Deliberately no markChanged(): that is the Smart Card's dirty flag, and
   * raising it here lit "Unpublished changes" on the card for video edits.
   * The video's own state is derived by comparing signatures (see
   * useEditorWorkStatus and useVideoStoryDraftSync), so it needs no flag.
   */
  function updateVideoStory(patch: Partial<VideoStory>) {
    setConfig((c) => ({ ...c, videoStory: { ...(c.videoStory ?? defaultVideoStory), ...patch } }));
  }

  // Any corner may be chosen; a clash with the live card is flagged, not fixed.
  const positionWarning = cornerClash(
    videoStory.position,
    livePromoCard && { position: livePromoCard.style.position, active: livePromoCard.active },
    'Smart Card',
  );

  return { kind, setKind, draft, inputRef, openPicker, videoStory, updateVideoStory, positionWarning };
}

const VideoStoryContext = createContext<ReturnType<typeof useVideoStoryState> | null>(null);

export function VideoStoryProvider({ children, ...props }: VideoStoryProviderProps) {
  const value = useVideoStoryState(props);
  return (
    <VideoStoryContext.Provider value={value}>
      {/* One file input for every "Upload a video" control. Any video is
          accepted: one that is not MP4, too big or too long is offered a
          re-encode rather than turned away. */}
      <input
        ref={value.inputRef}
        type="file"
        accept="video/*"
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
