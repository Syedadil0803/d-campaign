import { isAcceptedVideo, isAcceptedVideoType, VIDEO_FORMAT_NAMES, VIDEO_MAX_BYTES, VIDEO_MAX_MB } from './videoRules';

/**
 * The pure half of a Video Story upload: whether a picked clip can be used,
 * and how to word what went wrong. The browser half (the PUT) lives in
 * components/videoStory/clipTransfer.ts.
 *
 * The rule throughout: the user is never left with only "no". Every refusal
 * says why and comes with the editors that fix it.
 */

/** One decimal under 10 MB ("4.2 MB"), whole numbers above it ("38 MB"). */
export function formatMB(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  if (mb < 0.1) return '0.1 MB';
  return `${mb < 10 ? mb.toFixed(1).replace(/\.0$/, '') : Math.round(mb)} MB`;
}

/**
 * Why a picked clip can't be used, or null when it can. Apart from
 * turning a MOV or HEVC clip into an H.264 MP4 (decideMov), the tool
 * doesn't change the video: anything outside the rules is refused with the exact reason, and
 * the panel below points to free editors that fix it.
 * `seconds` is NaN when the browser could not read the file. Length is not
 * a rule (the widget loops).
 */
export function clipProblem(file: { name: string; type: string; size: number }, seconds: number): string | null {
  // One friendly line, the most basic problem first: what happened, then
  // what to do. Worded as help, not an error.
  if (!isAcceptedVideo(file)) return `Supported formats: ${VIDEO_FORMAT_NAMES}.`;
  if (Number.isNaN(seconds)) return "This file couldn't be read. Try exporting it as MP4.";
  if (file.size > VIDEO_MAX_BYTES) return `File is ${formatMB(file.size)}. Maximum size is ${VIDEO_MAX_MB} MB.`;
  return null;
}

/**
 * A suggestion, never a refusal: the widget is 9:16, so a wider video has its sides cut
 * off. Anything less tall than about 3:2 portrait (square, 4:5 cropped hard,
 * landscape) is flagged; 0×0 means the size is unknown, so nothing is said.
 */
export function shapeTip(width: number, height: number): string | null {
  if (!width || !height || height / width >= 1.5) return null;
  // Upright but short, like a 4:5 Instagram or Facebook feed post.
  if (height > width * 1.02) return 'This video is not tall enough for the widget. Use a vertical video instead.';
  return `This video is ${width > height * 1.02 ? 'horizontal' : 'square'}, while the widget is vertical. Use a vertical video instead.`;
}

/**
 * The note at the top of the upload area, until the user says "Don't show
 * again": every common social-media shape is accepted, and the widget always
 * shows it as 9:16. The shapes are listed in docs/video-aspect-ratios.md.
 */
export const SHAPES_ACCEPTED_NOTE =
  'Accepted: 9:16, 4:5, 1:1 and 16:9 videos from TikTok, Instagram, YouTube, Facebook and X. All show as 9:16.';

/**
 * The server's check of an upload request — a trust boundary, so it repeats
 * the browser's checks rather than trusting them. Returns the byte count and
 * type to sign for, or the reason to refuse.
 */
export function checkUploadRequest(body: unknown): { size: number; contentType: string } | { error: string } {
  const b = (body ?? {}) as { contentType?: unknown; size?: unknown };
  if (!isAcceptedVideoType(b.contentType)) return { error: 'Only MP4 or MOV video can be uploaded.' };
  const size = b.size;
  if (typeof size !== 'number' || !Number.isInteger(size) || size <= 0) return { error: 'Invalid file size.' };
  if (size > VIDEO_MAX_BYTES) return { error: `Keep the video under ${VIDEO_MAX_MB} MB.` };
  return { size, contentType: b.contentType };
}

/** What to say when the PUT to storage fails. Status 0 is the browser hiding a CORS refusal. */
export function uploadErrorMessage(status: number): string {
  if (status === 0) return "The storage isn't accepting uploads from this site yet. Ask your developer to allow it in the bucket's CORS settings.";
  if (status === 403) return 'Upload link expired. Please try again.';
  return `Upload failed (error ${status}). Please try again.`;
}

/**
 * Off until storage is connected (a public R2 address in R2_PUBLIC_BASE_URL
 * and the bucket's CORS rule). While off, a clip is checked and previewed
 * in the browser only: nothing is sent and videoUrl stays empty.
 * Turn on to send clips to R2 again — the upload route is already in place.
 */
export const VIDEO_UPLOADS_ENABLED = false;

