import { describe, expect, it } from 'vitest';
import { longestFittingPrefix } from './richTextFormats';

describe('longestFittingPrefix', () => {
  it('keeps the most characters that still fit', () => {
    expect(longestFittingPrefix('abcdefgh', (p) => p.length <= 5)).toBe(5);
    expect(longestFittingPrefix('abc', () => true)).toBe(3);
    expect(longestFittingPrefix('abc', (p) => p === '')).toBe(0);
  });
});
