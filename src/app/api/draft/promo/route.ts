import { NextRequest, NextResponse } from 'next/server';
import { campaignService } from '@/services/campaignService';
import { withUser } from '@/lib/auth/withUser';
import { PromoCard } from '@/types/campaign';

// Scoped to the promo card only — never reads or writes announcementBar,
// even though both live on the same draft row. See /api/draft/route.ts for
// the combined read and the full-wipe delete.
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// PUT → upsert just the promo side of the draft.
export async function PUT(request: NextRequest) {
  return withUser('[DRAFT/PROMO] PUT', 'Failed to save promo draft', async (userId, start) => {
    const { promoCard }: { promoCard: PromoCard } = await request.json();
    const result = await campaignService.savePromoDraft(userId, promoCard);
    if (!result.success) {
      console.error(`[DRAFT/PROMO] PUT -> rejected: ${result.message} (${Date.now() - start}ms)`);
      return NextResponse.json({ error: result.message }, { status: 500 });
    }
    console.log(`[DRAFT/PROMO] PUT -> OK (${Date.now() - start}ms)`);
    return NextResponse.json({ success: true });
  });
}

// DELETE → reset just the promo side to blank. Announcement is untouched.
export async function DELETE() {
  return withUser('[DRAFT/PROMO] DELETE', 'Failed to clear promo draft', async (userId, start) => {
    await campaignService.clearPromoDraft(userId);
    console.log(`[DRAFT/PROMO] DELETE -> OK (${Date.now() - start}ms)`);
    return NextResponse.json({ success: true });
  });
}
