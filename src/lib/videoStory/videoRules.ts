/**
 * What a Video Story clip may be.
 *
 * Kept small on purpose: the widget is about 180 px wide, so anything past a
 * 720p, 15-second clip is bytes the visitor downloads and never sees. MP4
 * (H.264) only, because it is the one format every browser plays inline —
 * an iPhone's .mov/HEVC does not play everywhere. decideClip (videoUpload.ts)
 * applies these limits and offers the fix for each.
 */
export const VIDEO_MAX_BYTES = 10 * 1024 * 1024;
export const VIDEO_MAX_SECONDS = 15;
export const VIDEO_ACCEPT = 'video/mp4';

/**
 * The Video Story widget's size, in px. Change it here — the preview (and,
 * later, the website widget) read these numbers and nothing else.
 *
 * The video is 9:16 (200 × 455); the call to action sits in a tray below it
 * rather than over it, so no part of the video is covered. Total: 200 × 511.
 * If you change the width, set videoHeight to width × 16 ÷ 9 to keep 9:16.
 */
export const VIDEO_WIDGET = {
  width: 200,
  videoHeight: 355,
  trayHeight: 56,
} as const;
