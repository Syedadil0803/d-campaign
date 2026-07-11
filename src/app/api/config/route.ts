import { NextRequest, NextResponse } from 'next/server';
import { campaignService } from '@/services/campaignService';
import { CampaignConfig } from '@/types/campaign';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

// This route talks to the DB + R2 at request time — never prerender it.
export const dynamic = 'force-dynamic';

const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || 'devlinproject';
const R2_CONFIG_KEY = 'campaign-config.json';

// Lazily create the R2 client on first use (not at module load), so `next build`
// doesn't need the R2 env vars.
let _r2Client: S3Client | null = null;
function getR2Client(): S3Client {
  if (!_r2Client) {
    _r2Client = new S3Client({
      region: 'auto',
      endpoint: `https://${process.env.R2_ACCOUNT_ID}.eu.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
      },
    });
  }
  return _r2Client;
}

async function syncToR2(config: CampaignConfig): Promise<{ ok: boolean; error?: string }> {
  const body = JSON.stringify(config, null, 2);
  const bytes = Buffer.byteLength(body);
  const start = Date.now();
  console.log(`[R2] PUT bucket=${R2_BUCKET_NAME} key=${R2_CONFIG_KEY} ${bytes}B version=${config.version} …`);
  try {
    await getR2Client().send(
      new PutObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: R2_CONFIG_KEY,
        Body: body,
        ContentType: 'application/json',
      })
    );
    console.log(`[R2] PUT -> OK bucket=${R2_BUCKET_NAME} key=${R2_CONFIG_KEY} ${bytes}B (${Date.now() - start}ms)`);
    return { ok: true };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error(`[R2] PUT -> FAILED bucket=${R2_BUCKET_NAME} key=${R2_CONFIG_KEY} ${bytes}B (${Date.now() - start}ms):`, error);
    return { ok: false, error: msg };
  }
}

export async function GET() {
  const start = Date.now();
  try {
    const config = await campaignService.getConfig();
    console.log(`[CONFIG] GET -> OK (${Date.now() - start}ms)`);
    return NextResponse.json(config);
  } catch (error) {
    console.error(`[CONFIG] GET -> FAILED (${Date.now() - start}ms):`, error);
    return NextResponse.json({ error: 'Failed to load config' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const start = Date.now();
  try {
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
  } catch (error) {
    console.error(`[CONFIG] PUT -> FAILED (${Date.now() - start}ms):`, error);
    return NextResponse.json({ error: 'Failed to save config' }, { status: 500 });
  }
}
