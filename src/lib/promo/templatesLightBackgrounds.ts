import type { PromoCard } from '@/types/campaign';
import { getISODateWithOffset } from '@/lib/utils';

/**
 * Template cards: light backgrounds, for pale sites.
 *
 * Grouped by look rather than by occasion, because that is the choice being
 * made in Template Hub — someone browsing is deciding what their card should
 * feel like, and a dark card next to a pale one is the comparison that matters.
 */
export const LIGHT_TEMPLATES: { id: string; name: string; promoCard: PromoCard }[] = [
  {
    id: 'professional-slate',
    name: 'Executive Slate',
    promoCard: {
      active: false,
      title: '<strong>Premium Workspace Collection</strong>',
      subtitle: '<span style="font-size:0.9rem;">Designed for modern offices and executive homes</span>',
      description: 'Elevate your interiors with refined textures, durable weaves, and a professional finish built for everyday performance.',
      buttonText: 'View Collection',
      buttonUrl: '/collections/professional',
      buttonFullWidth: false,
      startDate: getISODateWithOffset(0),
      endDate: getISODateWithOffset(12),
      showTimer: true,
      showButton: true,
      timerText: '{timer} left for executive pricing',
      style: {
        position: 'bottom-right' as const,
        background: { type: 'linear' as const, startColor: '#f8fafc', endColor: '#e2e8f0', direction: 'to bottom right', midpoint: 46 },
        textColor: '#0f172a',
        titleStyle: {
          background: { type: 'linear' as const, startColor: '#1e3a8a', endColor: '#334155', direction: 'to right', midpoint: 48 },
          textColor: '#ffffff',
          textAlign: 'left' as const,
        },
        subheadingStyle: {
          background: { type: 'solid' as const, startColor: '#e2e8f0', endColor: '#e2e8f0', midpoint: 50 },
          textColor: '#334155',
          textAlign: 'left' as const,
        },
        descriptionStyle: {
          background: { type: 'solid' as const, startColor: '#ffffff', endColor: '#ffffff', midpoint: 50 },
          textColor: '#334155',
          textAlign: 'left' as const,
        },
        dateStyle: {
          background: { type: 'radial' as const, startColor: '#dbeafe', endColor: '#bfdbfe', midpoint: 42 },
          textColor: '#1e3a8a',
          textAlign: 'left' as const,
        },
        buttonStyle: {
          background: { type: 'solid' as const, startColor: '#1e293b', endColor: '#1e293b', midpoint: 50 },
          textColor: '#f8fafc',
          textAlign: 'center' as const,
        },
      },
    } as PromoCard,
  },
    {
    id: 'home-makeover-editorial',
    name: 'Home Makeover',
    promoCard: {
      active: false,
      title: '<span style="font-size:0.75rem;">THE</span> <strong style="font-size:1.6rem;">MAKEOVER</strong> <span style="font-size:0.75rem;">EVENT</span>',
      subtitle: 'Redesign every room — <strong>floor up</strong>. Curated looks, styled for you.',
      description: 'From statement rugs to layered runners, our stylists picked the pieces that transform a space in a single weekend.',
      buttonText: 'Start My Makeover →',
      buttonUrl: '/collections/makeover',
      buttonFullWidth: true,
      startDate: getISODateWithOffset(0),
      endDate: getISODateWithOffset(21),
      showTimer: true,
      showButton: true,
      timerText: 'Styling event ends in {timer}',
      style: {
        position: 'bottom-right' as const,
        background: { type: 'linear' as const, startColor: '#faf7f2', endColor: '#ede8e0', direction: 'to bottom', midpoint: 50 },
        textColor: '#1c1917',
        titleStyle: {
          background: { type: 'solid' as const, startColor: '#0c0a09', endColor: '#0c0a09', midpoint: 50 },
          textColor: '#fafaf9',
          textAlign: 'center' as const,
        },
        subheadingStyle: {
          background: { type: 'solid' as const, startColor: '#faf7f2', endColor: '#faf7f2', midpoint: 50 },
          textColor: '#292524',
          textAlign: 'center' as const,
        },
        descriptionStyle: {
          background: { type: 'solid' as const, startColor: '#faf7f2', endColor: '#faf7f2', midpoint: 50 },
          textColor: '#57534e',
          textAlign: 'center' as const,
        },
        dateStyle: {
          background: { type: 'linear' as const, startColor: '#ff5a5f', endColor: '#ff7e54', direction: 'to right', midpoint: 50 },
          textColor: '#ffffff',
          textAlign: 'center' as const,
        },
        buttonStyle: {
          background: { type: 'solid' as const, startColor: '#0c0a09', endColor: '#0c0a09', midpoint: 50 },
          textColor: '#fafaf9',
          textAlign: 'center' as const,
        },
      },
    } as PromoCard,
  },
    {
    id: 'easter-pastel-egg',
    name: 'Easter Sale',
    promoCard: {
      active: false,
     title: '<strong style="font-size:1.25rem;">Easter Bloom Sale</strong> <span style="font-size:0.7rem;">🐣 SPRING DROP</span>',
      subtitle: '<span style="font-size:0.85rem;">Hop in for</span> <span style="font-size:1.4rem;"><strong>30% OFF</strong></span> <span style="font-size:0.85rem;">+ a free runner</span>',
      description: 'Pastel weaves, fresh florals, and feather-soft textures to wake up your home for the season of new beginnings.',
      buttonText: 'Unwrap the Offer 🥚',
      buttonUrl: '/collections/easter',
      buttonFullWidth: false,
      startDate: getISODateWithOffset(0),
      endDate: getISODateWithOffset(5),
      showTimer: true,
      showButton: true,
      timerText: 'Basket closes in {timer}',
      style: {
        position: 'bottom-right' as const,
        background: { type: 'linear' as const, startColor: '#f5f3ff', endColor: '#fefce8', direction: 'to bottom right', midpoint: 50 },
        textColor: '#3b0764',
        titleStyle: {
          background: { type: 'linear' as const, startColor: '#a78bfa', endColor: '#fbbf24', direction: 'to right', midpoint: 55 },
          textColor: '#ffffff',
          textAlign: 'center' as const,
        },
        subheadingStyle: {
          background: { type: 'solid' as const, startColor: '#ffffff', endColor: '#ffffff', midpoint: 50 },
          textColor: '#7c3aed',
          textAlign: 'center' as const,
        },
        descriptionStyle: {
          background: { type: 'solid' as const, startColor: '#faf5ff', endColor: '#faf5ff', midpoint: 50 },
          textColor: '#5b21b6',
          textAlign: 'center' as const,
        },
        dateStyle: {
          background: { type: 'radial' as const, startColor: '#fef08a', endColor: '#fde047', midpoint: 42 },
          textColor: '#713f12',
          textAlign: 'center' as const,
        },
        buttonStyle: {
          background: { type: 'solid' as const, startColor: '#8b5cf6', endColor: '#8b5cf6', midpoint: 50 },
          textColor: '#ffffff',
          textAlign: 'center' as const,
        },
      },
    } as PromoCard,
  },
  {
    id: 'spring-bloom',
    name: 'Spring Bloom',
    promoCard: {
      active: false,
      title: '<strong>Spring Refresh</strong> <span style="font-size:0.8rem;">NEW SEASON</span>',
      subtitle: 'Bring <strong>fresh colors</strong> and airy textures home',
      description: 'From pastel runners to floral accents, this edit instantly brightens every corner.',
      buttonText: 'Shop The Bloom Edit',
      buttonUrl: '/collections/spring',
      buttonFullWidth: true,
      startDate: getISODateWithOffset(0),
      endDate: getISODateWithOffset(10),
      showTimer: true,
      showButton: true,
      timerText: 'Spring deal ends in {timer}',
      style: {
        position: 'bottom-right' as const,
        background: { type: 'linear' as const, startColor: '#fdf2f8', endColor: '#ecfeff', direction: 'to right', midpoint: 50 },
        textColor: '#1f2937',
        titleStyle: {
          background: { type: 'linear' as const, startColor: '#ec4899', endColor: '#14b8a6', direction: 'to right', midpoint: 50 },
          textColor: '#ffffff',
          textAlign: 'center' as const,
        },
        subheadingStyle: {
          background: { type: 'solid' as const, startColor: '#ffffff', endColor: '#ffffff', midpoint: 50 },
          textColor: '#be185d',
          textAlign: 'center' as const,
        },
        descriptionStyle: {
          background: { type: 'solid' as const, startColor: '#ffffff', endColor: '#ffffff', midpoint: 50 },
          textColor: '#374151',
          textAlign: 'left' as const,
        },
        dateStyle: {
          background: { type: 'radial' as const, startColor: '#cffafe', endColor: '#a7f3d0', midpoint: 45 },
          textColor: '#0f766e',
          textAlign: 'center' as const,
        },
        buttonStyle: {
          background: { type: 'solid' as const, startColor: '#db2777', endColor: '#db2777', midpoint: 50 },
          textColor: '#ffffff',
          textAlign: 'center' as const,
        },
      },
    } as PromoCard,
  },
  {
    id: 'all-features',
    name: 'Festival Spotlight',
    promoCard: {
      active: false,
      title: '<strong>Weekend Carpet Festival</strong> <span style="font-size: 0.8rem;">LIMITED DROP</span>',
      subtitle: '<span style="font-size: 0.85rem;">Flat</span> <span style="font-size: 1.35rem;"><strong>35% OFF</strong></span> + Free Delivery',
      description: 'Give your room a full glow-up with premium carpets. Apply <strong>COZY35</strong> before this drop disappears.',
      buttonText: 'Reveal My Offer',
      buttonUrl: '/collections/carpets',
      buttonFullWidth: true,
      startDate: getISODateWithOffset(0),
      endDate: getISODateWithOffset(7),
      showTimer: true,
      showButton: true,
      timerText: 'Offer ends in {timer}',
      style: {
        position: 'bottom-right' as const,
        background: { type: 'linear' as const, startColor: '#fff7ed', endColor: '#ffedd5', direction: 'to bottom right', midpoint: 45 },
        textColor: '#1f2937',
        titleStyle: {
          background: { type: 'linear' as const, startColor: '#7c2d12', endColor: '#c2410c', direction: 'to right', midpoint: 55 },
          textColor: '#ffffff',
          textAlign: 'center' as const,
        },
        subheadingStyle: {
          background: { type: 'solid' as const, startColor: '#ffedd5', endColor: '#ffedd5', midpoint: 50 },
          textColor: '#9a3412',
          textAlign: 'center' as const,
        },
        descriptionStyle: {
          background: { type: 'solid' as const, startColor: '#ffffff', endColor: '#ffffff', midpoint: 50 },
          textColor: '#374151',
          textAlign: 'left' as const,
        },
        dateStyle: {
          background: { type: 'radial' as const, startColor: '#fed7aa', endColor: '#fdba74', midpoint: 40 },
          textColor: '#7c2d12',
          textAlign: 'center' as const,
        },
        buttonStyle: {
          background: { type: 'solid' as const, startColor: '#ea580c', endColor: '#ea580c', midpoint: 50 },
          textColor: '#ffffff',
          textAlign: 'center' as const,
        },
      },
    } as PromoCard,
  },
  {
    id: 'earthy-cozy',
    name: 'Earthy Cozy',
    promoCard: {
      active: false,
      title: '<strong>Cozy Home Week</strong> <span style="font-size:0.8rem;">CALM LIVING</span>',
      subtitle: 'Natural tones, soft textures, and calm spaces',
      description: 'Create a warm sanctuary with earthy layers and plush comfort made for everyday living.',
      buttonText: 'Build My Cozy Space',
      buttonUrl: '/collections/cozy-home',
      buttonFullWidth: true,
      startDate: getISODateWithOffset(0),
      endDate: getISODateWithOffset(14),
      showTimer: true,
      showButton: true,
      timerText: 'Cozy week ends in {timer}',
      style: {
        position: 'bottom-right' as const,
        background: { type: 'linear' as const, startColor: '#fffbeb', endColor: '#fef3c7', direction: 'to bottom right', midpoint: 42 },
        textColor: '#292524',
        titleStyle: {
          background: { type: 'linear' as const, startColor: '#b45309', endColor: '#78350f', direction: 'to right', midpoint: 52 },
          textColor: '#ffffff',
          textAlign: 'center' as const,
        },
        subheadingStyle: {
          background: { type: 'solid' as const, startColor: '#fde68a', endColor: '#fde68a', midpoint: 50 },
          textColor: '#78350f',
          textAlign: 'center' as const,
        },
        descriptionStyle: {
          background: { type: 'solid' as const, startColor: '#fffbeb', endColor: '#fffbeb', midpoint: 50 },
          textColor: '#44403c',
          textAlign: 'left' as const,
        },
        dateStyle: {
          background: { type: 'radial' as const, startColor: '#fed7aa', endColor: '#f59e0b', midpoint: 40 },
          textColor: '#7c2d12',
          textAlign: 'center' as const,
        },
        buttonStyle: {
          background: { type: 'solid' as const, startColor: '#92400e', endColor: '#92400e', midpoint: 50 },
          textColor: '#ffffff',
          textAlign: 'center' as const,
        },
      },
    } as PromoCard,
  }
];
