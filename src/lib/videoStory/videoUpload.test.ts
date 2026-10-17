import { describe, expect, it } from 'vitest';
import { VIDEO_FORMAT_NAMES, VIDEO_MAX_BYTES, VIDEO_PICKER_ACCEPT, videoExtension } from './videoRules';
import { checkUploadRequest, clipProblem, indexAtEnd, shapeTip, convertedSizeProblem, decideHevc, decideMov, evenSize, formatMB, mp4Name, uploadErrorMessage } from './videoUpload';

const MB = 1024 * 1024;

describe('formatMB', () => {
  it('shows one decimal under 10 MB and whole numbers above', () => {
    expect(formatMB(4.2 * MB)).toBe('4.2 MB');
    expect(formatMB(38.4 * MB)).toBe('38 MB');
    expect(formatMB(3 * MB)).toBe('3 MB');
    expect(formatMB(10)).toBe('0.1 MB');
  });
});

describe('clipProblem', () => {
  const mp4 = { name: 'a.mp4', type: 'video/mp4', size: 4 * MB };
  it('accepts a small MP4', () => {
    expect(clipProblem(mp4, 12)).toBeNull();
  });
  it('accepts a MOV', () => {
    expect(clipProblem({ name: 'b.mov', type: 'video/quicktime', size: 20 * MB }, 12)).toBeNull();
  });
  it('accepts a .mov the browser gave no type for', () => {
    expect(clipProblem({ name: 'IMG_1.MOV', type: '', size: 4 * MB }, 12)).toBeNull();
  });
  it('accepts a long clip — length is a tip, not a rule', () => {
    expect(clipProblem(mp4, 89)).toBeNull();
  });
  it('accepts 149 MB and refuses 151 MB', () => {
    expect(clipProblem({ ...mp4, size: 149 * MB }, 12)).toBeNull();
    expect(clipProblem({ ...mp4, size: 151 * MB }, 12)).toBe('File is 151 MB. Maximum size is 150 MB.');
  });
  it('refuses another video type, and an untyped file without an MP4/MOV extension', () => {
    expect(clipProblem({ name: 'c.wmv', type: 'video/x-ms-wmv', size: MB }, 5)).toContain('Supported formats');
    expect(clipProblem({ name: 'c.avi', type: '', size: MB }, 5)).toContain('Supported formats');
  });
  it('refuses a clip the browser cannot read', () => {
    expect(clipProblem(mp4, NaN)).toContain("couldn't be read");
  });
});

describe('checkUploadRequest', () => {
  it('accepts an MP4 or MOV within the limit, and returns its type to sign', () => {
    expect(checkUploadRequest({ contentType: 'video/mp4', size: VIDEO_MAX_BYTES })).toEqual({ size: VIDEO_MAX_BYTES, contentType: 'video/mp4' });
    expect(checkUploadRequest({ contentType: 'video/quicktime', size: 10 })).toEqual({ size: 10, contentType: 'video/quicktime' });
  });
  it('refuses other types, bad sizes and anything over 150 MB', () => {
    expect(checkUploadRequest({ contentType: 'video/webm', size: 10 })).toHaveProperty('error');
    expect(checkUploadRequest({ contentType: '', size: 10 })).toHaveProperty('error');
    expect(checkUploadRequest({ contentType: 'video/mp4', size: '10' })).toHaveProperty('error');
    expect(checkUploadRequest({ contentType: 'video/mp4', size: 0 })).toHaveProperty('error');
    expect(checkUploadRequest({ contentType: 'video/mp4', size: VIDEO_MAX_BYTES + 1 })).toEqual({ error: 'Keep the video under 150 MB.' });
    expect(checkUploadRequest(null)).toHaveProperty('error');
  });
});

describe('videoExtension', () => {
  it('names the stored file after its signed type', () => {
    expect(videoExtension('video/quicktime')).toBe('.mov');
    expect(videoExtension('video/mp4')).toBe('.mp4');
  });
});

describe('VIDEO_PICKER_ACCEPT', () => {
  it('lists every pickable type and extension', () => {
    expect(VIDEO_PICKER_ACCEPT).toBe('video/mp4,video/quicktime,video/x-m4v,video/webm,video/x-matroska,video/mp2t,.mp4,.mov,.m4v,.webm,.mkv,.mts,.m2ts');
  });
});

