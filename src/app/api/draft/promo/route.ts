import { NextRequest, NextResponse } from 'next/server';
import { campaignService } from '@/services/campaignService';
import { getSessionUserId } from '@/lib/auth/currentUser';
import { PromoCard } from '@/types/campaign';

// Scoped to the promo card only — never reads or writes announcementBar,
// even though both live on the same draft row. See /api/draft/route.ts for
// the combined read and the full-wipe delete.
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// PUT → upsert just the promo side of the draft.
export async function PUT(request: NextRequest) {
  const start = Date.now();
  try {
    const userId = await getSessionUserId();
    if (!userId) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

    const { promoCard }: { promoCard: PromoCard } = await request.json();
    const result = await campaignService.savePromoDraft(userId, promoCard);
    if (!result.success) {
      console.error(`[DRAFT/PROMO] PUT -> rejected: ${result.message} (${Date.now() - start}ms)`);
      return NextResponse.json({ error: result.message }, { status: 500 });
    }
    console.log(`[DRAFT/PROMO] PUT -> OK (${Date.now() - start}ms)`);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(`[DRAFT/PROMO] PUT -> FAILED (${Date.now() - start}ms):`, error);
    return NextResponse.json({ error: 'Failed to save promo draft' }, { status: 500 });
  }
}

// DELETE → reset just the promo side to blank. Announcement is untouched.
export async function DELETE() {
  const start = Date.now();
  try {
    const userId = await getSessionUserId();
    if (!userId) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

    await campaignService.clearPromoDraft(userId);
    console.log(`[DRAFT/PROMO] DELETE -> OK (${Date.now() - start}ms)`);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(`[DRAFT/PROMO] DELETE -> FAILED (${Date.now() - start}ms):`, error);
    return NextResponse.json({ error: 'Failed to clear promo draft' }, { status: 500 });
  }
}
