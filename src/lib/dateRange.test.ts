import { describe, expect, it } from 'vitest';
import { isInvalidRange, anyInvalidRange } from '@/lib/dateRange';

/**
 * An end date before its start.
 *
 * Shared by both editors on purpose: they disagreeing about what counts as a
 * valid range is how one of them blocks a save the other allows.
 */
describe('isInvalidRange', () => {
  it('rejects an end before the start', () => {
    expect(isInvalidRange('2026-05-10', '2026-05-01')).toBe(true);
  });

  it('accepts a single-day run, where start and end are the same', () => {
    expect(isInvalidRange('2026-05-10', '2026-05-10')).toBe(false);
  });

  it('accepts an ordinary range', () => {
    expect(isInvalidRange('2026-05-01', '2026-05-10')).toBe(false);
  });

  it('says nothing while a date is still missing — half a range is not wrong yet', () => {
    expect(isInvalidRange('2026-05-10', '')).toBe(false);
    expect(isInvalidRange('', '2026-05-01')).toBe(false);
    expect(isInvalidRange(undefined, null)).toBe(false);
  });
});

describe('anyInvalidRange', () => {
  it('is true when any one message has a bad range', () => {
    expect(
      anyInvalidRange([
        { startDate: '2026-05-01', endDate: '2026-05-09' },
        { startDate: '2026-05-10', endDate: '2026-05-01' },
      ]),
    ).toBe(true);
  });

  it('is false when every range is sound or unset', () => {
    expect(anyInvalidRange([{ startDate: '2026-05-01', endDate: '2026-05-09' }, {}])).toBe(false);
  });
});
