'use client';

import { Power } from 'lucide-react';

interface PromoPreviewHeaderProps {
  /** The published card is currently running on the site. */
  liveIsOnAir: boolean;
  /** Nothing has changed since publishing, so the same card can go back up. */
  canReactivate: boolean;
  setShowStopConfirm: (open: boolean) => void;
  setShowGoOnAirConfirm: (open: boolean) => void;
}

/**
 * The preview column's heading and its status chip.
 *
 * The chip is one control with three states — on air (tap to stop), go on air
 * (same content, one click), and disabled (edited content, so it needs Save &
 * Publish first). Every branch below tests `liveIsOnAir` then `canReactivate`
 * in that order, so the handler, the disabled flag, the tooltip and the styling
 * can never disagree about which state is showing.
 */
export function PromoPreviewHeader({
  liveIsOnAir,
  canReactivate,
  setShowStopConfirm,
  setShowGoOnAirConfirm,
}: PromoPreviewHeaderProps) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h4 className="text-xs font-bold text-on-surface-variant uppercase tracking-[0.08em]">
            Preview
          </h4>
          <p className="mt-2 text-sm text-on-surface-variant">
            See your promo card update as you edit — click any field to restyle it.
          </p>
        </div>
        <div className="shrink-0">
          <button
            type="button"
            onClick={
              liveIsOnAir
                ? () => setShowStopConfirm(true)
                : canReactivate
                  ? () => setShowGoOnAirConfirm(true)
                  : undefined
            }
            disabled={!liveIsOnAir && !canReactivate}
            aria-pressed={liveIsOnAir}
            title={
              liveIsOnAir
                ? 'Your published card is on air — tap to stop it'
                : canReactivate
                  ? 'Reactivate the same content — go on air now'
                  : 'You have unpublished changes — Save & Publish to go live'
            }
            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-semibold transition-colors duration-200 ${
              liveIsOnAir
                ? 'border-transparent bg-primary/[0.13] text-primary hover:bg-primary/[0.18] cursor-pointer'
                : canReactivate
                  ? 'border-border bg-surface-subtle text-on-surface-variant hover:border-primary/50 hover:text-primary cursor-pointer'
                  : 'border-border bg-surface-subtle text-on-surface-variant/40 cursor-not-allowed'
            }`}
          >
            {liveIsOnAir ? (
              <>
                <span className="live-dot" />
                On air · tap to stop
              </>
            ) : (
              <>
                <Power className="h-3.5 w-3.5" />
                Go on air
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
