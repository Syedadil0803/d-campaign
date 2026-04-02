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
};
