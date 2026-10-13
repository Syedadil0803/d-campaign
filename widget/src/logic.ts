import type { Announcement, CampaignConfig, CampaignSchedule, PromoCard, VideoStory } from '@/types/campaign';
import { isAnnouncementInWindow } from '@/lib/announcement/announcementWindow';
import { isOpenEnded } from '@/lib/promo/promoSchedule';
import { placeWidgets } from '@/lib/videoStory/placeWidgets';
import { toLocalISODate } from '@/lib/utils';
import { buildTimerDisplayHtml, calculateTimeRemaining } from '@/lib/editor/timerUtils';

/**
 * What the page shows right now. Everything the embed decides lives here, as
 * plain functions, so the tests can hold it still; the .svelte files only draw.
 * The rules themselves are the admin's own (imported from src/lib), not copies.
 */

/**
 * Inside the schedule, compared as local YYYY-MM-DD strings — the same way
 * videoStoryStatus judges "ended", so a campaign ending today runs all of today.
 * Open-ended ignores its end date. A missing end on a range campaign is treated
 * as no end (Publish refuses that state, so it only reaches here by hand).
 */
export function inSchedule(
  s: Pick<CampaignSchedule, 'startDate' | 'endDate' | 'scheduleMode'>,
  now: Date,
): boolean {
  const today = toLocalISODate(now);
  if (s.startDate && s.startDate.slice(0, 10) > today) return false;
  if (!isOpenEnded(s) && s.endDate && s.endDate.slice(0, 10) < today) return false;
  return true;
}

export interface Plan {
  messages: Announcement[];
  card: PromoCard | null;
  video: VideoStory | null;
  cardPosition: PromoCard['style']['position'];
  videoPosition: VideoStory['position'];
}

/**
 * The bar's per-message window uses the admin's isAnnouncementInWindow, which
 * reads the clock itself; `now` drives the card and the video.
 */
export function decide(config: Partial<CampaignConfig> | null | undefined, now = new Date()): Plan {
  const bar = config?.announcementBar;
  const messages = bar?.active
    ? (bar.announcements ?? []).filter((a) => a?.text && isAnnouncementInWindow(a.startDate, a.endDate))
    : [];
  const pc = config?.promoCard;
  const card = pc?.active && pc.style && inSchedule(pc, now) ? pc : null;
  const vs = config?.videoStory;
  const video = vs?.active && vs.videoUrl?.trim() && inSchedule(vs, now) ? vs : null;
  const placed = placeWidgets({
    cardPosition: pc?.style?.position ?? 'bottom-right',
    videoPosition: vs?.position ?? 'bottom-left',
    cardLive: !!card,
    videoLive: !!video,
  });
  return { messages, card, video, ...placed };
}

/**
 * Phones (under 640px) with the card also showing: the Video Story folds into a
 * bubble that opens an overlay, since both full widgets can't share the width.
 * Alone on a phone it keeps the full widget, scaled to fit.
 */
export const videoLayout = (cardShowing: boolean, viewportWidth: number): 'bubble' | 'full' =>
  cardShowing && viewportWidth < 640 ? 'bubble' : 'full';

/** A countdown shows only with an end date to count towards (PromoCanvas / VideoStoryCanvas rule). */
export const showsTimer = (s: CampaignSchedule) => s.showTimer && !isOpenEnded(s) && Boolean(s.endDate);

/** The card's countdown line: the admin's own timer builder, then sanitised. */
export const cardTimerHtml = (card: PromoCard) =>
  sanitize(buildTimerDisplayHtml(card.timerText ?? '', calculateTimeRemaining(card.endDate || ''), { editorSlots: false }));

/**
 * The Video Story's countdown, time only ("1d 04h 10m").
 * ponytail: copied from VideoStoryCanvas.tsx's private timeLeft(); move it to
 * src/lib/videoStory when that folder is free, and import it from both.
 */
