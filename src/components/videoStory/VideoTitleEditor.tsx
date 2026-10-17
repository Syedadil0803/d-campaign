'use client';

import { useEffect, type ClipboardEvent, type KeyboardEvent } from 'react';
import { Palette } from 'lucide-react';
import { longestFittingPrefix } from '@/lib/editor/richTextFormats';
import { titleOverflows } from '@/lib/videoStory/videoTitle';
import { TEXT_LIMIT } from '@/components/videoStory/useVideoTitleEditing';
import { useVideoStory } from '@/components/videoStory/VideoStoryContext';
import { CharCount } from '@/components/promo/CharCount';
import { PALETTE_BTN, richFieldBox } from '@/components/promo/fieldStyles';

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
/** The title box on the left: the label row with the style popup's palette, the editor and the counter. */
export function VideoTitleEditor() {
  const { videoStory: vs, title, closeOtherPopups } = useVideoStory();
  const { ref, commit, lastValid, styleOpen, setStyleOpen, refresh, warn } = title;
  const value = vs.title ?? '';

  // Load the stored title, and any change made elsewhere (Start Fresh, a
  // restored draft); never while it already matches, so the caret stays put.
  useEffect(() => {
    const el = ref.current;
    if (el && el.innerHTML !== value) {
      el.innerHTML = value;
      lastValid.current = value;
    }
  }, [value, ref, lastValid]);

  // One paragraph: Enter would start a third line the widget can't show.
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter') e.preventDefault();
  };

  // Pasted text comes in plain and only as much as fits in two lines, found
  // the way the Smart Card's smartPaste does: the longest start that fits.
  const onPaste = (e: ClipboardEvent<HTMLDivElement>) => {
    e.preventDefault();
    const text = e.clipboardData.getData('text/plain').replace(/\s+/g, ' ');
    const current = ref.current?.innerHTML ?? '';
    const best = longestFittingPrefix(text, (prefix) => !titleOverflows(current + prefix));
    if (best > 0) document.execCommand('insertText', false, text.slice(0, best));
    if (best < text.length) warn(TEXT_LIMIT);
  };

  const open = () => { closeOtherPopups(); setStyleOpen(true); refresh(); };

  return (
    <div className="!mt-5">
      <div className="flex items-center justify-between gap-3">
        <label htmlFor="vs-title" className="text-base font-semibold text-on-surface" onClick={() => ref.current?.focus()}>
          Title on video
        </label>
        {/* Opens the style popup on the preview, as the Smart Card's fields do.
            mousedown keeps the caret or selection in the title; click is what
            a keyboard's Enter / Space sends. */}
        <button
          type="button"
          onMouseDown={(e) => { e.preventDefault(); open(); }}
          onClick={open}
          aria-expanded={styleOpen}
          className={PALETTE_BTN}
          title="Open title style"
          aria-label="Open title style"
        >
          <Palette className="h-3.5 w-3.5" />
        </button>
      </div>
      <p className="mb-3 mt-1 text-sm text-on-surface-variant">Shown at the top, up to 2 lines.</p>
      {/* The same box as the Smart Card's title, subtitle and description:
          plain text here, the formatting shows on the video. */}
      <div
        id="vs-title"
        ref={ref}
        role="textbox"
        aria-label="Title on video"
        aria-multiline="false"
        contentEditable
        suppressContentEditableWarning
        data-own-undo
        data-placeholder="Add a short title"
        onInput={commit}
        onKeyDown={onKeyDown}
        onKeyUp={refresh}
        onMouseUp={refresh}
        onPaste={onPaste}
        // The Smart Card fields' own box (PromoTextField): same classes, padding and plain look.
        className={richFieldBox(styleOpen)}
        style={{ paddingTop: '10px', paddingBottom: '10px' }}
      />
      <CharCount html={vs.title} />
    </div>
  );
}
