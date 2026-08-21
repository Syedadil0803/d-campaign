import { NextRequest, NextResponse } from 'next/server';
import { getSessionUserId } from '@/lib/currentUser';
import { userRepository } from '@/repositories/userRepository';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * GET ?deviceId=… → unsaved work sitting in a browser other than this one.
 *
 * The caller names itself so the query can exclude it. Asking "does this
 * account have unsaved work anywhere" would answer yes to a browser about its
 * own edits, which it can already see on screen.
 */
export async function GET(request: NextRequest) {
  try {
    const userId = await getSessionUserId();
    if (!userId) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

    const deviceId = request.nextUrl.searchParams.get('deviceId');
    if (!deviceId) return NextResponse.json({ error: 'Missing deviceId' }, { status: 400 });

    return NextResponse.json({
      elsewhere: await userRepository.findUnsavedElsewhere(userId, deviceId),
    });
  } catch (error) {
    console.error('[PRESENCE] GET -> FAILED:', error);
    // A failure here must not break the editor: the notice is an extra, and
    // "we don't know" is safely reported as "nothing outstanding".
    return NextResponse.json({ elsewhere: null });
  }
}

/**
 * POST → raise or lower the flag for this account.
 *
 * Sent only when the answer changes — not on every edit. The body carries the
 * device, never the card: what is unsaved stays in the browser that made it.
 */
export async function POST(request: NextRequest) {
  try {
    const userId = await getSessionUserId();
    if (!userId) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

    const body = (await request.json()) as {
      hasUnsaved?: boolean;
      deviceId?: string;
      deviceLabel?: string;
    };
    if (typeof body.hasUnsaved !== 'boolean' || !body.deviceId) {
      return NextResponse.json({ error: 'Invalid presence update' }, { status: 400 });
    }

    const saved = await userRepository.setDevicePresence(userId, {
      hasUnsaved: body.hasUnsaved,
      deviceId: body.deviceId,
      deviceLabel: body.deviceLabel || 'an unrecognized browser',
    });
    return NextResponse.json({ success: saved });
  } catch (error) {
    console.error('[PRESENCE] POST -> FAILED:', error);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
