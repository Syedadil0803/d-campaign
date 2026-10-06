import { NextRequest, NextResponse } from 'next/server';
import { campaignService } from '@/services/campaignService';
import { withUser } from '@/lib/auth/withUser';
import { MAX_VERSIONS } from '@/lib/promo/promoVersions';

/**
 * Five is the rule, not a convention.
 *
 * The editor already enforces it, but that cap lives in the browser and
 * anything can post to this route. A limit only the client applies is not a
 * limit, and the column it protects is jsonb with no bound of its own.
 *
 * Imported rather than restated, so the server and the editor cannot come to
 * disagree about what the rule is.
 */

// Variants ("My Saved") live in the DB (variants column on the default row).
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// GET → the saved variants array (may be empty).
export async function GET() {
  // Checked here as well as in middleware. The guard is correct today, but a
  // change to its path matcher would expose this route with nothing in the
  // route itself to prevent it.
  return withUser('[VARIANTS] GET', 'Failed to load variants', async (userId, start) => {
    const variants = await campaignService.getVariants();
    console.log(`[VARIANTS] GET -> OK count=${variants.length} (${Date.now() - start}ms)`);
    return NextResponse.json({ variants });
  });
}

// PUT → replace the whole variants array (the client caps it at MAX_VERSIONS).
export async function PUT(request: NextRequest) {
  return withUser('[VARIANTS] PUT', 'Failed to save variants', async (userId, start) => {
    const body = await request.json();
    const variants = Array.isArray(body?.variants) ? body.variants : body;
    if (!Array.isArray(variants)) {
      return NextResponse.json({ error: 'Variants must be a list' }, { status: 400 });
    }
    if (variants.length > MAX_VERSIONS) {
      return NextResponse.json(
        { error: `At most ${MAX_VERSIONS} saved cards are allowed` },
        { status: 400 },
      );
    }

    const result = await campaignService.saveVariants(variants);
    if (!result.success) {
      return NextResponse.json({ error: 'Failed to save variants' }, { status: 500 });
    }
    console.log(`[VARIANTS] PUT -> OK count=${variants.length} (${Date.now() - start}ms)`);
    return NextResponse.json({ success: true });
  });
}
