import type { PromoCard } from '@/types/campaign';
import { getISODateWithOffset } from '@/lib/utils';

/**
 * Template cards: warm & loud.
 *
 * Grouped by look rather than by occasion, because that is the choice being
 * made in Template Hub — someone browsing is deciding what their card should
 * feel like, and a dark card next to a pale one is the comparison that matters.
 */
export const WARM_LOUD_TEMPLATES: { id: string; name: string; promoCard: PromoCard }[] = [
    {
    id: 'summer-sunset-splash',
    name: 'Summer Offers',
    promoCard: {
      active: false,
     title: '<strong style="font-size:1.25rem;">Summer Splash Sale</strong> <span style="font-size:0.7rem;">☀ HOT DEALS</span>',
      subtitle: '<span style="font-size:1.4rem;"><strong>Buy 2 Get 1 Free</strong></span> <span style="font-size:0.8rem;">on all summer weaves</span>',
      description: 'Lighten up every room with breezy, easy-clean rugs in vibrant sun-soaked shades — built for barefoot season.',
      buttonText: 'Dive Into Savings 🌊',
      buttonUrl: '/collections/summer',
      buttonFullWidth: true,
      startDate: getISODateWithOffset(0),
      endDate: getISODateWithOffset(8),
      showTimer: true,
      showButton: true,
      timerText: 'Heat ends in {timer}',
      style: {
        position: 'bottom-right' as const,
        background: { type: 'linear' as const, startColor: '#fb7185', endColor: '#fb923c', direction: 'to bottom right', midpoint: 50 },
        textColor: '#451a03',
        titleStyle: {
          background: { type: 'solid' as const, startColor: '#9f1239', endColor: '#9f1239', midpoint: 50 },
          textColor: '#fff7ed',
          textAlign: 'center' as const,
        },
        subheadingStyle: {
          background: { type: 'solid' as const, startColor: '#fff7ed', endColor: '#fff7ed', midpoint: 50 },
          textColor: '#c2410c',
          textAlign: 'center' as const,
        },
        descriptionStyle: {
          background: { type: 'solid' as const, startColor: '#fff1e6', endColor: '#fff1e6', midpoint: 50 },
          textColor: '#7c2d12',
          textAlign: 'center' as const,
        },
        dateStyle: {
          background: { type: 'linear' as const, startColor: '#22d3ee', endColor: '#06b6d4', direction: 'to right', midpoint: 50 },
          textColor: '#083344',
          textAlign: 'center' as const,
        },
        buttonStyle: {
          background: { type: 'solid' as const, startColor: '#0891b2', endColor: '#0891b2', midpoint: 50 },
          textColor: '#ffffff',
          textAlign: 'center' as const,
        },
      },
    } as PromoCard,
  }
];