describe('uploadErrorMessage', () => {
  it('explains a CORS refusal (status 0)', () => {
    expect(uploadErrorMessage(0)).toMatch(/isn't accepting uploads from this site/);
  });
});

describe('decideMov', () => {
  it('re-wraps H.264 with AAC or no sound', () => {
    expect(decideMov({ videoCodec: 'avc', audioCodec: 'aac' })).toBe('remux');
    expect(decideMov({ videoCodec: 'avc', audioCodec: null })).toBe('remux');
  });
  it('drops sound MP4 players do not take', () => {
    expect(decideMov({ videoCodec: 'avc', audioCodec: 'pcm-s16' })).toBe('remux-drop-audio');
  });
  it('sends HEVC to the H.264 conversion, whatever the sound', () => {
    expect(decideMov({ videoCodec: 'hevc', audioCodec: 'aac' })).toBe('transcode');
    expect(decideMov({ videoCodec: 'hevc', audioCodec: 'pcm-s16' })).toBe('transcode');
  });
  it('refuses other or unreadable video with the reason', () => {
    expect(decideMov({ videoCodec: 'prores', audioCodec: null })).toEqual({ refuse: expect.stringContaining('PRORES') });
    expect(decideMov({ videoCodec: null, audioCodec: null })).toEqual({ refuse: expect.stringContaining('No video track') });
  });
});

describe('decideHevc', () => {
  const refuse = "This browser can't convert this video. Try Chrome or Safari, or export as MP4.";
  const size = { width: 1080, height: 1920 };
  it('converts only when the browser can both decode HEVC and encode H.264', () => {
    expect(decideHevc('IMG_1.MOV', { decode: true, encode: true, ...size })).toBe('transcode');
  });
  it('otherwise refuses in plain words, with the missing part as the detail', () => {
    expect(decideHevc('IMG_1.MOV', { decode: false, encode: true, ...size })).toEqual({ refuse, detail: "This browser can't decode this video's format." });
    expect(decideHevc('IMG_1.MOV', { decode: true, encode: false, ...size })).toEqual({ refuse, detail: 'This browser has no H.264 encoder for 1080×1920.' });
    expect(decideHevc('IMG_1.MOV', { decode: false, encode: false, ...size })).toEqual({
      refuse, detail: "This browser can't decode this video's format. This browser has no H.264 encoder for 1080×1920.",
    });
  });
  it('never names a codec or a phone setting in the refusal', () => {
    expect(refuse).not.toMatch(/iPhone|HEVC|Most Compatible/);
  });
});

describe('evenSize', () => {
  it('leaves even sizes alone', () => {
    expect(evenSize(1080, 1920)).toBeNull();
  });
  it('trims one pixel off an odd side', () => {
    expect(evenSize(1081, 1920)).toEqual({ width: 1080, height: 1920 });
    expect(evenSize(721, 1279)).toEqual({ width: 720, height: 1278 });
  });
});

describe('convertedSizeProblem', () => {
  it('passes a result within the limit', () => {
    expect(convertedSizeProblem(150 * 1024 * 1024)).toBeNull();
  });
  it('names the converted size and the limit', () => {
    expect(convertedSizeProblem(162 * 1024 * 1024)).toBe('Converted file is 162 MB. Maximum size is 150 MB.');
  });
});

describe('mp4Name', () => {
  it('swaps a .mov or .mp4 ending for .mp4', () => {
    expect(mp4Name('IMG_1.MOV')).toBe('IMG_1.mp4');
    expect(mp4Name('IMG_2.mp4')).toBe('IMG_2.mp4');
    expect(mp4Name('clip')).toBe('clip.mp4');
  });
});

describe('shapeTip', () => {
  it('flags wide and square videos, not vertical ones', () => {
    expect(shapeTip(1080, 1920)).toBeNull();
    expect(shapeTip(2160, 3840)).toBeNull();
    expect(shapeTip(0, 0)).toBeNull();
    expect(shapeTip(1920, 1080)).toBe('This video is horizontal, while the widget is vertical. Use a vertical video instead.');
    expect(shapeTip(1080, 1080)).toMatch(/^This video is square/);
    // A 4:5 feed post is upright, just not tall enough.
    expect(shapeTip(1080, 1350)).toMatch(/^This video is not tall enough/);
  });
});

describe('indexAtEnd', () => {
  it('flags an MP4 whose index comes after its frames', () => {
    expect(indexAtEnd(['ftyp', 'mdat', 'moov'])).toBe(true);
    expect(indexAtEnd(['ftyp', 'moov', 'mdat'])).toBe(false);
    expect(indexAtEnd(['ftyp', 'free'])).toBe(false);
  });
});

describe('decideMov, other formats', () => {
  it('re-encodes WebM and AV1 video, re-wraps H.264 from any box', () => {
    expect(decideMov({ videoCodec: 'vp9', audioCodec: 'opus' })).toBe('transcode');
    expect(decideMov({ videoCodec: 'av1', audioCodec: null })).toBe('transcode');
    expect(decideMov({ videoCodec: 'avc', audioCodec: 'opus' })).toBe('remux-drop-audio');
  });
});

describe('VIDEO_FORMAT_NAMES', () => {
  it('names every pickable format once, as people know them', () => {
    expect(VIDEO_FORMAT_NAMES).toBe('MP4, MOV, M4V, WebM, MKV, MTS');
  });
});
