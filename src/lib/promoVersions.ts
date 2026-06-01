/**
 * promoVersions — local snapshot store for Promo Card "versions".
 *
 * Keeps up to MAX_VERSIONS named snapshots of a PromoCard in localStorage,
 * oldest-first. Saving beyond the cap drops the oldest (FIFO).
 *
 * All functions are async so the storage backend can later be swapped for a
 * real API/DB without touching any call site — only this file changes.
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

const STORAGE_KEY = 'promo_card_versions';
export const MAX_VERSIONS = 5;

function read(): PromoVersion[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as PromoVersion[]) : [];
  } catch {
    return [];
  }
}

function write(versions: PromoVersion[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(versions));
  } catch {
    // Storage full / unavailable — fail silently; versions are best-effort for now.
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

/**
 * Save a new named snapshot. Returns the updated list (oldest first).
 * Enforces the cap unless allowOverflow is passed, then drops oldest entries FIFO.
 */
export async function saveVersion(
  promoCard: PromoCard,
  label: string,
  options: { allowOverflow?: boolean } = {},
): Promise<PromoVersion[]> {
  const versions = read();
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
  write(versions);
  return versions;
}

/** Replace an existing version snapshot by id. Returns the updated list. */
export async function updateVersion(
  id: string,
  promoCard: PromoCard,
  label?: string,
): Promise<PromoVersion[]> {
  const versions = read();
  const index = versions.findIndex((version) => version.id === id);
  if (index === -1) return versions;
  versions[index] = {
    ...versions[index],
    savedAt: new Date().toISOString(),
    label: label?.trim() || versions[index].label,
    promoCard: JSON.parse(JSON.stringify(promoCard)) as PromoCard,
  };
  write(versions);
  return versions;
}

/** Delete one version by id. Returns the updated list. */
export async function deleteVersion(id: string): Promise<PromoVersion[]> {
  const versions = read().filter((v) => v.id !== id);
  write(versions);
  return versions;
}

/** Remove all versions. */
export async function clearVersions(): Promise<void> {
  write([]);
}
