/**
 * Plain-text editing over rich-text fields.
 *
 * Promo copy is stored as HTML so the editor can style individual words.
 * The guided flow's content step is a plain-text form, so it needs to show the
 * words without markup and write edits back WITHOUT throwing the template's
 * formatting away.
 *
 * The common case is a single wrapper around the text —
 * `<strong>Sale</strong>`, `<span style="font-size:0.9rem">Subtitle</span>` —
 * which we can preserve exactly by swapping only the inner text. Anything more
 * complex (styling applied to individual words) can't survive plain-text
 * editing, so those fields fall back to plain text once edited; the editor is
 * where per-word styling belongs.
 */

/**
 * Visible text of a rich-text field, with markup removed.
 *
 * Deliberately does NOT trim: these values feed controlled inputs, and
 * trimming here means a space typed at the end of a word is stripped before it
 * can render — making it impossible to type a space at all. Callers that need
 * an emptiness check should trim at the point of comparison instead.
 */
export function toPlainText(html: string | undefined): string {
  return String(html ?? '')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * True when the value styles different words differently — e.g. a big headline
 * word next to a small tagline. Plain-text editing can't preserve which new
 * words should get which style, so callers surface this to the user.
 */
export function hasMixedStyling(html: string | undefined): boolean {
  const original = String(html ?? '');
  if (!original.includes('<')) return false;
  // A single wrapper around one run of text is not "mixed".
  return !/^((?:<[^>]+>)*)([^<]*)((?:<\/[^>]+>)*)$/.test(original);
}

/** One styled stretch of a rich-text value: its markup, and the words inside. */
export interface TextRun {
  prefix: string;
  text: string;
  suffix: string;
  /** Whitespace-only runs are separators, not something to hand the user. */
  editable: boolean;
}

/**
 * Split a value into its styled runs so each can be edited on its own.
 *
 * `<span 0.85>Flat</span> <span 1.35>35% OFF</span> + Free Delivery` becomes
 * three editable runs plus the separators between them. Editing each run in
 * place is the only way to change the words AND keep every part's own styling —
 * collapsing to one style makes a small tagline swallow the whole headline.
 *
 * Returns null when the markup doesn't fit this simple shape, so callers can
 * fall back to single-field editing.
 */
export function splitRuns(html: string | undefined): TextRun[] | null {
  let rest = String(html ?? '');
  if (!rest) return null;
  const runs: TextRun[] = [];
  let guard = 0;

  while (rest.length > 0) {
    if (++guard > 200) return null;

    // Opening tag(s) → text → closing tag(s)
    const el = rest.match(/^((?:<[a-zA-Z][^>]*>)+)([^<]*)((?:<\/[a-zA-Z][^>]*>)+)/);
    if (el) {
      runs.push({
        prefix: el[1],
        text: el[2],
        suffix: el[3],
        editable: el[2].trim().length > 0,
      });
      rest = rest.slice(el[0].length);
      continue;
    }

    // Bare text between elements
    const bare = rest.match(/^([^<]+)/);
    if (bare) {
      runs.push({
        prefix: '',
        text: bare[1],
        suffix: '',
        editable: bare[1].trim().length > 0,
      });
      rest = rest.slice(bare[0].length);
      continue;
    }

    // Anything else (e.g. a stray <br>) — not a shape we can safely rebuild.
    return null;
  }

  return runs.length > 0 ? runs : null;
}

/** Rebuild the value from its runs, keeping each run's own markup. */
export function joinRuns(runs: TextRun[]): string {
  return runs.map((r) => `${r.prefix}${escapeHtml(r.text)}${r.suffix}`).join('');
}

/**
 * Re-apply a template's word-by-word styling to new text, by position.
 *
 * "Summer Sale" where *Summer* is big and *Sale* is small is a pattern: one
 * word in style A, one in style B. Typing "Winter Deals" should keep that —
 * *Winter* big, *Deals* small — even after deleting the line entirely. So the
 * pattern is kept as a list of slots (style + how many words it held) and the
 * user's words are dealt into those slots in order.
 *
 * Words beyond what the pattern covers are appended unstyled, in the card's
 * base style, rather than stretching a style that was never meant for them.
 * Slots left without words simply disappear.
 */
/**
 * Only runs that actually carry styling become slots.
 *
 * A template's unstyled trailing words ("+ Free Delivery") are sample copy,
 * not a style slot — treating them as one made the user's words get dealt into
 * a slot that styles nothing, shuffling them on every keystroke.
 */
function styleSlots(pattern: TextRun[]): TextRun[] {
  return pattern.filter((r) => r.editable && r.prefix);
}

export function applyWordPattern(pattern: TextRun[], plain: string): string {
  const words = plain.split(/\s+/).filter((w) => w.length > 0);
  const keepTrailingSpace = /\s$/.test(plain);
  const slots = styleSlots(pattern);

  let cursor = 0;
  const pieces: string[] = [];

  slots.forEach((run) => {
    const slotSize = run.text.trim().split(/\s+/).filter(Boolean).length || 1;
    const slotWords = words.slice(cursor, cursor + slotSize);
    cursor += slotWords.length;
    if (slotWords.length === 0) return;
    // A single space always separates slots — the template's own separators
    // may be sample copy, which must not reappear inside the user's text.
    pieces.push(
      `${pieces.length ? ' ' : ''}${run.prefix}${escapeHtml(slotWords.join(' '))}${run.suffix}`,
    );
  });

  // Anything the pattern didn't account for keeps the card's base style.
  if (cursor < words.length) {
    const rest = words.slice(cursor).join(' ');
    pieces.push(`${pieces.length ? ' ' : ''}${escapeHtml(rest)}`);
  }

  const html = pieces.join('');
  // Preserve a space the user just typed, so words can still be separated.
  return keepTrailingSpace ? `${html} ` : html;
}

const countWords = (text: string) => text.trim().split(/\s+/).filter(Boolean).length;

/** How many words the pattern styles before falling back to the base style. */
export function patternWordCapacity(pattern: TextRun[]): number {
  return styleSlots(pattern).reduce((n, r) => n + (countWords(r.text) || 1), 0);
}

/**
 * Total words the design's own copy had, styled or not.
 *
 * A design may deliberately leave words unstyled ("+ Free Delivery"). Those
 * aren't a problem to report — so the "stays plain" hint should only appear
 * once the user writes MORE than the design itself carried.
 */
export function patternTotalWords(pattern: TextRun[]): number {
  return pattern.filter((r) => r.editable).reduce((n, r) => n + countWords(r.text), 0);
}

/**
 * Write `text` back into `originalHtml`, keeping as much of the original
 * formatting as plain-text editing allows.
 *
 * - Single wrapper (`<strong>…</strong>`): preserved exactly.
 * - Several styled runs (`<strong>A</strong> <span>B</span>`): there's no way
 *   to know which new words belong to which run, so the FIRST run's tag and
 *   style are applied to the whole line. That keeps the template's typography
 *   instead of silently dropping to unstyled default text.
 * - No markup: returns escaped plain text.
 */
export function setPlainText(originalHtml: string | undefined, text: string): string {
  const original = String(originalHtml ?? '');
  const escaped = escapeHtml(text);
  if (!original.trim()) return escaped;

  // Opening tags, then a single run of text, then closing tags — nothing else.
  // No \s* around the tag groups: it would swallow a trailing space into the
  // suffix and then re-add it on the next keystroke, doubling spaces as you type.
  const simple = original.match(/^((?:<[^>]+>)*)([^<]*)((?:<\/[^>]+>)*)$/);
  if (simple && (simple[1] || simple[3])) {
    return `${simple[1]}${escaped}${simple[3]}`;
  }

  // Mixed runs — keep the style wrapping the MOST text, i.e. the field's main
  // treatment. Using the first run instead would let a small tagline ("Flat")
  // shrink the whole line.
  const runs = splitRuns(original);
  if (runs) {
    const editable = runs.filter((r) => r.editable && r.prefix);
    const dominant = [...editable].sort((a, b) => b.text.length - a.text.length)[0];
    if (dominant) return `${dominant.prefix}${escaped}${dominant.suffix}`;
  }
  return escaped;
}
