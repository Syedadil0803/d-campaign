/**
 * timerUtils.ts
 * 
 * Timer text manipulation functions for rich text editing.
 * Handles placeholder tokens, editor chrome, and storage format conversion.
 * 
 * Ported from Vue App.vue lines 1287–1424
 */

// ============================================================
// Constants
// ============================================================

export const TIMER_PLACEHOLDER_TOKENS = ['hhh', 'mmm', 'sss'] as const;

export const TIMER_EDITOR_COLOR_MAP: Record<string, string> = {
  hhh: 'background:#e0e7ff;color:#4338ca;border:1px solid #a5b4fc;',
  mmm: 'background:#dcfce7;color:#15803d;border:1px solid #86efac;',
  sss: 'background:#ffedd5;color:#c2410c;border:1px solid #fdba74;',
};

export const TIMER_EDITOR_BASE_STYLE = 'display:inline-block;padding:1px 4px;border-radius:4px;font-family:monospace;font-weight:600;cursor:default;user-select:all;-webkit-user-select:all;';

export const TIMER_SEP_STYLE = 'display:inline;user-select:none;-webkit-user-select:none;';

// ============================================================
// Timer Formatting Functions
// ============================================================

export interface TimerValue {
  hours: number;
  minutes: number;
  seconds: number;
  days?: number;
}

/**
 * Calculate remaining time between now and end date
 */
export function calculateTimeRemaining(endDate: string): TimerValue {
  const now = new Date();
  // A date-only value (YYYY-MM-DD) means the campaign runs through the whole of
  // that day, so count down to LOCAL end-of-day (23:59:59) using the device's
  // clock — otherwise a same-day end parses to midnight and shows 0.
  let end: Date;
  if (/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
    const [y, m, d] = endDate.split("-").map(Number);
    end = new Date(y, m - 1, d, 23, 59, 59, 999);
  } else {
    end = new Date(endDate);
  }
  const diff = end.getTime() - now.getTime();

  if (Number.isNaN(diff) || diff <= 0) {
    return { hours: 0, minutes: 0, seconds: 0, days: 0 };
  }

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diff % (1000 * 60)) / 1000);

  return { hours, minutes, seconds, days };
}

/**
 * Format timer text with placeholder replacements
 * Supports: {hh}, {h}, {mm}, {m}, {ss}, {s}, {ddd}, {dd}, {d}
 */
export function formatTimerText(template: string, timerValue: TimerValue): string {
  const { hours, minutes, seconds, days = 0 } = timerValue;
  const includesDayTokens = /\{ddd\}|\{dd\}|\{d\}/.test(template);
  const displayHours = includesDayTokens ? hours : (days * 24) + hours;

  return template
    // Days
    .replace(/\{ddd\}/g, days.toString().padStart(3, '0'))
    .replace(/\{dd\}/g, days.toString().padStart(2, '0'))
    .replace(/\{d\}/g, days.toString())
    // Hours
    .replace(/\{hhh\}/g, displayHours.toString().padStart(3, '0'))
    .replace(/\{hh\}/g, displayHours.toString().padStart(2, '0'))
    .replace(/\{h\}/g, displayHours.toString())
    // Minutes
    .replace(/\{mmm\}/g, minutes.toString().padStart(3, '0'))
    .replace(/\{mm\}/g, minutes.toString().padStart(2, '0'))
    .replace(/\{m\}/g, minutes.toString())
    // Seconds
    .replace(/\{sss\}/g, seconds.toString().padStart(3, '0'))
    .replace(/\{ss\}/g, seconds.toString().padStart(2, '0'))
    .replace(/\{s\}/g, seconds.toString());
  }

/**
 * Normalize a timer template to the plain token string used by the input box.
 * Supports legacy HTML templates that wrap placeholders in span tags.
 */
export function normalizeTimerTemplate(template?: string): string {
  if (!template) return '';

  return template
    .replace(/<span[^>]*data-timer-placeholder="hhh"[^>]*>.*?<\/span>/gi, '{hh}')
    .replace(/<span[^>]*data-timer-placeholder="mmm"[^>]*>.*?<\/span>/gi, '{mm}')
    .replace(/<span[^>]*data-timer-placeholder="sss"[^>]*>.*?<\/span>/gi, '{ss}')
    .replace(/<span[^>]*data-timer-placeholder="ddd"[^>]*>.*?<\/span>/gi, '{d}')
    .replace(/<span[^>]*data-timer-placeholder="dd"[^>]*>.*?<\/span>/gi, '{d}')
    .replace(/<span[^>]*data-timer-placeholder="d"[^>]*>.*?<\/span>/gi, '{d}')
    .trim();
}

