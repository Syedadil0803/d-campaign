'use client';

import { useRef, useState } from 'react';
import { useRichTextEditor } from '@/hooks/useRichTextEditor';
import { hexToRgbValues, rgbToHex } from '@/lib/editor/colorUtils';
import { applyToWholeField, toggleWholeStyle } from '@/lib/editor/richTextFormats';
import { readFormatsFromHtml } from '@/lib/editor/readFormatsFromHtml';
import { hasVisibleContent, selectionIsInsideEditor } from '@/lib/promo/promoEditorSelection';
import { titleOverflows, VIDEO_TITLE_LOOK } from '@/lib/videoStory/videoTitle';
import type { VideoStory } from '@/types/campaign';

/**
 * The Video Story title's editing: one contentEditable with its own
 * formatting engine (useRichTextEditor), shared by the box on the left and
 * the style popup on the preview (the same PromoFieldStylePanel the Smart
 * Card's fields open). It writes only to videoStory.title, so it can never
 * touch the Smart Card's fields.
 *
 * The limit is two lines on the video (titleOverflows), with no character
 * count, as on the Smart Card's subtitle. An edit or a style that would pass
 * it is undone on the spot, with the Smart Card's warning.
 */
/** The Smart Card's two "limit reached" messages, the first for a style, the second for text. */
const STYLE_LIMIT = 'This style exceeds the field limit — try a smaller size or shorter text';
export const TEXT_LIMIT = 'This text exceeds the field limit — shorten it to fit 2 lines';

export function useVideoTitleEditing(
  vs: VideoStory,
  update: (patch: Partial<VideoStory>) => void,
  /** Shows the warning in the style popup, the same box the Smart Card uses. */
  warn: (message: string) => void,
) {
  const ref = useRef<HTMLDivElement>(null);
  const look = VIDEO_TITLE_LOOK[vs.titleColor === 'black' ? 'black' : 'white'];
  const rich = useRichTextEditor(ref, { defaultColor: look.color });
  const [styleOpen, setStyleOpen] = useState(false);
  const lastValid = useRef(vs.title ?? '');
  // Set while a style is being applied, so a refusal says "style", not "text".
  const styling = useRef(false);

  /**
   * Saves the editor's HTML, or puts back the last version within the limits
   * (two lines on the video), as the Smart Card's
   * onFieldInput does, with its warning.
   */
  function commit() {
    const el = ref.current;
    if (!el) return;
    let html = el.innerHTML;
    if (!hasVisibleContent(html)) html = '';
    if (titleOverflows(html)) {
      el.innerHTML = lastValid.current;
      const sel = window.getSelection();
      sel?.selectAllChildren(el);
      sel?.collapseToEnd();
      warn(styling.current ? STYLE_LIMIT : TEXT_LIMIT);
      return;
    }
    lastValid.current = html;
    update({ title: html });
  }

  /** The toolbar's state: the selection's formats, or the whole title's when nothing is selected. */
  function refresh() {
    const el = ref.current;
    if (!el) return;
    if (selectionIsInsideEditor(el)) rich.detectFormats();
    else rich.setActiveFormats(readFormatsFromHtml(el.innerHTML, look.color));
  }

  /** The whole title, through the same helper as the Smart Card's applyPromoFormatToAll. */
  function applyToAll(action: () => void) {
    if (applyToWholeField(ref.current!, rich.saveSelection, action, commit)) refresh();
  }

  /**
   * The browser's bold and italic commands decide on or off from how the text
   * looks. The box's plain look (promo-standard-editor) shows everything as
   * normal weight, so the command would add bold to bold text instead of
   * removing it. The plain look is dropped for the command and put straight
   * back.
   */
  function formatText(f: string) {
    const el = ref.current;
    if (!el || (f !== 'bold' && f !== 'italic')) return rich.formatText(f);
    el.classList.remove('promo-standard-editor');
    try {
      rich.formatText(f);
    } finally {
      el.classList.add('promo-standard-editor');
    }
  }

  const hasText = () => !!ref.current?.textContent?.replace(/\u200B/g, '').trim();

  /**
   * Bold, italic and size, step for step as the Smart Card's
   * handlePromoToolbarFormat: the selection when there is one; otherwise the
   * whole title, with bold and italic switched by toggleWholeStyle (the
   * browser command alone flips a half-bold title the wrong way); with no
   * text yet, only the toolbar state, ready for typing.
   */
  function format(f: string) {
    styling.current = true;
    try {
      formatNow(f);
    } finally {
      styling.current = false;
    }
  }

  function formatNow(f: string) {
    const el = ref.current;
    if (!el) return;
    if (selectionIsInsideEditor(el)) {
      rich.saveSelection();
      formatText(f);
      commit();
      setTimeout(refresh, 0);
      return;
    }
    if (hasText()) {
      if (f === 'bold' || f === 'italic') {
        // Read from the title itself, not the toolbar state, which can still
        // show the last selected word: on unless every letter already has it.
        const now = readFormatsFromHtml(el.innerHTML, look.color);
        const enable = f === 'bold' ? !now.bold : !now.italic;
        applyToAll(() => toggleWholeStyle(el, f, enable, formatText));
      } else {
        applyToAll(() => formatText(f));
      }
      return;
    }
    if (f.startsWith('size-')) rich.setActiveFormats((p) => ({ ...p, size: f.replace('size-', '') }));
    else if (f === 'bold') rich.setActiveFormats((p) => ({ ...p, bold: !p.bold }));
    else if (f === 'italic') rich.setActiveFormats((p) => ({ ...p, italic: !p.italic }));
  }

  /**
   * Colour, as the Smart Card's handlePromoToolbarColor. Given to the whole
   * title, it also picks the soft shade behind it: a light colour gets the
   * dark wash, a dark colour the light one, so the title stays readable on
   * any footage without a separate setting.
   */
  function color(c: string) {
    styling.current = true;
    try {
      colorNow(c);
    } finally {
      styling.current = false;
    }
  }

  function colorNow(c: string) {
    const el = ref.current;
    if (!el) return;
    if (selectionIsInsideEditor(el)) {
      rich.saveSelection();
      rich.applyColor(c);
      commit();
      setTimeout(refresh, 0);
      return;
    }
    if (hasText()) {
      applyToAll(() => rich.applyColor(c));
      const { r, g, b } = hexToRgbValues(c.startsWith('rgb') ? rgbToHex(c) : c);
      update({ titleColor: 0.299 * r + 0.587 * g + 0.114 * b > 140 ? 'white' : 'black' });
    }
    rich.setActiveFormats((p) => ({ ...p, color: c }));
  }

  return { ref, rich, styleOpen, setStyleOpen, commit, lastValid, format, color, refresh, warn };
}

