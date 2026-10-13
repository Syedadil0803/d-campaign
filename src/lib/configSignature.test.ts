import { describe, it, expect } from 'vitest';
import {
  getConfigSignature,
  getVideoStorySignature,
  videoStoryDiffers,
  videoStoryHasContent,
} from '@/lib/configSignature';
import { defaultConfig, defaultVideoStory, type CampaignConfig } from '@/types/campaign';

// Adding the Video Story must not make a single existing config read as edited.

const withoutVideo = (): CampaignConfig => {
  const { videoStory: _video, ...rest } = structuredClone(defaultConfig);
  return rest;
};

describe('Video Story in the change signature', () => {
  it('signs a blank video story the same as none at all', () => {
    expect(getConfigSignature(defaultConfig)).toBe(getConfigSignature(withoutVideo()));
  });

  it('ignores key order, as the database returns it re-sorted', () => {
    const reordered = Object.fromEntries(Object.entries(defaultVideoStory).reverse());
    expect(getConfigSignature({ ...withoutVideo(), videoStory: reordered as typeof defaultVideoStory }))
      .toBe(getConfigSignature(withoutVideo()));
  });

  it('does not count going on air or stopping as an edit', () => {
    const live = { ...defaultConfig, videoStory: { ...defaultVideoStory, videoUrl: 'a.mp4', active: true } };
    const stopped = { ...live, videoStory: { ...live.videoStory, active: false, stoppedByUser: true } };
    expect(getConfigSignature(live)).toBe(getConfigSignature(stopped));
    expect(getVideoStorySignature(live)).toBe(getVideoStorySignature(stopped));
  });

  it('counts a real change', () => {
    const edited = { ...defaultConfig, videoStory: { ...defaultVideoStory, videoUrl: 'a.mp4' } };
    expect(getConfigSignature(edited)).not.toBe(getConfigSignature(defaultConfig));
    expect(videoStoryHasContent(edited.videoStory)).toBe(true);
    expect(videoStoryHasContent(defaultVideoStory)).toBe(false);
  });
});

describe('videoStoryDiffers — the Video Story compared on its own', () => {
  it('treats a missing video story as the blank default', () => {
    expect(videoStoryDiffers(undefined, defaultVideoStory)).toBe(false);
  });

  it('ignores the on/off flags, so Stop / Go on air is never unsaved work', () => {
    const live = { ...defaultVideoStory, buttonText: 'Shop', active: true };
    expect(videoStoryDiffers(live, { ...live, active: false, stoppedByUser: true })).toBe(false);
  });

  it('catches a content edit the card would never see', () => {
    expect(videoStoryDiffers({ ...defaultVideoStory, endDate: '2026-12-01' }, defaultVideoStory)).toBe(true);
  });

  it('reads an open-ended story published with a null end date as unchanged', () => {
    // Publish sends endDate null for open-ended; the editor keeps ''. That
    // difference used to leave "Unpublished changes" lit after every publish.
    const editor = { ...defaultVideoStory, videoUrl: 'a.mp4', scheduleMode: 'openEnded' as const, endDate: '' };
    expect(videoStoryDiffers(editor, { ...editor, endDate: null })).toBe(false);
    expect(videoStoryDiffers(editor, { ...editor, endDate: '2026-12-01' })).toBe(false);
    // For a range the end date still counts, with null and '' both "not set".
    const ranged = { ...editor, scheduleMode: 'range' as const };
    expect(videoStoryDiffers(ranged, { ...ranged, endDate: null })).toBe(false);
    expect(videoStoryDiffers(ranged, { ...ranged, endDate: '2026-12-01' })).toBe(true);
  });
});