/**
 * Get preview timer text for templates (shows sample values)
 */
export function getTemplateTimerPreviewText(timerText?: string): string {
  const sampleValue = { hours: 24, minutes: 18, seconds: 7, days: 2 };
  const template = normalizeLegacyTimerTokens(timerText || 'Ends in {timer}');
  // New fixed-block templates: swap the {timer} marker for sample countdown words.
  if (template.includes(TIMER_FIXED_TOKEN)) {
    return template.split(TIMER_FIXED_TOKEN).join(formatCountdownWords(sampleValue));
  }
  // Legacy token templates fallback.
  return formatTimerText(template, sampleValue);
}

/**
 * Check if timer should be active based on dates
 */
export function isTimerActive(startDate?: string, endDate?: string): boolean {
  if (!endDate) return false;

  const now = new Date();
  // Date-only values cover the whole day: start from 00:00:00, end at
  // 23:59:59.999 — so the final day is inclusive and back-to-back campaigns
  // (one ending day X, next starting day X+1 at 00:00) are seamless.
  const start = startDate ? new Date(startDate) : new Date(0);
  start.setHours(0, 0, 0, 0);
  const end = new Date(endDate);
  end.setHours(23, 59, 59, 999);

  return now >= start && now <= end;
}

/**
 * Strip inline font-size and color styles from timer HTML.
 * This ensures dateStyle settings take precedence over editor inline styles.
 */
export function stripTimerInlineStyles(html: string): string {
  if (!html) return '';
  
  // Remove font-size and color from style attributes while preserving other styles
  return html
    .replace(/style="([^"]*)"/gi, (match, styles) => {
      // Remove font-size and color properties, keep others
      const cleaned = styles
        .split(';')
        .filter((s: string) => {
          const prop = s.split(':')[0].trim().toLowerCase();
          return prop !== 'font-size' && prop !== 'color';
        })
        .join(';')
        .trim();
      return cleaned ? `style="${cleaned}"` : '';
    })
    .replace(/\s+>/g, '>')  // Clean up extra spaces before >
    .replace(/\s+/g, ' ');   // Normalize whitespace
}

/**
 * Get timer placeholder elements for rich text editing
 */
export function getTimerPlaceholders(): Array<{ placeholder: string; description: string }> {
  return [
    { placeholder: '{hhh}', description: 'Hours (3-digit, e.g., 001)' },
    { placeholder: '{hh}', description: 'Hours (2-digit, e.g., 01)' },
    { placeholder: '{h}', description: 'Hours (no padding, e.g., 1)' },
    { placeholder: '{mmm}', description: 'Minutes (3-digit, e.g., 001)' },
    { placeholder: '{mm}', description: 'Minutes (2-digit, e.g., 01)' },
    { placeholder: '{m}', description: 'Minutes (no padding, e.g., 1)' },
    { placeholder: '{sss}', description: 'Seconds (3-digit, e.g., 001)' },
    { placeholder: '{ss}', description: 'Seconds (2-digit, e.g., 01)' },
    { placeholder: '{s}', description: 'Seconds (no padding, e.g., 1)' },
    { placeholder: '{ddd}', description: 'Days (3-digit, e.g., 001)' },
    { placeholder: '{dd}', description: 'Days (2-digit, e.g., 01)' },
    { placeholder: '{d}', description: 'Days (no padding, e.g., 1)' }
  ];
}

// ============================================================
// Core Functions
// ============================================================

/**
 * Get default timer storage HTML with placeholder tokens
 * Returns: 'Ends in <span data-timer-placeholder="hhh">hh</span>:<span data-timer-placeholder="mmm">mm</span>:<span data-timer-placeholder="sss">ss</span>'
 */
export function getDefaultTimerStorageHTML(): string {
  return `Ends in <span data-timer-placeholder="hhh">hh</span>:<span data-timer-placeholder="mmm">mm</span>:<span data-timer-placeholder="sss">ss</span>`;
}

/**
 * Strip editor visual chrome from HTML, keep only user formatting.
 * For saving to config.
 * 
 * @param editorHTML - HTML content from the editor
 * @returns Cleaned HTML suitable for storage
 */
