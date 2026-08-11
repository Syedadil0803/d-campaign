import { NextRequest, NextResponse } from 'next/server';
import { campaignService } from '@/services/campaignService';

// Variants ("My Saved") live in the DB (variants column on the default row).
export const dynamic = 'force-dynamic';

// GET → the saved variants array (may be empty).
export async function GET() {
  const start = Date.now();
  try {
    const variants = await campaignService.getVariants();
    console.log(`[VARIANTS] GET -> OK count=${variants.length} (${Date.now() - start}ms)`);
    return NextResponse.json({ variants });
  } catch (error) {
    console.error(`[VARIANTS] GET -> FAILED (${Date.now() - start}ms):`, error);
    return NextResponse.json({ error: 'Failed to load variants' }, { status: 500 });
  }
}

// PUT → replace the whole variants array (the client caps it at MAX_VERSIONS).
export async function PUT(request: NextRequest) {
  const start = Date.now();
  try {
    const body = await request.json();
    const variants = Array.isArray(body?.variants) ? body.variants : body;
    const result = await campaignService.saveVariants(variants);
    if (!result.success) {
      return NextResponse.json({ error: 'Failed to save variants' }, { status: 500 });
    }
    console.log(`[VARIANTS] PUT -> OK count=${variants.length} (${Date.now() - start}ms)`);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(`[VARIANTS] PUT -> FAILED (${Date.now() - start}ms):`, error);
    return NextResponse.json({ error: 'Failed to save variants' }, { status: 500 });
  }
}
