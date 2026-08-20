import { getDb } from '@/lib/db';
import { campaignConfig } from '@/lib/schema';
import { eq } from 'drizzle-orm';
import { CampaignConfig } from '@/types/campaign';

// One-line summary of a config for logs — key fields only, never the full blob.
function summarize(config: CampaignConfig): string {
  const ann = config.announcementBar;
  const promo = config.promoCard;
  const annCount = Array.isArray((ann as any)?.announcements)
    ? (ann as any).announcements.length
    : '?';
  return `version=${config.version} annActive=${ann?.active} annCount=${annCount} promoActive=${promo?.active} lastUpdated=${config.lastUpdated}`;
}

// The live/published config is stored under id='default'; the single saved
// draft (scratchpad) is stored under id='draft' in the same table.
const DEFAULT_ID = 'default';

// The published config is genuinely shared — it is the live website, and there
// is one of those. A draft is not: it is one person's parked work, so it is
// keyed by account. Both live in the same table because the row shape is
// identical and the id already distinguishes them.
const draftId = (userId: string) => `draft:${userId}`;

export const campaignRepository = {
  async getConfig(id: string = DEFAULT_ID): Promise<CampaignConfig | null> {
    const start = Date.now();
    try {
      const result = await getDb().select().from(campaignConfig).where(eq(campaignConfig.id, id)).limit(1);

      if (result.length === 0) {
        console.log(`[DB] getConfig id=${id} -> NO ROW (${Date.now() - start}ms)`);
        return null;
      }

      const row = result[0];
      console.log(`[DB] getConfig id=${id} -> OK version=${row.version} (${Date.now() - start}ms)`);

      return {
        version: row.version,
        announcementBar: row.announcementBar as CampaignConfig['announcementBar'],
        promoCard: row.promoCard as CampaignConfig['promoCard'],
        lastUpdated: row.lastUpdated.toISOString(),
      };
    } catch (error) {
      console.error(`[DB] getConfig id=${id} -> FAILED (${Date.now() - start}ms):`, error);
      return null;
    }
  },

  async saveConfig(config: CampaignConfig, id: string = DEFAULT_ID): Promise<boolean> {
    const start = Date.now();
    console.log(`[DB] saveConfig id=${id} UPSERT ${summarize(config)}`);
    try {
      await getDb()
        .insert(campaignConfig)
        .values({
          id,
          version: config.version,
          announcementBar: config.announcementBar as any,
          promoCard: config.promoCard as any,
          lastUpdated: new Date(config.lastUpdated),
        })
        .onConflictDoUpdate({
          target: campaignConfig.id,
          set: {
            version: config.version,
            announcementBar: config.announcementBar as any,
            promoCard: config.promoCard as any,
            lastUpdated: new Date(config.lastUpdated),
          },
        });

      console.log(`[DB] saveConfig id=${id} -> OK (${Date.now() - start}ms)`);
      return true;
    } catch (error) {
      console.error(`[DB] saveConfig id=${id} -> FAILED ${summarize(config)} (${Date.now() - start}ms):`, error);
      return false;
    }
  },

  // ── Draft (single scratchpad, id='draft') ────────────────────────────────
  getDraft(userId: string): Promise<CampaignConfig | null> {
    return this.getConfig(draftId(userId));
  },

  saveDraft(userId: string, config: CampaignConfig): Promise<boolean> {
    return this.saveConfig(config, draftId(userId));
  },

  async deleteDraft(userId: string): Promise<boolean> {
    const start = Date.now();
    try {
      await getDb().delete(campaignConfig).where(eq(campaignConfig.id, draftId(userId)));
      console.log(`[DB] deleteDraft -> OK (${Date.now() - start}ms)`);
      return true;
    } catch (error) {
      console.error(`[DB] deleteDraft -> FAILED (${Date.now() - start}ms):`, error);
      return false;
    }
  },

  // ── Variants ("My Saved") — stored as a JSON array on the default row ─────
  async getVariants(): Promise<unknown[]> {
    const start = Date.now();
    try {
      const result = await getDb()
        .select({ variants: campaignConfig.variants })
        .from(campaignConfig)
        .where(eq(campaignConfig.id, DEFAULT_ID))
        .limit(1);
      const v = result[0]?.variants;
      const list = Array.isArray(v) ? v : [];
      console.log(`[DB] getVariants -> OK count=${list.length} (${Date.now() - start}ms)`);
      return list;
    } catch (error) {
      console.error(`[DB] getVariants -> FAILED (${Date.now() - start}ms):`, error);
      return [];
    }
  },

  async saveVariants(variants: unknown[]): Promise<boolean> {
    const start = Date.now();
    try {
      await getDb()
        .update(campaignConfig)
        .set({ variants: variants as any })
        .where(eq(campaignConfig.id, DEFAULT_ID));
      console.log(`[DB] saveVariants -> OK count=${variants.length} (${Date.now() - start}ms)`);
      return true;
    } catch (error) {
      console.error(`[DB] saveVariants -> FAILED (${Date.now() - start}ms):`, error);
      return false;
    }
  },
};
