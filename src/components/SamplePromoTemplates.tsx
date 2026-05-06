import { PromoCard } from '@/types/campaign';
import { getBackgroundStyle, getISODateWithOffset } from '@/lib/utils';
import { getTemplateTimerPreviewText } from '@/lib/timerUtils';

interface SamplePromoTemplatesProps {
  onApplyTemplate: (template: PromoCard, templateName: string) => void;
}

const sampleTemplates = [
  {
    id: 'professional-slate',
    name: 'Executive Slate',
    promoCard: {
      active: true,
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
      timerText: '<strong>{h}h</strong> <span style="font-size:1rem;">{mm}m</span> <span style="font-size:0.75rem;">{ss}s</span> left for executive pricing',
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
    id: 'all-features',
    name: 'Festival Spotlight',
    promoCard: {
      active: true,
      title: '<strong>Weekend Carpet Festival</strong> <span style="font-size: 0.8rem; letter-spacing:0.08em;">LIMITED DROP</span>',
      subtitle: '<span style="font-size: 0.85rem;">Flat</span> <span style="font-size: 1.35rem;"><strong>35% OFF</strong></span> + Free Delivery',
      description: 'Give your room a full glow-up with premium carpets. Apply <strong>COZY35</strong> before this drop disappears.',
      buttonText: 'Reveal My Offer',
      buttonUrl: '/collections/carpets',
      buttonFullWidth: true,
      startDate: getISODateWithOffset(0),
      endDate: getISODateWithOffset(7),
      showTimer: true,
      showButton: true,
      timerText: 'Offer ends in <strong>{h}h</strong> <span style="font-size:1.125rem;">{mm}m</span> <span style="font-size:0.75rem;">{ss}s</span>',
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
    id: 'luxury-gold',
    name: 'Luxury Gold',
    promoCard: {
      active: true,
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
      timerText: 'Private window closes in <strong>{h}h</strong> <span style="font-size:1.125rem;">{mm}m</span> <span style="font-size:0.75rem;">{ss}s</span>',
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
    id: 'spring-bloom',
    name: 'Spring Bloom',
    promoCard: {
      active: true,
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
      timerText: 'Spring deal ends in <strong>{h}h</strong> <span style="font-size:1.125rem;">{mm}m</span> <span style="font-size:0.75rem;">{ss}s</span>',
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
    id: 'midnight-neon',
    name: 'Midnight Neon',
    promoCard: {
      active: true,
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
      timerText: 'Flash ends in <strong>{h}h</strong> <span style="font-size:1.125rem;">{mm}m</span> <span style="font-size:0.75rem;">{ss}s</span>',
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
    id: 'earthy-cozy',
    name: 'Earthy Cozy',
    promoCard: {
      active: true,
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
      timerText: 'Cozy week ends in <strong>{h}h</strong> <span style="font-size:1.125rem;">{mm}m</span> <span style="font-size:0.75rem;">{ss}s</span>',
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

export function SamplePromoTemplates({ onApplyTemplate }: SamplePromoTemplatesProps) {
  return (
    <div className="lg:col-span-2 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800 mt-6">
      <h4 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-3">Sample Templates</h4>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {sampleTemplates.map((template) => (
          <div
            key={template.id}
            onClick={() => onApplyTemplate(template.promoCard, template.name)}
            className="group rounded-xl border border-gray-200 bg-white p-3 shadow-sm hover:shadow-lg cursor-pointer dark:border-gray-700 dark:bg-gray-900"
          >
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-semibold text-gray-800 dark:text-gray-200">{template.name}</p>
              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium dark:bg-gray-700 dark:text-gray-200">
                Click to apply
              </span>
            </div>
            <div
              className="w-full rounded-xl shadow-xl p-4 flex flex-col"
              style={{ background: getBackgroundStyle(template.promoCard.style.background) }}
            >
              <h3
                className="text-lg font-bold mb-1 px-2 py-1 rounded break-words"
                style={{
                  background: getBackgroundStyle(template.promoCard.style.titleStyle.background),
                  color: template.promoCard.style.titleStyle.textColor,
                  textAlign: template.promoCard.style.titleStyle.textAlign || 'center',
                }}
                dangerouslySetInnerHTML={{ __html: template.promoCard.title }}
              />
              <h4
                className="text-sm mb-2 px-2 py-1 rounded break-words"
                style={{
                  background: getBackgroundStyle(template.promoCard.style.subheadingStyle.background),
                  color: template.promoCard.style.subheadingStyle.textColor,
                  textAlign: template.promoCard.style.subheadingStyle.textAlign || 'center',
                }}
                dangerouslySetInnerHTML={{ __html: template.promoCard.subtitle }}
              />
              <p
                className="text-sm mb-2 px-2 py-1 rounded break-words"
                style={{
                  background: getBackgroundStyle(template.promoCard.style.descriptionStyle.background),
                  color: template.promoCard.style.descriptionStyle.textColor,
                  textAlign: template.promoCard.style.descriptionStyle.textAlign || 'left',
                }}
                dangerouslySetInnerHTML={{ __html: template.promoCard.description }}
              />
              <div
                className="text-xs mb-4 px-2 py-1 rounded break-words"
                style={{
                  background: getBackgroundStyle(template.promoCard.style.dateStyle.background),
                  color: template.promoCard.style.dateStyle.textColor,
                  textAlign: template.promoCard.style.dateStyle.textAlign || 'center',
                }}
                dangerouslySetInnerHTML={{ __html: getTemplateTimerPreviewText(template.promoCard.timerText) }}
              />
              <div className={template.promoCard.buttonFullWidth ? '' : 'flex justify-center'}>
                <button
                  className={`py-2 px-4 rounded-lg text-sm font-semibold ${template.promoCard.buttonFullWidth ? 'w-full' : ''}`}
                  style={{
                    background: getBackgroundStyle(template.promoCard.style.buttonStyle.background),
                    color: template.promoCard.style.buttonStyle.textColor,
                  }}
                  dangerouslySetInnerHTML={{ __html: template.promoCard.buttonText }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
