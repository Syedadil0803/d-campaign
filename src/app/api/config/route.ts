import { NextRequest, NextResponse } from 'next/server';
import { campaignService } from '@/services/campaignService';
import { getSessionUserId } from '@/lib/currentUser';
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
    const accountId = (process.env.R2_ACCOUNT_ID || '').trim();
    const endpoint = `https://${accountId}.eu.r2.cloudflarestorage.com`;
    // Config visibility (no secrets): a bad R2_ACCOUNT_ID (e.g. a DB URL leaking
    // in via the shell env) makes the endpoint host resolve to something like
    // "postgresql", so R2 PUTs fail with ENOTFOUND. Surface it loudly.
    let endpointHost = '(unparseable)';
    try { endpointHost = new URL(endpoint).host; } catch { /* keep placeholder */ }
    const accountIdLooksInvalid = !accountId || /[:/\s]/.test(accountId);
    console.log(
      `[R2] client init endpoint-host=${endpointHost}` +
      ` accountId=${accountId ? `set(${accountId.length}ch)` : 'MISSING'}` +
      ` accessKey=${process.env.R2_ACCESS_KEY_ID ? 'set' : 'MISSING'}` +
      ` secret=${process.env.R2_SECRET_ACCESS_KEY ? 'set' : 'MISSING'}`
    );
    if (accountIdLooksInvalid) {
      console.error(
        '[R2] !! R2_ACCOUNT_ID looks INVALID — it must be the 32-char Cloudflare ' +
        'account id (no URL, no ":" or "/"). A DB/URL value here makes R2 PUTs fail. ' +
        'Check the shell env of the process (echo $R2_ACCOUNT_ID) and .env.local.'
      );
    }
    _r2Client = new S3Client({
      region: 'auto',
      endpoint,
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

/**
 * Checked here as well as in middleware.
 *
 * Middleware guards every route through one path matcher, which is right for a
 * guard but wrong as the only defence: it is a single regex away from not
 * matching, and neither of these handlers would notice. PUT in particular
 * publishes to the live site and to R2.
 */
export async function GET() {
  const start = Date.now();
  try {
    const userId = await getSessionUserId();
    if (!userId) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

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
    const userId = await getSessionUserId();
    if (!userId) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

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
