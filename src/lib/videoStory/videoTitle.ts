import type { VideoStory } from '@/types/campaign';
import { hasVisibleContent } from '@/lib/promo/promoEditorSelection';

/**
 * The Video Story's title: rich text over the top of the clip, two lines at
 * most. The one place its rules live; the editor, the preview and the embed
 * all read them from here.
 *
 * There is no character limit, as on the Smart Card's subtitle: the limit is
 * the two lines themselves (titleOverflows), measured at the video's size, so
 * narrow letters fit more and wide capitals fewer.
 */

export type VideoTitleColor = NonNullable<VideoStory['titleColor']>;

/**
 * Text colour plus the soft shade behind it. White text gets a dark wash from
 * the top edge, black text a light one, so either reads on any footage
 * without a solid box covering the clip.
 */
export const VIDEO_TITLE_LOOK: Record<VideoTitleColor, { color: string; shade: string; shadow: string }> = {
  white: {
    color: '#ffffff',
    shade: 'linear-gradient(to bottom, rgba(0,0,0,.5), rgba(0,0,0,0))',
    shadow: '0 1px 3px rgba(0,0,0,.45)',
  },
  black: {
    color: '#000000',
    shade: 'linear-gradient(to bottom, rgba(255,255,255,.6), rgba(255,255,255,0))',
    shadow: '0 1px 3px rgba(255,255,255,.5)',
  },
};

/**
 * The countdown's colour, from the same two as the title. It is stored as a
 * hex value (older configs may hold any colour from the earlier palette), so
 * black means black and everything else reads as white.
 */
export function videoTimerColor(vs: Pick<VideoStory, 'timerTextColor'>): VideoTitleColor {
  return (vs.timerTextColor ?? '').trim().toLowerCase() === VIDEO_TITLE_LOOK.black.color ? 'black' : 'white';
}

/**
 * The title as drawn: its HTML (empty when there is no visible text), the
 * look for its colour and its alignment. Stories saved before these fields
 * existed have none of them, so the defaults are filled in here rather than
 * at every reader; an old plain-text title is valid HTML as it is.
 */
export function videoTitle(vs: Pick<VideoStory, 'title' | 'titleColor' | 'titleAlign'>): {
  html: string;
  look: (typeof VIDEO_TITLE_LOOK)[VideoTitleColor];
  align: 'left' | 'center' | 'right';
} {
  const html = (vs.title ?? '').trim();
  return {
    html: hasVisibleContent(html) ? html : '',
    look: VIDEO_TITLE_LOOK[vs.titleColor === 'black' ? 'black' : 'white'],
    align: vs.titleAlign ?? 'center',
  };
}

/** The bottom edge of each line the element's text takes, from where its fragments sit on screen. */
function lineBottoms(el: HTMLElement): number[] {
  const range = document.createRange();
  range.selectNodeContents(el);
  const rects = [...range.getClientRects()].filter((r) => r.width > 0 && r.height > 0).sort((a, b) => a.top - b.top);
  const bottoms: number[] = [];
  for (const r of rects) {
    // A fragment starting below the current line's bottom opens a new line;
    // one overlapping it (a bigger word on the same line) does not.
    const last = bottoms.length - 1;
    if (last < 0 || r.top >= bottoms[last] - 1) bottoms.push(r.bottom);
    else bottoms[last] = Math.max(bottoms[last], r.bottom);
  }
  return bottoms;
}

/**
 * Whether the title would take more than two lines on the video, measured
 * the way the Smart Card measures its fields (promoMeasure): a hidden copy at
 * the title's real size. Here that is the video's 128 px text width (200 px
 * less 36 px each side, clear of the hover buttons), 14 px medium text.
 * The editor refuses an edit or a style that fails it, with the Smart Card's
 * "exceeds the field limit" warning.
 */
export function titleOverflows(html: string): boolean {
  if (typeof document === 'undefined' || !hasVisibleContent(html)) return false;
  const ghost = document.createElement('p');
  ghost.style.cssText =
    'position:absolute;visibility:hidden;pointer-events:none;left:-9999px;top:0;margin:0;' +
    'width:128px;font-size:14px;line-height:1.4;font-weight:500;overflow-wrap:break-word;letter-spacing:normal;';
  ghost.innerHTML = html;
  document.body.appendChild(ghost);
  const lines = lineBottoms(ghost).length;
  ghost.remove();
  return lines > 2;
}

/** How far the title may shrink to fit, largest first. */
const VIDEO_TITLE_ZOOMS = [1, 0.92, 0.84, 0.76, 0.68, 0.6] as const;

/**
 * Shrinks the title just enough to fit two lines, so it is never cut with an
 * ellipsis. It scales the whole title (zoom), so words set in a bigger size
 * shrink with the rest. Two lines is also a hard cap: past the smallest step,
 * anything beyond the second line is hidden. Shared by the editor preview and
 * the embed, so both draw the title the same size.
 */
export function fitTitleToTwoLines(el: HTMLElement): void {
  el.style.maxHeight = '';
  el.style.overflow = '';
  for (const zoom of VIDEO_TITLE_ZOOMS) {
    el.style.zoom = String(zoom);
    if (lineBottoms(el).length <= 2) return;
  }
  // Still too long at the smallest size: show the first two lines only.
  const top = el.getBoundingClientRect().top;
  el.style.maxHeight = `${(lineBottoms(el)[1] - top) / VIDEO_TITLE_ZOOMS[VIDEO_TITLE_ZOOMS.length - 1]}px`;
  el.style.overflow = 'hidden';
}
