import { describe, it, expect } from 'vitest';
import { scheduleWarnings } from '@/lib/promo/promoSchedule';
import { getISODateWithOffset } from '@/lib/utils';

// One schedule check for both widgets. These pin the cases the two old copies
// disagreed on.

const range = (start: number, end: number) => ({
  scheduleMode: 'range' as const,
  startDate: getISODateWithOffset(start),
  endDate: getISODateWithOffset(end),
});

describe('scheduleWarnings', () => {
  it('catches a start date after the end date, for the card too', () => {
    expect(scheduleWarnings(range(9, 2))).toEqual(['Start date is after end date']);
    // The card's summary line is dropped for a range that cannot run.
    expect(scheduleWarnings(range(9, 2), { describe: true })).toEqual(['Start date is after end date']);
  });

  it('describes a valid range only when asked', () => {
    expect(scheduleWarnings(range(1, 8))).toEqual([]);
    expect(scheduleWarnings(range(1, 8), { describe: true })[0]).toMatch(/^Campaign is scheduled for/);
  });

  it('reports missing and past dates', () => {
    expect(scheduleWarnings({ ...range(1, 8), endDate: '' })).toEqual(['Start date or end date is not set']);
    expect(scheduleWarnings(range(-9, -2), { describe: true })).toEqual(['End date is in the past']);
  });

  it('needs only a start date when open-ended', () => {
    const open = { scheduleMode: 'openEnded' as const, startDate: getISODateWithOffset(0), endDate: null };
    expect(scheduleWarnings(open)).toEqual([]);
    expect(scheduleWarnings({ ...open, startDate: '' })).toEqual(['Start date is not set']);
    expect(scheduleWarnings(open, { describe: true })[0]).toMatch(/until you stop it \(starts immediately\)$/);
  });
});
