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
const SELECTED_ANNOUNCEMENT_INDEX_KEY = 'campaign-admin:selectedAnnouncementIndex';
const DEBUG_LOG_KEY = '__recovery_debug_logs';

/**
 * Persistent debug logging to localStorage (survives browser close).
 */
export function addDebugLog(tag: string, message: string, data?: unknown) {
  try {
    const logs: Array<{ ts: string; tag: string; message: string; data?: unknown }> = [];
    const existing = localStorage.getItem(DEBUG_LOG_KEY);
    if (existing) {
      logs.push(...JSON.parse(existing));
    }
    logs.push({
      ts: new Date().toISOString(),
      tag,
      message,
      ...(data !== undefined ? { data } : {}),
    });
    // Keep only last 100 entries
    if (logs.length > 100) {
      logs.splice(0, logs.length - 100);
    }
    localStorage.setItem(DEBUG_LOG_KEY, JSON.stringify(logs));
  } catch {
    /* nothing to do */
  }
}

/**
 * Why the rescue copy was written.
 *
 * The offer shown on the next login depends on it: an idle sign-out is not
 * an accident — the tool knew it was ending the session, and the copy was
 * taken deliberately on the way out — while a crash is exactly the case the
 * warning "session ended before you could save" is for. Saying the wrong one
 * makes the tool look like it lost track of what happened.
 */
export type RecoveryReason = 'idle' | 'crash';

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
  reason: RecoveryReason;
  config: CampaignConfig;
  announcementComposeText?: string;
  selectedAnnouncementIndex?: number | null;
}

export function writeRecovery(
  cfg: CampaignConfig,
  reason: RecoveryReason = 'crash',
  announcementComposeText?: string,
  selectedAnnouncementIndex?: number | null,
) {
  try {
    const envelope: RecoveryEnvelope = {
      savedAt: new Date().toISOString(),
      reason,
      config: cfg,
      ...(announcementComposeText ? { announcementComposeText } : {}),
      ...(selectedAnnouncementIndex !== undefined ? { selectedAnnouncementIndex } : {}),
    };
    // DEBUG
    const stack = new Error().stack?.split('\n').slice(1, 4).join(' | ') || 'unknown';
    const debugData = {
      reason,
      hasComposeText: !!announcementComposeText,
      composeTextLength: announcementComposeText?.length || 0,
      configHash: JSON.stringify(cfg).substring(0, 50),
      caller: stack,
    };
    console.log('[RECOVERY] Writing:', debugData);
    addDebugLog('RECOVERY', 'Writing recovery envelope', debugData);
    localStorage.setItem(RECOVERY_KEY, JSON.stringify(envelope));
  } catch {
    // Private mode or quota — nothing to fall back to, and the close must
    // not be blocked by it.
  }
}

/**
 * Reads either shape.
 *
 * Copies written before this carried the bare config, and copies written
 * before `reason` existed carry no reason. They belong to someone who is
 * mid-edit right now, so the change must not throw their work away — they
 * read as a crash with an unknown time, which is the safest default: the
 * offer says the work was rescued, and the user can still accept it.
 */
export function readRecoveryEnvelope(): RecoveryEnvelope | null {
  try {
    const raw = localStorage.getItem(RECOVERY_KEY);
    if (!raw) {
      addDebugLog('RECOVERY', 'No recovery found in localStorage');
      return null;
    }
    const parsed = JSON.parse(raw);
    const debugData = {
      reason: parsed.reason,
      hasComposeText: !!parsed.announcementComposeText,
      composeTextLength: parsed.announcementComposeText?.length || 0,
    };
    console.log('[RECOVERY] Read envelope:', debugData);
    addDebugLog('RECOVERY', 'Read envelope from localStorage', debugData);
    if (parsed && typeof parsed.savedAt === 'string' && parsed.config) {
      return {
        savedAt: parsed.savedAt,
        reason: parsed.reason === 'idle' ? 'idle' : 'crash',
        config: parsed.config as CampaignConfig,
        ...(parsed.announcementComposeText
          ? { announcementComposeText: parsed.announcementComposeText as string }
          : {}),
      };
    }
    return { savedAt: '', reason: 'crash', config: parsed as CampaignConfig };
  } catch (err) {
    addDebugLog('RECOVERY', 'Error reading recovery', { error: String(err) });
    return null;
  }
}

export function saveSelectedAnnouncementIndex(index: number | null) {
  try {
    if (index === null) {
      localStorage.removeItem(SELECTED_ANNOUNCEMENT_INDEX_KEY);
      addDebugLog('RECOVERY', 'Cleared selectedAnnouncementIndex from localStorage', {});
    } else {
      localStorage.setItem(SELECTED_ANNOUNCEMENT_INDEX_KEY, JSON.stringify(index));
      addDebugLog('RECOVERY', 'Saved selectedAnnouncementIndex to localStorage', { index });
    }
  } catch {
    /* nothing to do */
  }
}

export function getSelectedAnnouncementIndex(): number | null {
  try {
    const raw = localStorage.getItem(SELECTED_ANNOUNCEMENT_INDEX_KEY);
    if (!raw) {
      addDebugLog('RECOVERY', 'No selectedAnnouncementIndex in localStorage', {});
      return null;
    }
    const parsed = JSON.parse(raw);
    const index = typeof parsed === 'number' ? parsed : null;
    addDebugLog('RECOVERY', 'Retrieved selectedAnnouncementIndex from localStorage', { index, raw });
    return index;
  } catch (e) {
    addDebugLog('RECOVERY', 'Error reading selectedAnnouncementIndex', { error: String(e) });
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