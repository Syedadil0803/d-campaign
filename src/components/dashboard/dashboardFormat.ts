/**
 * How the dashboard says dates and durations.
 *
 * Pure, and shared by the page and its lifecycle cards — which is why they are
 * here rather than beside either.
 */

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

export const DAY = 86_400_000;

export function clamp(n: number, lo: number, hi: number): number {
  return Math.min(Math.max(n, lo), hi);
}

export function parseDate(s?: string): Date | null {
  if (!s) return null;
  const d = new Date(`${s}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

// Human, unambiguous date format for the operator: 06-Aug-2026.
export function fmtDate(s?: string): string {
  const d = parseDate(s);
  if (!d) return '—';
  return `${String(d.getDate()).padStart(2, '0')}-${MONTHS[d.getMonth()]}-${d.getFullYear()}`;
}

export function fmtRemaining(ms: number): string {
  if (ms <= 0) return 'ended';
  const d = Math.floor(ms / DAY);
  const h = Math.floor((ms % DAY) / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export function timeAgo(iso: string, now: Date): string {
  if (!iso) return 'not yet';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return 'not yet';
  const diff = now.getTime() - then;
  const m = Math.floor(diff / 60_000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}