export function videoTimeLeft(endDate: string): string {
  const t = calculateTimeRemaining(endDate);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${t.days ? `${t.days}d ` : ''}${pad(t.hours)}h ${pad(t.minutes)}m`;
}

// ---- Rich text ----

const KEEP = new Set(['B', 'STRONG', 'I', 'EM', 'U', 'BR', 'SPAN', 'A']);
/** Removed with everything inside; any other unknown tag is unwrapped to its text. */
const DROP = new Set(['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'TEMPLATE', 'NOSCRIPT', 'SVG', 'MATH', 'TEXTAREA', 'SELECT', 'TITLE', 'LINK', 'META']);
const STYLE_PROPS = new Set(['color', 'font-weight', 'font-style', 'font-size']);

/** An http(s)/mailto/tel address, resolved against the page; anything else (javascript:, data:) is ''. */
export function safeUrl(href: string | undefined | null): string {
  if (!href || !href.trim()) return '';
  try {
    const u = new URL(href.trim(), location.href);
    return /^(https?|mailto|tel):$/.test(u.protocol) ? u.href : '';
  } catch {
    return '';
  }
}

/**
 * Only color / weight / style / size survive. The editor stores sizes in rem,
 * which would resolve against the HOST page's root size, so they become px at
 * the 16px the tool measured with (the old site widget's normalizeRemToPx).
 */
function cleanStyle(style: string): string {
  return style
    .split(';')
    .map((d) => {
      const i = d.indexOf(':');
      const prop = d.slice(0, i).trim().toLowerCase();
      let value = d.slice(i + 1).trim();
      if (i < 0 || !STYLE_PROPS.has(prop) || !/^[#\w\s.,%()-]+$/.test(value) || /url|expression/i.test(value)) return '';
      value = value.replace(/^([\d.]+)rem$/i, (_, n) => `${parseFloat(n) * 16}px`);
      return `${prop}:${value}`;
    })
    .filter(Boolean)
    .join(';');
}

function clean(parent: Node): void {
  for (const node of Array.from(parent.childNodes)) {
    if (node.nodeType === 3) continue;
    if (node.nodeType !== 1) { node.parentNode?.removeChild(node); continue; }
    const el = node as Element;
    const tag = el.tagName.toUpperCase();
    if (DROP.has(tag)) { el.remove(); continue; }
    clean(el);
    if (!KEEP.has(tag)) { el.replaceWith(...Array.from(el.childNodes)); continue; }
    const style = cleanStyle(el.getAttribute('style') || '');
    const href = tag === 'A' ? safeUrl(el.getAttribute('href')) : '';
    for (const a of Array.from(el.attributes)) el.removeAttribute(a.name);
    if (style) el.setAttribute('style', style);
    if (href) {
      el.setAttribute('href', href);
      el.setAttribute('target', '_blank');
      el.setAttribute('rel', 'noopener noreferrer');
    }
  }
}

/**
 * The admin stores titles, messages and the countdown as HTML. Parsed in an
 * inert <template> (no scripts run, no images load), then whitelisted.
 */
export function sanitize(html: string | undefined | null): string {
  const t = document.createElement('template');
  t.innerHTML = html ?? '';
  clean(t.content);
  return t.innerHTML;
}

/** True when the HTML has visible text — an empty field is not drawn. */
export const hasText = (html: string | undefined | null) =>
  !!(html ?? '').replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();

// ---- Close, remembered for the session ----

const closedKey = (kind: string) => `cw-closed:${kind}`;
/** Which campaign was closed — a new one (other dates or content) shows again. */
export const campaignId = (s: CampaignSchedule, extra: string) => `${s.startDate}|${s.endDate}|${extra}`;

export function isClosed(kind: string, id: string): boolean {
  try { return sessionStorage.getItem(closedKey(kind)) === id; } catch { return false; }
}
export function rememberClosed(kind: string, id: string): void {
  try { sessionStorage.setItem(closedKey(kind), id); } catch { /* private mode: closes for this page only */ }
}
