import { VIDEO_ACCEPT } from '@/lib/videoStory/videoRules';
import { AUDIO_BITRATE, clipEnd, compressedSize, uploadErrorMessage } from '@/lib/videoStory/videoUpload';

/**
 * The browser half of a Video Story upload: re-encode a clip on the user's
 * own machine, and PUT the result straight to storage. Pure decisions live in
 * lib/videoStory/videoUpload.ts; this file only does the I/O.
 */

/** Thrown when this browser cannot re-encode — the UI shows the help panel. */
export class CompressionUnsupported extends Error {}

/**
 * MP4 / H.264 at 720p, AAC audio, first 15 seconds, at `bitrate`. Uses
 * WebCodecs through mediabunny, imported on demand so its ~200 KB is only
 * downloaded by someone who actually needs to shrink a clip.
 */
export async function compressClip(
  file: Blob,
  bitrate: number,
  onProgress: (fraction: number) => void,
  signal: AbortSignal,
): Promise<Blob> {
  if (typeof VideoEncoder === 'undefined') throw new CompressionUnsupported('No WebCodecs');
  const mb = await import('mediabunny');
  const input = new mb.Input({ source: new mb.BlobSource(file), formats: mb.ALL_FORMATS });
  try {
    const track = await input.getPrimaryVideoTrack();
    if (!track) throw new CompressionUnsupported('No video track');
    const duration = await input.computeDuration();
    const target = new mb.BufferTarget();
    const conversion = await mb.Conversion.init({
      input,
      // in-memory fast start puts the index first, so the widget can start
      // playing before the whole file has arrived.
      output: new mb.Output({ format: new mb.Mp4OutputFormat({ fastStart: 'in-memory' }), target }),
      video: {
        codec: 'avc',
        ...compressedSize(track.displayWidth, track.displayHeight),
        // Required by mediabunny once both sides are given. The box has the
        // clip's own aspect ratio, so 'contain' never letterboxes.
        fit: 'contain',
        // Constant, so the size is predictable: in variable mode the
        // hardware encoder overshot 2 Mbps by ~2× on busy footage.
        quality: new mb.Quality({ bitrate, bitrateMode: 'constant' }),
        forceTranscode: true,
      },
      audio: { codec: 'aac', quality: new mb.Quality({ bitrate: AUDIO_BITRATE }) },
      trim: { start: 0, end: clipEnd(duration) },
      showWarnings: false,
    });
    // A conversion that dropped the video (an HEVC clip where this browser
    // has no HEVC decoder, or no H.264 encoder) still counts as "valid" with
    // just the audio — and would hand back a 0.1 MB soundtrack. Refuse it.
    // A dropped audio track alone still makes a usable, silent clip.
    if (!conversion.utilizedTracks.some((t) => t.isVideoTrack())) {
      const why = conversion.discardedTracks.map((d) => `${d.track.type}: ${d.reason}`).join(', ');
      throw new CompressionUnsupported(`Video track not convertible (${why || 'none found'})`);
    }
    conversion.onProgress = (p) => onProgress(p);
    signal.addEventListener('abort', () => void conversion.cancel(), { once: true });
    await conversion.execute();
    if (!target.buffer) throw new Error('Conversion produced no output');
    return new Blob([target.buffer], { type: VIDEO_ACCEPT });
  } finally {
    input.dispose();
  }
}

/** A failed upload step, already worded for the user. `notSetUp` = no storage configured. */
export class UploadError extends Error {
  constructor(message: string, readonly notSetUp = false) { super(message); }
}

/**
 * Ask the server for a one-off upload link, then PUT the clip to it.
 * XMLHttpRequest rather than fetch because only XHR reports upload progress.
 * Resolves to the clip's public address.
 */
export async function uploadClip(
  blob: Blob,
  onProgress: (fraction: number) => void,
): Promise<string> {
  const res = await fetch('/api/uploads/video-story', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contentType: VIDEO_ACCEPT, size: blob.size }),
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 503) throw new UploadError('Video uploads are not set up yet.', true);
  if (!res.ok || !data.uploadUrl || !data.publicUrl) {
    throw new UploadError(data.error || 'The upload could not start. Try again.');
  }

  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', data.uploadUrl);
    xhr.setRequestHeader('Content-Type', VIDEO_ACCEPT); // signed into the link
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) onProgress(e.loaded / e.total); };
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300
      ? resolve()
      : reject(new UploadError(uploadErrorMessage(xhr.status))));
    // A network error and a CORS refusal look the same from here: status 0.
    xhr.onerror = () => reject(new UploadError(uploadErrorMessage(0)));
    xhr.send(blob);
  });
  return data.publicUrl as string;
}
