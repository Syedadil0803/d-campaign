// Ingest a fully-styled promo card the user generated in an external AI chat
// and pasted back as JSON. The AI is given a curated, flat schema (not our raw
// config); we validate/sanitize every field here and map it onto the real
// PromoCard, so a malformed or hostile paste can't corrupt the card. Copy may
// carry light formatting (bold, font-size, color) which we sanitize against a
// strict allowlist; everything else is dropped.

import { jsonrepair } from 'jsonrepair';
import type { PromoCard, GradientStyle } from '@/types/campaign';

// A section background: either a single hex (→ solid) or a gradient pair.
type AiBg = string | { from?: string; to?: string; direction?: string; type?: string };
type AiAlign = 'left' | 'center' | 'right';

// The flat schema we ask the AI to produce. Everything optional; we apply only
// what's present and valid.
export interface AiPromo {
  title?: string;
  subtitle?: string;
  description?: string;
  buttonText?: string;
  timerText?: string;
  showTimer?: boolean;
  showButton?: boolean;
  startDate?: string;
  endDate?: string;
  ctaType?: 'whatsapp' | 'link' | 'text';
  buttonUrl?: string;
  whatsappNumber?: string;
  cardPosition?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
  cardBg?: AiBg;
  cardTextColor?: string;
  titleBg?: AiBg;
  titleTextColor?: string;
  titleAlign?: AiAlign;
  subtitleBg?: AiBg;
  subtitleTextColor?: string;
  subtitleAlign?: AiAlign;
  descriptionBg?: AiBg;
  descriptionTextColor?: string;
  descriptionAlign?: AiAlign;
  timerBg?: AiBg;
  timerTextColor?: string;
  buttonBg?: AiBg;
  buttonTextColor?: string;
  buttonAlign?: AiAlign;
}

type ParseResult =
  | { ok: true; data: AiPromo; fields: string[]; skipped: string[] }
  | { ok: false; error: string };

// Every field the AI may send — used to report which ones we couldn't use.
const KNOWN_KEYS: (keyof AiPromo)[] = [
  'title', 'subtitle', 'description', 'buttonText', 'timerText', 'showTimer',
  'showButton', 'startDate', 'endDate', 'ctaType', 'buttonUrl', 'whatsappNumber',
  'cardPosition', 'cardBg', 'cardTextColor', 'titleBg', 'titleTextColor',
  'titleAlign', 'subtitleBg', 'subtitleTextColor', 'subtitleAlign', 'descriptionBg',
  'descriptionTextColor', 'descriptionAlign', 'timerBg', 'timerTextColor',
  'buttonBg', 'buttonTextColor', 'buttonAlign',
];

const HEX = /^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/; // 6- or 8-digit (alpha) hex
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const CTA_TYPES = new Set(['whatsapp', 'link', 'text']);
const ALIGNS = new Set(['left', 'center', 'right']);
const POSITIONS = new Set(['bottom-right', 'bottom-left', 'top-right', 'top-left']);
const DIRECTIONS = new Set([
  'to right', 'to left', 'to top', 'to bottom',
  'to top right', 'to top left', 'to bottom right', 'to bottom left',
]);

const COPY_MAX = 600; // sanitized-HTML length cap per field

function cleanHex(v: unknown): string | undefined {
  return typeof v === 'string' && HEX.test(v.trim()) ? v.trim().toLowerCase() : undefined;
}

function cleanDate(v: unknown): string | undefined {
  if (typeof v !== 'string' || !ISO_DATE.test(v.trim())) return undefined;
  const s = v.trim();
  return Number.isNaN(new Date(`${s}T00:00:00`).getTime()) ? undefined : s;
}

function pickEnum<T extends string>(v: unknown, set: Set<string>): T | undefined {
  return typeof v === 'string' && set.has(v.trim()) ? (v.trim() as T) : undefined;
}

