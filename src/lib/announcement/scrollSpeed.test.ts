import { describe, it, expect } from 'vitest';
import { marqueeDurationSeconds, DEFAULT_PX_PER_SEC } from '@/lib/announcement/scrollSpeed';

// Speed is px/sec — the reading velocity, the same on every screen. The duration
// is derived from it, so wider content scrolls for longer at the same pace,
// never faster. These lock in the arithmetic the whole feature rests on.
describe('Marquee scroll speed', () => {
  it('SPD-01 turns a travel distance into a duration at the given pace', () => {
    // 1392px at 60 px/s is the real "23.2s" the user measured.
    expect(marqueeDurationSeconds(1392, 60)).toBeCloseTo(23.2, 1);
  });

  it('SPD-02 keeps the same pace across screens — only the duration changes', () => {
    // A phone (375px) and a desktop (1392px) at 60 px/s read at one velocity;
    // the phone simply finishes sooner because it has less distance to cover.
    const phone = marqueeDurationSeconds(375, 60);
    const desktop = marqueeDurationSeconds(1392, 60);
    expect(phone).toBeLessThan(desktop);
    expect(375 / phone).toBeCloseTo(60, 5); // velocity, not duration, is constant
    expect(1392 / desktop).toBeCloseTo(60, 5);
  });

  it('SPD-03 a slower pace means a longer duration for the same content', () => {
    expect(marqueeDurationSeconds(1392, 40)).toBeCloseTo(34.8, 1); // Slow
    expect(marqueeDurationSeconds(1392, 90)).toBeCloseTo(15.5, 1); // Fast
  });

  it('SPD-04 pause returns 0 — the caller stops the animation, not races it', () => {
    expect(marqueeDurationSeconds(1392, 0)).toBe(0);
  });

  it('SPD-05 floors at 5s so a tiny message reads rather than flickers', () => {
    expect(marqueeDurationSeconds(10, 60)).toBe(5);
  });

  it('SPD-06 has a sensible default pace', () => {
    expect(DEFAULT_PX_PER_SEC).toBe(60);
  });
});