export function cleanTimerForStorage(editorHTML: string): string {
  if (!editorHTML) return '';
  
  const parser = new DOMParser();
  const doc = parser.parseFromString(`<div>${editorHTML}</div>`, 'text/html');
  const container = doc.body.firstElementChild as HTMLElement;

  if (!container) return '';

  // Clean placeholder spans: keep only user-applied styles
  container.querySelectorAll('[data-timer-placeholder]').forEach(el => {
    const htmlEl = el as HTMLElement;
    htmlEl.removeAttribute('contenteditable');
    
    // Extract user-applied formatting
    const userFontSize = htmlEl.style.fontSize || '1rem'; // default to md (1rem)
    const userFontWeight = htmlEl.style.fontWeight;
    const userFontStyle = htmlEl.style.fontStyle;
    const userColor = htmlEl.style.color;
    
    // Build minimal style with only user formatting (always include font-size)
    let style = `font-size:${userFontSize};`;
    
    // font-weight: 600 is our editor default, bold/700 is user-applied
    if (userFontWeight && userFontWeight !== '600' && userFontWeight !== 'normal') {
      style += `font-weight:${userFontWeight};`;
    }
    if (userFontStyle && userFontStyle !== 'normal') style += `font-style:${userFontStyle};`;
    if (userColor) style += `color:${userColor};`;
    
    htmlEl.setAttribute('style', style);
  });

  // Unwrap separator spans into plain text
  container.querySelectorAll('[data-timer-separator]').forEach(el => {
    const text = doc.createTextNode(el.textContent || '');
    el.replaceWith(text);
  });

  return container.innerHTML;
}

/**
 * Add editor visual chrome to stored HTML.
 * For loading into the editor.
 * 
 * @param storedHTML - HTML from config storage
 * @returns HTML with editor chrome applied
 */
