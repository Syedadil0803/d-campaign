import { NextRequest, NextResponse } from 'next/server';
import { campaignService } from '@/services/campaignService';
import { withUser } from '@/lib/auth/withUser';
import { CampaignConfig } from '@/types/campaign';

// Scoped to the announcement bar only — never reads or writes promoCard,
// even though both live on the same draft row. See /api/draft/route.ts for
// the combined read and the full-wipe delete.
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// PUT → upsert just the announcement side of the draft.
export async function PUT(request: NextRequest) {
  return withUser('[DRAFT/ANNOUNCEMENT] PUT', 'Failed to save announcement draft', async (userId, start) => {
    const { announcementBar }: { announcementBar: CampaignConfig['announcementBar'] } =
      await request.json();
    const result = await campaignService.saveAnnouncementDraft(userId, announcementBar);
    if (!result.success) {
      console.error(`[DRAFT/ANNOUNCEMENT] PUT -> rejected: ${result.message} (${Date.now() - start}ms)`);
      return NextResponse.json({ error: result.message }, { status: 500 });
    }
    console.log(`[DRAFT/ANNOUNCEMENT] PUT -> OK (${Date.now() - start}ms)`);
    return NextResponse.json({ success: true });
  });
}

// DELETE → reset just the announcement side to blank. Promo is untouched.
export async function DELETE() {
  return withUser('[DRAFT/ANNOUNCEMENT] DELETE', 'Failed to clear announcement draft', async (userId, start) => {
    await campaignService.clearAnnouncementDraft(userId);
    console.log(`[DRAFT/ANNOUNCEMENT] DELETE -> OK (${Date.now() - start}ms)`);
    return NextResponse.json({ success: true });
  });
}
