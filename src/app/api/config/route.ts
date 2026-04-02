import { NextRequest, NextResponse } from 'next/server';
import { campaignService } from '@/services/campaignService';
import { CampaignConfig } from '@/types/campaign';

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
      return NextResponse.json({ success: true, message: result.message });
    } else {
      return NextResponse.json({ error: result.message }, { status: 500 });
    }
  } catch (error) {
    console.error('Failed to save config:', error);
    return NextResponse.json({ error: 'Failed to save config' }, { status: 500 });
  }
}
