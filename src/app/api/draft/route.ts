import { NextRequest, NextResponse } from 'next/server';
import { campaignService } from '@/services/campaignService';
import { getSessionUserId } from '@/lib/auth/currentUser';
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
  const start = Date.now();
  try {
    const userId = await getSessionUserId();
    if (!userId) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

    const result = await campaignService.getDraftWithTimestamps(userId);
    console.log(`[DRAFT] GET -> ${result ? 'OK' : 'EMPTY'} (${Date.now() - start}ms)`);
    return NextResponse.json({
      draft: result?.config ?? null,
      promoLastUpdated: result?.promoLastUpdated ?? null,
      announcementLastUpdated: result?.announcementLastUpdated ?? null,
    });
  } catch (error) {
    console.error(`[DRAFT] GET -> FAILED (${Date.now() - start}ms):`, error);
    return NextResponse.json({ error: 'Failed to load draft' }, { status: 500 });
  }
}

// PUT → upsert the draft.
export async function PUT(request: NextRequest) {
  const start = Date.now();
  try {
    const userId = await getSessionUserId();
    if (!userId) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

    const config: CampaignConfig = await request.json();
    const result = await campaignService.saveDraft(userId, config);
    if (!result.success) {
      console.error(`[DRAFT] PUT -> rejected: ${result.message} (${Date.now() - start}ms)`);
      return NextResponse.json({ error: result.message }, { status: 500 });
    }
    console.log(`[DRAFT] PUT -> OK (${Date.now() - start}ms)`);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(`[DRAFT] PUT -> FAILED (${Date.now() - start}ms):`, error);
    return NextResponse.json({ error: 'Failed to save draft' }, { status: 500 });
  }
}

// DELETE → clear the draft (on publish / discard).
export async function DELETE() {
  const start = Date.now();
  try {
    const userId = await getSessionUserId();
    if (!userId) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

    await campaignService.clearDraft(userId);
    console.log(`[DRAFT] DELETE -> OK (${Date.now() - start}ms)`);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(`[DRAFT] DELETE -> FAILED (${Date.now() - start}ms):`, error);
    return NextResponse.json({ error: 'Failed to clear draft' }, { status: 500 });
  }
}
