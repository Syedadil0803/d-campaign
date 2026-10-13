import type { VideoStory } from '@/types/campaign';
import { ctaWarnings } from '@/lib/campaignCta';
import { scheduleWarnings } from '@/lib/promo/promoSchedule';
import { videoStoryHasContent } from '@/lib/configSignature';

/**
 * What the user should know before a Video Story goes live: the clip, the
 * button, the dates. The button and schedule rules are the card's own (ctaWarnings,
 * scheduleWarnings), so the two widgets cannot check either differently.
 */
export function validateVideoStory(vs: VideoStory): string[] {
  const warnings: string[] = [];

  if (!videoStoryHasContent(vs)) warnings.push('No video added');

  warnings.push(...scheduleWarnings(vs));
  warnings.push(...ctaWarnings(vs));
  return warnings;
}
