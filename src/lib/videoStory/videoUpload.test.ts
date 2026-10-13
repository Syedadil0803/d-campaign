import { describe, expect, it } from 'vitest';
import { VIDEO_MAX_BYTES } from './videoRules';
import { checkUploadRequest, clipEnd, compressedSize, formatMB, needsShrink, shrinkNote, uploadErrorMessage } from './videoUpload';

const MB = 1024 * 1024;

describe('formatMB', () => {
  it('shows one decimal under 10 MB and whole numbers above', () => {
    expect(formatMB(4.2 * MB)).toBe('4.2 MB');
    expect(formatMB(38.4 * MB)).toBe('38 MB');
    expect(formatMB(3 * MB)).toBe('3 MB');
    expect(formatMB(10)).toBe('0.1 MB');
  });
});

describe('needsShrink', () => {
  const mp4 = (size: number) => ({ type: 'video/mp4', size });
  it('passes a small, short MP4 as is', () => {
    expect(needsShrink(mp4(2 * MB), 8)).toBe(false);
  });
  it('re-encodes big, long, non-MP4 and unreadable clips', () => {
    expect(needsShrink(mp4(38 * MB), 10)).toBe(true);
    expect(needsShrink(mp4(5 * MB), 22)).toBe(true);
    expect(needsShrink({ type: 'video/quicktime', size: MB }, 5)).toBe(true);
    expect(needsShrink(mp4(MB), NaN)).toBe(true);
  });
});

describe('shrinkNote', () => {
  const mp4 = (size: number, seconds: number) => ({ type: 'video/mp4', size, seconds });
  it('says nothing for a clip that went up as is', () => {
    expect(shrinkNote(mp4(2 * MB, 8))).toBeNull();
  });
  it('names the trim, the shrink, or both in one line', () => {
    expect(shrinkNote(mp4(5 * MB, 89))).toBe('Shortened from 89 s to the first 15 seconds.');
    expect(shrinkNote(mp4(38 * MB, 10))).toBe('Made smaller from 38 MB.');
    expect(shrinkNote(mp4(38 * MB, 89))).toBe('Shortened from 89 s to the first 15 seconds and made smaller from 38 MB.');
  });
  it('falls back to the conversion for a small, short non-MP4', () => {
    expect(shrinkNote({ type: 'video/quicktime', size: MB, seconds: 5 })).toBe('Converted to MP4.');
  });
});

describe('compressedSize', () => {
  it('brings 1080 × 1920 down to 720 × 1280', () => {
    expect(compressedSize(1080, 1920)).toEqual({ width: 720, height: 1280 });
  });
  it('never scales up, and keeps sizes even', () => {
    expect(compressedSize(540, 960)).toEqual({ width: 540, height: 960 });
    expect(compressedSize(1081, 1921).width % 2).toBe(0);
  });
});

describe('clipEnd', () => {
  it('stops at 15 seconds', () => {
    expect(clipEnd(20)).toBe(15);
    expect(clipEnd(9)).toBe(9);
  });
});

describe('checkUploadRequest', () => {
  it('accepts an MP4 within the limit', () => {
    expect(checkUploadRequest({ contentType: 'video/mp4', size: VIDEO_MAX_BYTES })).toEqual({ size: VIDEO_MAX_BYTES });
  });
  it('refuses other types, bad sizes and anything over 10 MB', () => {
    expect(checkUploadRequest({ contentType: 'video/webm', size: 10 })).toHaveProperty('error');
    expect(checkUploadRequest({ contentType: 'video/mp4', size: '10' })).toHaveProperty('error');
    expect(checkUploadRequest({ contentType: 'video/mp4', size: 0 })).toHaveProperty('error');
    expect(checkUploadRequest({ contentType: 'video/mp4', size: VIDEO_MAX_BYTES + 1 })).toHaveProperty('error');
    expect(checkUploadRequest(null)).toHaveProperty('error');
  });
});

describe('uploadErrorMessage', () => {
  it('explains a CORS refusal (status 0)', () => {
    expect(uploadErrorMessage(0)).toMatch(/isn't accepting uploads from this site/);
  });
});