export function buildTimerEditorHTML(storedHTML: string): string {
  if (!storedHTML || !storedHTML.includes('data-timer-placeholder')) {
    return buildTimerEditorHTML(getDefaultTimerStorageHTML());
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(`<div>${storedHTML}</div>`, 'text/html');
  const container = doc.body.firstElementChild as HTMLElement;

  if (!container) return '';

  // Add editor chrome to placeholder spans
  container.querySelectorAll('[data-timer-placeholder]').forEach(el => {
    const htmlEl = el as HTMLElement;
    const token = htmlEl.getAttribute('data-timer-placeholder')!;
    
    htmlEl.setAttribute('contenteditable', 'false');
    
    // Preserve user formatting on top of editor base styles
    const userFontSize = htmlEl.style.fontSize || '1rem'; // default to md (1rem)
    const userFontWeight = htmlEl.style.fontWeight || '';
    const userFontStyle = htmlEl.style.fontStyle || '';
    const userColor = htmlEl.style.color || '';
    
    let style = (TIMER_EDITOR_COLOR_MAP[token] || '') + TIMER_EDITOR_BASE_STYLE;
    style += `font-size:${userFontSize};`;
    if (userFontWeight) style += `font-weight:${userFontWeight};`;
    if (userFontStyle) style += `font-style:${userFontStyle};`;
    if (userColor) style += `color:${userColor};`;
    
    htmlEl.setAttribute('style', style);
  });

  // Wrap ':' characters in direct text nodes with separator spans
  const walker = doc.createTreeWalker(container, NodeFilter.SHOW_TEXT, null);
  const textNodes: Text[] = [];
  let textNode: Text | null;
  
  while ((textNode = walker.nextNode() as Text | null)) {
    // Only process direct children of the container
    if (textNode.parentNode === container && textNode.textContent && textNode.textContent.includes(':')) {
      textNodes.push(textNode);
    }
  }
  
  for (const tn of textNodes) {
    const parts = tn.textContent!.split(':');
    if (parts.length > 1) {
      const fragment = doc.createDocumentFragment();
      parts.forEach((part, i) => {
        if (part) fragment.appendChild(doc.createTextNode(part));
        if (i < parts.length - 1) {
          const sep = doc.createElement('span');
          sep.setAttribute('data-timer-separator', '');
          sep.setAttribute('contenteditable', 'false');
          sep.setAttribute('style', TIMER_SEP_STYLE);
          sep.textContent = ':';
          fragment.appendChild(sep);
        }
      });
      tn.replaceWith(fragment);
    }
  }

  return container.innerHTML;
}

/**
 * Ensure all timer placeholders are present in the HTML.
 * Auto-repairs missing placeholders and separators.
 * 
 * @param html - HTML content to check/repair
 * @returns HTML with all placeholders guaranteed
 */
export function ensureTimerPlaceholders(html: string): string {
  // If all three placeholders and separators are present, return as-is
  const hasAllPlaceholders = TIMER_PLACEHOLDER_TOKENS.every(t => 
    html.includes(`data-timer-placeholder="${t}"`)
  );
  const hasSeparators = html.includes('data-timer-separator');
  
  if (hasAllPlaceholders && hasSeparators) return html;
  
  // Re-inject any missing placeholders
  // First clean to storage format, then rebuild editor HTML to fix consistency
  const cleaned = cleanTimerForStorage(html);
  
  // Re-inject missing tokens
  let result = cleaned;
  const missing: string[] = [];
  
  for (const token of TIMER_PLACEHOLDER_TOKENS) {
    if (!result.includes(`data-timer-placeholder="${token}"`)) {
      missing.push(token);
    }
  }
  
  if (missing.length > 0) {
    for (let i = 0; i < missing.length; i++) {
      if (i > 0 || result.trim().length > 0) result += ':';
      const displayText: Record<string, string> = { 
        hhh: 'hh', 
        mmm: 'mm', 
        sss: 'ss' 
      };
      result += `<span data-timer-placeholder="${missing[i]}" style="font-size:1rem;">${displayText[missing[i]] || missing[i]}</span>`;
    }
  }
  
  // Rebuild editor HTML from the fixed storage format
  return buildTimerEditorHTML(result);
}

// ============================================================
// Helper Functions
// ============================================================

// ============================================================
// Fixed (non-editable) countdown block — prefix/suffix model
// ============================================================

/** Single marker representing the whole fixed "X days : Y hours : Z mins" block. */
export const TIMER_FIXED_TOKEN = '{timer}';

/** Format the fixed center block, e.g. "3 days : 4 hours : 12 mins". Dashes if invalid. */
export function formatCountdownWords(timerValue: TimerValue): string {
  const { hours, minutes, seconds, days = 0 } = timerValue;
  if ([hours, minutes, seconds, days].some(Number.isNaN)) {
    return '-- days : -- hours : -- mins';
  }
  return `${days} days : ${hours} hours : ${minutes} mins`;
}

/** Collapse a legacy {hh}:{mm}:{ss}/{d} token run into a single {timer} marker. */
export function normalizeLegacyTimerTokens(text: string): string {
  if (!text || text.includes(TIMER_FIXED_TOKEN)) return text;
  if (!/\{(?:d{1,3}|h{1,3}|m{1,3}|s{1,3})\}/i.test(text)) return text;
  return text.replace(
    /(\{(?:d{1,3}|h{1,3}|m{1,3}|s{1,3})\}\s*[:：·\-]?\s*)+/gi,
    TIMER_FIXED_TOKEN,
  );
}

// User-applied style props that should survive on the fixed chip. Layout-only
// props (white-space, user-select) are editor chrome and are stripped on save.
const TIMER_USER_STYLE_PROPS = [
  'color',
  'font-size',
  'font-weight',
  'font-style',
  'text-decoration',
  'text-decoration-line',
  'background',
  'background-color',
];

function filterStyle(style: string, keep: string[]): string {
  return (style || '')
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean)
    .filter((s) => keep.includes(s.split(':')[0].trim().toLowerCase()))
    .join('; ');
}

/** Keep only user-applied styles (color/size/weight/etc.) for storage. */
function keepUserStyles(style: string): string {
  return filterStyle(style, TIMER_USER_STYLE_PROPS);
}

/** Editor display style for the chip: user styles + layout chrome. Selectable. */
function chipDisplayStyle(userStyle: string): string {
  const user = keepUserStyles(userStyle);
  return `${user ? user + '; ' : ''}white-space:nowrap;user-select:text;-webkit-user-select:text;`;
}

/** The numeric segments inside the fixed block, keyed for live updates. */
export const TIMER_VALUE_KINDS = ['days', 'hours', 'mins'] as const;

function timerSegmentText(kind: string, v: TimerValue): string {
  const bad = [v.hours, v.minutes, v.seconds, v.days ?? 0].some(Number.isNaN);
  if (bad) return '--';
  if (kind === 'days') return String(v.days ?? 0);
  if (kind === 'hours') return String(v.hours);
  return String(v.minutes);
}

