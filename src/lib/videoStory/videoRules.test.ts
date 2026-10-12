import { describe, expect, it } from 'vitest';
import { checkVideoDuration, checkVideoFile, VIDEO_MAX_BYTES } from './videoRules';

describe('checkVideoFile', () => {
  it('accepts an MP4 within the size limit', () => {
    expect(checkVideoFile({ type: 'video/mp4', size: VIDEO_MAX_BYTES })).toBeNull();
  });
  it('rejects other formats', () => {
    expect(checkVideoFile({ type: 'video/quicktime', size: 1000 })).toBe('Use an MP4 video.');
  });
  it('rejects files over 10 MB', () => {
    expect(checkVideoFile({ type: 'video/mp4', size: VIDEO_MAX_BYTES + 1 })).toBe(
      'Keep the video under 10 MB.',
    );
  });
});

describe('checkVideoDuration', () => {
  it('accepts 15 seconds exactly', () => {
    expect(checkVideoDuration(15)).toBeNull();
  });
  it('rejects longer clips and unreadable ones', () => {
    expect(checkVideoDuration(15.5)).toBe('Keep the video to 15 seconds or less.');
    expect(checkVideoDuration(NaN)).toBe('This video could not be read.');
  });
});

