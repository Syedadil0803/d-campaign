import { PromoCard } from "@/types/campaign";
import { getBackgroundStyle } from "@/lib/utils";
import { getTemplateTimerPreviewText } from "@/lib/editor/timerUtils";

interface PromoMiniPreviewProps {
  promoCard: PromoCard;
  // When true, render purely from the card's own HTML — no forced font
  // size/weight — so it matches the editor exactly (used by the Draft popup).
  faithful?: boolean;
  /**
   * Show empty fields as their colour bands instead of hiding them, the way
   * the editor's own canvas does on a blank card.
   *
   * Without it a new card previews as an almost-empty box, which reads as
   * "nothing here" rather than "here's the shape about to be filled in".
   */
  scaffold?: boolean;
}

/**
 * Static visual preview of a PromoCard — same look as the Sample Templates
 * cards. Used to render saved versions as click-to-apply tiles.
 */
export function PromoMiniPreview({ promoCard, faithful, scaffold }: PromoMiniPreviewProps) {
  const style = promoCard.style;
  /** An empty band still needs height, same as the editor's empty fields. */
  const EMPTY = "&nbsp;";
  const show = (html?: string) => Boolean(html) || scaffold;
  return (
    <div
      className="flex w-full flex-col rounded-xl p-4 shadow-xl"
      style={{ background: getBackgroundStyle(style.background) }}
    >
      {show(promoCard.title) && (
        <h3
          className={`mb-1 break-words rounded px-2 py-1 ${faithful ? "" : "text-lg font-bold"}`}
          style={{
            background: getBackgroundStyle(style.titleStyle.background),
            color: style.titleStyle.textColor,
            textAlign: style.titleStyle.textAlign || "center",
          }}
          dangerouslySetInnerHTML={{ __html: promoCard.title || EMPTY }}
        />
      )}
      {show(promoCard.subtitle) && (
        <h4
          className={`mb-2 break-words rounded px-2 py-1 ${faithful ? "" : "text-sm"}`}
          style={{
            background: getBackgroundStyle(style.subheadingStyle.background),
            color: style.subheadingStyle.textColor,
            textAlign: style.subheadingStyle.textAlign || "center",
          }}
          dangerouslySetInnerHTML={{ __html: promoCard.subtitle || EMPTY }}
        />
      )}
      {show(promoCard.description) && (
        <p
          className={`mb-2 break-words rounded px-2 py-1 ${faithful ? "" : "text-sm"}`}
          style={{
            background: getBackgroundStyle(style.descriptionStyle.background),
            color: style.descriptionStyle.textColor,
            textAlign: style.descriptionStyle.textAlign || "left",
          }}
          dangerouslySetInnerHTML={{ __html: promoCard.description || EMPTY }}
        />
      )}
      {promoCard.showTimer && show(promoCard.timerText) && (
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
      {promoCard.showButton && show(promoCard.buttonText) && (
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
            dangerouslySetInnerHTML={{ __html: promoCard.buttonText || EMPTY }}
          />
        </div>
      )}
    </div>
  );
}
