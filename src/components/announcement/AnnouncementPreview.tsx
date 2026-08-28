'use client';

import type { RefObject } from 'react';
import type { CampaignConfig, GradientStyle } from '@/types/campaign';
import { getBackgroundStyle } from '@/lib/utils';

interface AnnouncementPreviewProps {
  config: CampaignConfig;
  /** The bar's background, already carrying any hovered direction preview. */
  previewBg: GradientStyle;
  /** Only the announcements currently in their scheduled window. */
  visibleAnnouncements: CampaignConfig['announcementBar']['announcements'];
  /** How many copies the marquee repeats — measured, not guessed. */
  loopCopies: number;
  scrollContainerRef: RefObject<HTMLDivElement | null>;
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
}: AnnouncementPreviewProps) {
  return (
      <div className="py-4 border-border rounded-md">
        <h4 className="text-xs font-bold text-on-surface-variant uppercase tracking-[0.08em] mb-4">Preview</h4>
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
