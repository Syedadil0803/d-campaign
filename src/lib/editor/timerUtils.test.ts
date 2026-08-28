import { describe, expect, it } from 'vitest';
import {
  calculateTimeRemaining,
  formatCountdownWords,
  formatTimerText,
  normalizeLegacyTimerTokens,
} from '@/lib/editor/timerUtils';

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

/**
 * The countdown's text, before any markup is involved.
 *
 * These four need no DOM, so they are covered here. The three that build or
 * read HTML — buildTimerDisplayHtml's main path, serializeTimerHtml and
 * syncTimerElement — need a browser environment and are covered separately.
 */

describe('formatCountdownWords', () => {
  it('reads out the three units the chip shows', () => {
    expect(formatCountdownWords({ days: 2, hours: 7, minutes: 11, seconds: 3 }))
      .toBe('2 days : 7 hours : 11 mins');
  });

  it('shows dashes rather than NaN when a figure is unreadable', () => {
    // A visitor seeing "NaN days" is worse than one seeing "--": the first
    // looks broken, the second looks like it is still loading.
    expect(formatCountdownWords({ days: NaN, hours: 1, minutes: 2, seconds: 3 }))
      .toBe('-- days : -- hours : -- mins');
  });
});

describe('normalizeLegacyTimerTokens', () => {
  it('collapses an old token run into the single marker', () => {
    // Cards saved before the chip existed spelled the countdown out as
    // separate tokens. They still have to open.
    expect(normalizeLegacyTimerTokens('Ends in {dd}:{hh}:{mm}:{ss}'))
      .toBe('Ends in {timer}');
  });

  it('leaves text that already uses the marker alone', () => {
    expect(normalizeLegacyTimerTokens('Ends in {timer}')).toBe('Ends in {timer}');
  });

  it('leaves ordinary text alone', () => {
    expect(normalizeLegacyTimerTokens('Ends soon')).toBe('Ends soon');
  });

  it('handles an empty string', () => {
    expect(normalizeLegacyTimerTokens('')).toBe('');
  });
});

describe('formatTimerText', () => {
  const v = { days: 2, hours: 7, minutes: 5, seconds: 9 };

  it('pads each token to the width it asks for', () => {
    expect(formatTimerText('{dd}d {hh}h {mm}m {ss}s', v)).toBe('02d 07h 05m 09s');
    expect(formatTimerText('{d}d {h}h {m}m {s}s', v)).toBe('2d 7h 5m 9s');
  });

  it('rolls the days into the hours when the template shows no day token', () => {
    // "48 hours" is right when there is nowhere to put the days. Showing "0"
    // would tell the visitor the sale ends today when it ends in two.
    expect(formatTimerText('{hh}:{mm}', { days: 2, hours: 0, minutes: 30, seconds: 0 }))
      .toBe('48:30');
  });

  it('keeps the days separate when the template does show them', () => {
    expect(formatTimerText('{d}d {hh}:{mm}', { days: 2, hours: 0, minutes: 30, seconds: 0 }))
      .toBe('2d 00:30');
  });
});
