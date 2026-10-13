'use client';

import { CircleStop, Clapperboard, Info as InfoIcon, Pencil, Plus, Radio } from 'lucide-react';
import type { VideoStory } from '@/types/campaign';
import type { VideoStoryStatus } from '@/lib/videoStory/videoStoryStatus';
import { fmtDate } from '@/components/dashboard/dashboardFormat';
import { isOpenEnded } from '@/lib/promo/promoSchedule';
import { describeWhen } from '@/lib/auth/presenceClient';
import { GHOST_BTN, MICRO, PRIMARY_BTN, STOP_BTN } from '@/components/dashboard/dashboardStyles';

interface DashboardVideoStoryCardProps {
  /** The PUBLISHED Video Story — the dashboard mirrors the site, not the editor. */
  vs: VideoStory | undefined;
  status: VideoStoryStatus;
  /** A saved draft that differs from live, and when it was saved. */
  draftSavedAt: string | null;
  onEdit: () => void;
  onStop: () => void;
  onGoOnAir: () => void;
}

const STATUS_LINE: Record<Exclude<VideoStoryStatus, 'notCreated'>, { dot: string; text: string }> = {
  live: { dot: 'bg-emerald-600 dark:bg-emerald-400', text: 'On air' },
  ended: { dot: 'bg-amber-500', text: 'Ended' },
  off: { dot: 'bg-on-surface-variant/50', text: 'Turned off' },
};

/**
 * The Video Story's lifecycle card, beside the Smart Card's and the bar's.
 *
 * Its own file because the other two already fill DashboardLifecycleCards to
 * near the length ceiling. Laid out zone for zone like them — header, status,
 * preview stage, helper line, actions — so the three read as one set.
 */
export function DashboardVideoStoryCard({
  vs,
  status,
  draftSavedAt,
  onEdit,
  onStop,
  onGoOnAir,
}: DashboardVideoStoryCardProps) {
  const onAir = status === 'live' || status === 'ended';
  const line = status === 'notCreated' ? null : STATUS_LINE[status];

  return (
    <div className="flex h-full flex-col justify-between gap-4 rounded-2xl border border-border campaign-card-surface p-6 shadow-sm">
      {/* Header */}
      <div className="flex h-10 shrink-0 items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-background">
            <Clapperboard className="h-5 w-5 text-primary" />
          </div>
          <div className="flex flex-col gap-0.5">
            <h3 className="text-base font-semibold text-on-surface">Video Story</h3>
            <p className={`${MICRO} text-on-surface-variant`}>Floating video</p>
          </div>
        </div>
        {onAir && (
          <button
            type="button"
            onClick={onStop}
            aria-label="Stop the live Video Story"
            title="Stop the live Video Story"
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-surface-elevated px-3 text-xs font-medium text-on-surface transition-colors hover:bg-surface-subtle hover:text-primary"
          >
            <CircleStop className="h-4 w-4" />
            Stop
          </button>
        )}
      </div>

      {/* Status */}
      {line && vs ? (
        <div className="flex h-7 shrink-0 items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <span className={`h-2 w-2 rounded-full ${line.dot}`} />
            <span className="text-[15px] font-semibold text-on-surface">{line.text}</span>
          </div>
          {vs.startDate && (
            <span className="inline-flex shrink-0 items-center rounded-md bg-surface-subtle px-2 py-0.5 text-xs font-medium tabular-nums text-on-surface-variant">
              {fmtDate(vs.startDate)} –{' '}
              {/* Open-ended is the schedule mode, not a missing date: a range
                  nobody finished is not running until stopped. */}
              {isOpenEnded(vs) ? 'Open ended' : vs.endDate ? fmtDate(vs.endDate) : 'No end date'}
            </span>
          )}
        </div>
      ) : (
        <div className="h-7 shrink-0" aria-hidden />
      )}

      {/* Preview stage — a 9:16 frame; the clip itself arrives with uploads. */}
      <div className="relative flex h-[180px] items-center justify-center overflow-hidden rounded-xl border border-border bg-surface-subtle p-3 text-border shadow-inner [background-image:radial-gradient(currentColor_1px,transparent_1px)] [background-size:16px_16px]">
        <div className="flex h-full aspect-[9/16] flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-background/60 text-on-surface-variant">
          <Clapperboard className="h-6 w-6" />
          {vs?.showButton && vs.buttonText.trim() && (
            <span className="max-w-[90%] truncate rounded px-2 py-0.5 text-[11px] font-semibold">
              {vs.buttonText}
            </span>
          )}
        </div>
      </div>

      {/* Helper line */}
      <div className="flex h-10 shrink-0 items-center">
        {draftSavedAt ? (
          <div className="flex h-10 w-full items-center gap-2 rounded-lg border border-blue-100 bg-blue-50 px-3 dark:border-blue-800 dark:bg-blue-950">
            <InfoIcon className="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
            <span className="text-[13px] font-medium text-blue-800 dark:text-blue-100">
              Saved to cloud {describeWhen(draftSavedAt)} • Draft pending
            </span>
          </div>
        ) : status === 'live' ? (
          <div className="flex h-10 w-full items-center gap-2 rounded-lg border border-emerald-100 bg-emerald-50 px-3 dark:border-emerald-800 dark:bg-emerald-950">
            <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-500 dark:bg-emerald-400" />
            <span className="text-[13px] font-medium text-emerald-800 dark:text-emerald-100">
              Live version active on site
            </span>
          </div>
        ) : status === 'notCreated' ? (
          <span className="text-[13px] leading-snug text-on-surface-variant">
            No Video Story yet — create one to show it on your site.
          </span>
        ) : null}
      </div>

      {/* Actions */}
      {status === 'notCreated' ? (
        <button type="button" className={`${PRIMARY_BTN} h-[42px] w-full`} onClick={onEdit}>
          <Plus className="h-4 w-4" />
          Create Video Story
        </button>
      ) : (
        <div className="flex h-[42px] gap-2.5">
          <button type="button" className={`${GHOST_BTN} flex-1`} onClick={onEdit}>
            <Pencil className="h-4 w-4" />
            Edit
          </button>
          {onAir ? (
            <button type="button" className={`${STOP_BTN} flex-1`} onClick={onStop}>
              <CircleStop className="h-4 w-4" />
              Stop
            </button>
          ) : (
            <button type="button" className={`${PRIMARY_BTN} flex-1`} onClick={onGoOnAir}>
              <Radio className="h-4 w-4" />
              Go on air
            </button>
          )}
        </div>
      )}
    </div>
  );
}
