import { describe, expect, it } from 'vitest';
import { dwellSeconds } from './barMotion';

describe('dwellSeconds', () => {
  it('maps the Speed presets to how long each message stays', () => {
    expect(dwellSeconds(40)).toBe(5);
    expect(dwellSeconds(60)).toBe(4);
    expect(dwellSeconds(90)).toBe(3);
  });
  it('is 0 when paused', () => {
    expect(dwellSeconds(0)).toBe(0);
  });
});
