import type { CampaignConfig } from '@/types/campaign';
import type { PromoVersion } from '@/lib/promo/promoVersions';


export interface ElsewhereNotice {
  deviceId: string;
  deviceLabel: string;
  at: string | null;
}

/**
 * What this hook needs from the draft, and nothing more.
 *
 * The two own each other's problems — loading a config decides whether to
 * offer a draft back, and saving a draft rewrites the signatures this holds —
 * so one of them has to be built first. This is the smaller surface, declared
 * as a port so the draft hook can be built second and handed in.
 */
export interface RestoreNotice {
  /** When the local copy was taken. Empty for copies written before it was recorded. */
  localSavedAt: string | null;
  /** When the parked draft was saved, if there is one. Null means there isn't. */
  draftSavedAt: string | null;
  /** The draft is newer than the work being restored. */
  draftIsNewer: boolean;
}

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

export interface PublishConfirm {
  warnings: string[];
  onConfirm: () => Promise<void> | void;
  title?: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  // When true, confirm runs onConfirm as-is (e.g. to open a follow-up popup)
  // WITHOUT the "Publishing…" state — avoids a flicker when chaining popups.
  deferPublish?: boolean;
  // Runs when the popup is dismissed (Cancel / backdrop) — e.g. to revert a
  // provisional state change.
  onCancel?: () => void;
}

/**
 * A draft outlived a publish and holds something else.
 *
 * Asked rather than assumed: the draft may be the next campaign, or it may be
 * what was just published and is now redundant.
 */
/**
 * Why the "welcome back" dialog is up, or null when it is not.
 *
 * Three arrivals share one dialog because they answer the same question —
 * what happened to my work — and differ only in the answer.
 */
export type WelcomeBackState =
  /** A local copy was recovered — the fullest case, so it carries the notice. */
  | ({ mode: 'restored'; elsewhere: ElsewhereNotice | null } & RestoreNotice)
  /** A parked draft is being offered back. */
  | { mode: 'draft'; draftSavedAt: string | null; elsewhere: ElsewhereNotice | null }
  /** Only that work exists elsewhere — so the notice is never null here. */
  | { mode: 'elsewhere'; elsewhere: ElsewhereNotice }
  | null;
