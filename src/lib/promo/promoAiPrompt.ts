/**
 * The prompt used by the guided flow's AI step.
 *
 * Different from the editor's prompt on purpose. The editor's is a blank-slate
 * interview: it asks for the schedule and the whole palette because nothing has
 * been decided yet. By the time the user reaches this step they have ALREADY
 * picked dates and a template, so asking again is both redundant and a good way
 * to get copy that doesn't fit the design they chose.
 *
 * So this prompt states the schedule as fact, describes the chosen design, and
 * lets the user decide whether AI may restyle it.
 */

import { PromoCard } from '@/types/campaign';
import { PROMO_COPY_STYLE_GUIDE } from '@/lib/promo/promoCopyStyle';
import { GradientStyle } from '@/types/campaign';

/** Human-readable color for a section, so the model can judge contrast. */
function describeBg(bg: GradientStyle | undefined): string {
  if (!bg) return 'transparent';
  if (bg.type === 'solid') return bg.startColor;
  return `${bg.type} gradient ${bg.startColor} → ${bg.endColor}`;
}

function formatDay(iso: string): string {
  if (!iso) return '';
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

/**
 * What the model is being asked to produce.
 * - `copy`   — keep the design, write the words.
 * - `both`   — write the words AND propose a palette.
 * - `design` — keep the words, restyle only. Used when the user arrives from
 *              the editor with copy they've already written.
 */
export type AiMode = 'copy' | 'both' | 'design';

interface GuidedPromptOptions {
  card: PromoCard;
  templateName?: string;
  mode: AiMode;
  /** Answers from the panel's interview, pasted into the prompt as a brief. */
  brief?: PromoBrief;
}

/** Answers collected by the panel's own interview. */
export interface PromoBrief {
  /** What's being promoted — the offer and the product. */
  offer?: string;
  /** Who it's for and how it should sound. */
  tone?: string;
  /** Whether a countdown shows, and the wording around it. */
  timer?: string;
  /** What the button should do, if there is one. */
  cta?: string;
  /** Brand colors or a direction, when AI may restyle. */
  colors?: string;
  /** Anything else the user wanted to add. */
  extra?: string;
}

export function buildGuidedPromoPrompt({
  card,
  templateName,
  mode,
  brief,
}: GuidedPromptOptions): string {
  const keepDesign = mode === 'copy';
  const keepContent = mode === 'design';
  const plain = (html?: string) =>
    String(html ?? '').replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
  const s = card.style;
  const days =
    card.startDate && card.endDate
      ? Math.max(
          1,
          Math.round(
            (new Date(`${card.endDate}T00:00:00`).getTime() -
              new Date(`${card.startDate}T00:00:00`).getTime()) /
              86_400_000,
          ) + 1,
        )
      : null;

  /**
   * A finished brief, not an interview script.
   *
   * This prompt used to instruct the model to ask the user one question at a
   * time — which handed our own guided flow to whichever chat tool they
   * happened to open, and left them answering five messages there before
   * getting anything back. The panel runs that interview itself now and pastes
   * the answers in here, so one round trip produces the card.
   */
  const answered: string[] = [];
  const add = (label: string, value?: string) => {
    const v = (value ?? '').trim();
    if (v) answered.push(`- ${label}: ${v}`);
  };
  if (!keepContent) {
    add('What is being promoted', brief?.offer);
    add('Audience and tone', brief?.tone);
    add('Countdown', brief?.timer);
    add('Call to action', brief?.cta);
  }
  if (!keepDesign) add('Colors', brief?.colors);
  add('Also worth knowing', brief?.extra);

  const lines: string[] = [
    'Act as my Head of Marketing for an ecommerce promo card — a small floating',
    'widget on my website with a title, subtitle, description, an optional',
    'countdown timer and an optional CTA button.',
    '',
    'Do NOT ask me any questions. Everything you need is below; reply with the',
    'JSON object described at the end and nothing else.',
    '',
    '── THE BRIEF ──',
    ...(answered.length ? answered : ['- (no detail given — use your judgement)']),
    '',
    '── ALREADY DECIDED — do not ask me about these ──',
  ];

  if (card.startDate && card.endDate) {
    lines.push(
      `The campaign runs ${formatDay(card.startDate)} to ${formatDay(card.endDate)}` +
        `${days ? ` (${days} day${days > 1 ? 's' : ''})` : ''}.`,
      `Use exactly these dates: "startDate": "${card.startDate}", "endDate": "${card.endDate}".`,
      'Write any urgency in the copy so it matches that length — do not invent a',
      'different deadline.',
    );
  }

  /**
   * The palette is only "already decided" when the design is being kept.
   *
   * It used to sit under ALREADY DECIDED in every mode, while the instruction
   * further down told the model it could replace the design — a prompt that
   * contradicts itself, which is why "Content and colors" came back with the
   * old palette and new copy.
   */
  lines.push(
    '',
    keepDesign
      ? `I have already chosen a design${templateName ? `: "${templateName}"` : ''}. Its palette is:`
      : '── THE CARD\'S CURRENT COLORS — you may replace these ──',
    `- Card background: ${describeBg(s.background)}`,
    `- Title band: ${describeBg(s.titleStyle.background)}, text ${s.titleStyle.textColor}`,
    `- Subtitle: ${describeBg(s.subheadingStyle.background)}, text ${s.subheadingStyle.textColor}`,
    `- Description: ${describeBg(s.descriptionStyle.background)}, text ${s.descriptionStyle.textColor}`,
    `- Timer: ${describeBg(s.dateStyle.background)}, text ${s.dateStyle.textColor}`,
    `- Button: ${describeBg(s.buttonStyle.background)}, text ${s.buttonStyle.textColor}`,
  );

  /**
   * Alignment is design, and only "Content and colors" is allowed to change it.
   *
   * It was never in the prompt at all, so every card came back with whatever
   * alignment the template happened to use — ask for a centred hero headline on
   * a left-aligned template and you still got left-aligned lines, because the
   * model was never told the field existed. "Colors only" leaves it alone on
   * purpose: that mode promises colours and nothing else.
   */
  if (!keepDesign && !keepContent) {
    lines.push(
      '',
      '── THE CARD\'S CURRENT ALIGNMENT — you may replace this too ──',
      `- Title: ${s.titleStyle.textAlign ?? 'left'}`,
      `- Subtitle: ${s.subheadingStyle.textAlign ?? 'left'}`,
      `- Description: ${s.descriptionStyle.textAlign ?? 'left'}`,
      `- Button: ${s.buttonStyle.textAlign ?? 'left'}`,
      'Choose the alignment the design wants — a short hero headline usually',
      'centres, a paragraph of detail usually reads better left. Do not just',
      'repeat what is above.',
    );
  }

  lines.push('');

  if (keepContent) {
    lines.push(
      'KEEP MY WORDS EXACTLY AS THEY ARE. This card is already written:',
      `- Title: "${plain(card.title)}"`,
      `- Subtitle: "${plain(card.subtitle)}"`,
      `- Description: "${plain(card.description)}"`,
      card.showButton !== false ? `- Button: "${plain(card.buttonText)}"` : '- Button: hidden',
      '',
      'Do NOT rewrite, shorten or "improve" any of it, and do NOT return the copy',
      'fields. Return ONLY the color fields, choosing a palette that suits those',
      'words and the campaign. Every text color must be clearly readable against',
      'its OWN section background; if a section background is "transparent" the',
      'text sits on the card background, so contrast it against the card instead.',
    );
  } else if (keepDesign) {
    lines.push(
      'KEEP THIS DESIGN. Return ONLY the copy fields — do NOT return any color,',
      'background, alignment or position fields. Write copy whose tone matches the',
      'palette above (a dark, muted palette wants restrained wording; a bright,',
      'high-contrast one can take bolder wording).',
    );
  } else {
    lines.push(
      'Return BOTH the copy fields AND the color fields below — I want new words',
      'and a new palette, not one or the other.',
      'You may REPLACE this design. Propose a cohesive palette that suits the',
      'campaign, returning the color fields below. Every text color must be',
      'clearly readable against its OWN section background; if a section',
      'background is "transparent" the text sits on the card background, so',
      'contrast it against the card instead.',
    );
  }

  if (!keepContent) lines.push('', ...PROMO_COPY_STYLE_GUIDE);

  lines.push(
    '',
    'The card is SMALL, so keep copy tight and it will never overflow:',
    'title = ONE short line, subtitle = at most 2 short lines, description = at',
    'most 3 short lines, timerText = {timer} plus AT MOST FOUR SHORT WORDS.',
    'Shorter is better. The TITLE is the hook — make it creative and',
    'distinctive, never a flat generic label.',
    '',
    'Always fill title, subtitle and description. The timer and button are',
    'optional: use "showTimer": false or "showButton": false to drop them.',
    '',
    'Reply with ONLY a JSON object (no prose, no code fences) using these keys:',
    '{',
  );

  if (!keepContent) {
    lines.push(
      '  "title": "", "subtitle": "", "description": "",',
      '  "buttonText": "", "showButton": true, "showTimer": true,',
      '  "timerText": "Ends in {timer}",',
      `  "startDate": "${card.startDate || 'YYYY-MM-DD'}", "endDate": "${card.endDate || 'YYYY-MM-DD'}",`,
      '  "ctaType": "whatsapp | link | text", "buttonUrl": "", "whatsappNumber": ""',
    );
  }

  if (!keepDesign) {
    lines.push(
      `${keepContent ? '  ' : '  , '}"cardBg": {"type":"linear","startColor":"#hex","endColor":"#hex"},`,
      '  "cardTextColor": "#hex",',
      '  "titleBg": {"type":"solid","startColor":"#hex","endColor":"#hex"},',
      '  "titleTextColor": "#hex",',
      '  "subtitleBg": {"type":"solid","startColor":"#hex","endColor":"#hex"},',
      '  "subtitleTextColor": "#hex",',
      '  "descriptionBg": {"type":"solid","startColor":"#hex","endColor":"#hex"},',
      '  "descriptionTextColor": "#hex",',
      '  "timerBg": {"type":"solid","startColor":"#hex","endColor":"#hex"},',
      '  "timerTextColor": "#hex",',
      '  "buttonBg": {"type":"solid","startColor":"#hex","endColor":"#hex"},',
      `  "buttonTextColor": "#hex"${keepContent ? '' : ','}`,
    );
  }

  if (!keepDesign && !keepContent) {
    lines.push(
      '  "titleAlign": "left | center | right",',
      '  "subtitleAlign": "left | center | right",',
      '  "descriptionAlign": "left | center | right",',
      '  "buttonAlign": "left | center | right"',
    );
  }

  lines.push('}');
  return lines.join('\n');
}

/** Style keys the model may return — stripped when the user keeps their design. */
const STYLE_KEYS = [
  'cardBg',
  'cardTextColor',
  'titleBg',
  'titleTextColor',
  'titleAlign',
  'subtitleBg',
  'subtitleTextColor',
  'subtitleAlign',
  'descriptionBg',
  'descriptionTextColor',
  'descriptionAlign',
  'timerBg',
  'timerTextColor',
  'buttonBg',
  'buttonTextColor',
  'buttonAlign',
  'cardPosition',
] as const;

/**
 * Drop any styling the model sent back.
 *
 * The prompt asks it not to send styling when the design is being kept, but a
 * model can ignore that — this makes "keep this design" actually mean it.
 */
export function stripStyleFields<T extends object>(data: T): T {
  const out = { ...data } as Record<string, unknown>;
  STYLE_KEYS.forEach((k) => {
    delete out[k];
  });
  return out as T;
}

/** Copy keys — stripped when the user asked to keep their own words. */
const CONTENT_KEYS = [
  'title',
  'subtitle',
  'description',
  'buttonText',
  'timerText',
  'showTimer',
  'showButton',
  'ctaType',
  'buttonUrl',
  'whatsappNumber',
  'startDate',
  'endDate',
] as const;

/**
 * Drop any copy the model sent back.
 *
 * Same reasoning as stripStyleFields: the prompt says not to touch the words,
 * but a model can ignore that, and silently rewriting copy the user already
 * wrote is the worst possible surprise.
 */
export function stripContentFields<T extends object>(data: T): T {
  const out = { ...data } as Record<string, unknown>;
  CONTENT_KEYS.forEach((k) => {
    delete out[k];
  });
  return out as T;
}
