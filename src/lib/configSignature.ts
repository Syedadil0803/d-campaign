/**
 * Has anything actually changed, and is there anything here at all?
 *
 * Every "unsaved changes" dot, every draft offer and every publish prompt in
 * this app rests on these. A raw comparison of two configs answers wrongly:
 * the editors re-serialise their own HTML constantly, so a card nobody
 * touched compares as different, and a saved variant stores active:false
 * while the live card stores active:true.
 *
 * So each of these strips the noise first and compares what a person would
 * call the content. Pulled out of page.tsx because none of it needs the
 * component: configs in, strings and booleans out.
 */
import { CampaignConfig } from '@/types/campaign';

/**
 * Strips differences the APP creates on its own, so they don't read as edits.
 *
 * The editors rewrite their own HTML constantly: bare text gets wrapped in a
 * default font-size span on sync, the timer chip re-serialises, contentEditable
 * leaves zero-width characters behind, and cardWidth flips 400↔440 by itself.
 * A raw JSON compare counted every one of those as an unpublished change, so
 * the badge appeared without the user editing anything.
 *
 * Real edits still register: text, formatting other than the injected default,
 * and every style field are all preserved here.
 */
function normalizeForCompare(html: unknown): unknown {
  if (typeof html !== 'string') return html;
  return (
    html
      // The default-size wrapper the editors inject around bare text — it
      // changes the markup without changing what anything looks like.
      .replace(/<span style="font-size:\s*1rem;?">([\s\S]*?)<\/span>/gi, '$1')
      .replace(/[\u200B\u200C\u200D\uFEFF]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
  );
}

export function normalizePromoForCompare(card: Record<string, unknown>) {
  const clone = { ...card };
  delete clone.active;
  delete clone.stoppedByUser;
  // Recomputed by the fit logic, never chosen by the user.
  delete clone.cardWidth;
  (['title', 'subtitle', 'description', 'buttonText'] as const).forEach((k) => {
    clone[k] = normalizeForCompare(clone[k]);
  });
  // The countdown's markup is regenerated on every render; only its wording
  // is the user's.
  clone.timerText = String(clone.timerText ?? '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return clone;
}

/**
 * Same idea as normalizePromoForCompare, for the other editor.
 *
 * Each announcement's `text` is contentEditable HTML, so it carries exactly
 * the noise described at the top of this file — the injected default-size
 * span, zero-width characters, re-collapsed whitespace. It was compared raw,
 * which is why typing a character and deleting it again left "unsaved
 * changes" lit: the content was back to where it started, the markup was not.
 */
export function normalizeAnnouncementsForCompare(
  bar: Record<string, unknown>,
): Record<string, unknown> {
  const announcements = bar.announcements;
  if (!Array.isArray(announcements)) return bar;
  return {
    ...bar,
    announcements: announcements.map((item) =>
      item && typeof item === 'object'
        ? { ...item, text: normalizeForCompare((item as { text?: unknown }).text) }
        : item,
    ),
  };
}

export function getConfigSignature(cfg: CampaignConfig) {
  // `active` / `stoppedByUser` are live on/off flags managed by Go-on-air /
  // Stop, not content. Exclude them so the Save/dirty check reflects real
  // content changes only — e.g. re-applying an already-live variant (which
  // flips active) must not read as "unsaved changes". Mirrors the reactivate
  // comparison below.
  const strip = (o: Record<string, unknown>) => {
    const clone = normalizeAnnouncementsForCompare({ ...o });
    delete clone.active;
    delete clone.stoppedByUser;
    return clone;
  };
  // `lastUpdated` is rewritten on every save, so including it made two
  // identical configs compare as different — which meant a draft could never
  // match what's published, and the "Welcome back" banner fired for drafts
  // holding no real changes.
  const { lastUpdated: _ignored, ...content } = cfg;
  return JSON.stringify({
    ...content,
    announcementBar: strip(cfg.announcementBar as unknown as Record<string, unknown>),
    promoCard: normalizePromoForCompare(
      cfg.promoCard as unknown as Record<string, unknown>,
    ),
  });
}

// Announcement signature (live on/off excluded) — to tell a real announcement
// edit apart from the default messages.
export function announcementSignature(cfg: CampaignConfig): string {
  const ann = normalizeAnnouncementsForCompare({
    ...(cfg.announcementBar as unknown as Record<string, unknown>),
  });
  delete ann.active;
  return JSON.stringify(ann);
}

export function getPromoSignature(cfg: CampaignConfig) {
  return JSON.stringify(cfg.promoCard);
}

// A draft is only worth persisting/restoring when it carries real content —
// visible text in a promo field or an announcement message. A blank card
// (e.g. right after Start Fresh, which sets the dirty flag but has no text)
// differs from published only by defaults (dates/style), which isn't work
// worth a "You have an unpublished draft" banner.
function htmlHasVisibleText(html: string | undefined): boolean {
  if (!html) return false;
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/[\u200B\u200C\u200D\uFEFF]/g, '')
    .trim().length > 0;
}

export function promoHasVisibleContent(pc: CampaignConfig['promoCard']): boolean {
  return (
    htmlHasVisibleText(pc.title) ||
    htmlHasVisibleText(pc.subtitle) ||
    htmlHasVisibleText(pc.description) ||
    htmlHasVisibleText(pc.buttonText)
  );
}

// Authoritative: is a draft worth restoring (→ show the banner)? Yes only if
// the promo has authored text, OR the announcement actually differs from
// what's published. A blank promo (Start Fresh) with unchanged announcements
// is NOT restorable work, even though the announcement carries its messages.
export function draftHasRestorableWork(
  draft: CampaignConfig,
  published: CampaignConfig | null,
): boolean {
  if (promoHasVisibleContent(draft.promoCard)) return true;
  if (!published) return false;
  return announcementSignature(draft) !== announcementSignature(published);
}
