import { campaignRepository } from '@/repositories/campaignRepository';
import { CampaignConfig, PromoCard, defaultConfig } from '@/types/campaign';

export const campaignService = {
  async getConfig(): Promise<CampaignConfig> {
    const config = await campaignRepository.getConfig();
    return config || defaultConfig;
  },

  async saveConfig(config: CampaignConfig): Promise<{ success: boolean; message: string }> {
    // Validate config
    if (!config.announcementBar || !config.promoCard) {
      return { success: false, message: 'Invalid config structure' };
    }

    // Update timestamp
    config.lastUpdated = new Date().toISOString();

    // Save to database
    const success = await campaignRepository.saveConfig(config);

    if (success) {
      return { success: true, message: 'Config saved successfully' };
    } else {
      return { success: false, message: 'Failed to save config' };
    }
  },

  // ── Draft (single scratchpad) ──────────────────────────────────────────
  async getDraft(userId: string): Promise<CampaignConfig | null> {
    return campaignRepository.getDraft(userId);
  },

  /** Same as getDraft(), plus the two independent per-card save timestamps. */
  async getDraftWithTimestamps(userId: string) {
    return campaignRepository.getDraftWithTimestamps(userId);
  },

  async saveDraft(
    userId: string,
    config: CampaignConfig,
  ): Promise<{ success: boolean; message: string }> {
    if (!config.announcementBar || !config.promoCard) {
      return { success: false, message: 'Invalid config structure' };
    }
    config.lastUpdated = new Date().toISOString();
    const success = await campaignRepository.saveDraft(userId, config);
    return success
      ? { success: true, message: 'Draft saved' }
      : { success: false, message: 'Failed to save draft' };
  },

  /** Writes only the promo side of the draft — announcement is untouched. */
  async savePromoDraft(
    userId: string,
    promoCard: PromoCard,
  ): Promise<{ success: boolean; message: string }> {
    if (!promoCard) return { success: false, message: 'Invalid promo card' };
    const success = await campaignRepository.savePromoDraft(userId, promoCard);
    return success
      ? { success: true, message: 'Promo draft saved' }
      : { success: false, message: 'Failed to save promo draft' };
  },

  /** Writes only the announcement side of the draft — promo is untouched. */
  async saveAnnouncementDraft(
    userId: string,
    announcementBar: CampaignConfig['announcementBar'],
  ): Promise<{ success: boolean; message: string }> {
    if (!announcementBar) return { success: false, message: 'Invalid announcement bar' };
    const success = await campaignRepository.saveAnnouncementDraft(userId, announcementBar);
    return success
      ? { success: true, message: 'Announcement draft saved' }
      : { success: false, message: 'Failed to save announcement draft' };
  },

  /** Full wipe — both sides. Only for an explicit "delete my saved draft" action. */
  async clearDraft(userId: string): Promise<{ success: boolean }> {
    const success = await campaignRepository.deleteDraft(userId);
    return { success };
  },

  async clearPromoDraft(userId: string): Promise<{ success: boolean }> {
    const success = await campaignRepository.clearPromoDraft(userId);
    return { success };
  },

  async clearAnnouncementDraft(userId: string): Promise<{ success: boolean }> {
    const success = await campaignRepository.clearAnnouncementDraft(userId);
    return { success };
  },

  // ── Variants ("My Saved") ──────────────────────────────────────────────
  async getVariants(): Promise<PromoCard[]> {
    return campaignRepository.getVariants();
  },

  async saveVariants(variants: PromoCard[]): Promise<{ success: boolean }> {
    if (!Array.isArray(variants)) return { success: false };
    const success = await campaignRepository.saveVariants(variants);
    return { success };
  },
};
