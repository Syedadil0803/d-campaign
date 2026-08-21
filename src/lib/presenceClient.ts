import { getDeviceId, getDeviceLabel } from '@/lib/device';

/**
 * Telling the server whether this browser is holding unsaved work.
 *
 * Sent only when the answer changes — not while typing. The whole point of
 * keeping unsaved work local is that we are not writing it anywhere; a
 * heartbeat carrying the card would give that up, and a heartbeat on a timer
 * would spend a request a minute to repeat something the server already knows.
 */

/** Unsaved work in a browser that is not this one. */
export interface ElsewhereUnsaved {
  deviceId: string;
  deviceLabel: string;
  at: string;
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

/**
 * Unsaved work on some other device, or null.
 *
 * This browser names itself so the server can leave it out. Its own flag is
 * still up while it is holding work, and reporting that back would tell people
 * their edits are somewhere else while they are looking at them.
 */
export async function fetchUnsavedElsewhere(): Promise<ElsewhereUnsaved | null> {
  const deviceId = getDeviceId();
  if (!deviceId) return null;
  try {
    const response = await fetch(`/api/presence?deviceId=${encodeURIComponent(deviceId)}`);
    if (!response.ok) return null;
    const data = await response.json();
    const elsewhere = (data?.elsewhere as ElsewhereUnsaved | null) ?? null;
    // Raised once per batch of work, not once per visit. The browser holding
    // it is normally the only thing that can clear the flag, and it may never
    // be opened again — so without this the notice repeats forever and the
    // only way out is a destructive button nobody should have to press.
    if (elsewhere && alreadySeen(elsewhere)) return null;
    return elsewhere;
  } catch {
    return null;
  }
}

/**
 * Notices already seen, so the same one is not raised twice.
 *
 * Kept per device and stamped with the moment that device last had unsaved
 * work. Acknowledging is therefore not "never tell me about this machine
 * again" — it is "I have seen this". If that machine produces newer work, the
 * timestamp moves past the acknowledgement and it is raised again.
 *
 * Local, because it is about what this browser has shown its user. Nothing on
 * the other device is touched, and nothing is deleted anywhere — which is what
 * makes dismissing it safe enough to need no warning.
 */
const SEEN_KEY = 'campaign-admin:seen-elsewhere';

function readSeen(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(SEEN_KEY) || '{}') as Record<string, string>;
  } catch {
    return {};
  }
}

export function markElsewhereSeen(deviceId: string, at: string | null): void {
  if (!deviceId) return;
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify({ ...readSeen(), [deviceId]: at || '' }));
  } catch {
    // Private mode — the notice will simply appear again next visit.
  }
}

function alreadySeen(elsewhere: ElsewhereUnsaved): boolean {
  const seenAt = readSeen()[elsewhere.deviceId];
  if (seenAt === undefined) return false;
  // No timestamp either side means there is nothing newer to report.
  if (!elsewhere.at || !seenAt) return true;
  return new Date(elsewhere.at).getTime() <= new Date(seenAt).getTime();
}

/** "Today at 2:15 PM", "Yesterday at 9:04 AM", or a dated form for older work. */
export function describeWhen(iso: string | null | undefined): string {
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
