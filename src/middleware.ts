import { NextRequest, NextResponse } from 'next/server';
import { SESSION_COOKIE, verifySession } from '@/lib/session';

/**
 * Keeps the editor behind a sign-in.
 *
 * Runs on the Edge, so it can only use what session.ts offers on Web Crypto —
 * that is the whole reason session verification is stateless. A database
 * lookup here would mean a connection on every navigation, including for
 * visitors who turn out not to be signed in at all.
 */
export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const session = await verifySession(request.cookies.get(SESSION_COOKIE)?.value);

  if (pathname === '/login') {
    // Already signed in — no reason to show the form again.
    if (session) return NextResponse.redirect(new URL('/', request.url));
    return NextResponse.next();
  }

  if (!session) {
    const login = new URL('/login', request.url);
    // Remembered so the redirect lands where they were headed, not just home.
    if (pathname !== '/') login.searchParams.set('next', `${pathname}${search}`);
    return NextResponse.redirect(login);
  }

  return NextResponse.next();
}

export const config = {
  /**
   * Everything except Next's own assets, the public files, and the auth
   * endpoints themselves — the login POST has to be reachable while signed
   * out, and guarding it would make signing in impossible.
   */
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/auth|flags|.*\\.(?:png|jpg|jpeg|svg|gif|webp|ico|css|js|json|txt|xml)$).*)'],
};