function cleanBg(v: unknown): AiBg | undefined {
  // A transparent section shows the card background through it — a common,
  // deliberate choice the AI makes, so honour it.
  if (typeof v === 'string' && v.trim().toLowerCase() === 'transparent') return 'transparent';
  if (cleanHex(v)) return cleanHex(v);
  if (v && typeof v === 'object' && !Array.isArray(v)) {
    const o = v as Record<string, unknown>;
    const from = cleanHex(o.from) ?? cleanHex(o.startColor);
    if (!from) return undefined;
    const to = cleanHex(o.to) ?? cleanHex(o.endColor);
    const direction = pickEnum<string>(o.direction, DIRECTIONS);
    const type = o.type === 'radial' ? 'radial' : 'linear';
    return { from, to, direction, type };
  }
  return undefined;
}

// ── HTML sanitizer for copy fields ────────────────────────────────────────
// Allow only inline emphasis + font-size/color spans, mirroring the template
// copy. Any other tag is unwrapped to its text; any other attribute is dropped.
const ALLOWED_TAGS = new Set(['STRONG', 'B', 'EM', 'I', 'U', 'BR', 'SPAN']);
// Removed entirely (content dropped), rather than unwrapped to text.
const STRIP_TAGS = new Set([
  'SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'LINK', 'META', 'NOSCRIPT', 'TEMPLATE',
]);
const FONT_SIZE = /^\d{1,2}(\.\d+)?(rem|em|px)$/i;

function cleanStyleAttr(style: string): string {
  const out: string[] = [];
  for (const decl of style.split(';')) {
    const [rawProp, ...rest] = decl.split(':');
    const prop = rawProp?.trim().toLowerCase();
    const value = rest.join(':').trim();
    if (!prop || !value) continue;
    if (prop === 'font-size' && FONT_SIZE.test(value)) out.push(`font-size:${value}`);
    else if (prop === 'color' && (HEX.test(value) || /^rgb\([\d ,]+\)$/i.test(value))) {
      out.push(`color:${value}`);
    }
  }
  return out.join(';');
}

function sanitizeNode(node: Element): void {
  Array.from(node.childNodes).forEach((child) => {
    if (child.nodeType === Node.TEXT_NODE) return;
    if (child.nodeType !== Node.ELEMENT_NODE) {
      child.parentNode?.removeChild(child);
      return;
    }
    const el = child as Element;
    if (STRIP_TAGS.has(el.tagName)) {
      el.remove();
      return;
    }
    if (!ALLOWED_TAGS.has(el.tagName)) {
      el.replaceWith(...Array.from(el.childNodes));
      return;
    }
    for (const attr of Array.from(el.attributes)) {
      if (el.tagName === 'SPAN' && attr.name === 'style') {
        const cleaned = cleanStyleAttr(attr.value);
        if (cleaned) el.setAttribute('style', cleaned);
        else el.removeAttribute('style');
      } else {
        el.removeAttribute(attr.name);
      }
    }
    sanitizeNode(el);
  });
}

function sanitizeCopy(v: unknown): string | undefined {
  if (typeof v !== 'string') return undefined;
  const raw = v.trim();
  if (!raw) return undefined;
  if (typeof document === 'undefined') {
    // SSR safety: drop script/style blocks entirely, then strip remaining tags.
    const text = raw
      .replace(/<(script|style|iframe|object|embed|noscript|template)[\s\S]*?<\/\1>/gi, '')
      .replace(/<[^>]*>/g, '')
      .trim();
    return text ? text.slice(0, COPY_MAX) : undefined;
  }
  const host = document.createElement('div');
  host.innerHTML = raw;
  sanitizeNode(host);
  const html = host.innerHTML.trim();
  return html ? html.slice(0, COPY_MAX) : undefined;
}

// ── Parse ──────────────────────────────────────────────────────────────────
// Models wrap JSON in ```json fences and add chatter; fall back to the
// outermost { … } span.
function extractJson(raw: string): string | null {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fenced ? fenced[1].trim() : trimmed;
  if (body.startsWith('{') && body.endsWith('}')) return body;
  const start = body.indexOf('{');
  const end = body.lastIndexOf('}');
  return start >= 0 && end > start ? body.slice(start, end + 1) : null;
}

function coerceObject(v: unknown): Record<string, unknown> | null {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

// style="color:#fff" → style='color:#fff' so HTML attribute quotes stop
// terminating the surrounding JSON string. jsonrepair can't know it's HTML, so
// this runs first; jsonrepair then handles the generic breakage (trailing
// commas, single quotes, smart quotes, missing quotes, …).
function repairAttrQuotes(json: string): string {
  return json.replace(/([a-zA-Z][\w-]*)="([^"]*)"/g, "$1='$2'");
}

