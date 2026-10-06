import { NextResponse } from 'next/server';
import { getSessionUserId } from '@/lib/auth/currentUser';

/**
 * The shared shell of every signed-in API handler: a session check here as
 * well as in middleware (a guard that's one path-matcher change from not
 * matching shouldn't be the only defence), timing, and a logged 500 on any
 * throw. `label` is the log prefix, e.g. "[DRAFT] PUT".
 */
export async function withUser(
  label: string,
  failure: string,
  run: (userId: string, start: number) => Promise<Response>,
): Promise<Response> {
  const start = Date.now();
  try {
    const userId = await getSessionUserId();
    if (!userId) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
    return await run(userId, start);
  } catch (error) {
    console.error(`${label} -> FAILED (${Date.now() - start}ms):`, error);
    return NextResponse.json({ error: failure }, { status: 500 });
  }
}
