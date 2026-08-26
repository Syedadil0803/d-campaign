import { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { PromoCard } from '@/types/campaign';
import { getBackgroundStyle, getISODateWithOffset } from '@/lib/utils';
import { getTemplateTimerPreviewText } from '@/lib/editor/timerUtils';
import { INDUSTRIES, withIndustryCopy } from '@/lib/promo/industryCopy';

interface SamplePromoTemplatesProps {
  onApplyTemplate: (template: PromoCard, templateName: string) => void;
}

// Exported so the guided flow (start picker / content step) can list the same
// templates without duplicating them.
export const sampleTemplates = [
  // ── Deep & modern ─────────────────────────────────────────────────────
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
  },
  // ── Warm & loud ───────────────────────────────────────────────────────
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
  },
  // ── Light backgrounds, for pale sites ─────────────────────────────────
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
  },
];

const REVEAL_DURATION_MS = 350;
const STAGGER_DELAY_MS = 60;

/**
 * The width this card becomes the moment it is applied.
 *
 * getRequiredCardWidth() picks 400 or 440 by measuring whether a headline
 * would overflow, and no template here declares a width of its own, so 440
 * is the widest a tile can ever need to depict. Rendering at the maximum is
 * the safe direction to be wrong in: a headline that fits the real card
 * cannot wrap in the tile.
 */
const APPLIED_CARD_WIDTH = 440;

/**
 * The same stack the live preview pins itself to.
 *
 * The app is set in Geist, a wider cut than the widget could reliably load,
 * so text measured in Geist wraps sooner than the same text on the customer's
 * site. The preview already corrects for this; the gallery did not, which is
 * the second reason its headlines broke where the real card's did not.
 */
const WIDGET_FONT_STACK =
  '-apple-system, BlinkMacSystemFont, system-ui, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

/**
 * One template in the gallery, drawn at the size it will really be.
 *
 * The tile used to render the card at whatever width the grid column happened
 * to be — roughly 300px at three columns, against a real card of 440. The
 * template headlines carry inline `font-size` in **rem**, which is relative to
 * the document root and therefore completely indifferent to how narrow its
 * container is: a 1.6rem word is 25.6px in a 300px tile exactly as it is in a
 * 440px card. Nothing about a narrower column makes that text smaller, so it
 * simply wrapped, and a one-line headline became two.
 *
 * So the card is laid out at its true width and the whole thing is scaled to
 * fit. `zoom` rather than `transform: scale()` because zoom scales layout too
 * — the tile's height follows on its own, with no second measurement to keep
 * in step — and because the live preview already solves its own fitting
 * problem this way.
 *
 * The line breaks are now correct by construction rather than by tuning. Type
 * a longer headline into any template and the tile keeps agreeing with the
 * card, because it is the same layout at the same width, just smaller.
 */
