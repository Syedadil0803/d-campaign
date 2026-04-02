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

export function getISODateWithOffset(daysFromToday = 0): string {
  const date = new Date();
  date.setDate(date.getDate() + daysFromToday);
  return date.toISOString().split('T')[0];
}
