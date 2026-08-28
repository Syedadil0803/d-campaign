'use client';

import { useRef, useState, type RefObject } from 'react';
import type { CampaignConfig, GradientStyle, PromoCard, PromoField } from '@/types/campaign';
import { STYLE_KEY_MAP, type FieldStyle } from '@/lib/promo/promoStyleKeys';
import {
  fieldStylePopupPosition,
  STYLE_POPUP_FALLBACK_HEIGHT,
} from '@/lib/promo/fieldStylePopupPosition';


const FIELD_STYLE_LABEL: Record<PromoField, string> = {
  title: 'Title Style',
  subtitle: 'Subtitle Style',
  description: 'Description Style',
  timer: 'Timer Style',
  button: 'Button Style',
};

interface UsePromoFieldStylingArgs {
  config: CampaignConfig;
  setConfig: (config: CampaignConfig) => void;
  markChanged: () => void;
  pushPromoState: (options?: { replace?: boolean }) => void;

  currentField: PromoField | null;
  setCurrentField: (field: PromoField) => void;
  activeEditorRef: RefObject<HTMLDivElement | null>;
  promoDeletingRef: RefObject<boolean>;

  setShowPersistentScaffold: (show: boolean) => void;
  setShowCardBgPopup: (open: boolean) => void;
  setStyleWarning: (message: string | null) => void;
  refreshPromoToolbarFormats: (editor: HTMLDivElement | null) => void;
  ensureDefaultFontSize: () => void;

  /** Everything the panel is positioned against. */
  promoCardRef: RefObject<HTMLDivElement | null>;
  /**
   * The card ahead of React. usePromoUndo takes its snapshots from this, so
   * every write has to move it in the same breath as setConfig — otherwise a
   * second change landing in the same event snapshots the card as it was two
   * changes ago.
   */
  liveCardRef: RefObject<PromoCard>;
  fieldPopupHeightRef: RefObject<number>;
  previewFieldRefs: Record<PromoField, RefObject<HTMLDivElement | null>>;
}

/**
 * Styling the promo card's fields: the panel that does it, where it opens, and
 * the writes it makes.
 *
 * Owns the two pieces of state nothing else touches — which control the panel
 * was opened from, and the timer that clears its warning.
 */
export function usePromoFieldStyling({
  config,
  setConfig,
  markChanged,
  pushPromoState,
  currentField,
  setCurrentField,
  activeEditorRef,
  promoDeletingRef,
  setShowPersistentScaffold,
  setShowCardBgPopup,
  setStyleWarning,
  refreshPromoToolbarFormats,
  ensureDefaultFontSize,
  promoCardRef,
  liveCardRef,
  fieldPopupHeightRef,
  previewFieldRefs,
}: UsePromoFieldStylingArgs) {
  /** Opened from a field on the card, or from a style icon beside an input. */
  const [stylePopupAnchor, setStylePopupAnchor] = useState<'card' | 'input'>('card');
  const styleWarningTimer = useRef<NodeJS.Timeout | null>(null);

  /** Replace one field's style object, keeping the rest of the card intact. */
  function writeFieldStyle(next: Partial<FieldStyle>, mergeBackground = false) {
    if (!currentField) return;
    pushPromoState();
    const key = STYLE_KEY_MAP[currentField];
    const style = config.promoCard.style[key];
    const nextPromoCard = {
      ...config.promoCard,
      style: {
        ...config.promoCard.style,
        [key]: mergeBackground
          ? { ...style, background: { ...style.background, ...(next as Partial<GradientStyle>) } }
          : { ...style, ...next },
      },
    };
    liveCardRef.current = nextPromoCard;
    setConfig({ ...config, promoCard: nextPromoCard });
    markChanged();
  }

  function updateFieldStyle(patch: Partial<FieldStyle>) {
    writeFieldStyle(patch);
  }

  /** Update a property on the current field's background. */
  function updateFieldBg(patch: Partial<GradientStyle>) {
    writeFieldStyle(patch as Partial<FieldStyle>, true);
  }

  function setFieldAlignment(align: 'left' | 'center' | 'right') {
    updateFieldStyle({ textAlign: align });
  }

  /** Card-level background update. */
  function updateCardBg(patch: Partial<GradientStyle>) {
    pushPromoState();
    const nextPromoCard = {
      ...config.promoCard,
      style: {
        ...config.promoCard.style,
        background: { ...config.promoCard.style.background, ...patch },
      },
    };
    liveCardRef.current = nextPromoCard;
    setConfig({ ...config, promoCard: nextPromoCard });
    markChanged();
  }

  function openFieldStylePopup(
    field: PromoField,
    ref: RefObject<HTMLDivElement | null>,
    _trigger?: HTMLElement | null,
  ) {
    const nextEditor = ref.current;
    const prevEditor = activeEditorRef.current;
    if (prevEditor && prevEditor !== nextEditor) {
      prevEditor.blur();
    }
    setShowPersistentScaffold(true);
    setShowCardBgPopup(false);
    setStylePopupAnchor('input');
    setCurrentField(field);
    activeEditorRef.current = nextEditor;
    promoDeletingRef.current = false;
    setTimeout(() => {
      nextEditor?.focus();
      refreshPromoToolbarFormats(ref.current);
      ensureDefaultFontSize();
    }, 0);
  }

  function showStyleWarning(message: string) {
    if (styleWarningTimer.current) clearTimeout(styleWarningTimer.current);
    setStyleWarning(message);
    styleWarningTimer.current = setTimeout(() => setStyleWarning(null), 3000);
  }

  function getPopupFieldStyle(field: PromoField): FieldStyle {
    return config.promoCard.style[STYLE_KEY_MAP[field]];
  }

  function getPopupFieldLabel(field: PromoField) {
    return FIELD_STYLE_LABEL[field];
  }

  function getPreviewFieldBackground(field: PromoField) {
    return getPopupFieldStyle(field).background;
  }

  function getPopupPositionStyle(
    field: PromoField,
    popupHeight = STYLE_POPUP_FALLBACK_HEIGHT,
  ) {
    const position = config.promoCard.style.position;
    return fieldStylePopupPosition({
      card: promoCardRef.current,
      field: previewFieldRefs[field].current,
      // The real height is measured once the panel has rendered; the constant
      // only covers the first frame.
      height: fieldPopupHeightRef.current || popupHeight,
      anchor: stylePopupAnchor,
      cardIsOnTheLeft: position === 'bottom-left' || position === 'top-left',
    });
  }

  return {
    stylePopupAnchor,
    setStylePopupAnchor,
    updateFieldStyle,
    updateFieldBg,
    setFieldAlignment,
    updateCardBg,
    openFieldStylePopup,
    showStyleWarning,
    getPopupFieldStyle,
    getPopupFieldLabel,
    getPreviewFieldBackground,
    getPopupPositionStyle,
  };
}
