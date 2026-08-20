import { NextResponse } from 'next/server';
import { SESSION_COOKIE, sessionCookieOptions } from '@/lib/session';

export const dynamic = 'force-dynamic';

export async function POST() {
  const response = NextResponse.json({ success: true });
  // Same attributes as when it was set — a cookie cleared with a different
  // path or sameSite is a second cookie, and the original survives.
  response.cookies.set(SESSION_COOKIE, '', sessionCookieOptions(0));
  return response;
}
