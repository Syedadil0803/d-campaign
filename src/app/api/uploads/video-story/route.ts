import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { withUser } from '@/lib/auth/withUser';
import { getR2Client, R2_BUCKET_NAME } from '@/lib/publishToR2';
import { checkUploadRequest } from '@/lib/videoStory/videoUpload';
import { videoExtension } from '@/lib/videoStory/videoRules';

// Hands the browser a one-off, 5-minute PUT link so the clip goes straight
// to R2 — the video never passes through this server.
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  return withUser('[UPLOAD/VIDEO] POST', 'Failed to prepare the video upload', async (_userId, start) => {
    // Without a public address the stored clip could not be played, so there
    // is no point uploading it. 503 = "not set up", which the UI says plainly.
    const publicBase = (process.env.R2_PUBLIC_BASE_URL || '').trim().replace(/\/+$/, '');
    if (!publicBase) {
      console.error('[UPLOAD/VIDEO] POST -> R2_PUBLIC_BASE_URL is not set');
      return NextResponse.json({ error: 'Video uploads are not set up yet' }, { status: 503 });
    }

    const checked = checkUploadRequest(await request.json().catch(() => null));
    if ('error' in checked) return NextResponse.json({ error: checked.error }, { status: 400 });

    // A fresh random name per upload: nothing to guess, nothing overwritten,
    // and the address can be cached forever.
    // The extension follows the signed type so the stored file says what it is.
    const key = `video-story/${randomUUID()}${videoExtension(checked.contentType)}`;
    // Type and length are signed, so the link only accepts this one clip of
    // exactly the size checked above — not a bigger file swapped in later.
    const uploadUrl = await getSignedUrl(
      getR2Client(),
      new PutObjectCommand({ Bucket: R2_BUCKET_NAME, Key: key, ContentType: checked.contentType, ContentLength: checked.size }),
      { expiresIn: 300, signableHeaders: new Set(['content-type', 'content-length']) },
    );
    console.log(`[UPLOAD/VIDEO] POST -> signed ${key} ${checked.size}B (${Date.now() - start}ms)`);
    return NextResponse.json({ uploadUrl, publicUrl: `${publicBase}/${key}` });
  });
}
