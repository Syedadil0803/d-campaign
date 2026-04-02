import { db } from '@/lib/db';
import { campaignConfig } from '@/lib/schema';
import { eq } from 'drizzle-orm';
import { CampaignConfig } from '@/types/campaign';

export const campaignRepository = {
  async getConfig(): Promise<CampaignConfig | null> {
    const result = await db.select().from(campaignConfig).where(eq(campaignConfig.id, 'default')).limit(1);
    
    if (result.length === 0) {
      return null;
    }

    const row = result[0];
    return {
      announcementBar: row.announcementBar as CampaignConfig['announcementBar'],
      promoCard: row.promoCard as CampaignConfig['promoCard'],
      lastUpdated: row.lastUpdated.toISOString(),
    };
  },

  async saveConfig(config: CampaignConfig): Promise<boolean> {
    try {
      await db
        .insert(campaignConfig)
        .values({
          id: 'default',
          announcementBar: config.announcementBar as any,
          promoCard: config.promoCard as any,
          lastUpdated: new Date(config.lastUpdated),
        })
        .onConflictDoUpdate({
          target: campaignConfig.id,
          set: {
            announcementBar: config.announcementBar as any,
            promoCard: config.promoCard as any,
            lastUpdated: new Date(config.lastUpdated),
          },
        });
      
      return true;
    } catch (error) {
      console.error('Failed to save config:', error);
      return false;
    }
  },
};
