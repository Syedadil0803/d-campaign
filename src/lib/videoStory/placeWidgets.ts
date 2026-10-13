import type { VideoStory } from '@/types/campaign';
import type { PromoStyle } from '@/types/promoStyle';

type CardPosition = PromoStyle['position'];
type VideoPosition = VideoStory['position'];

/** The other bottom corner. */
export function oppositeCorner(pos: VideoPosition): VideoPosition {
  return pos === 'bottom-left' ? 'bottom-right' : 'bottom-left';
}

const CORNER_LABELS: Record<CardPosition, string> = {
  'bottom-left': 'Bottom Left',
  'bottom-right': 'Bottom Right',
  'top-left': 'Top Left',
  'top-right': 'Top Right',
};

/**
 * The warning for putting a widget in the corner the other one already holds
 * on the live site, or null when there is no clash.
 *
 * The editor lets the user pick any corner and says so here instead of moving
 * the widget silently: a control that quietly ignored the choice read as
 * broken. Exact match only — a card in a top corner never meets the video,
 * which only sits at the bottom. Shared by the inline note under Position and
 * the Publish confirm, so the two cannot disagree.
 */
export function cornerClash(
  mine: CardPosition,
  other: { position: CardPosition; active?: boolean } | null | undefined,
  otherName: string,
): string | null {
  if (!other?.active || other.position !== mine) return null;
  const free = oppositeCorner(mine as VideoPosition);
  return `The ${otherName} is live at ${CORNER_LABELS[mine]}. Choose ${CORNER_LABELS[free]} so they don't overlap.`;
}

/**
 * Where the two widgets actually sit on the website.
 *
 * The live site's safety net, used by the embed: the editor warns about a
 * shared corner (cornerClash) but still lets it be published, so the site
 * itself must never stack them. When only one widget is live it keeps its own
 * choice. When both are, they take opposite sides, and the card's choice wins —
 * it is the established widget, and moving it would change a live site that
 * nobody asked to change. The card may sit at the top; the video still takes
 * the bottom corner on the other side, so the two never share a side.
 */
export function placeWidgets({
  cardPosition,
  videoPosition,
  cardLive,
  videoLive,
}: {
  cardPosition: CardPosition;
  videoPosition: VideoPosition;
  cardLive: boolean;
  videoLive: boolean;
}): { cardPosition: CardPosition; videoPosition: VideoPosition } {
  if (!cardLive || !videoLive) return { cardPosition, videoPosition };
  const cardSide: VideoPosition = cardPosition.endsWith('left') ? 'bottom-left' : 'bottom-right';
  return { cardPosition, videoPosition: oppositeCorner(cardSide) };
}
