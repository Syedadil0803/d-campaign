import { $getRoot, $isTextNode } from 'lexical';
import { $isTimerChipNode } from './TimerChipNode';

/**
 * The adapter between the countdown's storage string and its Lexical document.
 *
 * Storage formats this can parse:
 *   - "prefix{timer}suffix"                              (token marker)
 *   - "prefix<span data-timer-fixed>...</span>suffix"     (rendered chip span)
 *   - free text                                          (all prefix)
 *
 * Storage format this emits: the token form, which buildTimerDisplayHtml
 * expands. Numbers are never written — they would be wrong a second later.
 */

const TIMER_TOKEN = '{timer}';

export function parseStorageHtml(html: string): { prefix: string; suffix: string } {
  if (!html) return { prefix: '', suffix: '' };

  if (html.includes(TIMER_TOKEN)) {
    const i = html.indexOf(TIMER_TOKEN);
    return {
      prefix: stripTags(html.slice(0, i)),
      suffix: stripTags(html.slice(i + TIMER_TOKEN.length)),
    };
  }

  const chipMatch = html.match(
    /^([\s\S]*?)<span\b[^>]*\bdata-timer-fixed\b[\s\S]*?<\/span>([\s\S]*)$/,
  );
  if (chipMatch) {
    return {
      prefix: stripTags(chipMatch[1]),
      suffix: stripTags(chipMatch[2]),
    };
  }

  return { prefix: stripTags(html), suffix: '' };
}

function stripTags(s: string): string {
  return s
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

export function serializeStorageHtml(): string {
  const root = $getRoot();
  const para = root.getFirstChild();
  if (!para || !('getChildren' in para)) return TIMER_TOKEN;

  let prefix = '';
  let suffix = '';
  let seenChip = false;
  (para as unknown as { getChildren: () => unknown[] })
    .getChildren()
    .forEach((c: unknown) => {
      if ($isTimerChipNode(c as never)) {
        seenChip = true;
        return;
      }
      if ($isTextNode(c as never)) {
        const tn = c as {
          getTextContent: () => string;
          getStyle: () => string;
        };
        // Strip zero-width spaces — these are only used transiently to give the
        // caret a place to sit next to the chip (see focus()); they must never
        // reach storage.
        const raw = tn.getTextContent().replace(/\u200B/g, "");
        if (!raw) return;
        const text = escapeHtml(raw);
        const style = tn.getStyle();
        // Emit a styled span so the preview's buildTimerDisplayHtml can
        // render the user's prefix/suffix styling. Plain text without
        // inline styles is emitted as raw text to keep storage small.
        const piece = style
          ? `<span style="${escapeAttr(style)}">${text}</span>`
          : text;
        if (seenChip) suffix += piece;
        else prefix += piece;
      }
    });

  return `${prefix}${TIMER_TOKEN}${suffix}`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeAttr(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}
