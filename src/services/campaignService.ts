import { campaignRepository } from '@/repositories/campaignRepository';
import { CampaignConfig, defaultConfig } from '@/types/campaign';

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
  async getDraft(): Promise<CampaignConfig | null> {
    return campaignRepository.getDraft();
  },

  async saveDraft(config: CampaignConfig): Promise<{ success: boolean; message: string }> {
    if (!config.announcementBar || !config.promoCard) {
      return { success: false, message: 'Invalid config structure' };
    }
    config.lastUpdated = new Date().toISOString();
    const success = await campaignRepository.saveDraft(config);
    return success
      ? { success: true, message: 'Draft saved' }
      : { success: false, message: 'Failed to save draft' };
  },

  async clearDraft(): Promise<{ success: boolean }> {
    const success = await campaignRepository.deleteDraft();
    return { success };
  },

  // ── Variants ("My Saved") ──────────────────────────────────────────────
  async getVariants(): Promise<unknown[]> {
    return campaignRepository.getVariants();
  },

  async saveVariants(variants: unknown[]): Promise<{ success: boolean }> {
    if (!Array.isArray(variants)) return { success: false };
    const success = await campaignRepository.saveVariants(variants);
    return { success };
  },
};
