import type { PromoCard } from '@/types/campaign';
import { getISODateWithOffset } from '@/lib/utils';

/**
 * Template cards: deep & modern.
 *
 * Grouped by look rather than by occasion, because that is the choice being
 * made in Template Hub — someone browsing is deciding what their card should
 * feel like, and a dark card next to a pale one is the comparison that matters.
 */
export const DEEP_MODERN_TEMPLATES: { id: string; name: string; promoCard: PromoCard }[] = [
  {
    id: 'midnight-neon',
    name: 'Midnight Neon',
    promoCard: {
      active: false,
      title: '<strong>Midnight Flash Drop</strong>',
      subtitle: '<span style="font-size: 1.125rem;"><strong>Buy 1 Get 1</strong></span> on Select Rugs',
      description: 'After-dark offer for modern homes. Neon accents + deep contrasts = maximum attention.',
      buttonText: 'Activate Flash Deal',
      buttonUrl: '/collections/flash-sale',
      buttonFullWidth: false,
      startDate: getISODateWithOffset(0),
      endDate: getISODateWithOffset(2),
      showTimer: true,
      showButton: true,
      timerText: 'Flash ends in {timer}',
      style: {
        position: 'bottom-right' as const,
        background: { type: 'linear' as const, startColor: '#020617', endColor: '#111827', direction: 'to bottom right', midpoint: 55 },
        textColor: '#e5e7eb',
        titleStyle: {
          background: { type: 'linear' as const, startColor: '#06b6d4', endColor: '#a78bfa', direction: 'to right', midpoint: 50 },
          textColor: '#ffffff',
          textAlign: 'center' as const,
        },
        subheadingStyle: {
          background: { type: 'solid' as const, startColor: '#0f172a', endColor: '#0f172a', midpoint: 50 },
          textColor: '#67e8f9',
          textAlign: 'center' as const,
        },
        descriptionStyle: {
          background: { type: 'solid' as const, startColor: '#111827', endColor: '#111827', midpoint: 50 },
          textColor: '#cbd5e1',
          textAlign: 'left' as const,
        },
        dateStyle: {
          background: { type: 'radial' as const, startColor: '#a5f3fc', endColor: '#22d3ee', midpoint: 38 },
          textColor: '#083344',
          textAlign: 'center' as const,
        },
        buttonStyle: {
          background: { type: 'solid' as const, startColor: '#22d3ee', endColor: '#22d3ee', midpoint: 50 },
          textColor: '#082f49',
          textAlign: 'center' as const,
        },
      },
    } as PromoCard,
  },
    {
    id: 'christmas-evergreen-gold',
    name: 'Christmas Sale',
    promoCard: {
      active: false,
      title: '<span style="font-size:0.75rem;">❄ THE</span> <strong style="font-size:1.6rem;">CHRISTMAS</strong> <span style="font-size:0.9rem;">Sale</span>',
      subtitle: '<span style="font-size:1.3rem;"><strong>Up to 50% OFF</strong></span> <span style="font-size:0.8rem;">+ gift-wrapped delivery</span>',
      description: 'Dress your home for the holidays with plush, warm-toned rugs that turn every room into a cozy celebration.',
      buttonText: '🎁 Claim Holiday Deal',
      buttonUrl: '/collections/christmas',
      buttonFullWidth: true,
      startDate: getISODateWithOffset(0),
      endDate: getISODateWithOffset(6),
      showTimer: true,
      showButton: true,
      timerText: 'Sleigh leaves in {timer}',
      style: {
        position: 'bottom-right' as const,
        background: { type: 'linear' as const, startColor: '#022c22', endColor: '#064e3b', direction: 'to bottom right', midpoint: 50 },
        textColor: '#f0fdf4',
        titleStyle: {
          background: { type: 'linear' as const, startColor: '#b91c1c', endColor: '#15803d', direction: 'to right', midpoint: 50 },
          textColor: '#fef9c3',
          textAlign: 'center' as const,
        },
        subheadingStyle: {
          background: { type: 'solid' as const, startColor: '#022c22', endColor: '#022c22', midpoint: 50 },
          textColor: '#fcd34d',
          textAlign: 'center' as const,
        },
        descriptionStyle: {
          background: { type: 'solid' as const, startColor: '#03291f', endColor: '#03291f', midpoint: 50 },
          textColor: '#d1fae5',
          textAlign: 'center' as const,
        },
        dateStyle: {
          background: { type: 'radial' as const, startColor: '#fde68a', endColor: '#d4af37', midpoint: 38 },
          textColor: '#3f2d04',
          textAlign: 'center' as const,
        },
        buttonStyle: {
          background: { type: 'solid' as const, startColor: '#dc2626', endColor: '#dc2626', midpoint: 50 },
          textColor: '#fffbeb',
          textAlign: 'center' as const,
        },
      },
    } as PromoCard,
  },
  {
    id: 'luxury-gold',
    name: 'Luxury Gold',
    promoCard: {
      active: false,
      title: '<strong>Royal Loom Collection</strong> <span style="font-size:0.8rem;">SIGNATURE EDIT</span>',
      subtitle: 'Exclusive <strong>Members Access</strong> to Luxury Drops',
      description: 'Handcrafted statement pieces with deep texture and heritage finishes. Concierge pricing is now live.',
      buttonText: 'Enter Private Sale',
      buttonUrl: '/collections/luxury',
      buttonFullWidth: false,
      startDate: getISODateWithOffset(0),
      endDate: getISODateWithOffset(3),
      showTimer: true,
      showButton: true,
      timerText: 'Private window closes in {timer}',
      style: {
        position: 'bottom-right' as const,
        background: { type: 'linear' as const, startColor: '#0f172a', endColor: '#111827', direction: 'to bottom right', midpoint: 50 },
        textColor: '#f9fafb',
        titleStyle: {
          background: { type: 'linear' as const, startColor: '#d97706', endColor: '#facc15', direction: 'to right', midpoint: 60 },
          textColor: '#111827',
          textAlign: 'center' as const,
        },
        subheadingStyle: {
          background: { type: 'solid' as const, startColor: '#1f2937', endColor: '#1f2937', midpoint: 50 },
          textColor: '#fde68a',
          textAlign: 'center' as const,
        },
        descriptionStyle: {
          background: { type: 'solid' as const, startColor: '#111827', endColor: '#111827', midpoint: 50 },
          textColor: '#e5e7eb',
          textAlign: 'left' as const,
        },
        dateStyle: {
          background: { type: 'radial' as const, startColor: '#fef3c7', endColor: '#f59e0b', midpoint: 35 },
          textColor: '#1f2937',
          textAlign: 'center' as const,
        },
        buttonStyle: {
          background: { type: 'solid' as const, startColor: '#d4af37', endColor: '#d4af37', midpoint: 50 },
          textColor: '#111827',
          textAlign: 'center' as const,
        },
      },
    } as PromoCard,
  },
    {
    id: 'newyear-champagne-confetti',
    name: 'New Year Sale',
    promoCard: {
      active: false,
      title: '<span style="font-size:2rem;"><strong>2026</strong></span> <span style="font-size:0.8rem;">NEW YEAR SALE</span>',
      subtitle: '<span style="font-size:0.85rem;">Pop into savings —</span> <span style="font-size:1.35rem;"><strong>up to 60% OFF</strong></span>',
      description: 'Ring in the new year with a fresh floor. Clearance pricing on our best-selling weaves while stocks last.',
      buttonText: 'Toast to the Deal 🥂',
      buttonUrl: '/collections/new-year',
      buttonFullWidth: false,
      startDate: getISODateWithOffset(0),
      endDate: getISODateWithOffset(4),
      showTimer: true,
      showButton: true,
      timerText: 'Countdown to midnight: {timer}',
      style: {
        position: 'bottom-right' as const,
        background: { type: 'radial' as const, startColor: '#1e1b4b', endColor: '#030712', midpoint: 60 },
        textColor: '#f5f3ff',
        titleStyle: {
          background: { type: 'linear' as const, startColor: '#fde047', endColor: '#d4af37', direction: 'to right', midpoint: 50 },
          textColor: '#1c1917',
          textAlign: 'center' as const,
        },
        subheadingStyle: {
          background: { type: 'solid' as const, startColor: '#111827', endColor: '#111827', midpoint: 50 },
          textColor: '#f0abfc',
          textAlign: 'center' as const,
        },
        descriptionStyle: {
          background: { type: 'solid' as const, startColor: '#0b1020', endColor: '#0b1020', midpoint: 50 },
          textColor: '#c7d2fe',
          textAlign: 'center' as const,
        },
        dateStyle: {
          background: { type: 'linear' as const, startColor: '#d946ef', endColor: '#7c3aed', direction: 'to right', midpoint: 50 },
          textColor: '#ffffff',
          textAlign: 'center' as const,
        },
        buttonStyle: {
          background: { type: 'solid' as const, startColor: '#facc15', endColor: '#facc15', midpoint: 50 },
          textColor: '#1c1917',
          textAlign: 'center' as const,
        },
      },
    } as PromoCard,
  },
    {
    id: 'autumn-harvest',
    name: 'Autumn Sale',
    promoCard: {
      active: false,
      title: '<strong>Autumn Harvest Sale</strong> <span style="font-size:0.8rem;">AUTUMN EDIT</span>',
      subtitle: '<span style="font-size:0.85rem;">Up to</span> <span style="font-size:1.35rem;"><strong>40% OFF</strong></span> warm-tone rugs',
      description: 'Wrap your home in the colors of the season — rust, amber, and deep berry weaves crafted for cozy autumn evenings.',
      buttonText: 'Shop Autumn Edit',
      buttonUrl: '/collections/autumn',
      buttonFullWidth: false,
      startDate: getISODateWithOffset(0),
      endDate: getISODateWithOffset(9),
      showTimer: true,
      showButton: true,
      timerText: 'Harvest deal ends in {timer}',
      style: {
        position: 'bottom-right' as const,
        background: { type: 'linear' as const, startColor: '#431407', endColor: '#7c2d12', direction: 'to bottom right', midpoint: 48 },
        textColor: '#fef3c7',
        titleStyle: {
          background: { type: 'linear' as const, startColor: '#b91c1c', endColor: '#f59e0b', direction: 'to right', midpoint: 58 },
          textColor: '#fffbeb',
          textAlign: 'left' as const,
        },
        subheadingStyle: {
          background: { type: 'solid' as const, startColor: '#5c1f0c', endColor: '#5c1f0c', midpoint: 50 },
          textColor: '#fcd34d',
          textAlign: 'left' as const,
        },
        descriptionStyle: {
          background: { type: 'solid' as const, startColor: '#431407', endColor: '#431407', midpoint: 50 },
          textColor: '#fed7aa',
          textAlign: 'left' as const,
        },
        dateStyle: {
          background: { type: 'radial' as const, startColor: '#a3e635', endColor: '#65a30d', midpoint: 40 },
          textColor: '#1a2e05',
          textAlign: 'left' as const,
        },
        buttonStyle: {
          background: { type: 'solid' as const, startColor: '#ea580c', endColor: '#ea580c', midpoint: 50 },
          textColor: '#fffbeb',
          textAlign: 'center' as const,
        },
      },
    } as PromoCard,
  }
];
