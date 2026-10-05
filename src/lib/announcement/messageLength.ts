/**
 * The announcement's character limit, counted the way a reader sees the text.
 *
 * Every visible character counts once — a letter, a space, a whole emoji
 * (👍🏽 is one, not the four UTF-16 units JavaScript's .length sees). The
 * editor stores HTML, where a space can be `&nbsp;`; counting that raw made one
 * space cost six characters.
 */
export const MESSAGE_LIMIT = 120;

const segmenter =
  typeof Intl !== 'undefined' && 'Segmenter' in Intl
    ? new Intl.Segmenter(undefined, { granularity: 'grapheme' })
    : null;

function graphemes(text: string): string[] {
  const clean = text.replace(/​/g, '');
  return segmenter ? Array.from(segmenter.segment(clean), (s) => s.segment) : Array.from(clean);
}

const NAMED: Record<string, string> = { nbsp: ' ', amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };

/** The editor's HTML as plain text: tags dropped, entities decoded. */
export function messageText(html: string): string {
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, code: string) => {
      if (code[0] !== '#') return NAMED[code.toLowerCase()] ?? match;
      const point = code[1].toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isNaN(point) ? match : String.fromCodePoint(point);
    });
}

/** Visible characters in plain text. */
export function countChars(text: string): number {
  return graphemes(text).length;
}

/** Visible characters in the editor's HTML. */
export function messageLength(html: string): number {
  return countChars(messageText(html));
}

/** The first `limit` visible characters — never splits an emoji in half. */
export function clipChars(text: string, limit: number): string {
  return graphemes(text).slice(0, Math.max(0, limit)).join('');
}