/**
 * Inner HTML for the fixed block: each number and each word is its own
 * selectable span, so the user can style a single word independently.
 * Value spans are tagged data-timer-val for live updates.
 */
function chipInnerHtml(v: TimerValue): string {
  const ut = 'user-select:text;-webkit-user-select:text;';
  const val = (kind: string) =>
    `<span data-timer-val="${kind}" style="${ut}">${timerSegmentText(kind, v)}</span>`;
  const lab = (t: string) => `<span data-timer-word style="${ut}">${t}</span>`;
  return (
    val('days') +
    lab(' days ') +
    lab(': ') +
    val('hours') +
    lab(' hours ') +
    lab(': ') +
    val('mins') +
    lab(' mins')
  );
}

/** Refresh only the numeric segments in place (keeps per-word styles + caret). */
export function refreshTimerValueSpans(rootEl: HTMLElement, v: TimerValue): void {
  rootEl.querySelectorAll('[data-timer-val]').forEach((el) => {
    const kind = el.getAttribute('data-timer-val') || '';
    const t = timerSegmentText(kind, v);
    if (el.textContent !== t) el.textContent = t;
  });
}

/**
 * Build editor/preview HTML: the user's prefix/suffix HTML with the fixed
 * countdown block injected where the {timer} marker is. The block is
 * non-editable but SELECTABLE, and is split into per-word spans so each
 * word/number can be styled independently; existing per-word styles and the
 * block's live numbers are preserved. If no block exists, one is appended.
 */
export function buildTimerDisplayHtml(storedHtml: string, timerValue: TimerValue): string {
  let html = normalizeLegacyTimerTokens(storedHtml || '');
  if (!html.includes(TIMER_FIXED_TOKEN) && !/data-timer-fixed/i.test(html)) {
    html = (html ? html + ' ' : '') + TIMER_FIXED_TOKEN;
  }

  if (typeof DOMParser === 'undefined') {
    const chip =
      `<span data-timer-fixed contenteditable="false" style="white-space:nowrap;">` +
      `${chipInnerHtml(timerValue)}</span>`;
    return html.split(TIMER_FIXED_TOKEN).join(chip);
  }

  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html');
  const root = doc.body.firstElementChild as HTMLElement;
  if (!root) return html;

  // Existing blocks: keep per-word styles, refresh numbers (or build structure
  // if it's an old flat chip).
  root.querySelectorAll('[data-timer-fixed]').forEach((el) => {
    const chip = el as HTMLElement;
    chip.setAttribute('contenteditable', 'false');
    chip.setAttribute('style', chipDisplayStyle(chip.getAttribute('style') || ''));
    if (!chip.querySelector('[data-timer-val]')) {
      chip.innerHTML = chipInnerHtml(timerValue);
    } else {
      refreshTimerValueSpans(chip, timerValue);
    }
  });

  // Bare {timer} markers in text nodes → fresh structured blocks.
  const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
  const hits: Text[] = [];
  let n: Text | null;
  while ((n = walker.nextNode() as Text | null)) {
    if (n.textContent && n.textContent.includes(TIMER_FIXED_TOKEN)) hits.push(n);
  }
  hits.forEach((tn) => {
    const parts = (tn.textContent || '').split(TIMER_FIXED_TOKEN);
    const frag = doc.createDocumentFragment();
    parts.forEach((part, i) => {
      if (part) frag.appendChild(doc.createTextNode(part));
      if (i < parts.length - 1) {
        const chip = doc.createElement('span');
        chip.setAttribute('data-timer-fixed', '');
        chip.setAttribute('contenteditable', 'false');
        chip.setAttribute('style', 'white-space:nowrap;');
        chip.innerHTML = chipInnerHtml(timerValue);
        frag.appendChild(chip);
      }
    });
    tn.replaceWith(frag);
  });

  // Wrap the text before/after the (first) block into editable slot spans so
  // each side can show its own ":empty" placeholder. Slots are stripped on save.
  const firstChip = root.querySelector('[data-timer-fixed]');
  if (firstChip) {
    const prefix = doc.createElement('span');
    prefix.setAttribute('data-timer-prefix', '');
    while (root.firstChild && root.firstChild !== firstChip) {
      prefix.appendChild(root.firstChild);
    }
    root.insertBefore(prefix, firstChip);

    const suffix = doc.createElement('span');
    suffix.setAttribute('data-timer-suffix', '');
    while (firstChip.nextSibling) {
      suffix.appendChild(firstChip.nextSibling);
    }
    root.appendChild(suffix);
  }

  return root.innerHTML;
}

