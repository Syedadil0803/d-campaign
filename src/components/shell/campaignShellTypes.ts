import type { CampaignConfig } from '@/types/campaign';
import type { PromoVersion } from '@/lib/promo/promoVersions';

/**
 * Shapes the shell and the draft hook both name.
 *
 * Their own file because they were declared beside the dialogs that render
 * them, and the draft hook needs them too — so the dialogs imported the hook's
 * types while the hook imported the dialogs', which is a cycle even though
 * nothing but types crossed it.
 */

export type PendingDraftAction =
  | { type: 'tab'; tab: 'dashboard' | 'announcement' | 'promo' }
  | { type: 'logout' };

export type PendingDashboardAction = 'create' | 'published';

export interface PendingVariantSave {
  config: CampaignConfig;
  versions: PromoVersion[];
  /** Publish must finish going live after the variant is stored, not just save. */
  mode: 'save' | 'publish';
}
