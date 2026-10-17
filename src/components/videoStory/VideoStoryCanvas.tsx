'use client';

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { Clapperboard, Maximize, X } from 'lucide-react';
import type { GradientStyle } from '@/types/campaign';
import { getBackgroundStyle } from '@/lib/utils';
import { deriveButtonUrl } from '@/lib/campaignCta';
import { calculateTimeRemaining } from '@/lib/editor/timerUtils';
import { isOpenEnded } from '@/lib/promo/promoSchedule';
import { VIDEO_WIDGET as size } from '@/lib/videoStory/videoRules';
import { fitTitleToTwoLines, VIDEO_TITLE_LOOK, videoTimerColor, videoTitle } from '@/lib/videoStory/videoTitle';
import { usePromoEditor } from '@/components/promo/PromoEditorContext';
import { PromoFieldStylePanel } from '@/components/promo/PromoFieldStylePanel';
import { useFitZoom } from '@/hooks/useFitZoom';
import { fieldStylePopupPosition, STYLE_POPUP_FALLBACK_HEIGHT } from '@/lib/promo/fieldStylePopupPosition';
import { useVideoStory } from '@/components/videoStory/VideoStoryContext';

/** Time left only, e.g. "1d 04h 10m" — no words around it. */
function timeLeft(endDate: string): string {
  const t = calculateTimeRemaining(endDate);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${t.days ? `${t.days}d ` : ''}${pad(t.hours)}h ${pad(t.minutes)}m`;
}

/** The expand and close buttons in the video's top corners: white circles shown on hover, and always on touch screens. */
const HOVER_BTN =
  'z-20 grid h-6 w-6 place-items-center rounded-full bg-white/90 text-black opacity-0 shadow-md transition-opacity duration-200 group-hover/widget:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-100';

/**
 * The Video Story widget as a visitor would see it: a 9:16 video with the
 * close button inside its top corner on hover, the title along its top edge, the countdown
 * along its bottom edge, an
 * expand button in its other top corner, and the call to action below it with no backing card
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
  const { draft, openPicker, videoStory: vs, updateVideoStory, title: titleEditing } = useVideoStory();
  // One style popup at a time: the button's opening closes the title's.
  const { setStyleOpen: setTitleStyleOpen } = titleEditing;
  useEffect(() => {
    if (currentField) setTitleStyleOpen(false);
  }, [currentField, setTitleStyleOpen]);
  // The stored choice, even when it shares the live card's corner: the
  // toolbar warns about that, and the preview shows what was picked.
  const onLeft = vs.position === 'bottom-left';
  const place = `${onLeft ? 'justify-self-start' : 'justify-self-end'} self-end`;
  const showTimer = vs.showTimer && !isOpenEnded(vs) && Boolean(vs.endDate);
  const buttonText = vs.buttonText.trim();
  const href = deriveButtonUrl(vs);
  // The local copy while there is one (instant, and the review candidate);
  // otherwise the stored address, e.g. a draft reopened later.
  // The full clip, for the large view; the widget plays the small preview
  // copy, as on the website. A clip picked in this tab only trusts its own
  // copy, never a stored one left from the previous clip.
  const src = draft.localUrl || vs.videoUrl;
  const widgetSrc = draft.localUrl ? draft.localPreviewUrl || draft.localUrl : vs.previewUrl || vs.videoUrl;
  // The two hover buttons work in the preview too: close hides the widget
  // the way a visitor's click would, expand opens the large view.
  const [closedInPreview, setClosedInPreview] = useState(false);
  const titleRef = useRef<HTMLParagraphElement>(null);
  // On a short window the widget is taller than the preview area: shrink it
  // to fit, keeping its proportions, with the Smart Card preview's own hook.
  // The frame's padding is pt-5 + pb-2, 28px.
  // Its full height is fixed (video + button row), so it is given, not measured.
  const fit = useFitZoom(widgetRef, [], { inset: 28, naturalHeight: size.videoHeight + size.trayHeight });
  const [expanded, setExpanded] = useState(false);
  useEffect(() => {
    if (!expanded) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setExpanded(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [expanded]);
  const button = vs.buttonStyle;
  const title = videoTitle(vs);
  // Re-fit whenever the text changes; runs before paint, so no flicker.
  useLayoutEffect(() => {
    if (titleRef.current) fitTitleToTwoLines(titleRef.current);
  }, [title.html]);

  /** The Button style popup writes here, not to the card. */
  const setButtonStyle = (patch: Partial<typeof button>) =>
    updateVideoStory({ buttonStyle: { ...button, ...patch } });
  const timerLook = VIDEO_TITLE_LOOK[videoTimerColor(vs)];

  /** What both style popups (title and button) share: the editor's popup plumbing, its warning and dropdown refs. */
  const panelProps = {
    config,
    fieldPopupHeightRef: editor.fieldPopupHeightRef,
    updateField: editor.updateField,
    fieldBgTypeBtnRef: editor.fieldBgTypeBtnRef,
    fieldBgTypeMenuRef: editor.fieldBgTypeMenuRef,
    closeAllPromoDropdowns: editor.closeAllPromoDropdowns,
    getDropdownPosition: editor.getDropdownPosition,
    styleWarning: editor.styleWarning,
    setStyleWarning: editor.setStyleWarning,
  };
  /** A style popup beside the video, on its left or right. */
  const popupPosition = (cardIsOnTheLeft: boolean) =>
    fieldStylePopupPosition({
      card: widgetRef.current,
      field: null,
      height: editor.fieldPopupHeightRef.current || STYLE_POPUP_FALLBACK_HEIGHT,
      anchor: 'card',
      cardIsOnTheLeft,
    });

  return (
    <div data-promo-canvas className="campaign-card-surface relative min-h-0 flex-1 rounded-lg border border-gray-200 px-5 pb-2 pt-5 dark:border-gray-600">
      <div className="pointer-events-none absolute inset-x-0 top-4 flex items-center justify-center text-sm font-medium text-gray-400">
        Website Content Area
      </div>
      <div className="relative z-10 grid h-full w-full">
        {closedInPreview && (
          <div className={`${place} rounded-xl border border-dashed border-border bg-surface/80 p-3 text-center text-xs text-on-surface-variant`} style={{ width: size.width }}>
            <p className="text-sm font-semibold text-on-surface">Video closed</p>
            <p className="mt-1">Once a visitor closes it, it stays hidden in their browser. A new video or new dates show it again.</p>
            <button type="button" onClick={() => setClosedInPreview(false)} className="mt-2 block w-full font-semibold text-primary hover:underline">
              Show the video
            </button>
            {/* Shown in the tool only: visitors never get a way back. */}
          </div>
        )}
        <div
          ref={widgetRef}
          className={`group/widget relative ${place} ${closedInPreview ? 'hidden' : ''}`}
          style={{ width: size.width, zoom: fit < 1 ? fit : undefined }}
        >
          {/* Close sits inside the top-right corner and appears on hover,
              so the video plays clean until the visitor points at it. Touch
              screens have no hover, so there it always shows. */}
          <button
            type="button"
            onClick={() => setClosedInPreview(true)}
            aria-label="Close"
            title="Visitors close the video here"
            className={`absolute right-1.5 top-1.5 ${HOVER_BTN}`}
          >
            <X className="h-3.5 w-3.5" />
          </button>
          {/* A click anywhere on the video opens the large view, like the
              expand button; the close and the button below keep their own jobs. */}
          <div
            className={`group relative overflow-hidden rounded-2xl bg-black shadow-2xl ${src ? 'cursor-pointer' : ''}`}
            style={{ height: size.videoHeight }}
            onClick={() => src && setExpanded(true)}
          >
            {src ? (
              <video
                key={widgetSrc}
                src={widgetSrc}
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

            {/* A soft dim on hover, so the white buttons sit on a calmer
                picture instead of popping onto bright footage. */}
            <div className="pointer-events-none absolute inset-0 bg-black/0 transition-colors duration-200 group-hover/widget:bg-black/25" />

            {/* Title along the top, mirroring the countdown at the bottom: same
                type, two lines at most, over a soft shade that keeps it
                readable. 8px from the top edge, like the countdown from the
                bottom, and never moves. Both lines are the same width,
                36px in from each side, clear of the hover buttons. Rich text,
                two lines at most (the editor refuses a third). */}
            {title.html && (
              <div
                className="pointer-events-none absolute inset-x-0 top-0 px-9 pb-6 pt-2"
                style={{ background: title.look.shade }}
              >
                <p
                  ref={titleRef}
                  className="break-words text-sm font-medium leading-[1.4]"
                  style={{ color: title.look.color, textShadow: title.look.shadow, textAlign: title.align }}
                >
                  {/* Rich text from the title editor, the same HTML the embed sanitises. */}
                  <span dangerouslySetInnerHTML={{ __html: title.html }} />
                </p>
              </div>
            )}

            {/* Countdown at the bottom, just above the button — the same place
                as on the Smart Card. White or black, like the title, with the
                matching soft shadow so it reads on any footage. */}
            {showTimer && (
              <span
                className="pointer-events-none absolute inset-x-2 bottom-2 truncate text-center text-sm font-semibold tabular-nums"
                style={{ color: timerLook.color, textShadow: timerLook.shadow }}
              >
                {timeLeft(vs.endDate!)}
              </span>
            )}

            {/* Expand in the top-left corner, the close in the top-right: one
                row of controls, both white circles revealed on hover (always
                shown on touch screens). The title starts below that row. On
                the website expand opens the large view with sound. */}
            {src && (
              <button
                type="button"
                onClick={() => setExpanded(true)}
                aria-label="Open video"
                title="Opens the large view, as visitors see it"
                className={`absolute left-1.5 top-1.5 ${HOVER_BTN}`}
              >
                <Maximize className="h-3.5 w-3.5" />
              </button>
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
                className={`block h-10 w-full truncate rounded-lg px-3 text-sm font-semibold leading-10 ${button.background.type === 'transparent' ? '' : 'shadow-lg'} ${
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

          {/* The same style popup the Smart Card uses, opened from the
              palette beside "Button Text" on the left. Every write is
              redirected to the Video Story; the text controls are hidden
              because the field is plain text. */}
          {/* The title's style popup: the same panel as the Smart Card's
              fields, acting on the title's own editor (useVideoTitleEditing).
              Bold, italic, size and colour apply to the selected words, or to
              the whole title when nothing is selected. */}
          {titleEditing.styleOpen && !currentField && (
            <PromoFieldStylePanel
              field="title"
              fieldStyle={{ ...button, textAlign: vs.titleAlign ?? 'center' }}
              {...panelProps}
              fieldLabel="Title on video"
              // Always on the video's left; it moves inward when there isn't room.
              positionStyle={popupPosition(false)}
              activeFormats={titleEditing.rich.activeFormats}
              setCurrentField={() => titleEditing.setStyleOpen(false)}
              handlePromoToolbarFormat={titleEditing.format}
              handlePromoToolbarColor={titleEditing.color}
              setFieldAlignment={(titleAlign) => updateVideoStory({ titleAlign })}
              updateFieldBg={() => {}}
              showFieldBgTypeDropdown={false}
              setShowFieldBgTypeDropdown={() => {}}
              fieldBgTypePos={null}
              setFieldBgTypePos={() => {}}
              hideBackground
            />
          )}
          {currentField === 'button' && (
            <PromoFieldStylePanel
              field={currentField}
              fieldStyle={button}
              {...panelProps}
              fieldLabel={editor.getPopupFieldLabel(currentField)}
              positionStyle={popupPosition(onLeft)}
              activeFormats={{
                ...editor.activeFormats,
                color: button.textColor,
              }}
              setCurrentField={editor.setCurrentField}
              handlePromoToolbarFormat={editor.handlePromoToolbarFormat}
              // The card colours characters inside a rich editor; the video's
              // fields are plain text, so colour is the whole field's.
              handlePromoToolbarColor={(color) => setButtonStyle({ textColor: color })}
              setFieldAlignment={(textAlign) => setButtonStyle({ textAlign })}
              updateFieldBg={(patch: Partial<GradientStyle>) =>
                setButtonStyle({ background: { ...button.background, ...patch } })
              }
              showFieldBgTypeDropdown={editor.showFieldBgTypeDropdown}
              setShowFieldBgTypeDropdown={editor.setShowFieldBgTypeDropdown}
              fieldBgTypePos={editor.fieldBgTypePos}
              setFieldBgTypePos={editor.setFieldBgTypePos}
              hideTextFormatting
              allowTransparent
            />
          )}
        </div>
      </div>

      {/* The large view, as the website's expand opens it: centred, with sound
          available. Esc, the close button or a click outside closes it. */}
      {expanded && src && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Video"
          className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-6"
          onClick={(e) => e.target === e.currentTarget && setExpanded(false)}
        >
          <div className="relative aspect-[9/16] h-[80vh] overflow-hidden rounded-2xl bg-black shadow-2xl">
            <video src={src} autoPlay loop playsInline controls className="h-full w-full object-cover" />
            <button
              type="button"
              autoFocus
              onClick={() => setExpanded(false)}
              aria-label="Close large view"
              className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-full bg-white/90 text-black shadow-md"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Renders the Smart Card or the Video Story version of a piece of the tab. */
export function CampaignSwitch({ card, video }: { card: ReactNode; video: ReactNode }) {
  const { kind } = useVideoStory();
  return <>{kind === 'video' ? video : card}</>;
}
