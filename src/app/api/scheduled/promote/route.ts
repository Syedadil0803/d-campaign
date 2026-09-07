import { NextRequest, NextResponse } from 'next/server';
import { promoteDueScheduled } from '@/lib/promoteScheduled';

// Talks to the DB + R2 at request time — never prerender it.
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Puts due campaigns live. Triggered by whatever the platform provides — a
 * Vercel cron today, a Cloudflare Cron Trigger later, a plain pinger in
 * between. Nothing here knows or cares which.
 *
 * Guarded by a shared secret rather than a session: a scheduler has no user to
 * sign in as, and this URL can publish to the live site.
 *
 * One job is enough however many campaigns exist — it sweeps them all, and the
 * start date is a day, so running once a day satisfies the promise made to the
 * user.
 */
export async function POST(request: NextRequest) {
  const secret = process.env.SCHEDULE_PROMOTE_SECRET;
  if (!secret) {
    console.error('[SCHEDULE] POST -> refused: SCHEDULE_PROMOTE_SECRET is not set');
    return NextResponse.json({ error: 'Not configured' }, { status: 503 });
  }

  const offered =
    request.headers.get('authorization')?.replace(/^Bearer /, '') ??
    request.headers.get('x-schedule-secret');

  if (offered !== secret) {
    console.warn('[SCHEDULE] POST -> refused: bad secret');
    return NextResponse.json({ error: 'Not authorised' }, { status: 401 });
  }

  const start = Date.now();
  try {
    const { promoted, failed } = await promoteDueScheduled();
    console.log(
      `[SCHEDULE] POST -> OK promoted=${promoted.length} failed=${failed.length} (${Date.now() - start}ms)`,
    );
    return NextResponse.json({ promoted: promoted.length, failed: failed.length });
  } catch (error) {
    console.error(`[SCHEDULE] POST -> FAILED (${Date.now() - start}ms):`, error);
    return NextResponse.json({ error: 'Failed to promote' }, { status: 500 });
  }
}