/**
 * What to do with a picked clip's tracks. The browser re-wraps an H.264 MOV
 * as MP4 — the same frames copied into a new box, so nothing is re-encoded
 * and it takes seconds. MP4 because every browser plays it, while a .mov
 * only plays reliably in Safari.
 *
 * HEVC, the iPhone default, is 'transcode': re-wrapping it would still leave
 * a video Chrome and Firefox on many machines can't play, so it is
 * re-encoded to H.264 in the owner's browser — if that browser can, which
 * decideHevc settles. Sound that MP4 players don't take (an iPhone or
 * camera's raw PCM) is dropped from a re-wrap rather than re-encoded, since
 * a re-wrap never decodes anything; the result card says so.
 */
export type MovPlan = 'remux' | 'remux-drop-audio' | 'transcode' | { refuse: string };

// What browsers play inside an MP4. mediabunny's names for the codecs.
const MP4_AUDIO = ['aac', 'mp3'];
// Video a browser can decode and we re-encode to H.264.
const RE_ENCODE = ['hevc', 'vp8', 'vp9', 'av1'];

export function decideMov(codecs: { videoCodec: string | null; audioCodec: string | null }): MovPlan {
  const { videoCodec, audioCodec } = codecs;
  // HEVC (iPhone, newer cameras), VP8/VP9 (WebM screen recordings) and AV1
  // are re-encoded to H.264; anything else (ProRes, MJPEG…) is refused.
  if (videoCodec && RE_ENCODE.includes(videoCodec)) return 'transcode';
  if (videoCodec !== 'avc') {
    const what = videoCodec ? `${videoCodec.toUpperCase()} format isn't supported` : 'No video track found';
    return { refuse: `${what}. Export as H.264 MP4.` };
  }
  return audioCodec && !MP4_AUDIO.includes(audioCodec) ? 'remux-drop-audio' : 'remux';
}

/**
 * The answer when this browser can't turn an HEVC clip into H.264. Codec
 * names and phone settings mean nothing to most owners, so it names only
 * what they can do; the codec detail goes under "Technical detail".
 */
export function hevcRefusal(): string {
  return "This browser can't convert this video. Try Chrome or Safari, or export as MP4.";
}

/**
 * Whether this browser can convert an HEVC clip: it must both decode the
 * HEVC (Chrome only does where the OS or GPU offers it) and encode H.264 at
 * the clip's size. Either missing → hevcRefusal, with which part was
 * missing as the technical detail.
 */
export function decideHevc(
  name: string,
  can: { decode: boolean; encode: boolean; width: number; height: number },
): 'transcode' | { refuse: string; detail: string } {
  if (can.decode && can.encode) return 'transcode';
  const missing = [
    !can.decode && "This browser can't decode this video's format.",
    !can.encode && `This browser has no H.264 encoder for ${can.width}×${can.height}.`,
  ].filter(Boolean);
  return { refuse: hevcRefusal(), detail: missing.join(' ') };
}

/**
 * H.264 encoders reject odd sizes (4:2:0 halves each side), so an odd side
 * loses one pixel. Null when both are already even: nothing to resize.
 */
export function evenSize(width: number, height: number): { width: number; height: number } | null {
  if (width % 2 === 0 && height % 2 === 0) return null;
  return { width: width - (width % 2), height: height - (height % 2) };
}

/**
 * A re-encode can come out bigger than the original, so the limit is
 * checked again on the result. Worded without "converted": the UI never
 * announces the conversion, only what the owner can act on.
 */
export function convertedSizeProblem(size: number): string | null {
  return size > VIDEO_MAX_BYTES ? `Converted file is ${formatMB(size)}. Maximum size is ${VIDEO_MAX_MB} MB.` : null;
}

/** The converted clip's file name: same name, .mp4 ending. */
export function mp4Name(name: string): string {
  return name.replace(/\.(mov|mp4)$/i, '') + '.mp4';
}

/**
 * The widget's preview copy: vertical, silent, small. 270×480 is the widget's
 * 200 px width at about 1.35× for sharp screens; 250 kbps at 24 fps keeps a
 * 30 s clip near 1 MB, against 25–150 MB for the full upload.
 */
export const VIDEO_PREVIEW = { width: 270, height: 480, bitrate: 250_000, frameRate: 24 } as const;

/**
 * Whether an MP4's index (moov) comes after its frames (mdat), from the
 * order of its top-level boxes. Then a browser must fetch the end of the
 * file before it can play, so the clip is re-wrapped with the index first.
 */
export function indexAtEnd(boxTypes: string[]): boolean {
  const moov = boxTypes.indexOf('moov');
  const mdat = boxTypes.indexOf('mdat');
  return moov !== -1 && mdat !== -1 && mdat < moov;
}
