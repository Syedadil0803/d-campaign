import { convertedSizeProblem, decideHevc, decideMov, evenSize, hevcRefusal, indexAtEnd, mp4Name, VIDEO_PREVIEW } from '@/lib/videoStory/videoUpload';

/**
 * The browser half of MOV/HEVC → MP4: read the clip's tracks, ask decideMov
 * what to do, then either copy the packets into an MP4 (H.264 MOV) or
 * re-encode the video to H.264 (HEVC, in a MOV or an MP4). Loaded with
 * import() only once a clip is picked, so the rest of the app never
 * downloads mediabunny.
 */
export type MovResult =
  | { file: File; soundRemoved: boolean }
  // An MP4 that isn't HEVC goes on exactly as picked.
  | { keep: true }
  | { refuse: string; detail?: string };

interface Options {
  onProgress: (fraction: number) => void;
  signal: AbortSignal;
  /** The picked file is already an MP4: only HEVC needs any work. */
  isMp4?: boolean;
}

export async function movToMp4(file: File, { onProgress, signal, isMp4 = false }: Options): Promise<MovResult> {
  const mb = await import('mediabunny');
  const input = new mb.Input({ source: new mb.BlobSource(file), formats: mb.ALL_FORMATS });
  try {
    let video, audio;
    try {
      [video, audio] = await Promise.all([input.getPrimaryVideoTrack(), input.getPrimaryAudioTrack()]);
    } catch {
      video = audio = null; // not a readable clip; decideMov (or, for an MP4, clipProblem) words it
    }
    // An H.264 MP4 is kept as picked, unless its index sits at the end: then
    // it is re-wrapped (same frames) so it starts playing before it has loaded.
    if (isMp4 && video?.codec !== 'hevc' && !indexAtEnd(await topBoxes(file))) return { keep: true };
    const plan = decideMov({ videoCodec: video?.codec ?? null, audioCodec: audio?.codec ?? null });
    if (typeof plan === 'object') return plan;
    const kind = plan === 'transcode' ? 'transcode' : 'remux';

    // Re-encoding settings. 'high' is mediabunny's quality level, turned into
    // a fixed rate scaled to the frame size (about 6 Mbps at 1080p, 23 at
    // 4K — what an iPhone records HEVC at), so the H.264 copy looks the same
    // and lands near the original's size. preferBitrate because the
    // constant-quality mode has no ceiling: a grainy 20 s 1080p clip came out
    // at 197 MB. No width, height or frame rate is set, so all stay as recorded.
    const quality = new mb.Quality({ quality: 'high', preferBitrate: true });
    if (kind === 'transcode') {
      const { averagePacketRate } = await video!.computePacketStats(100);
      const [decode, encode] = await Promise.all([
        video!.canDecode(),
        mb.canEncodeVideo('avc', { width: video!.displayWidth, height: video!.displayHeight, frameRate: averagePacketRate, quality }),
      ]);
      const ok = decideHevc(file.name, { decode, encode, width: video!.displayWidth, height: video!.displayHeight });
      if (typeof ok === 'object') return ok;
    }
    onProgress(0);

    const even = evenSize(video!.displayWidth, video!.displayHeight);
    const { conversion, target } = await toMp4(mb, input, {
      ...(kind === 'remux'
        // copy mode 'forced' is what keeps this a re-wrap: mediabunny may
        // only copy packets, never decode or encode, so it works where
        // VideoEncoder doesn't exist and the frames come out as they went in.
        ? { copy: { mode: 'forced' as const }, audio: { discard: plan === 'remux-drop-audio' } }
        // AAC is copied as is; any other sound is re-encoded to AAC, or
        // dropped by mediabunny when this browser has no AAC encoder.
        : { video: { codec: 'avc' as const, quality, ...(even && { ...even, fit: 'fill' as const }) }, audio: { codec: 'aac' as const } }),
    });
    // A dropped video track means there is nothing to show, so refuse.
    const noVideo = !keepsVideo(conversion);
    if (noVideo && kind === 'remux') {
      return { refuse: "This video couldn't be converted. Export as H.264 MP4." };
    }
    if (noVideo) {
      const why = conversion.discardedTracks.map((d) => `${d.track.type} track: ${d.reason}`).join('; ');
      return { refuse: hevcRefusal(), detail: `The converted file has no video track${why ? ` (${why})` : ''}.` };
    }
    signal.addEventListener('abort', () => void conversion.cancel(), { once: true });
    conversion.onProgress = onProgress;
    try {
      await conversion.execute();
    } catch (e) {
      // Remux failures keep their old path: the caller's catch words them.
      if (kind === 'remux') throw e;
      return { refuse: hevcRefusal(), detail: e instanceof Error ? `${e.name}: ${e.message}` : String(e) };
    }
    // Also true when 'forced' (or a missing AAC encoder) dropped the sound.
    const soundRemoved = !!audio && !conversion.utilizedTracks.some((t) => t.isAudioTrack());
    const result = new File([target.buffer!], mp4Name(file.name), { type: 'video/mp4' });
    if (kind === 'transcode') {
      const tooBig = convertedSizeProblem(result.size);
      if (tooBig) return { refuse: tooBig };
    }
    return { file: result, soundRemoved };
  } finally {
    input.dispose();
  }
}

