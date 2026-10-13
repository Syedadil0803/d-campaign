import { describe, it, expect } from 'vitest';
import { mergeScheduled } from '@/lib/mergeScheduled';
import { defaultConfig, defaultVideoStory, type CampaignConfig } from '@/types/campaign';

const today = '2026-10-12';
const live: CampaignConfig = {
  ...defaultConfig,
  announcementBar: { ...defaultConfig.announcementBar, active: true },
  videoStory: { ...defaultVideoStory, videoUrl: 'live.mp4' },
};
const scheduledCard = (startDate: string): CampaignConfig => {
  const { videoStory: _v, ...rest } = defaultConfig;
  return { ...rest, promoCard: { ...defaultConfig.promoCard, title: 'Sale', startDate } };
};

describe('Promoting a scheduled campaign', () => {
  it('waits for the start date', () => {
    expect(mergeScheduled(live, scheduledCard('2026-10-13'), today)).toBeNull();
  });

  it('copies the card only, keeping the live bar and video story', () => {
    const merged = mergeScheduled(live, scheduledCard(today), today)!;
    expect(merged.promoCard.title).toBe('Sale');
    expect(merged.announcementBar).toBe(live.announcementBar);
    expect(merged.videoStory).toBe(live.videoStory);
  });

  it('holds a row carrying both until the video story is due as well', () => {
    const both = { ...scheduledCard(today), videoStory: { ...defaultVideoStory, startDate: '2026-10-20' } };
    expect(mergeScheduled(live, both, today)).toBeNull();
    const due = { ...both, videoStory: { ...both.videoStory, startDate: today } };
    expect(mergeScheduled(live, due, today)!.videoStory).toBe(due.videoStory);
  });
});