function safeRepair(s: string): string {
  try {
    return jsonrepair(s);
  } catch {
    return '';
  }
}

// Try increasingly forgiving strategies; first that yields an object wins.
function tolerantParse(candidate: string): Record<string, unknown> | null {
  const attempts = [
    candidate,
    repairAttrQuotes(candidate),
    safeRepair(candidate),
    safeRepair(repairAttrQuotes(candidate)),
  ];
  for (const text of attempts) {
    if (!text) continue;
    try {
      const obj = coerceObject(JSON.parse(text));
      if (obj) return obj;
    } catch {
      // next strategy
    }
  }
  return null;
}

export function parseAiPromo(raw: string): ParseResult {
  if (!raw.trim()) return { ok: false, error: 'Paste the result from the AI first.' };
  const json = extractJson(raw);
  if (!json) return { ok: false, error: "Couldn't find any JSON. Paste the whole block the AI gave you." };

  const obj = tolerantParse(json);
  if (!obj) {
    return { ok: false, error: "That JSON couldn't be read. Copy just the JSON the AI produced." };
  }

  const data: AiPromo = {};
  const fields: string[] = [];
  const take = <K extends keyof AiPromo>(key: K, value: AiPromo[K] | undefined) => {
    if (value !== undefined) {
      data[key] = value;
      fields.push(key);
    }
  };

  take('title', sanitizeCopy(obj.title));
  take('subtitle', sanitizeCopy(obj.subtitle));
  take('description', sanitizeCopy(obj.description));
  take('buttonText', sanitizeCopy(obj.buttonText));
  take('timerText', sanitizeCopy(obj.timerText));

  if (typeof obj.showTimer === 'boolean') take('showTimer', obj.showTimer);
  if (typeof obj.showButton === 'boolean') take('showButton', obj.showButton);

  take('startDate', cleanDate(obj.startDate));
  take('endDate', cleanDate(obj.endDate));

  take('ctaType', pickEnum(obj.ctaType, CTA_TYPES));
  if (typeof obj.buttonUrl === 'string' && /^https?:\/\//i.test(obj.buttonUrl.trim())) {
    take('buttonUrl', obj.buttonUrl.trim().slice(0, 500));
  }
  if (typeof obj.whatsappNumber === 'string') {
    const digits = obj.whatsappNumber.replace(/\D/g, '').slice(0, 15);
    if (digits) take('whatsappNumber', digits);
  }

  take('cardPosition', pickEnum(obj.cardPosition, POSITIONS));
  take('cardBg', cleanBg(obj.cardBg));
  take('cardTextColor', cleanHex(obj.cardTextColor));

  take('titleBg', cleanBg(obj.titleBg));
  take('titleTextColor', cleanHex(obj.titleTextColor));
  take('titleAlign', pickEnum(obj.titleAlign, ALIGNS));

  take('subtitleBg', cleanBg(obj.subtitleBg));
  take('subtitleTextColor', cleanHex(obj.subtitleTextColor));
  take('subtitleAlign', pickEnum(obj.subtitleAlign, ALIGNS));

  take('descriptionBg', cleanBg(obj.descriptionBg));
  take('descriptionTextColor', cleanHex(obj.descriptionTextColor));
  take('descriptionAlign', pickEnum(obj.descriptionAlign, ALIGNS));

  take('timerBg', cleanBg(obj.timerBg));
  take('timerTextColor', cleanHex(obj.timerTextColor));

  take('buttonBg', cleanBg(obj.buttonBg));
  take('buttonTextColor', cleanHex(obj.buttonTextColor));
  take('buttonAlign', pickEnum(obj.buttonAlign, ALIGNS));

  // Fields the AI sent but we couldn't use (invalid value) — surfaced to the
  // user so an imperfect result is visible and fixable, not silent.
  const skipped = KNOWN_KEYS.filter((k) => {
    const v = obj[k as string];
    return v !== undefined && v !== null && v !== '' && !fields.includes(k as string);
  }).map((k) => k as string);

  if (fields.length === 0) {
    return { ok: false, error: 'No usable promo fields in that JSON. Check the format and try again.' };
  }
  return { ok: true, data, fields, skipped };
}

