'use client';

import { Info } from 'lucide-react';
import { toLocalISODate } from '@/lib/utils';
import { isInvalidRange } from '@/lib/dateRange';
import { isOpenEnded } from '@/lib/promo/promoSchedule';
import { usePromoEditor } from '@/components/promo/PromoEditorContext';
import { PromoDatePicker } from '@/components/promo/PromoDatePicker';
import { SegmentedToggle } from '@/components/promo/SegmentedToggle';
import { useVideoStory } from '@/components/videoStory/VideoStoryContext';
import { OverlayColorPicker } from '@/components/videoStory/OverlayColorPicker';
import { VIDEO_TITLE_LOOK, videoTimerColor } from '@/lib/videoStory/videoTitle';

/**
 * The Video Story's Campaign Schedule section, bound to config.videoStory.
 *
 * Built from the same pieces as the card's (PromoEditorPanel's schedule block
 * and PromoScheduleAndTimer) so the two read as one design, but writes only
 * the video. There is no Timer Text: the video's countdown shows the time
 * left and nothing else, so it only has a colour.
 */
export function VideoStorySchedule() {
  const { videoStory: vs, updateVideoStory } = useVideoStory();
  // The calendars' open state is the editor's: only one panel is on screen at
  // a time, so the card's and the video's pickers can share it.
  const {
    showStartDatePicker,
    setShowStartDatePicker,
    showEndDatePicker,
    setShowEndDatePicker,
  } = usePromoEditor();
  const openEnded = isOpenEnded(vs);
  const rangeInvalid = isInvalidRange(vs.startDate, vs.endDate);
  // A countdown counts towards the end date, so it needs one.
  const canUseTimer = Boolean(vs.endDate);

  return (
    <>
      <div className="!mt-8">
        <h4 className="text-2xl font-semibold leading-8 text-on-surface">
          Campaign Schedule
        </h4>
        {/* Every section heading has a line under it, like Content and Call To
            Action; without one, the heading sat right on the toggle. */}
        <p className="mt-2 text-sm text-on-surface-variant">
          Choose when the video shows on your site.
        </p>
      </div>

      <div className="!mt-4 flex rounded-lg border border-border bg-surface-subtle p-0.5">
        {[
          { open: false, label: 'Custom dates' },
          { open: true, label: 'Open-ended' },
        ].map((opt) => {
          const active = openEnded === opt.open;
          return (
            <button
              key={opt.label}
              type="button"
              // Open-ended drops the end date and the countdown it fed.
              onClick={() =>
                opt.open !== openEnded &&
                updateVideoStory(
                  opt.open
                    ? { scheduleMode: 'openEnded', endDate: '', showTimer: false }
                    : { scheduleMode: 'range' },
                )
              }
              aria-pressed={active}
              className={`flex-1 rounded-md px-3.5 py-2 text-xs font-semibold transition-colors ${
                active
                  ? 'bg-primary text-on-primary shadow-sm'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              {opt.label}
            </button>
          );
        })}
      </div>

      {!openEnded && (
        <div className="!mt-5">
          <div className="flex items-center gap-2">
            <h5 className="text-base font-semibold text-on-surface">
              Campaign Duration
            </h5>
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
              Required
            </span>
          </div>
          <p className="mt-1 text-sm text-on-surface-variant">
            Set when the video goes live, and how long it stays.
          </p>
        </div>
      )}

      <div
        className="!mt-5 grid gap-4"
        style={{ gridTemplateColumns: openEnded ? '150px minmax(0, 1fr)' : '1fr 1fr' }}
      >
        <div>
          <label htmlFor="vs-start-date" className="block text-sm font-semibold text-on-surface mb-2">
            Start Date
          </label>
          <PromoDatePicker
            id="vs-start-date"
            value={vs.startDate}
            minDate={toLocalISODate(new Date())}
            open={showStartDatePicker}
            onOpenChange={(next) => {
              setShowStartDatePicker(next);
              if (next) setShowEndDatePicker(false);
            }}
            onChange={(startDate: string) => updateVideoStory({ startDate })}
          />
        </div>
        {!openEnded ? (
          <div>
            <label htmlFor="vs-end-date" className="block text-sm font-semibold text-on-surface mb-2">
              End Date
            </label>
            <PromoDatePicker
              id="vs-end-date"
              value={vs.endDate ?? ''}
              minDate={toLocalISODate(new Date())}
              align="right"
              invalid={rangeInvalid}
              open={showEndDatePicker}
              onOpenChange={(next) => {
                setShowEndDatePicker(next);
                if (next) setShowStartDatePicker(false);
              }}
              // Clearing the end date takes the countdown with it.
              onChange={(endDate: string) =>
                updateVideoStory(endDate ? { endDate } : { endDate, showTimer: false })
              }
            />
            {rangeInvalid && (
              <p className="mt-1.5 text-[11px] font-semibold text-red-600 dark:text-red-400">
                End date must be on or after the start date.
              </p>
            )}
          </div>
        ) : (
          <div>
            <span aria-hidden className="invisible mb-2 block text-sm font-semibold">
              End Date
            </span>
            <div className="flex h-11 items-center gap-2 rounded-lg bg-primary/[0.06] px-3 text-[11px] leading-tight text-on-surface-variant">
              <Info className="h-4 w-4 flex-shrink-0 text-primary" />
              <span>
                <b className="font-semibold text-on-surface">No end date.</b> Runs until you take
                it off from the dashboard.
              </span>
            </div>
          </div>
        )}
      </div>

      {!openEnded && (
        <>
          <div className="!mt-8 flex items-center justify-between gap-4 border-t border-border pt-8">
            <div>
              <div className="flex items-center gap-2">
                <h5 className="text-base font-semibold text-on-surface">
                  Countdown Timer Display
                </h5>
                <span className="rounded-full bg-on-surface-variant/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-on-surface-variant">
                  Optional
                </span>
              </div>
              <p className="mt-1 text-sm text-on-surface-variant">
                Show the time left on the video to create urgency.
              </p>
            </div>
            {canUseTimer ? (
              <SegmentedToggle
                value={vs.showTimer}
                onChange={(showTimer) => updateVideoStory({ showTimer })}
              />
            ) : (
              <div className="group relative">
                <SegmentedToggle value={false} onChange={() => {}} />
                <div className="pointer-events-none absolute inset-0 cursor-not-allowed rounded-full bg-surface/40" />
                <div className="pointer-events-none absolute right-0 top-full z-10 mt-2 w-56 rounded-lg border border-border bg-surface-elevated p-2 text-[11px] leading-relaxed text-on-surface opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
                  Set an end date first — the countdown needs one to count towards.
                </div>
              </div>
            )}
          </div>

          <div
            className={`ml-1 border-l-2 border-border pl-4 ${
              !vs.showTimer ? 'opacity-50 pointer-events-none' : ''
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              {/* Not a <label>: the colour is picked from the menu, not typed. */}
              <span className="block text-sm font-semibold text-on-surface">
                Countdown Colour
              </span>
              <OverlayColorPicker
                label="Countdown colour"
                value={videoTimerColor(vs)}
                onChange={(c) => updateVideoStory({ timerTextColor: VIDEO_TITLE_LOOK[c].color })}
              />
            </div>
            <p className="text-[11px] text-on-surface-variant leading-relaxed">
              The countdown shows the time left only, over the bottom of the video.
            </p>
          </div>
        </>
      )}
    </>
  );
}
