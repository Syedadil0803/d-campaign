import { useEffect, useRef, useState } from "react";
import { PromoCard } from "@/types/campaign";
import { getBackgroundStyle } from "@/lib/utils";
import { getPreviewTimerHtml } from "@/lib/editor/timerUtils";

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
  /**
   * Render at the card's REAL width, then scale the whole thing to fit.
   *
   * This used to render at whatever width the tile happened to be, which meant
   * the words wrapped somewhere else than they do on the site — a card widened
   * to 440 still previewed with the line breaks of a narrow one. The preview's
   * whole job is to show where the text lands, so it has to be laid out at the
   * width it will actually have.
   */
  const CARD_WIDTH = promoCard.cardWidth || 400;
  const frameRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [cardHeight, setCardHeight] = useState(0);
  useEffect(() => {
    const frame = frameRef.current;
    const card = cardRef.current;
    if (!frame || !card || typeof ResizeObserver === "undefined") return;
    const measure = () => {
      const available = frame.clientWidth;
      // Never scale UP: a tile wider than the card shows it at its own size
      // rather than stretching a 400px card across the popup.
      if (available > 0) setScale(Math.min(1, available / CARD_WIDTH));
      setCardHeight(card.offsetHeight);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(frame);
    observer.observe(card);
    return () => observer.disconnect();
  }, [CARD_WIDTH]);
  /** An empty band still needs height, same as the editor's empty fields. */
  const EMPTY = "&nbsp;";
  const show = (html?: string) => Boolean(html) || scaffold;
  return (
    <div
      ref={frameRef}
      className="w-full overflow-hidden"
      // The scaled card no longer contributes its real height to the layout,
      // so the frame has to carry it or the tiles overlap.
      style={{ height: cardHeight ? cardHeight * scale : undefined }}
    >
    <div
      ref={cardRef}
      // p-5, not p-4: the live card uses p-5 and its fields px-2, which is what
      // makes its content box exactly the 344 / 384 the overflow measurement
      // assumes. At p-4 the preview gave itself 8px more and wrapped later than
      // the card it is previewing.
      className="flex flex-col rounded-xl p-5 shadow-xl"
      style={{
        background: getBackgroundStyle(style.background),
        width: `${CARD_WIDTH}px`,
        transform: `scale(${scale})`,
        transformOrigin: "top left",
      }}
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
            __html: getPreviewTimerHtml(
              promoCard.timerText,
              promoCard.endDate,
              promoCard.timerStateJson,
            ),
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
    </div>
  );
}
