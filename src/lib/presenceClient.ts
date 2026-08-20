import { getDeviceId, getDeviceLabel } from '@/lib/device';

/**
 * Telling the server whether this browser is holding unsaved work.
 *
 * Sent only when the answer changes — not while typing. The whole point of
 * keeping unsaved work local is that we are not writing it anywhere; a
 * heartbeat carrying the card would give that up, and a heartbeat on a timer
 * would spend a request a minute to repeat something the server already knows.
 */

export interface Presence {
  hasUnsavedLocalChanges: boolean;
  lastUnsavedDeviceId: string | null;
  lastUnsavedDeviceLabel: string | null;
  lastUnsavedAt: string | null;
}

export function reportUnsaved(hasUnsaved: boolean): void {
  const deviceId = getDeviceId();
  if (!deviceId) return; // No stable id (private mode) — nothing to claim.

  const body = JSON.stringify({ hasUnsaved, deviceId, deviceLabel: getDeviceLabel() });
  fetch('/api/presence', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
    // Survives the navigation when this is the last thing a closing or
    // timing-out page does.
    keepalive: true,
  }).catch(() => {
    // A missed flag costs a notice on another device, never the work itself.
  });
}

export async function fetchPresence(): Promise<Presence | null> {
  try {
    const response = await fetch('/api/presence');
    if (!response.ok) return null;
    const data = await response.json();
    return (data?.presence as Presence | null) ?? null;
  } catch {
    return null;
  }
}

/** True when the flag is up and it was raised by some browser other than this one. */
export function isElsewhere(presence: Presence | null): boolean {
  if (!presence?.hasUnsavedLocalChanges) return false;
  const mine = getDeviceId();
  return !!presence.lastUnsavedDeviceId && presence.lastUnsavedDeviceId !== mine;
}

/** "Today at 2:15 PM", "Yesterday at 9:04 AM", or a dated form for older work. */
export function describeWhen(iso: string | null): string {
  if (!iso) return 'recently';
  const when = new Date(iso);
  if (Number.isNaN(when.getTime())) return 'recently';

  const time = when.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const startOfYesterday = new Date(startOfToday);
  startOfYesterday.setDate(startOfYesterday.getDate() - 1);

  if (when >= startOfToday) return `today at ${time}`;
  if (when >= startOfYesterday) return `yesterday at ${time}`;
  return `${when.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} at ${time}`;
}
