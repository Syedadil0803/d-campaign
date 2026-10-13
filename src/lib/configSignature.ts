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
import { CampaignConfig, VideoStory, defaultVideoStory } from '@/types/campaign';
import { isOpenEnded } from '@/lib/promo/promoSchedule';

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
      // A space typed into a contentEditable is stored as &nbsp;, which \s
      // does not match — so "text" and "text&nbsp;" compared as different and
      // the header's Publish button stayed lit over a space nobody could see.
      // htmlHasVisibleText below already knew this; this did not.
      .replace(/&nbsp;|\u00a0/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  );
}

/**
 * The countdown's stored editor state, reduced to the ONE thing it adds.
 *
 * timerStateJson is a serialized Lexical state, rewritten on every reported
 * change, and Lexical splits text into different nodes while rendering
 * identically. Compared raw, applying a saved variant stopped the card
 * matching the published copy over a difference nobody could see, and Publish
 * stayed lit for good.
 *
 * The wording is already compared through timerText. All this state adds is
 * the per-cell chip styling timerText cannot express, so that is all that
 * survives here.
 *
 * Absence is not a difference: a card published before this existed reduces to
 * the same empty result as one whose countdown is unstyled. Neither expresses
 * a choice.
 */
function normalizeTimerStateForCompare(json: unknown): unknown {
  if (typeof json !== 'string' || !json) return '';
  type Node = {
    type?: string;
    style?: unknown;
    format?: unknown;
    children?: Node[];
  };
  try {
    const styling: string[] = [];
    const walk = (node: Node | undefined): void => {
      if (!node || typeof node !== 'object') return;
      const style = typeof node.style === 'string' ? node.style.trim() : '';
      const format = node.format;
      // Consecutive duplicates collapse: Lexical splits a styled run across
      // several nodes as it is edited, and the same styling listed twice is
      // still one choice. Without this, splitting a run counted as a change.
      const add = (entry: string) => {
        if (styling[styling.length - 1] !== entry) styling.push(entry);
      };
      if (style) add(style);
      if (typeof format === 'number' && format !== 0) {
        add(`format:${format}`);
      }
      node.children?.forEach(walk);
    };
    const parsed = JSON.parse(json) as { root?: Node };
    walk(parsed.root ?? (parsed as Node));
    // Nothing styled means no choice was made, which is the same as no state.
    return styling.length ? styling : '';
  } catch {
    // Not a state this build can read — compare it as it is rather than
    // pretending two unreadable states are the same.
    return json;
  }
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
  clone.timerStateJson = normalizeTimerStateForCompare(clone.timerStateJson);
  // migrateConfig() stamps today's date onto any promo card missing a
  // startDate, every single time it runs (withDefaultStartDate). For a card
  // nobody has ever actually scheduled, that means two snapshots migrated on
  // different days — e.g. a browser-cache recovery from yesterday compared
  // against a freshly re-migrated cloud draft today — disagree on startDate
  // even though nobody touched it. Only a card with real content or an
  // explicit endDate has a startDate worth comparing; on a blank card it's
  // pure app-generated noise, exactly like cardWidth above.
  const hasVisibleContent =
    htmlHasVisibleText(clone.title as string | undefined) ||
    htmlHasVisibleText(clone.subtitle as string | undefined) ||
    htmlHasVisibleText(clone.description as string | undefined) ||
    htmlHasVisibleText(clone.buttonText as string | undefined);
  if (!hasVisibleContent && !clone.endDate) {
    delete clone.startDate;
  }
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
function normalizeAnnouncementsForCompare(
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

/**
 * Key order, made irrelevant. Postgres jsonb hands objects back with their keys
 * re-sorted, so the same Video Story read from the database and built in code
 * stringify differently. Sorting gives both one spelling.
 */
function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((k) => [k, sortKeys((value as Record<string, unknown>)[k])]),
  );
}

/**
 * A Video Story reduced to its content: the live on/off flags dropped, exactly
 * as for the promo card, so Go on air / Stop never reads as an unsaved edit.
 * Its fields are plain values, not editor HTML, so nothing else needs stripping.
 */
function normalizeVideoStoryForCompare(vs: VideoStory): unknown {
  const { active: _active, stoppedByUser: _stopped, endDate, ...content } = vs;
  // An open-ended story has no end date by definition, and publishing sends
  // it as null while the editor holds '' (or whatever end was picked before
  // switching mode). Kept, that difference left "Unpublished changes" lit
  // straight after a publish. For a range, null and '' both mean "not set".
  return sortKeys(isOpenEnded(vs) ? content : { ...content, endDate: endDate ?? '' });
}

const videoSig = (vs: VideoStory | undefined) =>
  JSON.stringify(normalizeVideoStoryForCompare(vs ?? defaultVideoStory));

const DEFAULT_VIDEO_STORY_SIG = videoSig(defaultVideoStory);

export function getVideoStorySignature(cfg: CampaignConfig): string {
  return videoSig(cfg.videoStory);
}

/**
 * Do two Video Stories differ in content? Missing counts as the blank default,
 * for the reason getConfigSignature gives below. One comparison serves every
 * question the video's lifecycle asks: unsaved (editor vs the draft, or live
 * when there is no draft), unpublished (editor vs live), never made (live vs
 * the default).
 */
export function videoStoryDiffers(a: VideoStory | undefined, b: VideoStory | undefined): boolean {
  return videoSig(a) !== videoSig(b);
}

/** Worth a draft or a publish only once there is a clip to show. */
export function videoStoryHasContent(vs: VideoStory | undefined): boolean {
  return Boolean(vs?.videoUrl?.trim());
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
  //
  // `videoStory` is left out entirely while it is the blank default. These
  // signatures are compared across snapshots taken by different code: a
  // browser recovery copy or an in-memory baseline from before the Video Story
  // existed has no key, a freshly migrated config has the default. Counting
  // the key would make every one of those read as an unsaved change. A blank
  // video story and no video story are the same content, so they sign the same.
  const { lastUpdated: _ignored, videoStory: _video, ...content } = cfg;
  const video = normalizeVideoStoryForCompare(cfg.videoStory ?? defaultVideoStory);
  return JSON.stringify({
    ...content,
    announcementBar: strip(cfg.announcementBar as unknown as Record<string, unknown>),
    promoCard: normalizePromoForCompare(
      cfg.promoCard as unknown as Record<string, unknown>,
    ),
    ...(JSON.stringify(video) === DEFAULT_VIDEO_STORY_SIG ? {} : { videoStory: video }),
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
  return JSON.stringify(
    normalizePromoForCompare(
      cfg.promoCard as unknown as Record<string, unknown>,
    ),
  );
}

// A draft is only worth persisting/restoring when it carries real content —
// visible text in a promo field or an announcement message. A blank card
// (e.g. right after Start Fresh, which sets the dirty flag but has no text)
// differs from published only by defaults (dates/style), which isn't work
// worth a "You have an unpublished draft" banner.
export function htmlHasVisibleText(html: string | undefined): boolean {
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

// Messages signature (only text + styles, NOT bar background)
export function getMessagesSignature(cfg: CampaignConfig | null): string {
  if (!cfg?.messages || cfg.messages.length === 0) return '';
  return JSON.stringify(cfg.messages);
}

// Check if messages have changed from published
export function messagesHasRestorableWork(
  current: CampaignConfig,
  published: CampaignConfig | null,
): boolean {
  const currentSig = getMessagesSignature(current);
  const publishedSig = getMessagesSignature(published);
  return currentSig !== publishedSig && currentSig !== '';
}
