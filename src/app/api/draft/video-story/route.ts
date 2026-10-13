import { NextRequest, NextResponse } from 'next/server';
import { campaignService } from '@/services/campaignService';
import { withUser } from '@/lib/auth/withUser';
import { VideoStory } from '@/types/campaign';

// Scoped to the Video Story only — never reads or writes promoCard or
// announcementBar, even though all three live on the same draft row. See
// /api/draft/route.ts for the combined read and the full-wipe delete.
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// PUT → upsert just the Video Story side of the draft.
export async function PUT(request: NextRequest) {
  return withUser('[DRAFT/VIDEO] PUT', 'Failed to save video story draft', async (userId, start) => {
    // A body that is not JSON, or carries no video story object, is the
    // caller's mistake: 400, so it is not reported as the server failing.
    const body: { videoStory?: VideoStory } | null = await request.json().catch(() => null);
    const videoStory = body?.videoStory;
    if (!videoStory || typeof videoStory !== 'object' || Array.isArray(videoStory)) {
      console.error(`[DRAFT/VIDEO] PUT -> invalid body (${Date.now() - start}ms)`);
      return NextResponse.json({ error: 'Invalid video story' }, { status: 400 });
    }
    const result = await campaignService.saveVideoStoryDraft(userId, videoStory);
    if (!result.success) {
      console.error(`[DRAFT/VIDEO] PUT -> rejected: ${result.message} (${Date.now() - start}ms)`);
      return NextResponse.json({ error: result.message }, { status: 500 });
    }
    console.log(`[DRAFT/VIDEO] PUT -> OK (${Date.now() - start}ms)`);
    return NextResponse.json({ success: true });
  });
}

// DELETE → reset just the Video Story side. The other two are untouched.
export async function DELETE() {
  return withUser('[DRAFT/VIDEO] DELETE', 'Failed to clear video story draft', async (userId, start) => {
    // Reported, not assumed: a failed clear leaves the old draft to come back
    // on the next load, and the editor needs to know it did not go.
    const { success } = await campaignService.clearVideoStoryDraft(userId);
    if (!success) {
      console.error(`[DRAFT/VIDEO] DELETE -> failed (${Date.now() - start}ms)`);
      return NextResponse.json({ error: 'Failed to clear video story draft' }, { status: 500 });
    }
    console.log(`[DRAFT/VIDEO] DELETE -> OK (${Date.now() - start}ms)`);
    return NextResponse.json({ success: true });
  });
}
