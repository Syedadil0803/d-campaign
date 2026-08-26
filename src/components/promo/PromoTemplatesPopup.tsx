'use client';

import type { ReactNode } from 'react';
import type { PromoCard } from '@/types/campaign';
import { SamplePromoTemplates } from '@/components/promo/SamplePromoTemplates';
import { applyTemplateFull } from '@/lib/promo/promoTemplate';
import { X, ArrowLeft, FilePlus2 } from 'lucide-react';

/**
 * The Template Hub, shown over the editor.
 *
 * Back only exists when the build panel sent the user here; opened from the
 * toolbar chip there is nowhere to go back to, which is why the caller decides
 * whether it is offered rather than this component guessing.
 */
export function PromoTemplatesPopup({
  currentCard,
  showBack,
  onBack,
  onClose,
  onStartFresh,
  onApplyTemplate,
  confirmCardReplace,
}: {
  /** What is on the canvas — the preview of a template is built against it. */
  currentCard: PromoCard;
  showBack: boolean;
  onBack: () => void;
  onClose: () => void;
  onStartFresh: () => void;
  onApplyTemplate: (card: PromoCard, name: string) => void;
  confirmCardReplace: (
    action: () => void,
    opts: {
      title: string;
      body: ReactNode;
      confirmLabel: string;
      reassuranceBody?: ReactNode;
      replacementLabel?: string;
      nextCard?: PromoCard;
      offerDraftSave?: boolean;
    },
  ) => void;
}) {
  return (
    <div data-modal className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0" onClick={() => onClose()} />
      <div className="relative z-10 flex max-h-[90vh] w-[92vw] max-w-[1500px] flex-col overflow-hidden rounded-xl border border-border shadow-2xl backdrop-blur-md">
        <div className="flex items-center gap-3 border-b border-border px-6 py-3">
          {/* Back exists only when the build panel sent us here; opened
              from the toolbar chip there is nowhere to go back to. */}
          {showBack && (
            <button
              type="button"
              onClick={onBack}
              aria-label="Back"
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-on-surface-variant transition-colors hover:bg-primary/10 hover:text-primary"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
          )}
          {/* Two audiences, one popup. Arriving from the build panel this
              is a step in creating a card, so it gets a step title and a
              "start blank" alternative. Opened from the Template Hub chip
              it's just the template browser, and those would be clutter —
              starting blank already lives in Clear Canvas next to it. */}
          {showBack ? (
            <>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-on-surface">Pick a starting design</p>
                <p className="text-xs text-on-surface-variant">
                  Applies the design and its sample text. You can change either afterwards.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  confirmCardReplace(onStartFresh, {
                    title: 'Start from a blank card?',
                    offerDraftSave: false,
                    body: (
                      <>
                        This removes all content and styling from the card you are editing.
                        Anything saved in{' '}
                        <span className="font-semibold text-on-surface">My Draft</span> and your
                        live campaign remain unchanged.
                      </>
                    ),
                    reassuranceBody: (
                      <>
                        This removes all content and styling from the card you are editing.
                        Anything saved in{' '}
                        <span className="font-semibold text-on-surface">My Draft</span> and your
                        live campaign remain unchanged.
                      </>
                    ),
                    confirmLabel: 'Start blank',
                  });
                }}
                className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-border px-3 text-sm font-medium text-on-surface-variant transition-colors hover:border-primary/70 hover:text-primary"
              >
                <FilePlus2 className="h-4 w-4" /> Start blank
              </button>
            </>
          ) : (
            <p className="min-w-0 flex-1 text-sm text-on-surface-variant">
              Starts the card again with this template&apos;s design{' '}
              <span className="font-semibold text-on-surface">and its sample text</span>. To keep
              your words and change only the look, use Themes below the card.
            </p>
          )}
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-on-surface-variant transition-colors hover:bg-primary/10 hover:text-primary"
            aria-label="Close templates"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="campaign-custom-scrollbar overflow-y-auto p-6">
          <SamplePromoTemplates
            onApplyTemplate={(template, name) => {
              onClose();
              confirmCardReplace(() => onApplyTemplate(template, name), {
                title: 'Apply this template?',
                replacementLabel: 'this template',
                nextCard: applyTemplateFull(currentCard, template),
                body: "This replaces the text and design of the card you're editing. Your live campaign remains unchanged until you publish.",
                reassuranceBody:
                  "This replaces the card you're editing, including its text. Your live campaign remains unchanged until you publish.",
                confirmLabel: 'Apply template',
              });
            }}
          />
        </div>
      </div>
    </div>
  );
}
