import type { CampaignConfig } from '@/types/campaign';

/**
 * Crash recovery, kept apart from the draft.
 *
 * Pure localStorage work — it reads no component state, which is why it sits
 * here rather than inside the page.
 *
 * These are two different jobs that were sharing one slot and had opposite
 * rules. A draft is parked on purpose and must never be overwritten without
 * asking. A recovery copy is taken automatically and *should* be replaced by
 * the next one. Sharing the slot meant one of them always lost: either the
 * rescue clobbered a deliberate draft, or — once that was stopped — work in
 * progress had nowhere to go because the slot was taken.
 *
 * Recovery lives in localStorage: it is per-browser, survives a reload, and
 * costs no round trip on the way out, which matters when the page is already
 * closing.
 */
const RECOVERY_KEY = 'campaign-admin:recovery';

/**
 * Stored with the moment it was taken, not just the config.
 *
 * The config's own `lastUpdated` is when it was last published, which says
 * nothing about when this copy was made — and without that, a draft saved
 * from another device in the meantime cannot be told from one saved before
 * the user ever walked away.
 */
export interface RecoveryEnvelope {
  savedAt: string;
  config: CampaignConfig;
}

export function writeRecovery(cfg: CampaignConfig) {
  try {
    const envelope: RecoveryEnvelope = { savedAt: new Date().toISOString(), config: cfg };
    localStorage.setItem(RECOVERY_KEY, JSON.stringify(envelope));
  } catch {
    // Private mode or quota — nothing to fall back to, and the close must
    // not be blocked by it.
  }
}

/**
 * Reads either shape.
 *
 * Copies written before this carried the bare config. They belong to someone
 * who is mid-edit right now, so the change must not throw their work away —
 * it reads as a recovery with an unknown time, which is exactly what it is.
 */
export function readRecoveryEnvelope(): RecoveryEnvelope | null {
  try {
    const raw = localStorage.getItem(RECOVERY_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.savedAt === 'string' && parsed.config) {
      return parsed as RecoveryEnvelope;
    }
    return { savedAt: '', config: parsed as CampaignConfig };
  } catch {
    return null;
  }
}


export function clearRecovery() {
  try {
    localStorage.removeItem(RECOVERY_KEY);
  } catch {
    /* nothing to do */
  }
}
