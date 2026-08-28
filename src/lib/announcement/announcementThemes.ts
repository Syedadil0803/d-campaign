/**
 * Ready-made looks for the announcement bar.
 *
 * A theme sets background AND text colour together, so the choice is "which
 * bar do I want" rather than "which gradient function should I pick". Pairing
 * them is deliberate: choosing a background alone is how you get dark text on
 * a dark bar. Every pair clears WCAG AA at the bar's text size.
 *
 * On `midpoint`: the renderer holds startColor FLAT until midpoint%, then
 * blends to endColor (see getBackgroundStyle). So 0 is a true edge-to-edge
 * blend and a higher value pushes the change later. It is NOT a midpoint in
 * the usual gradient sense.
 */

import { GradientStyle } from '@/types/campaign';
import { getBackgroundStyle } from '@/lib/utils';

export interface AnnouncementTheme {
  id: string;
  name: string;
  background: GradientStyle;
  textColor: string;
}

export const announcementThemes: AnnouncementTheme[] = [
  // ── Deep & modern ────────────────────────────────────────────────
  {
    id: 'aurora',
    name: 'Aurora',
    background: { type: 'linear', startColor: '#7f5af0', endColor: '#2cb67d', direction: 'to bottom right', midpoint: 0 },
    textColor: '#ffffff',
  },
  {
    id: 'cosmic',
    name: 'Cosmic',
    background: { type: 'linear', startColor: '#302b63', endColor: '#0f0c29', direction: 'to right', midpoint: 0 },
    textColor: '#e0e7ff',
  },
  {
    id: 'nebula',
    name: 'Nebula',
    background: { type: 'radial', startColor: '#6d28d9', endColor: '#1e1b4b', midpoint: 10 },
    textColor: '#f5f3ff',
  },
  {
    id: 'twilight',
    name: 'Twilight',
    background: { type: 'linear', startColor: '#1e3a8a', endColor: '#9333ea', direction: 'to bottom right', midpoint: 0 },
    textColor: '#f8fafc',
  },
  {
    id: 'midnight',
    name: 'Midnight',
    background: { type: 'linear', startColor: '#0f172a', endColor: '#334155', direction: 'to right', midpoint: 0 },
    textColor: '#f8fafc',
  },
  {
    id: 'ink',
    name: 'Ink',
    background: { type: 'solid', startColor: '#0f172a', endColor: '#0f172a' },
    textColor: '#e2e8f0',
  },

  // ── Warm & loud ──────────────────────────────────────────────────
  {
    id: 'sunset',
    name: 'Sunset',
    background: { type: 'linear', startColor: '#ff512f', endColor: '#dd2476', direction: 'to right', midpoint: 0 },
    textColor: '#ffffff',
  },
  {
    id: 'ember',
    name: 'Ember',
    background: { type: 'linear', startColor: '#7f1d1d', endColor: '#f97316', direction: 'to bottom right', midpoint: 0 },
    textColor: '#fff7ed',
  },
  {
    id: 'punch',
    name: 'Punch',
    background: { type: 'linear', startColor: '#f43f5e', endColor: '#f97316', direction: 'to right', midpoint: 0 },
    textColor: '#ffffff',
  },
  {
    id: 'mango',
    name: 'Mango',
    background: { type: 'linear', startColor: '#f7971e', endColor: '#ffd200', direction: 'to right', midpoint: 0 },
    textColor: '#422006',
  },
  {
    id: 'coral',
    name: 'Coral',
    background: { type: 'linear', startColor: '#ff6a88', endColor: '#ffb199', direction: 'to right', midpoint: 0 },
    textColor: '#4c0519',
  },

  // ── Cool & calm ──────────────────────────────────────────────────
  {
    id: 'ocean',
    name: 'Ocean',
    background: { type: 'linear', startColor: '#0369a1', endColor: '#06b6d4', direction: 'to right', midpoint: 0 },
    textColor: '#f0f9ff',
  },
  {
    id: 'lagoon',
    name: 'Lagoon',
    background: { type: 'linear', startColor: '#0f766e', endColor: '#22d3ee', direction: 'to bottom right', midpoint: 0 },
    textColor: '#ecfeff',
  },
  {
    id: 'deep-sea',
    name: 'Deep Sea',
    background: { type: 'radial', startColor: '#0e7490', endColor: '#082f49', midpoint: 10 },
    textColor: '#ecfeff',
  },
  {
    id: 'forest',
    name: 'Forest',
    background: { type: 'linear', startColor: '#064e3b', endColor: '#10b981', direction: 'to right', midpoint: 0 },
    textColor: '#ecfdf5',
  },

  // ── Jewel tones ──────────────────────────────────────────────────
  {
    id: 'orchid',
    name: 'Orchid',
    background: { type: 'linear', startColor: '#a855f7', endColor: '#ec4899', direction: 'to right', midpoint: 0 },
    textColor: '#ffffff',
  },
  {
    id: 'grape',
    name: 'Grape',
    background: { type: 'linear', startColor: '#4c1d95', endColor: '#a21caf', direction: 'to bottom right', midpoint: 0 },
    textColor: '#fdf4ff',
  },
  {
    id: 'gold',
    name: 'Gold',
    background: { type: 'linear', startColor: '#92400e', endColor: '#f59e0b', direction: 'to right', midpoint: 0 },
    textColor: '#fffbeb',
  },
  {
    id: 'spotlight',
    name: 'Spotlight',
    background: { type: 'radial', startColor: '#475569', endColor: '#0f172a', midpoint: 5 },
    textColor: '#f8fafc',
  },

  // ── Light backgrounds, for pale sites ────────────────────────────
  {
    id: 'champagne',
    name: 'Champagne',
    background: { type: 'linear', startColor: '#fde68a', endColor: '#fef3c7', direction: 'to right', midpoint: 0 },
    textColor: '#78350f',
  },
  {
    id: 'blush',
    name: 'Blush',
    background: { type: 'linear', startColor: '#fbcfe8', endColor: '#fce7f3', direction: 'to right', midpoint: 0 },
    textColor: '#831843',
  },
  {
    id: 'matcha',
    name: 'Matcha',
    background: { type: 'linear', startColor: '#bbf7d0', endColor: '#ecfccb', direction: 'to right', midpoint: 0 },
    textColor: '#14532d',
  },
  {
    id: 'arctic',
    name: 'Arctic',
    background: { type: 'linear', startColor: '#bae6fd', endColor: '#e0f2fe', direction: 'to right', midpoint: 0 },
    textColor: '#0c4a6e',
  },
  {
    id: 'paper',
    name: 'Paper',
    background: { type: 'solid', startColor: '#f8fafc', endColor: '#f8fafc' },
    textColor: '#0f172a',
  },
];

/**
 * CSS for a theme's background.
 *
 * Delegates to the app's own renderer rather than reimplementing gradients —
 * a chip that draws its gradient differently from the bar is a chip that lies
 * about what you're picking.
 */
export function themeBackgroundCss(bg: GradientStyle): string {
  return getBackgroundStyle(bg);
}

/**
 * Which theme (if any) the current style matches, so the strip can show a
 * selection. Compares the colors that define the look — a user nudging the
 * balance slider afterwards means it's no longer that theme.
 */
export function matchAnnouncementTheme(
  bg: GradientStyle,
  textColor: string,
): string | null {
  const hit = announcementThemes.find(
    (t) =>
      t.background.type === bg.type &&
      t.background.startColor.toLowerCase() === (bg.startColor || '').toLowerCase() &&
      t.background.endColor.toLowerCase() === (bg.endColor || '').toLowerCase() &&
      t.textColor.toLowerCase() === (textColor || '').toLowerCase(),
  );
  return hit?.id ?? null;
}