function TemplateTile({
  template,
  card,
  index,
  isVisible,
  onApply,
}: {
  template: (typeof sampleTemplates)[number];
  card: PromoCard;
  index: number;
  isVisible: boolean;
  /** Handed the very card that is on screen, so what you click is what you get. */
  onApply: (card: PromoCard, templateName: string) => void;
}) {
  const frameRef = useRef<HTMLDivElement>(null);
  const [fitZoom, setFitZoom] = useState(1);

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    const fit = () => {
      const available = frame.clientWidth;
      // Never scale up. A column wider than the card should show the card,
      // not an inflated version of it.
      if (available > 0) setFitZoom(Math.min(1, available / APPLIED_CARD_WIDTH));
    };
    fit();
    // The grid drops from three columns to two to one, and the panel itself
    // resizes with the window, so a single measurement on mount goes stale.
    const observer = new ResizeObserver(fit);
    observer.observe(frame);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      data-template-id={template.id}
      onClick={() => onApply(card, template.name)}
      className={`group rounded-xl border border-gray-200 hover:border-primary hover:ring-1 hover:ring-primary bg-white p-3 shadow-sm hover:shadow-lg cursor-pointer dark:border-gray-700 dark:bg-gray-900 [transition:border-color_150ms_ease,box-shadow_150ms_ease,opacity_var(--reveal-ms)_ease-out_var(--reveal-delay),transform_var(--reveal-ms)_ease-out_var(--reveal-delay)] ${
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
      }`}
      style={
        {
          ['--reveal-ms' as string]: isVisible ? `${REVEAL_DURATION_MS}ms` : '120ms',
          ['--reveal-delay' as string]: isVisible ? `${index * STAGGER_DELAY_MS}ms` : '0ms',
        } as React.CSSProperties
      }
    >
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs font-semibold text-gray-800 dark:text-gray-200">{template.name}</p>
        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium dark:bg-gray-700 dark:text-gray-200">
          Click to apply
        </span>
      </div>

      {/* The frame is what the grid sizes; the card inside keeps its own.
          `overflow-hidden` covers the single frame between first paint and the
          effect measuring: the card is briefly its full 440 in a narrower
          column, and clipping for one frame beats bursting out of the tile.
          The reveal animation starts at opacity-0, so nothing is visible
          either way — this is the belt to that pair of braces. */}
      <div ref={frameRef} className="overflow-hidden">
        <div
          className="rounded-xl shadow-xl p-4 flex flex-col"
          style={{
            width: `${APPLIED_CARD_WIDTH}px`,
            zoom: fitZoom,
            fontFamily: WIDGET_FONT_STACK,
            background: getBackgroundStyle(template.promoCard.style.background),
          }}
        >
          <h3
            className="text-lg font-bold mb-1 px-2 py-1 rounded break-words"
            style={{
              background: getBackgroundStyle(template.promoCard.style.titleStyle.background),
              color: template.promoCard.style.titleStyle.textColor,
              textAlign: template.promoCard.style.titleStyle.textAlign || 'center',
            }}
            dangerouslySetInnerHTML={{ __html: card.title }}
          />
          <h4
            className="text-sm mb-2 px-2 py-1 rounded break-words"
            style={{
              background: getBackgroundStyle(template.promoCard.style.subheadingStyle.background),
              color: template.promoCard.style.subheadingStyle.textColor,
              textAlign: template.promoCard.style.subheadingStyle.textAlign || 'center',
            }}
            dangerouslySetInnerHTML={{ __html: card.subtitle }}
          />
          <p
            className="text-sm mb-2 px-2 py-1 rounded break-words"
            style={{
              background: getBackgroundStyle(template.promoCard.style.descriptionStyle.background),
              color: template.promoCard.style.descriptionStyle.textColor,
              textAlign: template.promoCard.style.descriptionStyle.textAlign || 'left',
            }}
            dangerouslySetInnerHTML={{ __html: card.description }}
          />
          <div
            className="text-xs mb-4 px-2 py-1 rounded break-words"
            style={{
              background: getBackgroundStyle(template.promoCard.style.dateStyle.background),
              color: template.promoCard.style.dateStyle.textColor,
              textAlign: template.promoCard.style.dateStyle.textAlign || 'center',
            }}
            dangerouslySetInnerHTML={{ __html: getTemplateTimerPreviewText(card.timerText) }}
          />
          <div className={template.promoCard.buttonFullWidth ? '' : 'flex justify-center'}>
            <button
              className={`py-2 px-4 rounded-lg text-sm font-semibold ${template.promoCard.buttonFullWidth ? 'w-full' : ''}`}
              style={{
                background: getBackgroundStyle(template.promoCard.style.buttonStyle.background),
                color: template.promoCard.style.buttonStyle.textColor,
              }}
              dangerouslySetInnerHTML={{ __html: card.buttonText }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}


export function SamplePromoTemplates({ onApplyTemplate }: SamplePromoTemplatesProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  /**
   * Which trade's sample wording the cards are showing.
   *
   * It changes the words and nothing else — every template keeps its own
   * colours, and none are hidden. Calling it a filter would promise a shorter
   * grid that never arrives, so the heading asks a question instead.
   */
  const [industryId, setIndustryId] = useState<string | null>(null);
  /**
   * Open on arrival, deliberately.
   *
   * Collapsed, the row was tidy and nobody knew the trades were there — a
   * feature that exists to be noticed cannot start hidden behind a chevron.
   * It collapses once a choice is made, so it costs a moment rather than a
   * permanent band across the top.
   */
  const [pickerOpen, setPickerOpen] = useState(true);
  const [visibleTemplateIds, setVisibleTemplateIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const root = containerRef.current;
    if (!root) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const id = entry.target.getAttribute('data-template-id');
          if (!id) return;
          setVisibleTemplateIds((prev) => {
            const next = new Set(prev);
            if (entry.isIntersecting) next.add(id);
            else next.delete(id);
            return next;
          });
        });
      },
      { threshold: 0.05, rootMargin: '0px 0px -2% 0px' }
    );

    const cards = root.querySelectorAll('[data-template-id]');
    cards.forEach((card) => observer.observe(card));

    return () => observer.disconnect();
  }, []);

  return (
    <div ref={containerRef}>
      {/* Open on arrival, then out of the way.
          Ten pills in a row wrapped onto a second line and read as a paragraph
          rather than a set of choices. A dropdown would have hidden the trades
          behind a click, which defeats the point — someone should SEE their
          trade without going looking. So: stated in words, shown as a grid that
          scans in columns, and folded away once it has been used. */}
      <div className="mb-6">
        <button
          type="button"
          onClick={() => setPickerOpen((v) => !v)}
          aria-expanded={pickerOpen}
          className="group flex items-baseline gap-2"
        >
          {/* The word the team uses for these, and the word a business owner
              would pick themselves. Earlier attempts described the mechanism
              instead — "showing examples for" and "sample wording" both explain
              what the control does to the page, when the only thing the reader
              needs to answer is which trade they are in. */}
          <span className="text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant">
            Industry
          </span>
          <span className="text-sm font-semibold text-primary">
            {INDUSTRIES.find((i) => i.id === industryId)?.label ?? 'Default'}
          </span>
          <ChevronDown
            className={`h-3.5 w-3.5 self-center text-on-surface-variant transition-transform group-hover:text-primary ${
              pickerOpen ? 'rotate-180' : ''
            }`}
          />
        </button>

        {pickerOpen && (
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
            {[{ id: null, label: 'Default' }, ...INDUSTRIES].map((option) => {
              const active = option.id === industryId;
              return (
                <button
                  key={option.id ?? 'all'}
                  type="button"
                  onClick={() => {
                    setIndustryId(option.id);
                    setPickerOpen(false);
                  }}
                  aria-pressed={active}
                  /* A card each, rather than text on a grey panel. The border
                     is what makes ten items read as ten choices instead of a
                     paragraph, and it survives both themes without a fill. */
                  className={`rounded-lg border px-3 py-2.5 text-left text-xs font-medium transition-all ${
                    active
                      ? 'border-primary bg-primary/10 text-primary shadow-sm'
                      : 'border-border bg-surface text-on-surface-variant hover:-translate-y-0.5 hover:border-primary/60 hover:text-primary hover:shadow-sm'
                  }`}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {sampleTemplates.map((template, index) => (
          <TemplateTile
            key={template.id}
            template={template}
            // The look is the template's; the words are the trade's.
            card={withIndustryCopy(template.promoCard as PromoCard, template.id, industryId)}
            index={index}
            isVisible={visibleTemplateIds.has(template.id)}
            onApply={onApplyTemplate}
          />
        ))}
      </div>
    </div>
  );
}
