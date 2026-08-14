'use client';

/**
 * Compact promo-card thumbnail — the same tile the Dashboard uses.
 *
 * Not a scaled-down PromoMiniPreview: scaling crops and blurs, and the real
 * preview renders a <button>, which can't be nested inside a clickable card.
 * This is a flat, three-row summary (title / description / button) that keeps
 * the card's own colors so it still reads as *that* campaign.
 */

import { PromoCard } from '@/types/campaign';
import { stripHtml, getBackgroundStyle } from '@/lib/utils';
import { getTemplateTimerPreviewText } from '@/lib/timerUtils';

export function PromoCardThumb({
  promoCard,
  /** `lg` shows the subtitle too and gives the card room to actually be read. */
  size = 'sm',
}: {
  promoCard: PromoCard;
  size?: 'sm' | 'lg';
}) {
  const promo = promoCard;
  const lg = size === 'lg';
  return (
    // At `lg` the card IS the thumbnail — no grey frame around it. Nesting a
    // padded container inside a padded card shrinks the artwork for no reason.
    <div
      className={
        lg
          ? ''
          : 'flex h-24 items-center justify-center overflow-hidden rounded-lg border border-border bg-surface-subtle p-2 shadow-inner'
      }
    >
      <div
        className={`w-full rounded-lg ${lg ? 'p-3.5 shadow-lg' : 'max-w-[200px] p-2 shadow-md'}`}
        style={{ background: getBackgroundStyle(promo.style.background) }}
      >
        <div className={`flex flex-col ${lg ? 'gap-2' : 'gap-1'}`}>
          <div
            className={`rounded px-2 text-center font-semibold ${
              lg ? 'line-clamp-1 py-1.5 text-[15px]' : 'line-clamp-1 py-0.5 text-[11px]'
            }`}
            style={{
              background: getBackgroundStyle(promo.style.titleStyle.background),
              color: promo.style.titleStyle.textColor,
            }}
          >
            {stripHtml(promo.title) || 'Promo title'}
          </div>

          {/* The subtitle carries a lot of a design's character, so the larger
              size shows it rather than jumping straight to the description. */}
          {lg && stripHtml(promo.subtitle) && (
            <div
              className="line-clamp-1 rounded px-2 py-1 text-center text-[13px]"
              style={{
                background: getBackgroundStyle(promo.style.subheadingStyle.background),
                color: promo.style.subheadingStyle.textColor,
              }}
            >
              {stripHtml(promo.subtitle)}
            </div>
          )}

          <div
            className={`rounded px-2 leading-snug ${
              lg ? 'line-clamp-2 py-1.5 text-[12px]' : 'line-clamp-1 py-0.5 text-[10px]'
            }`}
            style={{
              background: getBackgroundStyle(promo.style.descriptionStyle.background),
              color: promo.style.descriptionStyle.textColor,
            }}
          >
            {stripHtml(promo.description) || stripHtml(promo.subtitle) || 'Your description here.'}
          </div>

          {/* The countdown sits between the copy and the button on the real
              card. Leaving it out made designs look shorter than they are. */}
          {lg && promo.showTimer !== false && (
            <div
              className="line-clamp-1 rounded px-2 py-1 text-center text-[11px] font-semibold"
              style={{
                background: getBackgroundStyle(promo.style.dateStyle.background),
                color: promo.style.dateStyle.textColor,
              }}
            >
              {stripHtml(getTemplateTimerPreviewText(promo.timerText))}
            </div>
          )}

          {promo.showButton !== false && (
            <div
              className={`line-clamp-1 rounded px-2 text-center font-semibold ${
                lg ? 'py-1.5 text-[13px]' : 'py-0.5 text-[10px]'
              }`}
              style={{
                background: getBackgroundStyle(promo.style.buttonStyle.background),
                color: promo.style.buttonStyle.textColor,
              }}
            >
              {stripHtml(promo.buttonText) || 'Claim offer'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
