import type { PromoCard, PromoField } from '@/types/campaign';

/**
 * Which entry under `style` each field is painted from.
 *
 * Shared because three different places need it: the styling hook writes
 * through it, lookSignature strips per-field properties with it, and
 * applyTemplateLook carries them across with it. It used to be a partial map
 * in the editor plus two hand-written if-chains.
 */
export const STYLE_KEY_MAP = {
  title: 'titleStyle',
  subtitle: 'subheadingStyle',
  description: 'descriptionStyle',
  button: 'buttonStyle',
  timer: 'dateStyle',
} as const;

export type FieldStyleKey = (typeof STYLE_KEY_MAP)[PromoField];

export const FIELD_STYLE_KEYS = Object.values(STYLE_KEY_MAP) as FieldStyleKey[];

export type FieldStyle = PromoCard['style']['titleStyle'];
