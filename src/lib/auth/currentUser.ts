import { cookies } from 'next/headers';
import { SESSION_COOKIE, verifySession } from '@/lib/auth/session';

/**
 * The signed-in account id for the current request, or null.
 *
 * Route handlers call this instead of trusting anything the client sends: a
 * user id in a request body is a suggestion, a signed cookie is a claim the
 * server made itself. It matters most for the draft, which is now keyed per
 * account — reading the id from the body would let any caller ask for anyone's.
 */
export async function getSessionUserId(): Promise<string | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const payload = await verifySession(token);
  return payload?.userId ?? null;
}
