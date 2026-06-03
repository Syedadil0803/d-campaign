import { NextRequest, NextResponse } from 'next/server';
import { campaignService } from '@/services/campaignService';
import { CampaignConfig } from '@/types/campaign';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

// R2 S3-compatible client (EU jurisdiction bucket)
const r2Client = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.eu.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
  },
});

const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || 'devlinproject';
const R2_CONFIG_KEY = 'campaign-config.json';

async function syncToR2(config: CampaignConfig): Promise<void> {
  try {
    await r2Client.send(
      new PutObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: R2_CONFIG_KEY,
        Body: JSON.stringify(config, null, 2),
        ContentType: 'application/json',
      })
    );
  } catch (error) {
    console.error('R2 sync error:', error);
  }
}

export async function GET() {
  try {
    const config = await campaignService.getConfig();
    return NextResponse.json(config);
  } catch (error) {
    console.error('Failed to load config:', error);
    return NextResponse.json({ error: 'Failed to load config' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const config: CampaignConfig = await request.json();
    const result = await campaignService.saveConfig(config);

    if (result.success) {
      // Sync to R2 so the website widget can fetch the latest config
      await syncToR2(config);
      return NextResponse.json({ success: true, message: result.message });
    } else {
      return NextResponse.json({ error: result.message }, { status: 500 });
    }
  } catch (error) {
    console.error('Failed to save config:', error);
    return NextResponse.json({ error: 'Failed to save config' }, { status: 500 });
  }
}
