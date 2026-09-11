'use client';

import { useState, useEffect, useRef } from 'react';
import { Check, ChevronDown, X } from 'lucide-react';
import type { ActionableIssue } from '@/hooks/useCommandBar';

export type { ActionableIssue };

interface CommandBarProps {
  siteName?: string;
  lastPublished?: string;
  isLive?: boolean;
  liveStatusText?: string;
  initialIssues?: ActionableIssue[];
  onIssueAction?: (issueId: string) => void;
  className?: string;
}

// ── Design tokens ──────────────────────────────────────────────────────────────

const PRIORITY_CONFIG = {
  high: {
    icon: '🔴',
  },
  medium: {
    icon: '🟡',
  },
  low: {
    icon: '🔵',
  },
} as const;

// ── THEME-CONSISTENT BUTTON ──
// Light mode: white text, Dark mode: proper contrast from theme
const CTA_CLASSES =
  'bg-primary hover:bg-primary/80 active:bg-primary/90 text-white dark:text-primary-foreground transition-all duration-150 ease-in-out shadow-sm focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-900';

// ── CHIP STYLES using theme tokens ──
const CHIP_STYLES = {
  high: {
    border: 'border-red-400/50',
    bg: 'bg-red-50/30 dark:bg-red-950/20',
    text: 'text-red-700 dark:text-red-400',
  },
  medium: {
    border: 'border-amber-400/50',
    bg: 'bg-amber-50/30 dark:bg-amber-950/20',
    text: 'text-amber-700 dark:text-amber-400',
  },
  low: {
    border: 'border-blue-400/50',
    bg: 'bg-blue-50/30 dark:bg-blue-950/20',
    text: 'text-blue-700 dark:text-blue-400',
  },
} as const;

const INLINE_LIMIT = 1;

// ── Sub-components ────────────────────────────────────────────────────────────

function LiveDot({ isLive }: { isLive: boolean }) {
  if (!isLive) {
    return (
      <span
        className="inline-block shrink-0 rounded-full bg-on-surface-variant/30 dark:bg-on-surface-variant/30"
        style={{ width: 8, height: 8 }}
      />
    );
  }
  return (
    <span
      className="live-dot text-emerald-500 shrink-0 dark:text-emerald-400"
      style={{ width: 8, height: 8 }}
    />
  );
}

