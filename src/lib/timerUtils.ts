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
  const end = new Date(endDate);
  const diff = end.getTime() - now.getTime();

  if (diff <= 0) {
    return { hours: 0, minutes: 0, seconds: 0 };
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

  return template
    // Days
    .replace(/\{ddd\}/g, days.toString().padStart(3, '0'))
    .replace(/\{dd\}/g, days.toString().padStart(2, '0'))
    .replace(/\{d\}/g, days.toString())
    // Hours
    .replace(/\{hhh\}/g, hours.toString().padStart(3, '0'))
    .replace(/\{hh\}/g, hours.toString().padStart(2, '0'))
    .replace(/\{h\}/g, hours.toString())
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
 * Get preview timer text for templates (shows sample values)
 */
export function getTemplateTimerPreviewText(timerText?: string): string {
  const template = timerText || 'Ends in <strong>{h}h</strong> {mm}m {ss}s';
  const sampleValue = { hours: 24, minutes: 18, seconds: 7, days: 2 };
  
  return formatTimerText(template, sampleValue);
}

/**
 * Check if timer should be active based on dates
 */
export function isTimerActive(startDate?: string, endDate?: string): boolean {
  if (!endDate) return false;
  
  const now = new Date();
  const start = startDate ? new Date(startDate) : new Date(0);
  const end = new Date(endDate);
  
  return now >= start && now <= end;
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
