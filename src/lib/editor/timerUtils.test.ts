import { describe, expect, it } from 'vitest';
import { calculateTimeRemaining } from '@/lib/editor/timerUtils';

/**
 * The countdown's arithmetic.
 *
 * Worth holding still because it is read three ways — the editor's preview,
 * the mini previews, and the live widget — and because a wrong figure here is
 * a wrong promise to the visitor rather than a cosmetic fault.
 */
describe('calculateTimeRemaining', () => {
  const at = (iso: string) => calculateTimeRemaining(iso);

  it('counts to the END of the given day, not its midnight', () => {
    // A campaign ending today runs until tonight. Parsing the date-only value
    // as midnight would report it finished from the moment the day began.
    const today = new Date();
    const iso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const v = at(iso);
    expect(v.days).toBe(0);
    expect(v.hours + v.minutes + v.seconds).toBeGreaterThan(0);
  });

  it('never reports 24 or more hours — those roll into a day', () => {
    for (const offset of [1, 2, 5, 30]) {
      const d = new Date();
      d.setDate(d.getDate() + offset);
      const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const v = at(iso);
      expect(v.hours).toBeLessThan(24);
      expect(v.minutes).toBeLessThan(60);
      expect(v.seconds).toBeLessThan(60);
    }
  });

  it('reports all zeroes once the end has passed', () => {
    expect(at('2020-01-01')).toEqual({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  });

  it('reports all zeroes rather than NaN for a date it cannot read', () => {
    expect(at('not-a-date')).toEqual({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  });
});