function IssueChip({
  issue,
  onAction,
}: {
  issue: ActionableIssue;
  onAction?: () => void;
}) {
  const styles = CHIP_STYLES[issue.severity];

  return (
    <div
      className={`flex items-center rounded-lg border ${styles.border} ${styles.bg} ${styles.text}`}
      style={{ height: 34, padding: '4px 4px 4px 10px', gap: 8 }}
    >
      <span className="shrink-0 text-[13px] leading-none">{PRIORITY_CONFIG[issue.severity].icon}</span>
      <span className="whitespace-nowrap font-medium text-xs leading-4">
        {issue.message}
      </span>
      {issue.action && (
        <button
          type="button"
          onClick={onAction ?? issue.action.onClick}
          className={`flex shrink-0 items-center justify-center rounded-md font-semibold leading-4 ${CTA_CLASSES}`}
          style={{
            height: 26,
            padding: '4px 10px',
            minWidth: 48,
            maxWidth: 80,
            fontSize: 11,
            lineHeight: '16px',
            letterSpacing: '0.01em',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {issue.action.label}
        </button>
      )}
    </div>
  );
}

function OverflowBadge({
  count,
  isOpen,
  onClick,
}: {
  count: number;
  isOpen: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={isOpen}
      className="flex shrink-0 items-center rounded-lg border border-border bg-surface-elevated font-semibold text-on-surface-variant transition-colors hover:border-primary/50 hover:text-primary dark:border-border dark:bg-surface-elevated dark:text-on-surface-variant"
      style={{ height: 34, padding: '6px 12px', fontSize: 12, gap: 6 }}
    >
      <span>+{count} More</span>
      <ChevronDown
        className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
        style={{ width: 12, height: 12 }}
      />
    </button>
  );
}

function FlyoutDrawer({
  issues,
  onClose,
  onAction,
}: {
  issues: ActionableIssue[];
  onClose: () => void;
  onAction: (id: string) => void;
}) {
  return (
    <div
      className="absolute right-0 z-50 rounded-xl border border-white/10 bg-black/10 p-4 text-on-surface shadow-2xl backdrop-blur-md"
      style={{
        top: 'calc(100% + 6px)',
        width: 440,
        animation: 'fadeSlideDown 150ms ease-out both',
      }}
    >
      {/* Header */}
      <div className="mb-3 flex items-center justify-between border-b border-white/10 pb-3">
        <span className="font-bold uppercase tracking-[0.08em] text-on-surface-variant text-[11px]">
          All Pending Issues ({issues.length})
        </span>
        <button
          type="button"
          onClick={onClose}
          className="flex h-6 w-6 items-center justify-center rounded-md text-on-surface-variant transition-colors hover:bg-white/10 hover:text-on-surface"
          aria-label="Close issues drawer"
        >
          <X style={{ width: 14, height: 14 }} />
        </button>
      </div>

      {/* Rows */}
      <div className="flex flex-col" style={{ gap: 8 }}>
        {issues.map((issue) => {
          const styles = CHIP_STYLES[issue.severity];
          return (
            <div
              key={issue.id}
              className="flex items-center justify-between rounded-lg bg-white/5 transition-colors hover:bg-white/10"
              style={{ height: 40, padding: '8px 12px', gap: 12 }}
            >
              <div className="flex min-w-0 flex-1 items-center" style={{ gap: 10 }}>
                <span className="shrink-0 text-[13px] leading-none">{PRIORITY_CONFIG[issue.severity].icon}</span>
                <span className="truncate text-on-surface text-[13px] font-medium leading-[18px]">
                  {issue.message}
                </span>
              </div>
              {issue.action && (
                <button
                  type="button"
                  onClick={() => onAction(issue.id)}
                  className={`shrink-0 rounded-md font-semibold leading-4 ${CTA_CLASSES}`}
                  style={{
                    height: 26,
                    padding: '4px 10px',
                    minWidth: 48,
                    maxWidth: 80,
                    fontSize: 11,
                    lineHeight: '16px',
                    letterSpacing: '0.01em',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {issue.action.label}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Bar state styles using theme tokens ──────────────────────────────────────

const BAR_STYLES = {
  healthy: {
    background: 'rgba(var(--border), 0.02)',
    borderColor: 'rgba(var(--border), 0.10)',
  },
  warning: {
    background: 'rgba(245,158,11, 0.05)',
    borderColor: 'rgba(245,158,11, 0.20)',
  },
  offline: {
    background: 'rgba(var(--border), 0.05)',
    borderColor: 'rgba(var(--border), 0.20)',
  },
} as const;

function getBarStyles(hasIssues: boolean, isLive: boolean) {
  if (hasIssues) return BAR_STYLES.warning;
  if (!isLive) return BAR_STYLES.offline;
  return BAR_STYLES.healthy;
}

// ── Main component ────────────────────────────────────────────────────────────

export function CommandBar({
  siteName = 'Your Site',
  lastPublished = '—',
  isLive = false,
  liveStatusText = 'No campaigns are currently live',
  initialIssues = [],
  onIssueAction,
  className = '',
}: CommandBarProps) {
  const [isFlyoutOpen, setIsFlyoutOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close flyout on outside click
  useEffect(() => {
    if (!isFlyoutOpen) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsFlyoutOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isFlyoutOpen]);

  const handleIssueAction = (id: string) => {
    onIssueAction?.(id);
    const issue = initialIssues.find((i) => i.id === id);
    if (issue?.action) {
      issue.action.onClick();
    }
    setIsFlyoutOpen(false);
  };

  const hasIssues = initialIssues.length > 0;
  const visibleIssues = initialIssues.slice(0, INLINE_LIMIT);
  const overflowIssues = initialIssues.slice(INLINE_LIMIT);
  const hasOverflow = overflowIssues.length > 0;

  const { background, borderColor } = getBarStyles(hasIssues, isLive);

  return (
    <div
      ref={containerRef}
      className={`relative ${className}`}
      style={{
        width: '100%',
        height: 68,
        padding: '12px 24px',
        borderRadius: 12,
        border: '1px solid',
        borderColor,
        background,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}
    >
      {/* LEFT ZONE */}
      <div
        style={{
          minWidth: 360,
          height: 44,
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
        }}
      >
        <div className="flex items-center" style={{ gap: 8 }}>
          <span
            className="font-bold uppercase text-on-surface-variant dark:text-on-surface-variant"
            style={{ fontSize: 11, lineHeight: '14px', letterSpacing: '0.08em' }}
          >
            {siteName}
          </span>
          {/* <span className="text-on-surface-variant/40 dark:text-on-surface-variant/40" style={{ fontSize: 11 }}>•</span> */}
          {/* <span
            className="font-medium text-on-surface-variant/60 dark:text-on-surface-variant/60"
            style={{ fontSize: 11, lineHeight: '14px' }}
          >
            {lastPublished}
          </span> */}
        </div>
        <div className="flex items-center" style={{ gap: 8 }}>
          <LiveDot isLive={isLive} />
          <span
            className="font-semibold text-on-surface dark:text-on-surface"
            style={{ fontSize: 14, lineHeight: '20px' }}
          >
            {liveStatusText}
          </span>
        </div>
      </div>

      {/* DIVIDER */}
      <div className="shrink-0 bg-border dark:bg-border" style={{ width: 1, height: 32, margin: '0 24px' }} />

      {/* RIGHT ZONE */}
      <div className="flex min-w-0 flex-1 items-center justify-end" style={{ gap: 12 }}>
        <span
          className={`shrink-0 whitespace-nowrap font-bold uppercase tracking-[0.08em] text-[11px] leading-[14px] ${hasIssues ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'
            }`}
        >
          {hasIssues
            ? `⚠️ NEEDS ATTENTION (${initialIssues.length})`
            : '✅ ALL HEALTHY'}
        </span>

        {hasIssues ? (
          <>
            {visibleIssues.map((issue) => (
              <IssueChip
                key={issue.id}
                issue={issue}
                onAction={() => handleIssueAction(issue.id)}
              />
            ))}
            {hasOverflow && (
              <OverflowBadge
                count={overflowIssues.length}
                isOpen={isFlyoutOpen}
                onClick={() => setIsFlyoutOpen((v) => !v)}
              />
            )}
          </>
        ) : (
          <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
            <Check style={{ width: 14, height: 14 }} strokeWidth={2.5} />
            <span className="text-sm font-medium">All systems go</span>
          </div>
        )}
      </div>

      {/* FLYOUT */}
      {isFlyoutOpen && hasOverflow && (
        <FlyoutDrawer
          issues={initialIssues}
          onClose={() => setIsFlyoutOpen(false)}
          onAction={handleIssueAction}
        />
      )}
    </div>
  );
}

export default CommandBar;