import { describe, it, expect } from 'vitest';
import { defaultVideoStory } from '@/types/campaign';
import { videoStoryStatus } from '@/lib/videoStory/videoStoryStatus';

const today = '2026-10-12';
const made = { ...defaultVideoStory, buttonText: 'Shop', startDate: '2026-10-01', endDate: '2026-10-20' };

describe('videoStoryStatus', () => {
  it('reads a missing or blank, switched-off story as not created', () => {
    expect(videoStoryStatus(undefined, today)).toBe('notCreated');
    expect(videoStoryStatus(defaultVideoStory, today)).toBe('notCreated');
  });

  it('tells off, live and ended apart', () => {
    expect(videoStoryStatus({ ...made, active: false, stoppedByUser: true }, today)).toBe('off');
    expect(videoStoryStatus({ ...made, active: true }, today)).toBe('live');
    expect(videoStoryStatus({ ...made, active: true, endDate: today }, today)).toBe('live');
    expect(videoStoryStatus({ ...made, active: true, endDate: '2026-10-11' }, today)).toBe('ended');
  });

  it('never ends an open-ended story', () => {
    expect(videoStoryStatus({ ...made, active: true, scheduleMode: 'openEnded', endDate: '2020-01-01' }, today)).toBe('live');
  });
});