// ── Apply ────────────────────────────────────────────────────────────────
function solid(hex: string): GradientStyle {
  return { type: 'solid', startColor: hex, endColor: hex, direction: 'to right', midpoint: 50 };
}

function toGradient(bg: AiBg): GradientStyle {
  if (typeof bg === 'string') return solid(bg);
  if (!bg.to) return solid(bg.from!);
  return {
    type: bg.type === 'radial' ? 'radial' : 'linear',
    startColor: bg.from!,
    endColor: bg.to,
    direction: bg.direction ?? 'to bottom right',
    midpoint: 50,
  };
}

// Map validated AI fields onto a copy of the current card. Only present fields
// change; everything else is preserved.
export function applyAiPromo(current: PromoCard, ai: AiPromo): PromoCard {
  const next: PromoCard = {
    ...current,
    style: {
      ...current.style,
      titleStyle: { ...current.style.titleStyle },
      subheadingStyle: { ...current.style.subheadingStyle },
      descriptionStyle: { ...current.style.descriptionStyle },
      dateStyle: { ...current.style.dateStyle },
      buttonStyle: { ...current.style.buttonStyle },
    },
  };

  if (ai.title !== undefined) next.title = ai.title;
  if (ai.subtitle !== undefined) next.subtitle = ai.subtitle;
  if (ai.description !== undefined) next.description = ai.description;
  if (ai.buttonText !== undefined) next.buttonText = ai.buttonText;
  if (ai.timerText !== undefined) {
    next.timerText = ai.timerText;
    next.timerStateJson = undefined; // plain text is now the source of truth
  }

  if (ai.showTimer !== undefined) next.showTimer = ai.showTimer;
  if (ai.showButton !== undefined) next.showButton = ai.showButton;
  if (ai.startDate !== undefined) next.startDate = ai.startDate;
  if (ai.endDate !== undefined) next.endDate = ai.endDate;
  if (ai.ctaType !== undefined) next.ctaType = ai.ctaType;
  if (ai.buttonUrl !== undefined) next.buttonUrl = ai.buttonUrl;
  if (ai.whatsappNumber !== undefined) next.whatsappNumber = ai.whatsappNumber;

  const s = next.style;
  if (ai.cardPosition) s.position = ai.cardPosition;
  if (ai.cardBg) s.background = toGradient(ai.cardBg);
  if (ai.cardTextColor) s.textColor = ai.cardTextColor;

  if (ai.titleBg) s.titleStyle.background = toGradient(ai.titleBg);
  if (ai.titleTextColor) s.titleStyle.textColor = ai.titleTextColor;
  if (ai.titleAlign) s.titleStyle.textAlign = ai.titleAlign;

  if (ai.subtitleBg) s.subheadingStyle.background = toGradient(ai.subtitleBg);
  if (ai.subtitleTextColor) s.subheadingStyle.textColor = ai.subtitleTextColor;
  if (ai.subtitleAlign) s.subheadingStyle.textAlign = ai.subtitleAlign;

  if (ai.descriptionBg) s.descriptionStyle.background = toGradient(ai.descriptionBg);
  if (ai.descriptionTextColor) s.descriptionStyle.textColor = ai.descriptionTextColor;
  if (ai.descriptionAlign) s.descriptionStyle.textAlign = ai.descriptionAlign;

  if (ai.timerBg) s.dateStyle.background = toGradient(ai.timerBg);
  if (ai.timerTextColor) s.dateStyle.textColor = ai.timerTextColor;

  if (ai.buttonBg) s.buttonStyle.background = toGradient(ai.buttonBg);
  if (ai.buttonTextColor) s.buttonStyle.textColor = ai.buttonTextColor;
  if (ai.buttonAlign) s.buttonStyle.textAlign = ai.buttonAlign;

  return next;
}

