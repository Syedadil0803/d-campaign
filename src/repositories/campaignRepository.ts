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

export const campaignRepository = {
  async getConfig(): Promise<CampaignConfig | null> {
    const start = Date.now();
    try {
      const result = await getDb().select().from(campaignConfig).where(eq(campaignConfig.id, 'default')).limit(1);

      if (result.length === 0) {
        console.log(`[DB] getConfig id=default -> NO ROW (${Date.now() - start}ms)`);
        return null;
      }

      const row = result[0];
      console.log(`[DB] getConfig id=default -> OK version=${row.version} (${Date.now() - start}ms)`);

      return {
        version: row.version,
        announcementBar: row.announcementBar as CampaignConfig['announcementBar'],
        promoCard: row.promoCard as CampaignConfig['promoCard'],
        lastUpdated: row.lastUpdated.toISOString(),
      };
    } catch (error) {
      console.error(`[DB] getConfig id=default -> FAILED (${Date.now() - start}ms):`, error);
      return null;
    }
  },

  async saveConfig(config: CampaignConfig): Promise<boolean> {
    const start = Date.now();
    console.log(`[DB] saveConfig id=default UPSERT ${summarize(config)}`);
    try {
      await getDb()
        .insert(campaignConfig)
        .values({
          id: 'default',
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

      console.log(`[DB] saveConfig id=default -> OK (${Date.now() - start}ms)`);
      return true;
    } catch (error) {
      console.error(`[DB] saveConfig id=default -> FAILED ${summarize(config)} (${Date.now() - start}ms):`, error);
      return false;
    }
  },
};
