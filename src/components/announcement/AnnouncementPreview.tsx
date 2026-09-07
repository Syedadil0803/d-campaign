'use client';

import { useEffect, useRef, type RefObject } from 'react';
import { ArrowRight, Pause, Repeat } from 'lucide-react';
import type { CampaignConfig, GradientStyle } from '@/types/campaign';
import { getBackgroundStyle } from '@/lib/utils';
import { SPEED_PRESETS, DEFAULT_PX_PER_SEC } from '@/lib/announcement/scrollSpeed';

interface AnnouncementPreviewProps {
  config: CampaignConfig;
  /** The bar's background, already carrying any hovered direction preview. */
  previewBg: GradientStyle;
  /** Only the announcements currently in their scheduled window. */
  visibleAnnouncements: CampaignConfig['announcementBar']['announcements'];
  /** How many copies the marquee repeats — measured, not guessed. */
  loopCopies: number;
  scrollContainerRef: RefObject<HTMLDivElement | null>;
  /** Whether the marquee repeats (Loop) or runs once and stops (Single). */
  loop: boolean;
  onLoopChange: (next: boolean) => void;
  /** Scroll speed in pixels per second (0 = paused). */
  speed: number;
  onSpeedChange: (next: number) => void;
}

/** One compact segmented control, styled to match the schedule/promo toggles. */
function SegmentedControl<T>({
  options,
  value,
  onChange,
  label,
}: {
  options: { value: T; label: React.ReactNode; title: string }[];
  value: T;
  onChange: (next: T) => void;
  label: string;
}) {
  return (
    <div role="group" aria-label={label} className="flex rounded-lg border border-border bg-surface-subtle p-0.5">
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={String(opt.value)}
            type="button"
            title={opt.title}
            aria-pressed={active}
            onClick={() => onChange(opt.value)}
            className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors ${
              active ? 'bg-primary text-on-primary shadow-sm' : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * The live marquee preview. Read-only: it renders the bar exactly as the site
 * will, including when the campaign is stopped, so the admin can tune styling
 * without going on air.
 */
export function AnnouncementPreview({
  config,
  previewBg,
  visibleAnnouncements,
  loopCopies,
  scrollContainerRef,
  loop,
  onLoopChange,
  speed,
  onSpeedChange,
}: AnnouncementPreviewProps) {
  // Pause stores 0 px/s and remembers the pace to resume to.
  const isPaused = speed <= 0;
  const lastSpeedRef = useRef(speed > 0 ? speed : DEFAULT_PX_PER_SEC);
  useEffect(() => {
    if (speed > 0) lastSpeedRef.current = speed;
  }, [speed]);
  const togglePause = () => onSpeedChange(isPaused ? lastSpeedRef.current || DEFAULT_PX_PER_SEC : 0);

  return (
      <div className="pt-2 pb-0 border-border rounded-md">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h4 className="text-xs font-bold text-on-surface-variant uppercase tracking-[0.08em]">Preview</h4>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-[0.08em] text-on-surface-variant">Mode:</span>
              <SegmentedControl
                label="Loop mode"
                value={loop}
                onChange={onLoopChange}
                options={[
                  { value: false, label: (<><ArrowRight className="h-3 w-3" aria-hidden="true" />Single</>), title: 'Runs once, then stops' },
                  { value: true, label: (<><Repeat className="h-3 w-3" aria-hidden="true" />Loop</>), title: 'Repeats continuously' },
                ]}
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-[0.08em] text-on-surface-variant">Speed:</span>
              {/* Pause shares the speeds' pill — one control, mutually exclusive. */}
              <div role="group" aria-label="Scroll speed" className="flex rounded-lg border border-border bg-surface-subtle p-0.5">
                <button
                  type="button"
                  onClick={togglePause}
                  aria-pressed={isPaused}
                  title={isPaused ? 'Paused — click to resume' : 'Pause scrolling'}
                  className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                    isPaused ? 'bg-primary text-on-primary shadow-sm' : 'text-on-surface-variant hover:text-on-surface'
                  }`}
                >
                  <Pause className="h-3 w-3" aria-hidden="true" />
                  Pause
                </button>
              {SPEED_PRESETS.map((p) => {
                const active = !isPaused && speed === p.pxPerSec;
                return (
                  <button
                    key={p.pxPerSec}
                    type="button"
                    onClick={() => onSpeedChange(p.pxPerSec)}
                    aria-pressed={active}
                    title={p.hint}
                    className={`rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                      active ? 'bg-primary text-on-primary shadow-sm' : 'text-on-surface-variant hover:text-on-surface'
                    }`}
                  >
                    {p.label}
                  </button>
                );
              })}
              </div>
            </div>
          </div>
        </div>
        <div className="w-full bg-surface-elevated border-border rounded overflow-hidden">
          {/* Preview always shows the content (with looping) whenever there
              are visible announcements — even when the campaign is stopped.
              On/off only affects the live site, not this preview. */}
          {visibleAnnouncements.length > 0 && (
            <div ref={scrollContainerRef} className="h-10 text-sm font-medium overflow-hidden flex items-center group"
              style={{
                background: getBackgroundStyle(previewBg),
                color: config.announcementBar.style.textColor,
              }}>
              <div className="animate-scroll-left">
                {(() => {
                  const isLoopOn = config.announcementBar.loop !== false;
                  const totalSets = isLoopOn ? loopCopies * 2 : 2;
                  return [...Array(totalSets)].map((_, setIndex) => (
                    <span key={setIndex} className="inline-flex items-center justify-center"
                      style={!isLoopOn ? { minWidth: 'var(--set-min-width, 100%)' } : undefined}>
                      {visibleAnnouncements.map((ann, i) => (
                        <span key={`${setIndex}-${i}`} className="inline-block px-4">
                          {ann.url ? (
                            <a
                              href={ann.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="animated-underline inline-block"
                              dangerouslySetInnerHTML={{ __html: ann.text }}
                            />
                          ) : (
                            <span dangerouslySetInnerHTML={{ __html: ann.text }} />
                          )}
                        </span>
                      ))}
                    </span>
                  ));
                })()}
              </div>
            </div>
          )}
          {visibleAnnouncements.length === 0 && (
            // No announcements yet — show the configured background so the
            // admin can preview/tune the bar's styling before adding text.
            <div
              className="h-10 flex items-center justify-center text-sm font-medium"
              style={{
                background: getBackgroundStyle(previewBg),
                color: config.announcementBar.style.textColor,
              }}
            >
              <span className="opacity-60">Your announcement will appear here</span>
            </div>
          )}
        </div>
      </div>
  );
}
