import { GradientStyle } from '@/types/campaign';

export function getBackgroundStyle(background: GradientStyle): string {
  if (background.type === 'solid') {
    return background.startColor;
  }
  if (background.type === 'linear') {
    const direction = background.direction || 'to right';
    const midpoint = background.midpoint ?? 50;
    return `linear-gradient(${direction}, ${background.startColor} 0%, ${background.startColor} ${midpoint}%, ${background.endColor} 100%)`;
  }
  if (background.type === 'radial') {
    const midpoint = background.midpoint ?? 50;
    return `radial-gradient(circle, ${background.startColor} 0%, ${background.startColor} ${midpoint}%, ${background.endColor} 100%)`;
  }
  return background.startColor;
}

export function stripHtml(html: string): string {
  if (!html) return '';
  if (typeof document !== 'undefined') {
    const div = document.createElement('div');
    div.innerHTML = html;
    return div.textContent || div.innerText || '';
  }
  return html.replace(/<[^>]*>/g, '');
}

/**
 * YYYY-MM-DD for a date, in the USER'S timezone.
 *
 * Never use `toISOString().split('T')[0]` for this. That converts to UTC
 * first, so anywhere east of Greenwich a local-midnight date lands on the
 * previous day: in UTC+5:30, `new Date('2026-08-14T00:00:00')` + 3 days
 * serialised to 2026-08-16 rather than 2026-08-17. Campaign dates are calendar
 * days the user picked, not instants, so they must be formatted locally.
 */
export function toLocalISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function getISODateWithOffset(daysFromToday = 0): string {
  const date = new Date();
  date.setDate(date.getDate() + daysFromToday);
  return toLocalISODate(date);
}
