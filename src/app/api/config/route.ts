import { NextRequest, NextResponse } from 'next/server';
import { campaignService } from '@/services/campaignService';
import { withUser } from '@/lib/auth/withUser';
import { CampaignConfig } from '@/types/campaign';
import { syncToR2 } from '@/lib/publishToR2';
import { promoteDueScheduled } from '@/lib/promoteScheduled';
import { campaignRepository } from '@/repositories/campaignRepository';

// This route talks to the DB + R2 at request time — never prerender it.
export const dynamic = 'force-dynamic';

/**
 * Checked here as well as in middleware.
 *
 * Middleware guards every route through one path matcher, which is right for a
 * guard but wrong as the only defence: it is a single regex away from not
 * matching, and neither of these handlers would notice. PUT in particular
 * publishes to the live site and to R2.
 */
export async function GET() {
  return withUser('[CONFIG] GET', 'Failed to load config', async (userId, start) => {
    // Swept here too, so scheduling works before any cron is wired up. The
    // endpoint stays the real trigger — nobody opening the tool means nobody
    // publishes, and a campaign due yesterday would sit waiting.
    await promoteDueScheduled().catch((e) => console.error('[CONFIG] sweep failed:', e));

    // One request carries both: the live config, and the campaign waiting for
    // its date. A second endpoint would be a second round trip on every load.
    const [config, scheduled] = await Promise.all([
      campaignService.getConfig(),
      campaignRepository.getScheduled(userId),
    ]);
    console.log(`[CONFIG] GET -> OK scheduled=${scheduled ? 'yes' : 'no'} (${Date.now() - start}ms)`);
    return NextResponse.json({ ...config, scheduled });
  });
}

export async function PUT(request: NextRequest) {
  return withUser('[CONFIG] PUT', 'Failed to save config', async (userId, start) => {
    const config: CampaignConfig = await request.json();
    const result = await campaignService.saveConfig(config);

    if (!result.success) {
      console.error(`[CONFIG] PUT -> DB save rejected: ${result.message} (${Date.now() - start}ms)`);
      return NextResponse.json({ error: result.message }, { status: 500 });
    }

    // Sync to R2 so the website widget can fetch the latest config. The DB is the
    // source of truth and already saved; we report R2's outcome separately instead
    // of silently claiming full success when the CDN copy didn't update.
    const r2 = await syncToR2(config);
    console.log(
      `[CONFIG] PUT -> done db=ok r2=${r2.ok ? 'ok' : 'FAILED'} (${Date.now() - start}ms)`
    );
    return NextResponse.json({
      success: true,
      message: result.message,
      db: { saved: true },
      r2: { synced: r2.ok, ...(r2.ok ? {} : { error: r2.error }) },
    });
  });
}
