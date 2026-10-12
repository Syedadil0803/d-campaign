'use client';

import { useRef, type ReactNode } from 'react';
import { Clapperboard, Maximize2, X } from 'lucide-react';
import { getBackgroundStyle } from '@/lib/utils';
import { stripHtmlText } from '@/lib/promo/promoCardIdentity';
import { calculateTimeRemaining } from '@/lib/editor/timerUtils';
import { isOpenEnded } from '@/lib/promo/promoSchedule';
import { VIDEO_WIDGET as size } from '@/lib/videoStory/videoRules';
import { usePromoEditor } from '@/components/promo/PromoEditorContext';
import { PromoFieldStylePanel } from '@/components/promo/PromoFieldStylePanel';
import { fieldStylePopupPosition, STYLE_POPUP_FALLBACK_HEIGHT } from '@/lib/promo/fieldStylePopupPosition';
import { useVideoStory } from '@/components/videoStory/VideoStoryContext';

/** Time left only, e.g. "1d 04h 10m" — no words around it. */
function timeLeft(endDate: string): string {
  const t = calculateTimeRemaining(endDate);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${t.days ? `${t.days}d ` : ''}${pad(t.hours)}h ${pad(t.minutes)}m`;
}

/**
 * The Video Story widget as a visitor would see it: a 9:16 video with the
 * close button on its top corner, the countdown along its bottom edge, an
 * expand hint on hover, and the call to action below it with no backing card
 * of its own, so the video is never covered. Sits on
 * the same "Website Content Area" surface and corner as the Smart Card.
 */
export function VideoStoryCanvas() {
  const editor = usePromoEditor();
  const { config, currentField } = editor;
  // Our own ref for the widget: the card's promoCardRef is measured by the
  // card's sizing code, and pointing it at the video would resize the card.
  const widgetRef = useRef<HTMLDivElement>(null);
  const { draft, openPicker } = useVideoStory();
  const card = config.promoCard;
  const pos = card.style.position;
  const onLeft = pos === 'bottom-left' || pos === 'top-left';
  const place = `${onLeft ? 'justify-self-start' : 'justify-self-end'} ${pos.startsWith('top') ? 'self-start' : 'self-end'}`;
  const showTimer = card.showTimer && !isOpenEnded(card) && Boolean(card.endDate);
  const buttonText = stripHtmlText(card.buttonText);
  const clip = draft.clip;

  return (
    <div data-promo-canvas className="campaign-card-surface relative min-h-0 flex-1 rounded-lg border border-gray-200 px-5 pb-2 pt-5 dark:border-gray-600">
      <div className="pointer-events-none absolute inset-x-0 top-4 flex items-center justify-center text-sm font-medium text-gray-400">
        Website Content Area
      </div>
      <div className="relative z-10 grid h-full w-full">
        <div
          ref={widgetRef}
          className={`relative ${place}`}
          style={{ width: size.width }}
        >
          <div className="group relative overflow-hidden rounded-2xl bg-black shadow-2xl" style={{ height: size.videoHeight }}>
            {clip ? (
              <video
                key={clip.url}
                src={clip.url}
                muted
                loop
                autoPlay
                playsInline
                className="h-full w-full object-cover"
              />
            ) : (
              <button
                type="button"
                onClick={openPicker}
                className="flex h-full w-full flex-col items-center justify-center gap-2 text-white/80 hover:text-white"
              >
                <Clapperboard className="h-7 w-7" />
                <span className="text-xs font-semibold">Upload a video</span>
              </button>
            )}

            {/* Close sits on the outer top corner. */}
            <span
              className={`pointer-events-none absolute top-2 grid h-7 w-7 place-items-center rounded-full bg-black/55 text-white backdrop-blur-md ${onLeft ? 'left-2' : 'right-2'}`}
            >
              <X className="h-3.5 w-3.5" />
            </span>

            {/* Countdown at the bottom, just above the button — the same place
                as on the Smart Card. Plain text with no background; its text
                colour comes from the timer style popup (the palette beside
                "Timer Text" on the left). */}
            {showTimer && (
              <span
                className={`pointer-events-none absolute inset-x-2 bottom-2 truncate text-center text-sm font-semibold tabular-nums ${
                  currentField === 'timer' ? 'rounded ring-1 ring-primary/70' : ''
                }`}
                style={{
                  color: card.style.dateStyle.textColor,
                  textShadow: '0 1px 3px rgba(0,0,0,.45)',
                }}
              >
                {timeLeft(card.endDate!)}
              </span>
            )}

            {clip && (
              <div className="pointer-events-none absolute inset-0 grid place-items-center bg-black/0 opacity-0 transition group-hover:bg-black/30 group-hover:opacity-100">
                <span className="grid h-10 w-10 place-items-center rounded-full bg-black/55 text-white backdrop-blur-md">
                  <Maximize2 className="h-4 w-4" />
                </span>
              </div>
            )}
          </div>

          <div className="flex items-center" style={{ height: size.trayHeight }}>
            {card.showButton && buttonText ? (
              <span
                className={`block h-10 w-full truncate rounded-lg px-3 text-sm font-semibold leading-10 shadow-lg ${
                  currentField === 'button' ? 'ring-1 ring-primary/70' : ''
                }`}
                style={{
                  background: getBackgroundStyle(card.style.buttonStyle.background),
                  color: card.style.buttonStyle.textColor,
                  textAlign: card.style.buttonStyle.textAlign || 'center',
                }}
                // Same markup the card's button shows, so bold/size/colour set
                // in the Button style popup carry over.
                dangerouslySetInnerHTML={{ __html: card.buttonText }}
              />
            ) : (
              <span className="w-full text-center text-xs text-gray-400">Call To Action shows here</span>
            )}
          </div>

          {/* The same style popups the Smart Card uses, opened from the
              palettes beside "Button Text" and "Timer Text" on the left.
              Reused as they are. */}
          {(currentField === 'button' || currentField === 'timer') && (
            <PromoFieldStylePanel
              field={currentField}
              fieldStyle={editor.getPopupFieldStyle(currentField)}
              fieldLabel={editor.getPopupFieldLabel(currentField)}
              positionStyle={fieldStylePopupPosition({
                card: widgetRef.current,
                field: null,
                height: editor.fieldPopupHeightRef.current || STYLE_POPUP_FALLBACK_HEIGHT,
                anchor: 'card',
                cardIsOnTheLeft: onLeft,
              })}
              config={config}
              activeFormats={editor.activeFormats}
              fieldPopupHeightRef={editor.fieldPopupHeightRef}
              setCurrentField={editor.setCurrentField}
              handlePromoToolbarFormat={editor.handlePromoToolbarFormat}
              // The card's timer is a rich editor that takes colour per
              // character; the video's countdown is one line of plain text,
              // so its colour is the timer style's text colour.
              handlePromoToolbarColor={
                currentField === 'timer'
                  ? (color) =>
                      editor.updateField('style', {
                        ...config.promoCard.style,
                        dateStyle: { ...config.promoCard.style.dateStyle, textColor: color },
                      })
                  : editor.handlePromoToolbarColor
              }
              setFieldAlignment={editor.setFieldAlignment}
              updateFieldBg={editor.updateFieldBg}
              updateField={editor.updateField}
              showFieldBgTypeDropdown={editor.showFieldBgTypeDropdown}
              setShowFieldBgTypeDropdown={editor.setShowFieldBgTypeDropdown}
              fieldBgTypePos={editor.fieldBgTypePos}
              setFieldBgTypePos={editor.setFieldBgTypePos}
              fieldBgTypeBtnRef={editor.fieldBgTypeBtnRef}
              fieldBgTypeMenuRef={editor.fieldBgTypeMenuRef}
              closeAllPromoDropdowns={editor.closeAllPromoDropdowns}
              getDropdownPosition={editor.getDropdownPosition}
              styleWarning={editor.styleWarning}
              setStyleWarning={editor.setStyleWarning}
              hideBackground={currentField === 'timer'}
            />
          )}
        </div>
      </div>
    </div>
  );
}

/** Renders the Smart Card or the Video Story version of a piece of the tab. */
export function CampaignSwitch({ card, video }: { card: ReactNode; video: ReactNode }) {
  const { kind } = useVideoStory();
  return <>{kind === 'video' ? video : card}</>;
}
