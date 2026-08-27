'use client';

interface PromoSkeletonGhostsProps {
  /** The card is still a blank start — nothing has been designed into it yet. */
  blankStart: boolean;
  showTimerInPreview: boolean;
  showButtonInPreview: boolean;
  /** Drives both outlines, at different opacities. */
  textColor: string;
  /** Decides which of the two countdown instructions is the outstanding one. */
  endDate: string;
}

/**
 * Ghosts for the two parts of the card that are switched off.
 *
 * A cleared card has no countdown and no button, so the skeleton stopped after
 * the description and the lower half of the card was blank — someone who has
 * never built one had no way to know a countdown or a button were even
 * possible, which is the whole reason the skeleton exists.
 *
 * Inert on purpose. They are dashed outlines that render nothing real:
 * showTimer and showButton stay false, so nothing here can switch the countdown
 * back on behind the user, and they disappear the moment a design arrives or
 * the toggle is turned on for real.
 */
export function PromoSkeletonGhosts({
  blankStart,
  showTimerInPreview,
  showButtonInPreview,
  textColor,
  endDate,
}: PromoSkeletonGhostsProps) {
  if (!blankStart) return null;

  return (
    <>
      {!showTimerInPreview && (
        <div
          className="mb-2 rounded border border-dashed px-2 py-1.5 text-center text-xs"
          style={{
            borderColor: `${textColor}33`,
            color: `${textColor}66`,
          }}
        >
          {/* Says the step that is actually outstanding.
              Fixed text told people to set an end date they may have already
              set — the countdown turns itself on when a cleared card gets its
              dates, so the only way to be looking at this ghost WITH dates in
              place is to have switched the timer off by hand. Repeating the
              first instruction there is telling someone to redo work they have
              done. */}
          {endDate
            ? 'Countdown — turn on Countdown Timer Display'
            : 'Countdown — set an end date to switch it on'}
        </div>
      )}

      {!showButtonInPreview && (
        <div className="flex justify-center">
          {/* A dashed outline again, not a filled button. Filling it made the
              card look finished — a real call to action sitting on a real
              design — which is exactly what a skeleton must not look like.
              Dashed says "something goes here", which is the whole message. */}
          <div
            className="rounded border border-dashed px-4 py-1.5 text-xs"
            style={{
              borderColor: `${textColor}55`,
              color: `${textColor}aa`,
            }}
          >
            Button — turn on Call to Action
          </div>
        </div>
      )}
    </>
  );
}