type Mediabunny = typeof import('mediabunny');
type ConversionOptions = Omit<Parameters<Mediabunny['Conversion']['init']>[0], 'input' | 'output'>;

/**
 * A conversion of the clip's main tracks into an in-memory MP4, set up the
 * same way for the full video and the widget preview. 'in-memory' fast start
 * writes the index (moov) before the frames, so it plays while it downloads.
 */
async function toMp4(mb: Mediabunny, input: InstanceType<Mediabunny['Input']>, options: ConversionOptions) {
  const target = new mb.BufferTarget();
  const output = new mb.Output({ format: new mb.Mp4OutputFormat({ fastStart: 'in-memory' }), target });
  const conversion = await mb.Conversion.init({ input, output, tracks: 'primary', showWarnings: false, ...options });
  return { conversion, target };
}

/** Whether the conversion will produce a video track; without one there is nothing to show. */
function keepsVideo(conversion: Awaited<ReturnType<typeof toMp4>>['conversion']): boolean {
  return conversion.isValid && conversion.utilizedTracks.some((t) => t.isVideoTrack());
}

/** The types of an MP4's top-level boxes, in order, read from their 8-byte headers. */
async function topBoxes(file: File): Promise<string[]> {
  const types: string[] = [];
  let at = 0;
  while (at + 8 <= file.size && types.length < 64) {
    const head = new DataView(await file.slice(at, at + 16).arrayBuffer());
    let size = head.getUint32(0);
    const type = String.fromCharCode(head.getUint8(4), head.getUint8(5), head.getUint8(6), head.getUint8(7));
    types.push(type);
    if (size === 1) size = Number(head.getBigUint64(8)); // 64-bit size
    if (size === 0) break; // runs to the end of the file
    if (size < 8) break; // not a valid box: stop rather than loop
    at += size;
  }
  return types;
}

/**
 * The widget's preview copy (VIDEO_PREVIEW): the same clip at about 270×480,
 * silent, cropped to fill the vertical frame. Null when this browser can't
 * encode it; the widget then plays the full clip, as it always has.
 */
export async function makePreview(file: File, signal: AbortSignal): Promise<File | null> {
  const mb = await import('mediabunny');
  const { width, height, bitrate, frameRate } = VIDEO_PREVIEW;
  if (!(await mb.canEncodeVideo('avc', { width, height, bitrate }))) return null;
  const input = new mb.Input({ source: new mb.BlobSource(file), formats: mb.ALL_FORMATS });
  try {
    const { conversion, target } = await toMp4(mb, input, {
      video: { codec: 'avc', width, height, fit: 'cover', bitrate, frameRate },
      audio: { discard: true },
    });
    if (!keepsVideo(conversion)) return null;
    signal.addEventListener('abort', () => void conversion.cancel(), { once: true });
    await conversion.execute();
    return new File([target.buffer!], mp4Name(file.name).replace(/\.mp4$/, '-preview.mp4'), { type: 'video/mp4' });
  } catch {
    return null; // the full clip still works; the preview is an extra
  } finally {
    input.dispose();
  }
}
