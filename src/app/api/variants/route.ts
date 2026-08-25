import { NextRequest, NextResponse } from 'next/server';
import { campaignService } from '@/services/campaignService';
import { getSessionUserId } from '@/lib/currentUser';
import { MAX_VERSIONS } from '@/lib/promoVersions';

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
  const start = Date.now();
  try {
    // Checked here as well as in middleware. The guard is correct today, but a
    // change to its path matcher would expose this route with nothing in the
    // route itself to prevent it.
    const userId = await getSessionUserId();
    if (!userId) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

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
    const userId = await getSessionUserId();
    if (!userId) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

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
  } catch (error) {
    console.error(`[VARIANTS] PUT -> FAILED (${Date.now() - start}ms):`, error);
    return NextResponse.json({ error: 'Failed to save variants' }, { status: 500 });
  }
}
