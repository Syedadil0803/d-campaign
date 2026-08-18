/**
 * promoVersions — saved Promo Card "versions" ("My Saved"), stored in the DB.
 *
 * Keeps up to MAX_VERSIONS named snapshots of a PromoCard, oldest-first. Saving
 * beyond the cap drops the oldest (FIFO). Backed by the `/api/variants` route
 * (DB variants column); every mutation reads the current list, edits it, and
 * writes the whole array back.
 */

import { PromoCard } from '@/types/campaign';

export interface PromoVersion {
  /** Stable id for list keys / deletion. */
  id: string;
  /** ISO timestamp recorded automatically at save time. */
  savedAt: string;
  /** User-entered version name. */
  label: string;
  /** Deep snapshot of the promo card at save time. */
  promoCard: PromoCard;
}

export const MAX_VERSIONS = 5;

async function read(): Promise<PromoVersion[]> {
  if (typeof window === 'undefined') return [];
  try {
    const res = await fetch('/api/variants');
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data?.variants) ? (data.variants as PromoVersion[]) : [];
  } catch {
    return [];
  }
}

async function write(versions: PromoVersion[]): Promise<void> {
  if (typeof window === 'undefined') return;
  try {
    await fetch('/api/variants', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ variants: versions }),
    });
  } catch {
    // Network/DB unavailable — best-effort; the caller still gets the new list.
  }
}

function makeId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `v_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

/** All saved versions, oldest first. */
export async function listVersions(): Promise<PromoVersion[]> {
  return read();
}
// (read/write are async; each mutation below reads, edits, then writes back.)

/**
 * Save a new named snapshot. Returns the updated list (oldest first).
 * Enforces the cap unless allowOverflow is passed, then drops oldest entries FIFO.
 */
export async function saveVersion(
  promoCard: PromoCard,
  label: string,
  options: { allowOverflow?: boolean } = {},
): Promise<PromoVersion[]> {
  const versions = await read();
  if (!options.allowOverflow && versions.length >= MAX_VERSIONS) {
    return versions;
  }
  const next: PromoVersion = {
    id: makeId(),
    savedAt: new Date().toISOString(),
    label: label.trim(),
    promoCard: JSON.parse(JSON.stringify(promoCard)) as PromoCard,
  };
  versions.push(next);
  while (versions.length > MAX_VERSIONS) versions.shift();
  await write(versions);
  return versions;
}

/** Replace an existing version snapshot by id. Returns the updated list. */
export async function updateVersion(
  id: string,
  promoCard: PromoCard,
  label?: string,
): Promise<PromoVersion[]> {
  const versions = await read();
  const index = versions.findIndex((version) => version.id === id);
  if (index === -1) return versions;
  versions[index] = {
    ...versions[index],
    savedAt: new Date().toISOString(),
    label: label?.trim() || versions[index].label,
    promoCard: JSON.parse(JSON.stringify(promoCard)) as PromoCard,
  };
  await write(versions);
  return versions;
}

/** Delete one version by id. Returns the updated list. */
export async function deleteVersion(id: string): Promise<PromoVersion[]> {
  const versions = (await read()).filter((v) => v.id !== id);
  await write(versions);
  return versions;
}

/**
 * Put a deleted version back exactly as it was — same id, label and savedAt,
 * at its original position in the list. Backs the "Undo" offer on a delete;
 * re-saving instead would give it a new id and push it to the end.
 */
export async function restoreVersion(
  version: PromoVersion,
  index: number,
): Promise<PromoVersion[]> {
  const versions = await read();
  if (versions.some((v) => v.id === version.id)) return versions;
  const at = Math.max(0, Math.min(index, versions.length));
  versions.splice(at, 0, JSON.parse(JSON.stringify(version)) as PromoVersion);
  while (versions.length > MAX_VERSIONS) versions.shift();
  await write(versions);
  return versions;
}

/** Remove all versions. */
export async function clearVersions(): Promise<void> {
  await write([]);
}
