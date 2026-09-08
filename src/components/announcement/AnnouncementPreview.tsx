'use client';

import { useEffect, useRef, useState, type RefObject } from 'react';
import { ArrowRight, Palette, Pause, Repeat } from 'lucide-react';
import type { CampaignConfig, GradientStyle } from '@/types/campaign';
import { getBackgroundStyle } from '@/lib/utils';
import { SPEED_PRESETS, DEFAULT_PX_PER_SEC } from '@/lib/announcement/scrollSpeed';
import { announcementThemes } from '@/lib/announcement/announcementThemes';
import { BarAppearancePopover } from '@/components/announcement/BarAppearancePopover';
import { useAnnouncementEditor } from './AnnouncementEditorContext';

interface AnnouncementPreviewProps {
  config: CampaignConfig;
  previewBg: GradientStyle;
  visibleAnnouncements: CampaignConfig['announcementBar']['announcements'];
  loopCopies: number;
  scrollContainerRef: RefObject<HTMLDivElement | null>;
  loop: boolean;
  onLoopChange: (next: boolean) => void;
  speed: number;
  onSpeedChange: (next: number) => void;
}

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
            className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors ${active ? 'bg-primary text-on-primary shadow-sm' : 'text-on-surface-variant hover:text-on-surface'
              }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

function appearanceTriggerLabel(bg: GradientStyle, textColor: string, activeThemeId: string | null, isThemeMode: boolean): string {
  if (isThemeMode && activeThemeId) {
    const theme = announcementThemes.find((t) => t.id === activeThemeId);
    if (theme) return `Theme: ${theme.name}`;
  }
  const typeLabel = bg.type === 'radial' ? 'Gradient' : bg.type.charAt(0).toUpperCase() + bg.type.slice(1);
  return `${typeLabel}`;
}

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
  const isPaused = speed <= 0;
  const lastSpeedRef = useRef(speed > 0 ? speed : DEFAULT_PX_PER_SEC);
  useEffect(() => {
    if (speed > 0) lastSpeedRef.current = speed;
  }, [speed]);
  const togglePause = () => onSpeedChange(isPaused ? lastSpeedRef.current || DEFAULT_PX_PER_SEC : 0);

  const [appearanceOpen, setAppearanceOpen] = useState(false);
  const appearanceBtnRef = useRef<HTMLButtonElement>(null);

  const bg = config.announcementBar.style.background;
  const textColor = config.announcementBar.style.textColor;
  const { activeThemeId, isThemeMode } = useAnnouncementEditor();
  const triggerLabel = appearanceTriggerLabel(bg, textColor, activeThemeId, isThemeMode);

  return (
    <div className="pt-2 pb-0 border-border rounded-md">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-nowrap items-center gap-3 shrink-0">
          <h4 className="text-xs font-bold text-on-surface-variant uppercase tracking-[0.08em] select-none">
            Styling Studio: 
          </h4>

          <button
            ref={appearanceBtnRef}
            type="button"
            onClick={() => setAppearanceOpen((v) => !v)}
            aria-pressed={appearanceOpen}
            title="Edit bar appearance and themes"
            className={`flex h-7 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-medium transition-colors ${appearanceOpen
                ? 'border-primary/80 bg-primary/10 text-primary'
                : 'border-border bg-surface-subtle text-on-surface-variant hover:border-primary/60 hover:text-on-surface'
              }`}
          >
            <Palette className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span className="max-w-[160px] truncate">{triggerLabel}</span>
            <svg
              className={`h-3.5 w-3.5 shrink-0 transition-transform ${appearanceOpen ? 'rotate-180' : ''}`}
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
            >
              <path d="M4 6l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-[0.08em] text-on-surface-variant">FLOW:</span>
            <SegmentedControl
              label="Loop mode"
              value={loop}
              onChange={onLoopChange}
              options={[
                { value: false, label: (<><ArrowRight className="h-3 w-3" aria-hidden="true" />Single</>), title: 'Keeps your message as a single line with open space between passes.' },
                { value: true, label: (<><Repeat className="h-3 w-3" aria-hidden="true" />Loop</>), title: 'Repeats your message end-to-end to fill every inch of the banner.' },
              ]}
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-[0.08em] text-on-surface-variant">Speed:</span>
            <div role="group" aria-label="Scroll speed" className="flex rounded-lg border border-border bg-surface-subtle p-0.5">
              <button
                type="button"
                onClick={togglePause}
                aria-pressed={isPaused}
                title={isPaused ? 'Paused — click to resume' : 'Pause scrolling'}
                className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors ${isPaused ? 'bg-primary text-on-primary shadow-sm' : 'text-on-surface-variant hover:text-on-surface'
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
                    className={`rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors ${active ? 'bg-primary text-on-primary shadow-sm' : 'text-on-surface-variant hover:text-on-surface'
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
        {visibleAnnouncements.length > 0 && (
          <div
            ref={scrollContainerRef}
            className="h-10 text-sm font-medium overflow-hidden flex items-center group"
            style={{
              background: getBackgroundStyle(previewBg),
              color: config.announcementBar.style.textColor,
            }}
          >
            <div className="animate-scroll-left">
              {(() => {
                const isLoopOn = config.announcementBar.loop !== false;
                const totalSets = isLoopOn ? loopCopies * 2 : 2;
                return [...Array(totalSets)].map((_, setIndex) => (
                  <span
                    key={setIndex}
                    className="inline-flex items-center justify-center"
                    style={!isLoopOn ? { minWidth: 'var(--set-min-width, 100%)' } : undefined}
                  >
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

      <BarAppearancePopover
        triggerRef={appearanceBtnRef}
        open={appearanceOpen}
        onClose={() => setAppearanceOpen(false)}
      />
    </div>
  );
}