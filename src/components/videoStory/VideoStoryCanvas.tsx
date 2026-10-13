'use client';

import { useRef, type ReactNode } from 'react';
import { Clapperboard, Maximize2, X } from 'lucide-react';
import type { GradientStyle } from '@/types/campaign';
import { getBackgroundStyle } from '@/lib/utils';
import { deriveButtonUrl } from '@/lib/campaignCta';
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
 * the same "Website Content Area" surface as the Smart Card, in the corner
 * the user picked.
 */
export function VideoStoryCanvas() {
  const editor = usePromoEditor();
  const { config, currentField } = editor;
  // Our own ref for the widget: the card's promoCardRef is measured by the
  // card's sizing code, and pointing it at the video would resize the card.
  const widgetRef = useRef<HTMLDivElement>(null);
  const { draft, openPicker, videoStory: vs, updateVideoStory } = useVideoStory();
  // The stored choice, even when it shares the live card's corner: the
  // toolbar warns about that, and the preview shows what was picked.
  const onLeft = vs.position === 'bottom-left';
  const place = `${onLeft ? 'justify-self-start' : 'justify-self-end'} self-end`;
  const showTimer = vs.showTimer && !isOpenEnded(vs) && Boolean(vs.endDate);
  const buttonText = vs.buttonText.trim();
  const href = deriveButtonUrl(vs);
  // The local copy while there is one (instant, and the review candidate);
  // otherwise the stored address, e.g. a draft reopened later.
  const src = draft.previewUrl || vs.videoUrl;
  const button = vs.buttonStyle;

  /** The Button and Timer style popups write here, not to the card. */
  const setButtonStyle = (patch: Partial<typeof button>) =>
    updateVideoStory({ buttonStyle: { ...button, ...patch } });
  const timerStyle = { ...button, textColor: vs.timerTextColor };

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
            {src ? (
              <video
                key={src}
                src={src}
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
                "Countdown Colour" on the left). */}
            {showTimer && (
              <span
                className={`pointer-events-none absolute inset-x-2 bottom-2 truncate text-center text-sm font-semibold tabular-nums ${
                  currentField === 'timer' ? 'rounded ring-1 ring-primary/70' : ''
                }`}
                style={{
                  color: vs.timerTextColor,
                  textShadow: '0 1px 3px rgba(0,0,0,.45)',
                }}
              >
                {timeLeft(vs.endDate!)}
              </span>
            )}

            {src && (
              <div className="pointer-events-none absolute inset-0 grid place-items-center bg-black/0 opacity-0 transition group-hover:bg-black/30 group-hover:opacity-100">
                <span className="grid h-10 w-10 place-items-center rounded-full bg-black/55 text-white backdrop-blur-md">
                  <Maximize2 className="h-4 w-4" />
                </span>
              </div>
            )}
          </div>

          <div className="flex items-center" style={{ height: size.trayHeight }}>
            {vs.showButton && buttonText ? (
              // A real link when there is a destination, so it can be tried
              // from the preview the same way the card's button can.
              <a
                href={href || undefined}
                title={href ? `Opens ${href} in a new tab` : undefined}
                target="_blank"
                rel="noopener noreferrer"
                className={`block h-10 w-full truncate rounded-lg px-3 text-sm font-semibold leading-10 shadow-lg ${
                  currentField === 'button' ? 'ring-1 ring-primary/70' : ''
                }`}
                style={{
                  background: getBackgroundStyle(button.background),
                  color: button.textColor,
                  textAlign: button.textAlign || 'center',
                }}
              >
                {buttonText}
              </a>
            ) : (
              <span className="w-full text-center text-xs text-gray-400">Call To Action shows here</span>
            )}
          </div>

          {/* The same style popups the Smart Card uses, opened from the
              palettes beside "Button Text" and the countdown on the left.
              Every write is redirected to the Video Story; the text controls
              are hidden because both fields are plain text. */}
          {(currentField === 'button' || currentField === 'timer') && (
            <PromoFieldStylePanel
              field={currentField}
              fieldStyle={currentField === 'timer' ? timerStyle : button}
              fieldLabel={editor.getPopupFieldLabel(currentField)}
              positionStyle={fieldStylePopupPosition({
                card: widgetRef.current,
                field: null,
                height: editor.fieldPopupHeightRef.current || STYLE_POPUP_FALLBACK_HEIGHT,
                anchor: 'card',
                cardIsOnTheLeft: onLeft,
              })}
              config={config}
              activeFormats={{
                ...editor.activeFormats,
                color: currentField === 'timer' ? vs.timerTextColor : button.textColor,
              }}
              fieldPopupHeightRef={editor.fieldPopupHeightRef}
              setCurrentField={editor.setCurrentField}
              handlePromoToolbarFormat={editor.handlePromoToolbarFormat}
              // The card colours characters inside a rich editor; the video's
              // fields are plain text, so colour is the whole field's.
              handlePromoToolbarColor={(color) =>
                currentField === 'timer'
                  ? updateVideoStory({ timerTextColor: color })
                  : setButtonStyle({ textColor: color })
              }
              setFieldAlignment={
                currentField === 'button' ? (textAlign) => setButtonStyle({ textAlign }) : undefined
              }
              updateFieldBg={(patch: Partial<GradientStyle>) =>
                setButtonStyle({ background: { ...button.background, ...patch } })
              }
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
              hideTextFormatting
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
