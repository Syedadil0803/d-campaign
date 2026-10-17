import { describe, expect, it } from 'vitest';
import { videoTimerColor, videoTitle, VIDEO_TITLE_LOOK } from './videoTitle';
import { getConfigSignature, videoStoryDiffers } from '@/lib/configSignature';
import { defaultConfig, defaultVideoStory, type VideoStory } from '@/types/campaign';

describe('video title rules', () => {
  it('reads a story saved before the title existed as empty, white and centred', () => {
    const { title: _t, titleColor: _c, ...old } = defaultVideoStory;
    expect(videoTitle(old)).toEqual({ html: '', look: VIDEO_TITLE_LOOK.white, align: 'center' });
    expect(videoTitle({ title: '  Sale ', titleColor: 'black' })).toEqual({ html: 'Sale', look: VIDEO_TITLE_LOOK.black, align: 'center' });
    expect(videoTitle({ title: '<b></b>' }).html).toBe('');
  });
});

describe('video title in the change signature', () => {
  const { title: _t, titleColor: _c, ...old } = defaultVideoStory;
  const before = old as VideoStory;

  it('signs the default title the same as no title fields at all', () => {
    expect(videoStoryDiffers(before, defaultVideoStory)).toBe(false);
    expect(getConfigSignature({ ...defaultConfig, videoStory: before })).toBe(getConfigSignature(defaultConfig));
  });

  it('counts a title or a black title as an edit', () => {
    expect(videoStoryDiffers({ ...defaultVideoStory, title: 'Sale' }, defaultVideoStory)).toBe(true);
    expect(videoStoryDiffers({ ...defaultVideoStory, titleColor: 'black' }, before)).toBe(true);
  });
});

describe('videoTimerColor', () => {
  it('reads black as black and every other stored colour as white', () => {
    expect(videoTimerColor({ timerTextColor: '#000000' })).toBe('black');
    expect(videoTimerColor({ timerTextColor: '#FFFFFF' })).toBe('white');
    // An older config may hold any colour from the earlier palette.
    expect(videoTimerColor({ timerTextColor: '#ff6600' })).toBe('white');
  });
});
