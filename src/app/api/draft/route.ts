import { NextRequest, NextResponse } from 'next/server';
import { campaignService } from '@/services/campaignService';
import { withUser } from '@/lib/auth/withUser';
import { CampaignConfig } from '@/types/campaign';

// The draft lives only in the DB (never R2 — it isn't published). Talks to the
// DB at request time, so never prerender it.
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// GET → the single saved draft, or null when there is none. Also carries the
// two independent per-card save timestamps (promoCard and announcementBar
// share this one row, but are saved separately — see savePromoDraft /
// saveAnnouncementDraft — so each needs its own "last saved" time).
export async function GET() {
  return withUser('[DRAFT] GET', 'Failed to load draft', async (userId, start) => {
    const result = await campaignService.getDraftWithTimestamps(userId);
    console.log(`[DRAFT] GET -> ${result ? 'OK' : 'EMPTY'} (${Date.now() - start}ms)`);
    return NextResponse.json({
      draft: result?.config ?? null,
      promoLastUpdated: result?.promoLastUpdated ?? null,
      announcementLastUpdated: result?.announcementLastUpdated ?? null,
    });
  });
}

// PUT → upsert the draft.
export async function PUT(request: NextRequest) {
  return withUser('[DRAFT] PUT', 'Failed to save draft', async (userId, start) => {
    const config: CampaignConfig = await request.json();
    const result = await campaignService.saveDraft(userId, config);
    if (!result.success) {
      console.error(`[DRAFT] PUT -> rejected: ${result.message} (${Date.now() - start}ms)`);
      return NextResponse.json({ error: result.message }, { status: 500 });
    }
    console.log(`[DRAFT] PUT -> OK (${Date.now() - start}ms)`);
    return NextResponse.json({ success: true });
  });
}

// DELETE → clear the draft (on publish / discard).
export async function DELETE() {
  return withUser('[DRAFT] DELETE', 'Failed to clear draft', async (userId, start) => {
    await campaignService.clearDraft(userId);
    console.log(`[DRAFT] DELETE -> OK (${Date.now() - start}ms)`);
    return NextResponse.json({ success: true });
  });
}
