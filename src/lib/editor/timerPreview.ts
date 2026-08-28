import {
  TIMER_FIXED_TOKEN,
  buildTimerDisplayHtml,
  calculateTimeRemaining,
  formatCountdownWords,
  formatTimerText,
  normalizeLegacyTimerTokens,
} from '@/lib/editor/timerUtils';

/**
 * The countdown as a STATIC preview shows it — My Draft, My Published, the
 * saved variants, Template Hub.
 *
 * Apart from the editor's own rendering because the two answer different
 * questions. The editor draws a chip someone is about to type around, so it
 * carries the placeholder slots and the caret handling. A preview draws a
 * picture of a card, so it wants the real remaining time, the user's styling,
 * and none of the editing chrome.
 */

/**
 * Get preview timer text for templates (shows sample values)
 */
export function getTemplateTimerPreviewText(timerText?: string): string {
  // Hours never reaches 24 in a real countdown — it rolls into days — so a
  // sample showing 24 advertised a value the site can never display.
  const sampleValue = { hours: 23, minutes: 18, seconds: 7, days: 2 };
  const template = normalizeLegacyTimerTokens(timerText || 'Ends in {timer}');
  // New fixed-block templates: swap the {timer} marker for sample countdown words.
  if (template.includes(TIMER_FIXED_TOKEN)) {
    return template.split(TIMER_FIXED_TOKEN).join(formatCountdownWords(sampleValue));
  }
  // Legacy token templates fallback.
  return formatTimerText(template, sampleValue);
}

/**
 * The eight styleable pieces of the countdown, in the order chipInnerHtml and
 * TimerChipComponent both emit them. Kept here so the preview can line the
 * stored per-cell styles up with the spans it just built.
 */
const CHIP_CELL_ORDER = [
  'days-val',
  'days-lab',
  'sep-0',
  'hours-val',
  'hours-lab',
  'sep-1',
  'mins-val',
  'mins-lab',
] as const;

/** The chip's style model as TimerChipNode.exportJSON writes it. */
interface SerializedChipStyle {
  whole?: Record<string, string>;
  cells?: Record<string, Record<string, string>>;
}

/** Find the countdown chip's style model inside a serialized Lexical state. */
function readChipStyleModel(stateJson: string): SerializedChipStyle | null {
  try {
    const parsed = JSON.parse(stateJson) as { root?: unknown };
    let found: SerializedChipStyle | null = null;
    const walk = (node: unknown): void => {
      if (found || !node || typeof node !== 'object') return;
      const n = node as { type?: string; model?: SerializedChipStyle; children?: unknown[] };
      if (n.type === 'timer-chip' && n.model) {
        found = n.model;
        return;
      }
      if (Array.isArray(n.children)) n.children.forEach(walk);
    };
    walk(parsed.root);
    return found;
  } catch {
    // Not a state this build can read. The countdown simply previews unstyled,
    // which is what happened before it was read at all.
    return null;
  }
}

function cssText(css: Record<string, string> | undefined): string {
  if (!css) return '';
  return Object.entries(css)
    .map(([k, v]) => `${k}:${v}`)
    .join(';');
}

/**
 * Paint the countdown's own styling onto an already-built preview.
 *
 * The prefix and suffix carry their styles in timerText and come through on
 * their own. The chip does not: the Lexical field serializes it to a bare
 * {timer} marker, so its colours, weights and sizes live only in
 * timerStateJson. Without this the draft, My Published and the saved variants
 * showed a bold red "Ends in", a bold red "Live In the", and plain grey
 * numbers between them — styling the user had applied to the whole line.
 */
function applyChipStyleToPreview(html: string, stateJson?: string): string {
  if (!stateJson || typeof DOMParser === 'undefined') return html;
  const model = readChipStyleModel(stateJson);
  if (!model) return html;

  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html');
  const root = doc.body.firstElementChild as HTMLElement | null;
  const chip = root?.querySelector('[data-timer-fixed]') as HTMLElement | null;
  if (!root || !chip) return html;

  const whole = cssText(model.whole);
  if (whole) chip.setAttribute('style', `${chip.getAttribute('style') || ''};${whole}`);

  const pieces = Array.from(chip.children) as HTMLElement[];
  // Only when the chip has the structure this maps onto. A chip built by an
  // older shape is left alone rather than styled by guesswork.
  if (pieces.length !== CHIP_CELL_ORDER.length) return root.innerHTML;
  pieces.forEach((piece, i) => {
    const css = cssText(model.cells?.[CHIP_CELL_ORDER[i]]);
    if (css) piece.setAttribute('style', `${piece.getAttribute('style') || ''};${css}`);
  });
  return root.innerHTML;
}

/**
 * The countdown as a static preview should show it.
 *
 * A card with an end date gets its REAL remaining time — the same figures the
 * editor canvas and the live site show, through the same builder, so the three
 * cannot disagree. Only a card without one falls back to sample numbers, which
 * is the Template Hub: a template is a design, not a campaign, and has no date
 * to count to.
 *
 * My Draft, My Published and the saved variants all showed the sample before
 * this, so a card ending tomorrow claimed two days in the very popup meant to
 * show the user what they had stored.
 */
export function getPreviewTimerHtml(
  timerText?: string,
  endDate?: string,
  timerStateJson?: string,
): string {
  if (!endDate) return getTemplateTimerPreviewText(timerText);
  const html = buildTimerDisplayHtml(timerText || '', calculateTimeRemaining(endDate), {
    editorSlots: false,
  });
  return applyChipStyleToPreview(html, timerStateJson);
}
