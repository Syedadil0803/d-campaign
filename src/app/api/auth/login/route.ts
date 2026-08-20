import { NextRequest, NextResponse } from 'next/server';
import { userRepository } from '@/repositories/userRepository';
import { verifyPassword } from '@/lib/password';
import { SESSION_COOKIE, SESSION_TTL_MS, signSession, sessionCookieOptions } from '@/lib/session';

// Reads the database and sets a cookie, so it can never be prerendered.
export const dynamic = 'force-dynamic';
// scrypt needs node:crypto — this route must not be pushed to the Edge.
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const { email, password } = (await request.json()) as { email?: string; password?: string };
    if (!email || !password) {
      return NextResponse.json({ error: 'Enter your email and password.' }, { status: 400 });
    }

    const user = await userRepository.findByEmail(email);
    const ok = user?.provider === 'password' && (await verifyPassword(password, user.passwordHash));

    // One message for "no such account" and "wrong password" alike, so the
    // form cannot be used to find out which addresses have accounts.
    if (!user || !ok) {
      return NextResponse.json({ error: "That email and password don't match." }, { status: 401 });
    }

    const response = NextResponse.json({
      user: { id: user.id, email: user.email, name: user.name },
    });
    response.cookies.set(
      SESSION_COOKIE,
      await signSession(user.id),
      sessionCookieOptions(SESSION_TTL_MS / 1000),
    );
    console.log(`[AUTH] login -> OK user=${user.id}`);
    return response;
  } catch (error) {
    console.error('[AUTH] login -> FAILED:', error);
    return NextResponse.json({ error: 'Could not sign you in. Try again.' }, { status: 500 });
  }
}
