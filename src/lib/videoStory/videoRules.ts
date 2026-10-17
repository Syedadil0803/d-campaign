/**
 * What a Video Story clip may be. The one place these rules live —
 * clipProblem and checkUploadRequest (videoUpload.ts), the file picker and
 * the dropzone chips all read them from here.
 *
 * - Picked: MP4, MOV, M4V, WebM, MKV and MTS/M2TS, which covers phones,
 *   cameras (DSLR, mirrorless, camcorders' AVCHD), action cameras, editors
 *   and screen recorders. Everything is stored as an H.264 MP4: H.264 in
 *   another box is re-wrapped, HEVC, VP8, VP9 and AV1 are re-encoded, in the
 *   owner's browser before upload (decideMov, movToMp4). Pro codecs a browser
 *   can't decode (ProRes, RAW, MJPEG) get a plain refusal.
 * - 150 MB cap: room for a phone's own recording without asking anyone to
 *   compress first. A single presigned PUT takes up to 5 GB on R2, so no
 *   multipart upload is needed at this size.
 * - No length cap: the widget loops, so there is nothing to trim.
 */
export const VIDEO_MAX_BYTES = 150 * 1024 * 1024;
export const VIDEO_MAX_MB = VIDEO_MAX_BYTES / (1024 * 1024);
/** What is stored and uploaded: each MIME type with its extension. */
const VIDEO_FORMATS = [
  { type: 'video/mp4', ext: '.mp4' },
  { type: 'video/quicktime', ext: '.mov' },
] as const;
/** What an owner may pick: the stored formats plus the ones turned into MP4 first. */
const PICKABLE_FORMATS = [
  ...VIDEO_FORMATS,
  { type: 'video/x-m4v', ext: '.m4v' },
  { type: 'video/webm', ext: '.webm' },
  { type: 'video/x-matroska', ext: '.mkv' },
  { type: 'video/mp2t', ext: '.mts' },
  { type: 'video/mp2t', ext: '.m2ts' },
] as const;
/** The formats as people know them, from the list above: "MP4, MOV, M4V, WebM, MKV, MTS". MTS and M2TS are one format. */
export const VIDEO_FORMAT_NAMES = [
  ...new Set(PICKABLE_FORMATS.map((f) => (f.ext === '.webm' ? 'WebM' : f.ext === '.m2ts' ? 'MTS' : f.ext.slice(1).toUpperCase()))),
].join(', ');
/** The rules as short chips, shown on the upload area. */
export const VIDEO_SPECS = [VIDEO_FORMAT_NAMES, `Up to ${VIDEO_MAX_MB} MB`, 'Vertical 9:16'];
/** For the file input: types plus extensions, for systems that report no type. */
export const VIDEO_PICKER_ACCEPT = [...new Set([...PICKABLE_FORMATS.map((f) => f.type), ...PICKABLE_FORMATS.map((f) => f.ext)])].join(',');

/**
 * The MIME type of a pickable clip, or null when it is not one. Some systems
 * give an empty or odd type (.mov on Windows, .mts and .mkv almost
 * everywhere), so the extension decides when the type isn't on the list.
 */
export function videoContentType(file: { name: string; type: string }): string | null {
  const name = file.name.toLowerCase();
  const match = PICKABLE_FORMATS.find((f) => f.type === file.type) ?? PICKABLE_FORMATS.find((f) => name.endsWith(f.ext));
  return match?.type ?? null;
}

export function isAcceptedVideo(file: { name: string; type: string }): boolean {
  return videoContentType(file) !== null;
}

/** For the server: a content type the browser claims, checked against the list. */
export function isAcceptedVideoType(type: unknown): type is string {
  return VIDEO_FORMATS.some((f) => f.type === type);
}

/** Key extension for a stored clip, matching its signed type. */
export function videoExtension(type: string): string {
  return VIDEO_FORMATS.find((f) => f.type === type)?.ext ?? '.mp4';
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