// The instruction block appended to the ChatGPT prompt. It sets a senior
// content + design persona, runs a one-question-at-a-time interview, then emits
// exactly this schema.
export const AI_PROMO_SCHEMA_PROMPT = [
  'Act as my Head of Marketing and Design for an ecommerce promo card (a small',
  'floating widget on a website with a title, subtitle, description, a countdown',
  'timer, and a CTA button).',
  '',
  'Interview me ONE QUESTION AT A TIME — wait for my answer before the next one.',
  'Talk like a seasoned creative director in a relaxed working session — warm,',
  'confident, and human, in plain language. Show my progress: prefix every',
  'question with the step, like "Step 1 of 5", "Step 2 of 5", and so on, and',
  'briefly react to my previous answer before asking the next.',
  'The 5 steps, in order:',
  '1. The offer/goal and the product.',
  '2. The audience and the tone (bold, elegant, playful, urgent…).',
  '3. The campaign schedule — always ask for the start date AND end date',
  '   (YYYY-MM-DD); these are needed either way. Then, separately, ask whether',
  '   to SHOW a countdown timer or not — the timer is optional, the dates are not.',
  '4. The call to action — tell them the button is optional and can be skipped;',
  '   if they want one, get a WhatsApp number, a link, or plain text.',
  '5. The look: ask whether they want to pick the colors themselves or have you',
  '   choose a cohesive palette for them. If they pick, collect the overall card',
  '   background and the color feel for each section (title band, subtitle,',
  '   description, timer, button) plus text colors. If they leave it to you,',
  '   design a tasteful, on-brand palette yourself.',
  '',
  'Then write punchy, conversion-focused copy, at least as polished as a',
  'professional template. The card is SMALL, so keep copy tight so it never',
  'overflows: title = ONE short line, subtitle = at most 2 short lines,',
  'description = at most 3 short lines. Shorter is better; trim ruthlessly.',
  'The TITLE is the hook — write it like a top brand copywriter: creative,',
  'catchy, and distinctive (a clever angle, a bold promise, tasteful wordplay),',
  'never a flat, generic label. Give it real personality.',
  '',
  'ALWAYS fill the title, subtitle, and description — those three are required.',
  'Only the timer and the button (CTA) are OPTIONAL: include them when they help,',
  'and use "showTimer": false to drop the timer or "showButton": false to drop',
  'the button. Design for how the card LOOKS — clean and uncluttered.',
  '',
  "You may use light inline HTML in the copy: <strong>, <em>, and",
  "<span style='font-size:1.2rem'> or <span style='color:#hex'> — use SINGLE",
  'quotes for HTML attributes so the JSON stays valid.',
  '',
  'COLOR RULES (important): choose a cohesive, on-brand palette, and make every',
  'text color clearly readable against its OWN section background. If a section',
  "background is \"transparent\", its text sits on the CARD background — so give",
  'it strong contrast against the card, not the section. Never pick a text color',
  'that is the same as or close to whatever it sits on. Aim for bold, legible',
  'combinations like a real designer would.',
  '',
  'Any background (the card or any section) can be a flat color OR a gradient —',
  'linear or radial, with a direction like "to bottom right". Reach for gradients',
  'tastefully to add depth and a premium feel where it helps, not everywhere.',
  '',
  'Finally output ONLY one JSON object (no prose, no markdown fences) with any of',
  'these keys you have values for. Each *Bg can be a "#hex" or',
  '{ "from":"#hex", "to":"#hex", "direction":"to bottom right", "type":"linear|radial" }:',
  '{',
  '  "title","subtitle","description","buttonText","timerText" (put {timer} in it),',
  '  "showTimer":true,"showButton":true,',
  '  "startDate":"YYYY-MM-DD","endDate":"YYYY-MM-DD",',
  '  "ctaType":"whatsapp|link|text","buttonUrl":"https://…","whatsappNumber":"digits",',
  '  "cardPosition":"bottom-right|bottom-left|top-right|top-left",',
  '  "cardBg","cardTextColor":"#hex",',
  '  "titleBg","titleTextColor":"#hex","titleAlign":"left|center|right",',
  '  "subtitleBg","subtitleTextColor":"#hex","subtitleAlign":"…",',
  '  "descriptionBg","descriptionTextColor":"#hex","descriptionAlign":"…",',
  '  "timerBg","timerTextColor":"#hex",',
  '  "buttonBg","buttonTextColor":"#hex","buttonAlign":"…"',
  '}',
].join('\n');
