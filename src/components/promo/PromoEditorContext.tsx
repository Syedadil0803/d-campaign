'use client';

import { createContext, useContext, type Dispatch, type ReactNode, type RefObject, type SetStateAction } from 'react';
import type { CampaignConfig, GradientStyle, PromoCard, PromoField } from '@/types/campaign';
import type { LexicalTimerFieldHandle } from '@/components/timer-lexical/LexicalTimerField';
import type { ActiveFormats } from '@/hooks/useRichTextEditor';
import type { PromoCardAction } from '@/components/promo/PromoCardActionDialog';
import type { usePromoRichText } from '@/components/promo/usePromoRichText';
import type { usePromoFieldStyling } from '@/components/promo/usePromoFieldStyling';

type MenuPosition = { top: number; left: number; width: number } | null;
type Editor = RefObject<HTMLDivElement | null>;

/**
 * What the promo editor's parts need from it.
 *
 * The canvas alone reads sixty-one values from PromoSection. Threading those
 * through props does not produce a module — it produces the same component
 * with a sixty-one-line call site, which is why prop-based extraction stopped
 * being worth doing. A context is the shape this actually is: one editor, with
 * pieces of its UI rendered in different places.
 *
 * Deliberately FLAT, and named exactly as PromoSection names things. Grouping
 * would read better, but every consumer's markup would then need rewriting to
 * match — and rewriting markup is how detail gets lost. Flat means a moved
 * block is checkable against the original character for character.
 *
 * The rich-text and styling halves are inherited from their hooks rather than
 * restated, so a change to either signature lands here on its own.
 */
export interface PromoEditorApi
  extends ReturnType<typeof usePromoRichText>,
    ReturnType<typeof usePromoFieldStyling> {
  config: CampaignConfig;
  setConfig: Dispatch<SetStateAction<CampaignConfig>>;
  markChanged: () => void;
  currentField: PromoField | null;
  setCurrentField: (field: PromoField | null) => void;
  updateField: <K extends keyof PromoCard>(field: K, value: PromoCard[K]) => void;

  /** Editor elements. Owned here so the per-field line limit can measure them. */
  promoCardRef: Editor;
  previewFieldRefs: Record<'title' | 'subtitle' | 'description', Editor>;
  previewButtonRef: Editor;
  lexicalTimerRef: RefObject<LexicalTimerFieldHandle | null>;
  activeEditorRef: Editor;
  fieldPopupHeightRef: RefObject<number>;

  /** What the card is currently showing. */
  blankStart: boolean;
  previewZoom: number;
  cardWidth: number;
  setCardWidth: (width: number) => void;
  computeCardWidth: (promo: PromoCard) => number;
  showTimerInPreview: boolean;
  showButtonInPreview: boolean;
  previewFieldVisible: Record<'title' | 'subtitle' | 'description', boolean>;
  previewFieldHasContent: Record<'title' | 'subtitle' | 'description', boolean>;
  ctaDestination: (card?: PromoCard) => string | null;
  onTimerEdited?: () => void;
  /** Bumped when a card arrives from elsewhere, so the editors re-read it. */
  configLoadedSignal?: number;
  /** Toolbar state, shared with the rich-text hook. */
  activeFormats: ActiveFormats;
  setActiveFormats: Dispatch<SetStateAction<ActiveFormats>>;

  /** Style warning and the popups that sit over the card. */
  styleWarning: string | null;
  setStyleWarning: (message: string | null) => void;
  showCardBgPopup: boolean;
  setShowCardBgPopup: (open: boolean) => void;
  cardBgPopupRef: Editor;
  cardBgPopupTop: number | null;
  updateCardBg: (patch: Partial<GradientStyle>) => void;
  showCardBgTypeDropdown: boolean;
  setShowCardBgTypeDropdown: (open: boolean) => void;
  cardBgTypeBtnRef: RefObject<HTMLButtonElement | null>;
  cardBgTypeMenuRef: Editor;
  cardBgTypePos: MenuPosition;
  setCardBgTypePos: (pos: MenuPosition) => void;
  showFieldBgTypeDropdown: boolean;
  setShowFieldBgTypeDropdown: (open: boolean | ((prev: boolean) => boolean)) => void;
  fieldBgTypeBtnRef: RefObject<HTMLButtonElement | null>;
  fieldBgTypeMenuRef: Editor;
  fieldBgTypePos: MenuPosition;
  setFieldBgTypePos: (pos: MenuPosition) => void;
  closeAllPromoDropdowns: () => void;
  getDropdownPosition: (button: HTMLButtonElement | null) => MenuPosition;
  popupEditableFields: readonly PromoField[];

  /** The panel's own editors. Same rule as the preview's — owned, not made. */
  panelFieldRefs: Record<'title' | 'subtitle' | 'description', Editor>;
  buttonRef: Editor;
  timerRef: Editor;

  /** The per-field "i" guidance. */
  fieldInfoPopup: 'title' | 'subtitle' | 'description' | null;
  setFieldInfoPopup: (field: 'title' | 'subtitle' | 'description' | null) => void;
  dismissFieldInfo: (field: 'title' | 'subtitle' | 'description') => void;

  /** Consent before anything replaces the card. */
  cardActionConfirm: PromoCardAction | null;
  setCardActionConfirm: (action: PromoCardAction | null) => void;
  pushPromoState: (options?: { replace?: boolean }) => void;

  /** Schedule and countdown. */
  showStartDatePicker: boolean;
  setShowStartDatePicker: Dispatch<SetStateAction<boolean>>;
  showEndDatePicker: boolean;
  setShowEndDatePicker: Dispatch<SetStateAction<boolean>>;
  endDateFieldRef: Editor;
  promoDateRangeInvalid: boolean;
  dateErrorFlash: boolean;
  timerLimitReached: boolean;

  /** The CTA's dialling-code picker. */
  showCountryCodeDropdown: boolean;
  setShowCountryCodeDropdown: (open: boolean | ((prev: boolean) => boolean)) => void;
  countryCodePos: MenuPosition;
  setCountryCodePos: (pos: MenuPosition) => void;
  countryCodeBtnRef: RefObject<HTMLButtonElement | null>;
  countryCodeMenuRef: Editor;
}

const PromoEditorContext = createContext<PromoEditorApi | null>(null);

export function PromoEditorProvider({
  value,
  children,
}: {
  value: PromoEditorApi;
  children: ReactNode;
}) {
  return (
    <PromoEditorContext.Provider value={value}>
      {children}
    </PromoEditorContext.Provider>
  );
}

/** Throws rather than returning null: a missing provider is a wiring bug. */
export function usePromoEditor(): PromoEditorApi {
  const api = useContext(PromoEditorContext);
  if (!api) {
    throw new Error('usePromoEditor must be used inside PromoEditorProvider');
  }
  return api;
}
