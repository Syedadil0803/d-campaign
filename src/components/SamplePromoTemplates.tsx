import { PromoCard } from '@/types/campaign';
import { getBackgroundStyle, getISODateWithOffset } from '@/lib/utils';

interface SamplePromoTemplatesProps {
  onApplyTemplate: (template: PromoCard, templateName: string) => void;
}

const sampleTemplates = [
  {
    id: 'executive',
    name: 'Executive Slate',
    promoCard: {
      active: true,
      title: 'Premium Collection',
      subtitle: 'Designed for modern offices',
      description: 'Elevate your interiors with refined textures.',
      buttonText: 'View Collection',
      buttonUrl: '/collections/professional',
      buttonFullWidth: false,
      startDate: getISODateWithOffset(0),
      endDate: getISODateWithOffset(12),
      showTimer: true,
      showButton: true,
      timerText: '{h}h {mm}m {ss}s left',
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
              <h3 className="text-lg font-bold mb-1 px-2 py-1 rounded">{template.promoCard.title}</h3>
              <h4 className="text-sm mb-2 px-2 py-1 rounded">{template.promoCard.subtitle}</h4>
              <p className="text-sm mb-2 px-2 py-1 rounded">{template.promoCard.description}</p>
              <button className="py-2 px-4 rounded-lg text-sm font-semibold">{template.promoCard.buttonText}</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
