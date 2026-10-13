import { VIDEO_ACCEPT, VIDEO_MAX_BYTES, VIDEO_MAX_SECONDS as MAX_SECONDS } from './videoRules';

/**
 * The pure half of a Video Story upload: what to do with a picked clip, what
 * to shrink it to, and how to word what went wrong. The browser half (the
 * re-encode and the PUT) lives in components/videoStory/clipTransfer.ts.
 *
 * The rule throughout: the user is never left with only "no". Every problem
 * comes with the step that fixes it.
 */

/** One decimal under 10 MB ("4.2 MB"), whole numbers above it ("38 MB"). */
export function formatMB(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  if (mb < 0.1) return '0.1 MB';
  return `${mb < 10 ? mb.toFixed(1).replace(/\.0$/, '') : Math.round(mb)} MB`;
}

/**
 * Upload as is, or re-encode first. One pass fixes format, size and length
 * together, so there is nothing to ask: the clip is simply made fit. `seconds`
 * is NaN when the browser could not read the file; the re-encode may still
 * manage it, so that is attempted rather than refused.
 */
export function needsShrink(file: { type: string; size: number }, seconds: number): boolean {
  return file.type !== VIDEO_ACCEPT || file.size > VIDEO_MAX_BYTES || !(seconds <= MAX_SECONDS);
}

/**
 * The one line under a re-encoded clip saying what was done to it, so an
 * automatic change is never a silent one. Null when the clip went up as is.
 */
export function shrinkNote(
  original: { type: string; size: number; seconds: number },
): string | null {
  if (!needsShrink(original, original.seconds)) return null;
  const trimmed = original.seconds > MAX_SECONDS;
  const shrunk = original.size > VIDEO_MAX_BYTES;
  const from = `${Math.round(original.seconds)} s`;
  if (trimmed && shrunk) return `Shortened from ${from} to the first 15 seconds and made smaller from ${formatMB(original.size)}.`;
  if (trimmed) return `Shortened from ${from} to the first 15 seconds.`;
  if (shrunk) return `Made smaller from ${formatMB(original.size)}.`;
  return 'Converted to MP4.';
}

/**
 * Video bitrates to try, in order. 2 Mbps is clean at 720p for 15 s (≈ 4 MB);
 * the second is the one automatic retry when a busy clip still comes out over
 * 10 MB. After that the help panel takes over.
 */
export const VIDEO_BITRATES = [2_000_000, 1_000_000] as const;
export const AUDIO_BITRATE = 96_000;

/** Where to stop the re-encode: the first 15 seconds, or the whole clip. */
export function clipEnd(duration: number): number {
  return Math.min(duration, MAX_SECONDS);
}

/**
 * Output size: 720 on the short side (720 × 1280 for a vertical clip), never
 * scaled up, rounded to even numbers because H.264 needs them. The widget is
 * ~200 px wide, so 720p is already more than 2× its sharpest display.
 */
export function compressedSize(width: number, height: number): { width: number; height: number } {
  const scale = Math.min(1, 720 / Math.min(width, height));
  const even = (n: number) => Math.max(2, Math.round((n * scale) / 2) * 2);
  return { width: even(width), height: even(height) };
}

/**
 * The server's check of an upload request — a trust boundary, so it repeats
 * the browser's checks rather than trusting them. Returns the byte count to
 * sign for, or the reason to refuse.
 */
export function checkUploadRequest(body: unknown): { size: number } | { error: string } {
  const b = (body ?? {}) as { contentType?: unknown; size?: unknown };
  if (b.contentType !== VIDEO_ACCEPT) return { error: 'Only MP4 video can be uploaded.' };
  const size = b.size;
  if (typeof size !== 'number' || !Number.isInteger(size) || size <= 0) return { error: 'Invalid file size.' };
  if (size > VIDEO_MAX_BYTES) return { error: 'Keep the video under 10 MB.' };
  return { size };
}

/** What to say when the PUT to storage fails. Status 0 is the browser hiding a CORS refusal. */
export function uploadErrorMessage(status: number): string {
  if (status === 0) return "The storage isn't accepting uploads from this site yet. Ask your developer to allow it in the bucket's CORS settings.";
  if (status === 403) return 'The upload link expired or was refused. Try again.';
  return `The upload failed (error ${status}). Try again.`;
}
