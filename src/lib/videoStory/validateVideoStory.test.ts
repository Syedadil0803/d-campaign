import { describe, it, expect } from 'vitest';
import { validateVideoStory } from '@/lib/videoStory/validateVideoStory';
import { defaultVideoStory, type VideoStory } from '@/types/campaign';
import { getISODateWithOffset } from '@/lib/utils';

/** A story that raises nothing, so each test breaks one thing at a time. */
const good = (changes: Partial<VideoStory> = {}): VideoStory => ({
  ...defaultVideoStory,
  videoUrl: 'https://cdn.example.com/clip.mp4',
  startDate: getISODateWithOffset(1),
  endDate: getISODateWithOffset(8),
  ...changes,
});

describe('Video Story publishing checks', () => {
  it('raises nothing for a finished story', () => {
    expect(validateVideoStory(good())).toEqual([]);
  });

  it('asks for a clip', () => {
    expect(validateVideoStory(good({ videoUrl: ' ' }))).toEqual(['No video added']);
  });

  it('checks the dates for a range', () => {
    expect(validateVideoStory(good({ endDate: '' }))).toEqual(['Start date or end date is not set']);
    expect(validateVideoStory(good({ startDate: getISODateWithOffset(-9), endDate: getISODateWithOffset(-2) })))
      .toEqual(['End date is in the past']);
    expect(validateVideoStory(good({ startDate: getISODateWithOffset(9) }))).toEqual(['Start date is after end date']);
  });

  it('needs only a start date when open-ended', () => {
    expect(validateVideoStory(good({ scheduleMode: 'openEnded', endDate: '' }))).toEqual([]);
    expect(validateVideoStory(good({ scheduleMode: 'openEnded', startDate: '' }))).toEqual(['Start date is not set']);
  });

  it('checks the button only when it is shown', () => {
    expect(validateVideoStory(good({ showButton: true, buttonText: 'Order', whatsappNumber: '' })))
      .toEqual(['WhatsApp number is empty']);
  });
});
