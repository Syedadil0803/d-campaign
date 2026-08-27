'use client';

import type { RefObject } from 'react';
import type { CampaignConfig, GradientStyle } from '@/types/campaign';
import { getBackgroundStyle } from '@/lib/utils';

interface PromoPreviewButtonProps {
  config: CampaignConfig;
  currentField: string | null;
  background: GradientStyle;
  previewButtonRef: RefObject<HTMLDivElement | null>;
  setShowCardBgPopup: (open: boolean) => void;
  ctaDestination: (card?: CampaignConfig['promoCard']) => string | null;
}

/**
 * The call-to-action button as it appears on the card.
 *
 * Read-only here: its wording is edited in the panel, so this renders the
 * result and reports where the button would go.
 */
export function PromoPreviewButton({
  config,
  currentField,
  background,
  previewButtonRef,
  setShowCardBgPopup,
  ctaDestination,
}: PromoPreviewButtonProps) {
  return (
                  <div
                    className={
                      config.promoCard.buttonFullWidth
                        ? ""
                        : `flex ${
                            (config.promoCard.style.buttonStyle.textAlign ||
                              "center") === "left"
                              ? "justify-start"
                              : (config.promoCard.style.buttonStyle
                                    .textAlign || "center") === "right"
                                ? "justify-end"
                                : "justify-center"
                          }`
                    }
                  >
                    <div
                      ref={previewButtonRef}
                      {...(ctaDestination(config.promoCard)
                        ? { role: 'button' as const, tabIndex: 0 }
                        : {})}
                      title={
                        // Silence was the problem: an inert button gives no
                        // clue that a destination is missing, so a click that
                        // does nothing reads as broken rather than unset.
                        ctaDestination(config.promoCard)
                          ? `Opens ${ctaDestination(config.promoCard)} in a new tab`
                          : config.promoCard.ctaType === 'text'
                            ? 'Text only — this button has no link'
                            : (config.promoCard.ctaType || 'whatsapp') === 'whatsapp'
                              ? 'Add a WhatsApp number on the left to make this clickable'
                              : 'Add a link on the left to make this clickable'
                      }
                      data-placeholder="Button"
                      className={`promo-preview-button py-2 px-4 rounded-lg text-base font-semibold outline-none min-h-10 ${
                        config.promoCard.buttonFullWidth ? "w-full" : ""
                      } ${currentField === "button" ? "ring-1 ring-primary/70" : ""} ${
                        ctaDestination(config.promoCard)
                          ? 'cursor-pointer transition-opacity hover:opacity-90'
                          : ''
                      }`}
                      onClick={() => {
                        // The card's CTA behaves like the button it depicts:
                        // it opens its destination. Its styles are reached
                        // from the palette beside "Button Text" on the left,
                        // so a click here doesn't have to serve two masters.
                        const url = ctaDestination(config.promoCard);
                        if (!url) return;
                        setShowCardBgPopup(false);
                        window.open(url, '_blank', 'noopener,noreferrer');
                      }}
                      style={{
                        background: getBackgroundStyle(
                          background,
                        ),
                        color: config.promoCard.style.buttonStyle.textColor,
                        textAlign:
                          config.promoCard.style.buttonStyle.textAlign ||
                          "center",
                        cursor: ctaDestination(config.promoCard) ? 'pointer' : 'default',
                      }}
                    />
                  </div>
  );
}
