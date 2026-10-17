import { videoContentType } from '@/lib/videoStory/videoRules';
import { uploadErrorMessage } from '@/lib/videoStory/videoUpload';

/**
 * The browser half of a Video Story upload: PUT the clip straight to
 * storage. Pure decisions live in
 * lib/videoStory/videoUpload.ts; this file only does the I/O.
 */

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
  file: File,
  onProgress: (fraction: number) => void,
): Promise<string> {
  // The file's own type (or its extension's, when the browser gave none);
  // only accepted clips reach here, so null cannot happen in practice.
  const contentType = videoContentType(file) ?? 'video/mp4';
  const res = await fetch('/api/uploads/video-story', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contentType, size: file.size }),
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 503) throw new UploadError('Video uploads are not set up yet.', true);
  if (!res.ok || !data.uploadUrl || !data.publicUrl) {
    throw new UploadError(data.error || "Upload couldn't start. Please try again.");
  }

  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', data.uploadUrl);
    xhr.setRequestHeader('Content-Type', contentType); // signed into the link
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) onProgress(e.loaded / e.total); };
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300
      ? resolve()
      : reject(new UploadError(uploadErrorMessage(xhr.status))));
    // A network error and a CORS refusal look the same from here: status 0.
    xhr.onerror = () => reject(new UploadError(uploadErrorMessage(0)));
    xhr.send(file);
  });
  return data.publicUrl as string;
}
