import { describe, it, expect } from 'vitest';
import { defaultConfig, defaultVideoStory } from '@/types/campaign';
import {
  broadcastsFact,
  broadcastsStatus,
  lastSavedLine,
  needsAttention,
  scheduleLine,
  smartCardFact,
  smartCardStatus,
  tileAction,
  tilePill,
  videoStoryFact,
} from '@/lib/dashboard/tileSummary';

const today = '2026-10-13';
const ann = (over: Partial<typeof defaultConfig.announcementBar> = {}) => ({
  ...defaultConfig.announcementBar,
  announcements: [{ text: 'Hi' }, { text: 'Sale', startDate: '2026-10-01' }],
  ...over,
});

describe('tilePill', () => {
  it('only turns amber for a live widget with issues', () => {
    expect(tilePill('live', false)).toEqual({ tone: 'live', label: 'Live' });
    expect(tilePill('live', true)).toEqual({ tone: 'attention', label: 'Needs Attention' });
    expect(tilePill('off', true).label).toBe('Off');
    expect(tilePill('ended', true).label).toBe('Ended');
    expect(tilePill('notCreated', false).label).toBe('Not created');
  });
});

describe('needsAttention', () => {
  it('counts the widget’s own issues, ignoring low-severity draft notices', () => {
    const issues = [
      { widget: 'promo' as const, severity: 'low' as const },
      { widget: 'videoStory' as const, severity: 'high' as const },
    ];
    expect(needsAttention(issues, 'promo')).toBe(false);
    expect(needsAttention(issues, 'videoStory')).toBe(true);
    expect(needsAttention(issues, 'announcement')).toBe(false);
  });
});

describe('statuses', () => {
  it('reads Broadcasts as live, off, or never made', () => {
    expect(broadcastsStatus(ann({ active: true }))).toBe('live');
    expect(broadcastsStatus(ann({ active: false }))).toBe('off');
    expect(broadcastsStatus(ann({ active: false, announcements: [] }))).toBe('notCreated');
  });

  it('reads the Smart Card in the full card’s order', () => {
    expect(smartCardStatus(true, true, true)).toBe('notCreated');
    expect(smartCardStatus(false, false, true)).toBe('off');
    expect(smartCardStatus(false, true, true)).toBe('ended');
    expect(smartCardStatus(false, true, false)).toBe('live');
  });
});

describe('scheduleLine', () => {
  it('counts whole days, and names open-ended and ended schedules', () => {
    expect(scheduleLine({ endDate: '2026-10-16' }, false, today)).toBe('Ends in 3 days');
    expect(scheduleLine({ endDate: '2026-10-14' }, false, today)).toBe('Ends in 1 day');
    expect(scheduleLine({ endDate: today }, false, today)).toBe('Ends today');
    expect(scheduleLine({ endDate: '2026-10-20', scheduleMode: 'openEnded' }, false, today)).toBe('No end date');
    expect(scheduleLine({ endDate: null }, false, today)).toBe('No end date');
    expect(scheduleLine({ endDate: '2026-10-06' }, true, today)).toBe('Ended');
    expect(scheduleLine({ endDate: '2026-10-16' }, false, '')).toBe('Ends 16-Oct-2026');
  });
});

describe('facts', () => {
  it('Broadcasts: the message count, bold', () => {
    expect(broadcastsFact(ann())).toEqual({ strong: '2', text: 'Messages Active' });
    expect(broadcastsFact(ann({ announcements: [{ text: 'x' }] }))).toEqual({ strong: '1', text: 'Message Active' });
  });

  it('Smart Card: its schedule', () => {
    const promo = { ...defaultConfig.promoCard, endDate: '2026-10-16', scheduleMode: 'range' as const };
    expect(smartCardFact(promo, 'live', today)).toEqual({ text: 'Ends in 3 days' });
    expect(smartCardFact(promo, 'ended', today)).toEqual({ text: 'Ended' });
  });

  it('Video Story: whether a clip exists', () => {
    expect(videoStoryFact(undefined)).toEqual({ text: 'No video yet' });
    expect(videoStoryFact({ ...defaultVideoStory, active: true, videoUrl: 'x.mp4' })).toEqual({ text: 'Video added' });
    expect(videoStoryFact({ ...defaultVideoStory, active: true })).toEqual({ text: 'No video yet' });
  });
});

describe('tileAction', () => {
  it('Resume beats Open; Create only when nothing exists and nothing is drafted', () => {
    expect(tileAction('live', true)).toBe('Resume');
    expect(tileAction('off', false)).toBe('Open');
    expect(tileAction('notCreated', false)).toBe('Create');
    expect(tileAction('notCreated', true)).toBe('Resume');
  });
});

describe('lastSavedLine', () => {
  it('says when, capitalised, without seconds, and nothing without a save', () => {
    expect(lastSavedLine(new Date(2026, 0, 1, 12, 23, 24).toISOString())).not.toMatch(/:24/);
    expect(lastSavedLine(new Date().toISOString())).toMatch(/^Last saved: Today at \d{1,2}:\d{2}\s?[AP]M$/);
    expect(lastSavedLine(null)).toBeNull();
  });
});
