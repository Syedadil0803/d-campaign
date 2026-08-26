import { NextResponse } from 'next/server';
import { getSessionUserId } from '@/lib/auth/currentUser';
import { userRepository } from '@/repositories/userRepository';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// GET → the signed-in account, or null. Never the password hash.
export async function GET() {
  try {
    const userId = await getSessionUserId();
    if (!userId) return NextResponse.json({ user: null });

    const user = await userRepository.findById(userId);
    if (!user) return NextResponse.json({ user: null });

    return NextResponse.json({ user: { id: user.id, email: user.email, name: user.name } });
  } catch (error) {
    console.error('[AUTH] session -> FAILED:', error);
    return NextResponse.json({ user: null });
  }
}
