'use client';

import type { RefObject } from 'react';
import { Megaphone, MoreVertical, Radio, Trash2 } from 'lucide-react';
import type { CampaignConfig } from '@/types/campaign';

interface AnnouncementHeaderProps {
  config: CampaignConfig;
  /** True only when the current content already matches what is published. */
  canReactivate: boolean;
  showResetMenu: boolean;
  setShowResetMenu: (update: boolean | ((open: boolean) => boolean)) => void;
  setShowStopConfirm: (open: boolean) => void;
  setShowGoOnAirConfirm: (open: boolean) => void;
  setShowResetConfirm: (open: boolean) => void;
  /** Anchors the outside-click dismissal that lives with the section. */
  resetMenuRef: RefObject<HTMLDivElement | null>;
}

/**
 * Section title plus the two controls that change the bar's live state: the
 * on-air toggle and the overflow menu holding "Start fresh".
 */
export function AnnouncementHeader({
  config,
  canReactivate,
  showResetMenu,
  setShowResetMenu,
  setShowStopConfirm,
  setShowGoOnAirConfirm,
  setShowResetConfirm,
  resetMenuRef,
}: AnnouncementHeaderProps) {
  return (
    <div className="px-4 py-2 border-border bg-surface/60 flex items-center justify-between">
      <div className="flex items-center">
        <div className="p-1 bg-primary/15 rounded-lg mr-3 border border-primary/60"><Megaphone className="w-4 h-4 text-primary" /></div>
        <div>
          <h3 className="text-[1.75rem] leading-9 font-bold text-on-surface">Announcement Bar</h3>
          <p className="mt-2 max-w-2xl text-sm text-on-surface-variant">Top banner for site-wide alerts.</p>
        </div>
      </div>
      <div className="flex items-center gap-1">
        <button
          onClick={
            config.announcementBar.active
              ? () => setShowStopConfirm(true)
              : canReactivate
              ? () => setShowGoOnAirConfirm(true)
              : undefined
          }
          disabled={!config.announcementBar.active && !canReactivate}
          aria-pressed={config.announcementBar.active}
          title={
            config.announcementBar.active
              ? 'On air — tap to stop'
              : canReactivate
              ? 'Reactivate the same content — go on air now'
              : 'You have unpublished changes — Save & Publish to go live'
          }
          className={`inline-flex flex-none items-center gap-2 rounded-full border px-4 py-[9px] text-[13px] font-medium transition-colors duration-200 ${
            config.announcementBar.active
              ? 'border-transparent bg-primary/[0.13] text-primary hover:bg-primary/[0.18] cursor-pointer'
              : canReactivate
              ? 'border-border bg-surface-elevated text-on-surface-variant hover:border-primary/50 hover:text-primary cursor-pointer'
              : 'border-border bg-surface-elevated text-on-surface-variant/40 cursor-not-allowed'
          }`}
        >
          {config.announcementBar.active ? (
            <>
              <span className="eq-bars"><i /><i /><i /><i /></span>
              On air · tap to stop
            </>
          ) : (
            <>
              <Radio className="w-4 h-4" />
              Go on air
            </>
          )}
        </button>
        <div ref={resetMenuRef} className="relative">
          <button
            type="button"
            onClick={() => setShowResetMenu((v) => !v)}
            aria-haspopup="menu"
            aria-expanded={showResetMenu}
            title="More actions"
            className="inline-flex h-9 w-9 flex-none items-center justify-center rounded-full border border-border bg-surface-elevated text-on-surface-variant transition-colors hover:border-primary/50 hover:text-primary"
          >
            <MoreVertical className="w-4 h-4" />
          </button>
          {showResetMenu && (
            <div
              role="menu"
              className="absolute right-0 top-full z-30 mt-1 w-48 overflow-hidden rounded-lg border border-border bg-surface-elevated shadow-lg"
            >
              <button
                type="button"
                role="menuitem"
                title="Reset all messages and styling to defaults"
                onClick={() => { setShowResetMenu(false); setShowResetConfirm(true); }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-medium text-red-500 transition-colors hover:bg-red-500/10"
              >
                <Trash2 className="w-4 h-4 flex-none" />
                Start fresh
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
