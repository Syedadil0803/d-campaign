import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import type { CampaignConfig } from '@/types/campaign';

// Publishing writes two places: the DB row the tool reads, and this file, which
// is what the website actually loads. Lifted out of the config route so the
// scheduled-campaign promoter publishes down exactly the same path — two copies
// of a publish is how the two drift apart.

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

export async function syncToR2(config: CampaignConfig): Promise<{ ok: boolean; error?: string }> {
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

export { R2_CONFIG_KEY, R2_BUCKET_NAME };
