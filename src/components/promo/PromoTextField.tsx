'use client';

import type { ClipboardEvent, KeyboardEvent, ReactNode, RefObject } from 'react';
import { Palette } from 'lucide-react';
import type { MeasuredField } from '@/lib/promo/promoMeasure';
import { FieldInfoNote } from '@/components/promo/FieldInfoNote';
import { CharCount } from '@/components/promo/CharCount';
import { useFillOnMount } from '@/components/promo/useMirroredHtml';
import { PALETTE_BTN, richFieldBox } from '@/components/promo/fieldStyles';

type TextField = 'title' | 'subtitle' | 'description';

interface PromoTextFieldProps {
  field: TextField;
  label: string;
  placeholder: string;
  /** The guidance shown behind the field's "i" note. */
  info: ReactNode;
  /** Current HTML, for the at-the-limit warning. */
  html: string | undefined;
  /**
   * The editor element's ref, OWNED BY THE EDITOR, never created here.
   *
   * This is the one thing this component must not do for itself. Every path
   * that enforces the per-field line limit reaches the element through
   * PromoSection's titleRef / subtitleRef / descRef; onFieldInput reads
   * `refMap[field].current` and RETURNS EARLY when it is null. A field whose
   * ref lives in here would leave those null, so typing would never be
   * measured and the cap would vanish silently, with nothing else changed —
   * which is exactly what was reported the last time these three were merged,
   * and why the note left in PromoSection said not to try again without
   * finding the mechanism first.
   */
  editorRef: RefObject<HTMLDivElement | null>;

  currentField: string | null;
  /** Resolved background for the editor's own surface. */
  background: string;

  fieldInfoPopup: 'title' | 'subtitle' | 'description' | null;
  setFieldInfoPopup: (field: 'title' | 'subtitle' | 'description' | null) => void;
  dismissFieldInfo: (field: 'title' | 'subtitle' | 'description') => void;

  openFieldStylePopup: (
    field: TextField,
    ref: RefObject<HTMLDivElement | null>,
    trigger?: HTMLElement | null,
  ) => void;
  onFieldInput: (field: TextField) => void;
  onFieldFocus: (field: TextField, ref: RefObject<HTMLDivElement | null>) => void;
  onPromoEditorKeyDown: (e: KeyboardEvent<HTMLDivElement>) => void;
  refreshPromoToolbarFormats: (editor: HTMLDivElement | null) => void;
  smartPaste: (e: ClipboardEvent<HTMLDivElement>, field: MeasuredField) => void;

  /** The first field carries the section's top spacing. */
  className?: string;
  headerClassName?: string;
}

/**
 * One of the promo card's three panel text fields: its label, style button,
 * guidance note, editor and limit warning.
 *
 * Written out three times before this, identical but for the label, the field
 * name and the placeholder.
 */
export function PromoTextField({
  field,
  label,
  placeholder,
  info,
  html,
  editorRef,
  currentField,
  background,
  fieldInfoPopup,
  setFieldInfoPopup,
  dismissFieldInfo,
  openFieldStylePopup,
  onFieldInput,
  onFieldFocus,
  onPromoEditorKeyDown,
  refreshPromoToolbarFormats,
  smartPaste,
  className = '',
  headerClassName = 'flex items-center justify-between',
}: PromoTextFieldProps) {
  useFillOnMount(editorRef, html);
  return (
    <div className={className}>
      <div className={headerClassName}>
        <label className="block text-sm font-semibold text-on-surface mb-2">
          {label}
        </label>
        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            openFieldStylePopup(field, editorRef, e.currentTarget as HTMLElement);
          }}
          className={PALETTE_BTN}
          title={`Open ${label.toLowerCase()} style`}
          aria-label={`Open ${label.toLowerCase()} style`}
        >
          <Palette className="w-3.5 h-3.5" />
        </button>
      </div>

      <FieldInfoNote
        open={fieldInfoPopup === field}
        onDismiss={() => setFieldInfoPopup(null)}
        onNeverShow={() => dismissFieldInfo(field)}
      >
        {info}
      </FieldInfoNote>

      <div
        ref={editorRef}
        contentEditable
        spellCheck={true}
        data-placeholder={placeholder}
        suppressContentEditableWarning
        onInput={() => onFieldInput(field)}
        onFocus={() => onFieldFocus(field, editorRef)}
        onKeyDown={onPromoEditorKeyDown}
        onMouseUp={() => refreshPromoToolbarFormats(editorRef.current)}
        onKeyUp={() => refreshPromoToolbarFormats(editorRef.current)}
        onPaste={(e) => smartPaste(e, field)}
        className={richFieldBox(currentField === field)}
        style={{
          background,
          paddingTop: '10px',
          paddingBottom: '10px',
        }}
      />
      <CharCount html={html} />
    </div>
  );
}