/**
 * Serialize editor HTML back to storage: keep the fixed block (its per-word
 * structure + user styles, so styling persists), ensure exactly one exists
 * (re-inject if deleted — keeps it undeletable), keep prefix/suffix HTML.
 * Numeric values are blanked so storage doesn't churn every second.
 */
export function serializeTimerHtml(editorHtml: string): string {
  const html = normalizeLegacyTimerTokens(editorHtml || '');

  if (typeof DOMParser === 'undefined') return html || TIMER_FIXED_TOKEN;

  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html');
  const root = doc.body.firstElementChild as HTMLElement;
  if (!root) return TIMER_FIXED_TOKEN;

  // Unwrap editor-only prefix/suffix slot spans back to flat content.
  root.querySelectorAll('[data-timer-prefix],[data-timer-suffix]').forEach((slot) => {
    const parent = slot.parentNode;
    if (!parent) return;
    while (slot.firstChild) parent.insertBefore(slot.firstChild, slot);
    parent.removeChild(slot);
  });

  let seen = false;
  root.querySelectorAll('[data-timer-fixed]').forEach((el) => {
    const chip = el as HTMLElement;
    if (seen) {
      chip.remove(); // dedupe
      return;
    }
    seen = true;
    chip.removeAttribute('contenteditable');
    const cleaned = keepUserStyles(chip.getAttribute('style') || '');
    if (cleaned) chip.setAttribute('style', cleaned);
    else chip.removeAttribute('style');
    // Blank the live numbers (build refreshes them) to keep storage stable.
    chip.querySelectorAll('[data-timer-val]').forEach((v) => {
      v.textContent = '';
    });
  });

  const hasChip = !!root.querySelector('[data-timer-fixed]');
  if (hasChip) {
    // A chip is the canonical block — strip any leftover bare {timer} markers
    // so buildTimerDisplayHtml doesn't render a SECOND block from them.
    const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
    const markerNodes: Text[] = [];
    let tn: Text | null;
    while ((tn = walker.nextNode() as Text | null)) {
      if (tn.textContent && tn.textContent.includes(TIMER_FIXED_TOKEN)) {
        markerNodes.push(tn);
      }
    }
    markerNodes.forEach((t) => {
      t.textContent = (t.textContent || '').split(TIMER_FIXED_TOKEN).join('');
    });
  } else if (!root.innerHTML.includes(TIMER_FIXED_TOKEN)) {
    // No block at all (neither a chip nor a {timer} marker) → append a fresh
    // one so the countdown always exists (undeletable). A bare {timer} marker
    // is left as-is; build will turn it into a single chip.
    const chip = doc.createElement('span');
    chip.setAttribute('data-timer-fixed', '');
    chip.innerHTML = chipInnerHtml({ hours: 0, minutes: 0, seconds: 0, days: 0 });
    chip.querySelectorAll('[data-timer-val]').forEach((v) => {
      v.textContent = '';
    });
    if (root.lastChild) root.appendChild(doc.createTextNode(' '));
    root.appendChild(chip);
  }

  return root.innerHTML;
}

/**
 * Check if HTML contains timer placeholders
 * @param html - HTML to check
 * @returns true if timer placeholders are present
 */
export function hasTimerPlaceholders(html: string): boolean {
  return TIMER_PLACEHOLDER_TOKENS.some(t => html.includes(`data-timer-placeholder="${t}"`));
}

/**
 * Extract timer placeholder values from HTML
 * @param html - HTML containing timer placeholders
 * @returns Object with hh, mm, ss values
 */
export function extractTimerValues(html: string): { hh: string; mm: string; ss: string } {
  const parser = new DOMParser();
  const doc = parser.parseFromString(`<div>${html}</div>`, 'text/html');
  const container = doc.body.firstElementChild as HTMLElement;
  
  const result = { hh: 'hh', mm: 'mm', ss: 'ss' };
  
  if (container) {
    const hhEl = container.querySelector('[data-timer-placeholder="hhh"]');
    const mmEl = container.querySelector('[data-timer-placeholder="mmm"]');
    const ssEl = container.querySelector('[data-timer-placeholder="sss"]');
    
    if (hhEl) result.hh = hhEl.textContent || 'hh';
    if (mmEl) result.mm = mmEl.textContent || 'mm';
    if (ssEl) result.ss = ssEl.textContent || 'ss';
  }
  
  return result;
}
