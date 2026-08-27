'use client';

import type { KeyboardEvent, RefObject } from 'react';
import type { CampaignConfig, GradientStyle } from '@/types/campaign';
import { STYLE_KEY_MAP } from '@/lib/promo/promoStyleKeys';
import { getBackgroundStyle } from '@/lib/utils';

type TextField = 'title' | 'subtitle' | 'description';

interface PromoPreviewTextFieldProps {
  field: TextField;
  /**
   * The editor element's ref, owned by PromoSection. Never create one here —
   * the per-field line limit reads the element through those refs and stops
   * measuring when they are null. See PromoTextField for the full note.
   */
  editorRef: RefObject<HTMLDivElement | null>;
  placeholder: string;
  /** Whether the field has words in it — decides the type scale. */
  hasContent: boolean;
  /** Type scale while the field is still empty. */
  emptyClassName: string;
  marginClassName: string;
  defaultAlign: 'left' | 'center' | 'right';

  config: CampaignConfig;
  blankStart: boolean;
  currentField: string | null;
  /** The field's own background, already resolved by the caller. */
  background: GradientStyle;

  activeEditorRef: RefObject<HTMLDivElement | null>;
  setShowCardBgPopup: (open: boolean) => void;
  setStylePopupAnchor: (anchor: 'card' | 'input') => void;
  setCurrentField: (field: TextField) => void;
  refreshPromoToolbarFormats: (editor: HTMLDivElement | null) => void;
  onFieldInput: (field: TextField) => void;
  onPromoPreviewKeyDown: (e: KeyboardEvent<HTMLDivElement>) => void;
}

/**
 * One of the three text fields as it appears ON the card.
 *
 * The panel's copy of these is PromoTextField; this is the preview's, which
 * behaves differently enough to stay separate — it is click-to-select rather
 * than click-to-type, refuses paste and drops, and hides its caret.
 *
 * The placeholder names the region rather than saying "Enter text here". The
 * card was rendering as a bare white box: these fields are always present so
 * the shape stays visible, but with nothing in them and no placeholder
 * attribute the CSS resolved attr(data-placeholder) to an empty string and
 * drew nothing — the skeleton existed and was invisible. Each names what
 * belongs there, because someone who is not a designer looking at an empty
 * card needs to know what to print, not to be told three times that text goes
 * in.
 */
export function PromoPreviewTextField({
  field,
  editorRef,
  placeholder,
  hasContent,
  emptyClassName,
  marginClassName,
  defaultAlign,
  config,
  blankStart,
  currentField,
  background,
  activeEditorRef,
  setShowCardBgPopup,
  setStylePopupAnchor,
  setCurrentField,
  refreshPromoToolbarFormats,
  onFieldInput,
  onPromoPreviewKeyDown,
}: PromoPreviewTextFieldProps) {
  const fieldStyle = config.promoCard.style[STYLE_KEY_MAP[field]];

  return (
    <div
      ref={editorRef}
      contentEditable
      suppressContentEditableWarning
      data-placeholder={placeholder}
      className={`${blankStart ? 'promo-ghost' : ''} ${hasContent ? 'text-base font-normal' : emptyClassName} ${marginClassName} px-2 py-1 rounded break-words cursor-pointer outline-none ${currentField === field ? 'ring-1 ring-primary/70' : ''}`}
      onMouseDown={() => {
        // Don't trigger state updates while dragging selection.
        activeEditorRef.current = editorRef.current;
      }}
      onClick={() => {
        setShowCardBgPopup(false);
        setStylePopupAnchor('card');
        // Plain click activates this field's style mode.
        if (currentField !== field) setCurrentField(field);
        activeEditorRef.current = editorRef.current;
        setTimeout(() => refreshPromoToolbarFormats(editorRef.current), 0);
      }}
      onFocus={() => {
        activeEditorRef.current = editorRef.current;
      }}
      onMouseUp={() => {
        refreshPromoToolbarFormats(editorRef.current);
      }}
      onInput={() => onFieldInput(field)}
      onKeyDown={onPromoPreviewKeyDown}
      onPaste={(e) => e.preventDefault()}
      onDrop={(e) => e.preventDefault()}
      style={{
        background: getBackgroundStyle(background),
        color: fieldStyle.textColor,
        textAlign: fieldStyle.textAlign || defaultAlign,
        caretColor: 'transparent',
        userSelect: 'text',
        WebkitUserSelect: 'text',
        cursor: 'text',
      }}
    />
  );
}
