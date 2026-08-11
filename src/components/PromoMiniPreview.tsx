import { PromoCard } from "@/types/campaign";
import { getBackgroundStyle } from "@/lib/utils";
import { getTemplateTimerPreviewText } from "@/lib/timerUtils";

interface PromoMiniPreviewProps {
  promoCard: PromoCard;
  // When true, render purely from the card's own HTML — no forced font
  // size/weight — so it matches the editor exactly (used by the Draft popup).
  faithful?: boolean;
}

/**
 * Static visual preview of a PromoCard — same look as the Sample Templates
 * cards. Used to render saved versions as click-to-apply tiles.
 */
export function PromoMiniPreview({ promoCard, faithful }: PromoMiniPreviewProps) {
  const style = promoCard.style;
  return (
    <div
      className="flex w-full flex-col rounded-xl p-4 shadow-xl"
      style={{ background: getBackgroundStyle(style.background) }}
    >
      {promoCard.title && (
        <h3
          className={`mb-1 break-words rounded px-2 py-1 ${faithful ? "" : "text-lg font-bold"}`}
          style={{
            background: getBackgroundStyle(style.titleStyle.background),
            color: style.titleStyle.textColor,
            textAlign: style.titleStyle.textAlign || "center",
          }}
          dangerouslySetInnerHTML={{ __html: promoCard.title }}
        />
      )}
      {promoCard.subtitle && (
        <h4
          className={`mb-2 break-words rounded px-2 py-1 ${faithful ? "" : "text-sm"}`}
          style={{
            background: getBackgroundStyle(style.subheadingStyle.background),
            color: style.subheadingStyle.textColor,
            textAlign: style.subheadingStyle.textAlign || "center",
          }}
          dangerouslySetInnerHTML={{ __html: promoCard.subtitle }}
        />
      )}
      {promoCard.description && (
        <p
          className={`mb-2 break-words rounded px-2 py-1 ${faithful ? "" : "text-sm"}`}
          style={{
            background: getBackgroundStyle(style.descriptionStyle.background),
            color: style.descriptionStyle.textColor,
            textAlign: style.descriptionStyle.textAlign || "left",
          }}
          dangerouslySetInnerHTML={{ __html: promoCard.description }}
        />
      )}
      {promoCard.showTimer && promoCard.timerText && (
        <div
          className={`mb-4 break-words rounded px-2 py-1 ${faithful ? "" : "text-xs"}`}
          style={{
            background: getBackgroundStyle(style.dateStyle.background),
            color: style.dateStyle.textColor,
            textAlign: style.dateStyle.textAlign || "center",
          }}
          dangerouslySetInnerHTML={{
            __html: getTemplateTimerPreviewText(promoCard.timerText),
          }}
        />
      )}
      {promoCard.showButton && promoCard.buttonText && (
        <div className={promoCard.buttonFullWidth ? "" : "flex justify-center"}>
          <button
            type="button"
            className={`rounded-lg px-4 py-2 ${faithful ? "" : "text-sm font-semibold"} ${
              promoCard.buttonFullWidth ? "w-full" : ""
            }`}
            style={{
              background: getBackgroundStyle(style.buttonStyle.background),
              color: style.buttonStyle.textColor,
            }}
            dangerouslySetInnerHTML={{ __html: promoCard.buttonText }}
          />
        </div>
      )}
    </div>
  );
}
