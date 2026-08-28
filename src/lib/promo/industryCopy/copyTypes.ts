import type { PromoCard } from '@/types/campaign';

/** The five text fields a trade swaps; everything else the template keeps. */
type Copy = Pick<
  PromoCard,
  'title' | 'subtitle' | 'description' | 'buttonText' | 'timerText'
>;

/** Keyed by template id, then industry id. */
export type CopyTable = Record<string, Record<string, Copy>>;
