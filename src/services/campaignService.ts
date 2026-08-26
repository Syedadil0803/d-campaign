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

  async clearDraft(userId: string): Promise<{ success: boolean }> {
    const success = await campaignRepository.deleteDraft(userId);
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
