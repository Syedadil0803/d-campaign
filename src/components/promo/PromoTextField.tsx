'use client';

import type { KeyboardEvent, ClipboardEvent, RefObject } from 'react';
import type { GradientStyle } from '@/types/campaign';
import { getBackgroundStyle } from '@/lib/utils';
import { measureOverflow } from '@/lib/promo/promoMeasure';

/** The three fields that hold styled text on the card. */
export type PromoTextFieldName = 'title' | 'subtitle' | 'description';

/**
 * One editable line of the promo card, with its overflow warning.
 *
 * Written out three times before, for the title, the subtitle and the
 * description, differing only in the field's name, its ref and its
 * placeholder. Every handler already took the field or the ref, so each copy
 * was the same twenty-three lines with three words changed — and any change
 * to how a field behaves had to be made three times, correctly, each time.
 *
 * There are a lot of props and all of them are values or handlers. None of
 * them is a mode: nothing here reads a flag and renders something different.
 * That is the line between a shared component and one that has absorbed three
 * variants and needs a switch to tell them apart.
 *
 * The warning is measured on the text plus one character rather than the text
 * itself. It is a warning that the field is *full*, not that it has already
 * overflowed — by the time the real text overflows it is too late to be
 * useful.
 */
export function PromoTextField({
  field,
  fieldRef,
  placeholder,
  value,
  isActive,
  background,
  onInput,
  onFocus,
  onKeyDown,
  onFormatsRefresh,
  onPaste,
}: {
  field: PromoTextFieldName;
  fieldRef: RefObject<HTMLDivElement | null>;
  placeholder: string;
  /** The stored HTML, used only to decide whether the field is full. */
  value: string;
  isActive: boolean;
  background: GradientStyle;
  onInput: (field: PromoTextFieldName) => void;
  onFocus: (field: PromoTextFieldName, ref: RefObject<HTMLDivElement | null>) => void;
  onKeyDown: (e: KeyboardEvent<HTMLDivElement>) => void;
  onFormatsRefresh: (el?: HTMLDivElement | null) => void;
  onPaste: (e: ClipboardEvent<HTMLDivElement>, field: PromoTextFieldName) => void;
}) {
  const isFull = Boolean(value) && measureOverflow(`${value}x`, field);

  return (
    <>
      <div
        ref={fieldRef}
        contentEditable
        spellCheck={true}
        data-placeholder={placeholder}
        suppressContentEditableWarning
        onInput={() => onInput(field)}
        onFocus={() => onFocus(field, fieldRef)}
        onKeyDown={onKeyDown}
        onMouseUp={() => onFormatsRefresh(fieldRef.current)}
        onKeyUp={() => onFormatsRefresh(fieldRef.current)}
        onPaste={(e) => onPaste(e, field)}
        className={`rich-editor promo-standard-editor block w-full rounded-md px-2 border min-h-[44px] max-h-[360px] resize-none overflow-y-auto outline-none break-words transition-colors ${
          isActive ? 'border-primary/70' : 'border-border'
        } focus:ring-primary/60 focus:border-primary/80 hover:border-primary/70`}
        style={{
          background: getBackgroundStyle(background),
          paddingTop: '10px',
          paddingBottom: '10px',
        }}
      />
      {isFull && (
        <p className="mt-1.5 text-[11px] font-semibold text-amber-600 dark:text-amber-400 animate-pulse">
          ⚠️ Field limit reached
        </p>
      )}
    </>
  );
}
