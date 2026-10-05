import { describe, it, expect } from 'vitest';
import { canSchedule, groupRows, insertIndexForPosition, rowState, rowTiming, rowDates } from '@/lib/announcement/listSections';
import type { Announcement } from '@/types/campaign';

function dayOffset(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().split('T')[0];
}

describe('rowState', () => {
  it('treats a message with no dates as active — it is always on', () => {
    // The old list read this as 'none' and showed it in neither section.
    expect(rowState({ text: 'always on' })).toBe('active');
  });

  it('treats a running dated message as active', () => {
    expect(rowState({ text: 'sale', startDate: dayOffset(-2), endDate: dayOffset(2) })).toBe('active');
  });

  it('treats a message starting later as scheduled', () => {
    expect(rowState({ text: 'soon', startDate: dayOffset(3) })).toBe('scheduled');
  });

  it('treats a message whose end has passed as ended', () => {
    expect(rowState({ text: 'over', startDate: dayOffset(-10), endDate: dayOffset(-1) })).toBe('ended');
  });

  it('counts a message ending today as still active', () => {
    expect(rowState({ text: 'last day', endDate: dayOffset(0) })).toBe('active');
  });
});

describe('groupRows', () => {
  const list: Announcement[] = [
    { text: 'a' },
    { text: 'later-2', startDate: dayOffset(9) },
    { text: 'b', endDate: dayOffset(-1) },
    { text: 'later-1', startDate: dayOffset(4) },
    { text: 'c' },
  ];

  it('keeps active and ended rows in stored order — that order is the rotation', () => {
    const { active } = groupRows(list);
    expect(active.map((r) => r.message.text)).toEqual(['a', 'b', 'c']);
    expect(active.map((r) => r.state)).toEqual(['active', 'ended', 'active']);
  });

  it('sorts scheduled rows by start date, earliest first', () => {
    const { scheduled } = groupRows(list);
    expect(scheduled.map((r) => r.message.text)).toEqual(['later-1', 'later-2']);
  });

  it('keeps each row pointing at its real position in the stored array', () => {
    // Reorder, edit and delete act on this index, so it must survive grouping.
    const { active, scheduled } = groupRows(list);
    expect(active.map((r) => r.index)).toEqual([0, 2, 4]);
    expect(scheduled.map((r) => r.index)).toEqual([3, 1]);
  });
});

describe('canSchedule', () => {
  const soon = (text: string): Announcement => ({ text, startDate: dayOffset(3) });

  it('allows scheduling while slots are free', () => {
    expect(canSchedule([soon('a'), soon('b'), { text: 'live' }], null)).toBe(true);
  });

  it('refuses a fourth scheduled message', () => {
    expect(canSchedule([soon('a'), soon('b'), soon('c')], null)).toBe(false);
  });

  it('does not count live or ended messages against the limit', () => {
    const list = [
      soon('a'),
      soon('b'),
      { text: 'live' },
      { text: 'over', startDate: dayOffset(-9), endDate: dayOffset(-1) },
    ];
    expect(canSchedule(list, null)).toBe(true);
  });

  it('lets a scheduled message be edited when all three slots are taken — it keeps its own', () => {
    expect(canSchedule([soon('a'), soon('b'), soon('c')], 1)).toBe(true);
  });

  it('still refuses moving a LIVE message into a full schedule', () => {
    expect(canSchedule([soon('a'), soon('b'), soon('c'), { text: 'live' }], 3)).toBe(false);
  });
});

describe('rowTiming', () => {
  it('shows nothing for an undated message', () => {
    expect(rowTiming({ text: 'x' }, 'active')).toBe('');
  });

  it('shows an open-ended run by when it began', () => {
    expect(rowTiming({ text: 'x', startDate: '2026-05-01' }, 'active')).toMatch(/^Since /);
  });

  it('shows a date window with an en dash, not an arrow', () => {
    expect(rowTiming({ text: 'x', startDate: '2026-05-01', endDate: '2026-05-10' }, 'active')).toContain(' – ');
  });

  it('shows an upcoming message by its start only', () => {
    expect(rowTiming({ text: 'x', startDate: dayOffset(5), endDate: dayOffset(9) }, 'scheduled')).toMatch(/^Starts /);
  });

  it('says when an ended message ended', () => {
    expect(rowTiming({ text: 'x', startDate: dayOffset(-9), endDate: dayOffset(-2) }, 'ended')).toMatch(/^Ended /);
  });

  it('reads a stored date as that calendar day, whatever the time zone', () => {
    // 2026-05-01 must never show as Apr 30.
    expect(rowTiming({ text: 'x', startDate: '2026-05-01' }, 'active')).toContain('1');
    expect(rowTiming({ text: 'x', startDate: '2026-05-01' }, 'active')).not.toContain('30');
  });
});

describe('rowDates', () => {
  it('calls an undated message continuous', () => {
    expect(rowDates({ text: 'x' }, 'active')).toBe('Continuous');
  });

  it('counts a window inclusive of both days', () => {
    expect(rowDates({ text: 'x', startDate: '2026-05-01', endDate: '2026-05-10' }, 'active')).toMatch(/\(10 days\)$/);
    expect(rowDates({ text: 'x', startDate: '2026-05-01', endDate: '2026-05-01' }, 'active')).toMatch(/\(1 day\)$/);
  });

  it('says Starts for an upcoming open-ended message, Since for a running one', () => {
    expect(rowDates({ text: 'x', startDate: '2026-05-01' }, 'scheduled')).toMatch(/^Starts /);
    expect(rowDates({ text: 'x', startDate: '2026-05-01' }, 'active')).toMatch(/^Since /);
  });
});

describe('insertIndexForPosition', () => {
  const list: Announcement[] = [
    { text: 'live-a' },
    { text: 'later', startDate: dayOffset(5) },
    { text: 'live-b' },
    { text: 'live-c' },
  ];

  it('puts position 1 before the first live message', () => {
    expect(insertIndexForPosition(list, 1)).toBe(0);
  });

  it('counts only live messages, skipping upcoming ones', () => {
    // Position 2 = before live-b, which is stored at index 2.
    expect(insertIndexForPosition(list, 2)).toBe(2);
  });

  it('puts the last position just after the last live message', () => {
    expect(insertIndexForPosition(list, 4)).toBe(4);
    expect(insertIndexForPosition(list, 99)).toBe(4);
  });

  it('starts an empty list at the top', () => {
    expect(insertIndexForPosition([], 3)).toBe(0);
  });
});
