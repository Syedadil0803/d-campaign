import { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { PromoCard } from '@/types/campaign';
import { getBackgroundStyle, getISODateWithOffset } from '@/lib/utils';
import { getTemplateTimerPreviewText } from '@/lib/editor/timerUtils';
import { INDUSTRIES, withIndustryCopy } from '@/lib/promo/industryCopy';
import { sampleTemplates } from '@/lib/promo/sampleTemplateCards';

interface SamplePromoTemplatesProps {
  onApplyTemplate: (template: PromoCard, templateName: string) => void;
}


const REVEAL_DURATION_MS = 350;
const STAGGER_DELAY_MS = 60;

/**
 * The width this card becomes the moment it is applied.
 *
 * getRequiredCardWidth() picks 400 or 440 by measuring whether a headline
 * would overflow, and no template here declares a width of its own, so 440
 * is the widest a tile can ever need to depict. Rendering at the maximum is
 * the safe direction to be wrong in: a headline that fits the real card
 * cannot wrap in the tile.
 */
const APPLIED_CARD_WIDTH = 440;

/**
 * The same stack the live preview pins itself to.
 *
 * The app is set in Geist, a wider cut than the widget could reliably load,
 * so text measured in Geist wraps sooner than the same text on the customer's
 * site. The preview already corrects for this; the gallery did not, which is
 * the second reason its headlines broke where the real card's did not.
 */
const WIDGET_FONT_STACK =
  '-apple-system, BlinkMacSystemFont, system-ui, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

/**
 * One template in the gallery, drawn at the size it will really be.
 *
 * The tile used to render the card at whatever width the grid column happened
 * to be — roughly 300px at three columns, against a real card of 440. The
 * template headlines carry inline `font-size` in **rem**, which is relative to
 * the document root and therefore completely indifferent to how narrow its
 * container is: a 1.6rem word is 25.6px in a 300px tile exactly as it is in a
 * 440px card. Nothing about a narrower column makes that text smaller, so it
 * simply wrapped, and a one-line headline became two.
 *
 * So the card is laid out at its true width and the whole thing is scaled to
 * fit. `zoom` rather than `transform: scale()` because zoom scales layout too
 * — the tile's height follows on its own, with no second measurement to keep
 * in step — and because the live preview already solves its own fitting
 * problem this way.
 *
 * The line breaks are now correct by construction rather than by tuning. Type
 * a longer headline into any template and the tile keeps agreeing with the
 * card, because it is the same layout at the same width, just smaller.
 */
function TemplateTile({
  template,
  card,
  index,
  isVisible,
  onApply,
}: {
  template: (typeof sampleTemplates)[number];
  card: PromoCard;
  index: number;
  isVisible: boolean;
  /** Handed the very card that is on screen, so what you click is what you get. */
  onApply: (card: PromoCard, templateName: string) => void;
}) {
  const frameRef = useRef<HTMLDivElement>(null);
  const [fitZoom, setFitZoom] = useState(1);

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    const fit = () => {
      const available = frame.clientWidth;
      // Never scale up. A column wider than the card should show the card,
      // not an inflated version of it.
      if (available > 0) setFitZoom(Math.min(1, available / APPLIED_CARD_WIDTH));
    };
    fit();
    // The grid drops from three columns to two to one, and the panel itself
    // resizes with the window, so a single measurement on mount goes stale.
    const observer = new ResizeObserver(fit);
    observer.observe(frame);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      data-template-id={template.id}
      onClick={() => onApply(card, template.name)}
      className={`group rounded-xl border border-gray-200 hover:border-primary hover:ring-1 hover:ring-primary bg-white p-3 shadow-sm hover:shadow-lg cursor-pointer dark:border-gray-700 dark:bg-gray-900 [transition:border-color_150ms_ease,box-shadow_150ms_ease,opacity_var(--reveal-ms)_ease-out_var(--reveal-delay),transform_var(--reveal-ms)_ease-out_var(--reveal-delay)] ${
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
      }`}
      style={
        {
          ['--reveal-ms' as string]: isVisible ? `${REVEAL_DURATION_MS}ms` : '120ms',
          ['--reveal-delay' as string]: isVisible ? `${index * STAGGER_DELAY_MS}ms` : '0ms',
        } as React.CSSProperties
      }
    >
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs font-semibold text-gray-800 dark:text-gray-200">{template.name}</p>
        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium dark:bg-gray-700 dark:text-gray-200">
          Click to apply
        </span>
      </div>

      {/* The frame is what the grid sizes; the card inside keeps its own.
          `overflow-hidden` covers the single frame between first paint and the
          effect measuring: the card is briefly its full 440 in a narrower
          column, and clipping for one frame beats bursting out of the tile.
          The reveal animation starts at opacity-0, so nothing is visible
          either way — this is the belt to that pair of braces. */}
      <div ref={frameRef} className="overflow-hidden">
        <div
          className="rounded-xl shadow-xl p-4 flex flex-col"
          style={{
            width: `${APPLIED_CARD_WIDTH}px`,
            zoom: fitZoom,
            fontFamily: WIDGET_FONT_STACK,
            background: getBackgroundStyle(template.promoCard.style.background),
          }}
        >
          <h3
            className="text-lg font-bold mb-1 px-2 py-1 rounded break-words"
            style={{
              background: getBackgroundStyle(template.promoCard.style.titleStyle.background),
              color: template.promoCard.style.titleStyle.textColor,
              textAlign: template.promoCard.style.titleStyle.textAlign || 'center',
            }}
            dangerouslySetInnerHTML={{ __html: card.title }}
          />
          <h4
            className="text-sm mb-2 px-2 py-1 rounded break-words"
            style={{
              background: getBackgroundStyle(template.promoCard.style.subheadingStyle.background),
              color: template.promoCard.style.subheadingStyle.textColor,
              textAlign: template.promoCard.style.subheadingStyle.textAlign || 'center',
            }}
            dangerouslySetInnerHTML={{ __html: card.subtitle }}
          />
          <p
            className="text-sm mb-2 px-2 py-1 rounded break-words"
            style={{
              background: getBackgroundStyle(template.promoCard.style.descriptionStyle.background),
              color: template.promoCard.style.descriptionStyle.textColor,
              textAlign: template.promoCard.style.descriptionStyle.textAlign || 'left',
            }}
            dangerouslySetInnerHTML={{ __html: card.description }}
          />
          <div
            className="text-xs mb-4 px-2 py-1 rounded break-words"
            style={{
              background: getBackgroundStyle(template.promoCard.style.dateStyle.background),
              color: template.promoCard.style.dateStyle.textColor,
              textAlign: template.promoCard.style.dateStyle.textAlign || 'center',
            }}
            dangerouslySetInnerHTML={{ __html: getTemplateTimerPreviewText(card.timerText) }}
          />
          <div className={template.promoCard.buttonFullWidth ? '' : 'flex justify-center'}>
            <button
              className={`py-2 px-4 rounded-lg text-sm font-semibold ${template.promoCard.buttonFullWidth ? 'w-full' : ''}`}
              style={{
                background: getBackgroundStyle(template.promoCard.style.buttonStyle.background),
                color: template.promoCard.style.buttonStyle.textColor,
              }}
              dangerouslySetInnerHTML={{ __html: card.buttonText }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}


export function SamplePromoTemplates({ onApplyTemplate }: SamplePromoTemplatesProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  /**
   * Which trade's sample wording the cards are showing.
   *
   * It changes the words and nothing else — every template keeps its own
   * colours, and none are hidden. Calling it a filter would promise a shorter
   * grid that never arrives, so the heading asks a question instead.
   */
  const [industryId, setIndustryId] = useState<string | null>(null);
  /**
   * Open on arrival, deliberately.
   *
   * Collapsed, the row was tidy and nobody knew the trades were there — a
   * feature that exists to be noticed cannot start hidden behind a chevron.
   * It collapses once a choice is made, so it costs a moment rather than a
   * permanent band across the top.
   */
  const [pickerOpen, setPickerOpen] = useState(true);
  const [visibleTemplateIds, setVisibleTemplateIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const root = containerRef.current;
    if (!root) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const id = entry.target.getAttribute('data-template-id');
          if (!id) return;
          setVisibleTemplateIds((prev) => {
            const next = new Set(prev);
            if (entry.isIntersecting) next.add(id);
            else next.delete(id);
            return next;
          });
        });
      },
      { threshold: 0.05, rootMargin: '0px 0px -2% 0px' }
    );

    const cards = root.querySelectorAll('[data-template-id]');
    cards.forEach((card) => observer.observe(card));

    return () => observer.disconnect();
  }, []);

  return (
    <div ref={containerRef}>
      {/* Open on arrival, then out of the way.
          Ten pills in a row wrapped onto a second line and read as a paragraph
          rather than a set of choices. A dropdown would have hidden the trades
          behind a click, which defeats the point — someone should SEE their
          trade without going looking. So: stated in words, shown as a grid that
          scans in columns, and folded away once it has been used. */}
      <div className="mb-6">
        <button
          type="button"
          onClick={() => setPickerOpen((v) => !v)}
          aria-expanded={pickerOpen}
          className="group flex items-baseline gap-2"
        >
          {/* The word the team uses for these, and the word a business owner
              would pick themselves. Earlier attempts described the mechanism
              instead — "showing examples for" and "sample wording" both explain
              what the control does to the page, when the only thing the reader
              needs to answer is which trade they are in. */}
          <span className="text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant">
            Industry
          </span>
          <span className="text-sm font-semibold text-primary">
            {INDUSTRIES.find((i) => i.id === industryId)?.label ?? 'Default'}
          </span>
          <ChevronDown
            className={`h-3.5 w-3.5 self-center text-on-surface-variant transition-transform group-hover:text-primary ${
              pickerOpen ? 'rotate-180' : ''
            }`}
          />
        </button>

        {pickerOpen && (
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
            {[{ id: null, label: 'Default' }, ...INDUSTRIES].map((option) => {
              const active = option.id === industryId;
              return (
                <button
                  key={option.id ?? 'all'}
                  type="button"
                  onClick={() => {
                    setIndustryId(option.id);
                    setPickerOpen(false);
                  }}
                  aria-pressed={active}
                  /* A card each, rather than text on a grey panel. The border
                     is what makes ten items read as ten choices instead of a
                     paragraph, and it survives both themes without a fill. */
                  className={`rounded-lg border px-3 py-2.5 text-left text-xs font-medium transition-all ${
                    active
                      ? 'border-primary bg-primary/10 text-primary shadow-sm'
                      : 'border-border bg-surface text-on-surface-variant hover:-translate-y-0.5 hover:border-primary/60 hover:text-primary hover:shadow-sm'
                  }`}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {sampleTemplates.map((template, index) => (
          <TemplateTile
            key={template.id}
            template={template}
            // The look is the template's; the words are the trade's.
            card={withIndustryCopy(template.promoCard as PromoCard, template.id, industryId)}
            index={index}
            isVisible={visibleTemplateIds.has(template.id)}
            onApply={onApplyTemplate}
          />
        ))}
      </div>
    </div>
  );
}
