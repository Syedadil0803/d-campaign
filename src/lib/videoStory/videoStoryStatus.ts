import { defaultVideoStory, type VideoStory } from '@/types/campaign';
import { videoStoryDiffers } from '@/lib/configSignature';
import { isOpenEnded } from '@/lib/promo/promoSchedule';

export type VideoStoryStatus = 'notCreated' | 'live' | 'ended' | 'off';

/**
 * Where the PUBLISHED Video Story stands, for the dashboard.
 *
 * "Not created" is the blank default switched off — every config saved before
 * the Video Story existed reads that way, so it must not show as "off".
 * Ended compares local ISO dates, as validateVideoStory does, so a story
 * ending today is still live today.
 */
export function videoStoryStatus(vs: VideoStory | undefined, todayIso: string): VideoStoryStatus {
  if (!vs || (!vs.active && !videoStoryDiffers(vs, defaultVideoStory))) return 'notCreated';
  if (!vs.active) return 'off';
  if (!isOpenEnded(vs) && vs.endDate && vs.endDate < todayIso) return 'ended';
  return 'live';
}
