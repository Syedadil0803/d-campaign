/**
 * What a Video Story clip may be.
 *
 * Kept small on purpose: the widget is about 180 px wide, so anything past a
 * 720p, 15-second clip is bytes the visitor downloads and never sees. MP4
 * (H.264) only, because it is the one format every browser plays inline —
 * an iPhone's .mov/HEVC does not play everywhere.
 */
export const VIDEO_MAX_BYTES = 10 * 1024 * 1024;
const VIDEO_MAX_SECONDS = 15;
export const VIDEO_ACCEPT = 'video/mp4';

/**
 * The checks that need no video decoding: type and size. Returns the message
 * to show, or null when the file may go on to the duration check.
 */
export function checkVideoFile(file: { type: string; size: number }): string | null {
  if (file.type !== VIDEO_ACCEPT) return 'Use an MP4 video.';
  if (file.size > VIDEO_MAX_BYTES) return 'Keep the video under 10 MB.';
  return null;
}

/** Duration is only known once the browser has read the file's metadata. */
export function checkVideoDuration(seconds: number): string | null {
  if (!Number.isFinite(seconds)) return 'This video could not be read.';
  if (seconds > VIDEO_MAX_SECONDS) return 'Keep the video to 15 seconds or less.';
  return null;
}

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
