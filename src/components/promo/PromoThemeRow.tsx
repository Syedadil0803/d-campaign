'use client';

import type { RefObject } from 'react';
import { Palette, RotateCcw } from 'lucide-react';
import type { CampaignConfig, PromoCard } from '@/types/campaign';
import { getBackgroundStyle } from '@/lib/utils';
import { applyTemplateLook } from '@/lib/promo/promoTemplate';
import { lookSignature } from '@/lib/promo/promoAuthorship';
import { sampleTemplates } from '@/lib/promo/sampleTemplateCards';
import { PopupDropdown } from '@/components/shared/PopupDropdown';

type MenuPosition = { top: number; left: number; width: number } | null;

interface PromoThemeRowProps {
  config: CampaignConfig;
  configRef: RefObject<CampaignConfig>;
  setConfig: (
    config: CampaignConfig | ((prev: CampaignConfig) => CampaignConfig),
  ) => void;
  markChanged: () => void;
  pushPromoState: (options?: { replace?: boolean }) => void;
  toast: (message: string, isError?: boolean) => void;

  /** Card Position dropdown. */
  showCardPositionDropdown: boolean;
  setShowCardPositionDropdown: (open: boolean) => void;
  cardPositionPos: MenuPosition;
  setCardPositionPos: (pos: MenuPosition) => void;
  cardPositionBtnRef: RefObject<HTMLButtonElement | null>;
  cardPositionMenuRef: RefObject<HTMLDivElement | null>;
  closeAllPromoDropdowns: () => void;
  getDropdownPosition: (button: HTMLButtonElement | null) => MenuPosition;

  /** Edit Colors popup, which is anchored to the card in the canvas. */
  cardBgPopupBtnRef: RefObject<HTMLButtonElement | null>;
  promoCardRef: RefObject<HTMLDivElement | null>;
  setShowCardBgPopup: (open: boolean | ((prev: boolean) => boolean)) => void;
  setCardBgPopupTop: (top: number | null) => void;
  setShowPersistentScaffold: (show: boolean) => void;

  /** Which single swatch across both groups is marked. */
  hasCurrentDesign: boolean;
  onOwnDesign: boolean;
  baselineIsATheme: boolean;
  themeBaseline: PromoCard['style'];
  samplingThemeRef: RefObject<boolean>;
}

/**
 * The row beneath the canvas: where the card sits on the site, the colours it
 * uses there, and the themes you can try on.
 *
 * Themes restyle the card without touching the words. This is the safe half of
 * what "Template Hub" used to do: applying a template wholesale replaced the
 * user's copy, which is what made it need a consent popup. Swapping only the
 * look never destroys anything.
 */
export function PromoThemeRow({
  config,
  configRef,
  setConfig,
  markChanged,
  pushPromoState,
  toast,
  showCardPositionDropdown,
  setShowCardPositionDropdown,
  cardPositionPos,
  setCardPositionPos,
  cardPositionBtnRef,
  cardPositionMenuRef,
  closeAllPromoDropdowns,
  getDropdownPosition,
  cardBgPopupBtnRef,
  promoCardRef,
  setShowCardBgPopup,
  setCardBgPopupTop,
  setShowPersistentScaffold,
  hasCurrentDesign,
  onOwnDesign,
  baselineIsATheme,
  themeBaseline,
  samplingThemeRef,
}: PromoThemeRowProps) {
  return (
    <div className="mt-5 shrink-0 pb-1">
      {/* Two labelled groups rather than one unbroken row.

          The current design used to sit in the row as just another swatch,
          told apart only by a small revert icon — so the one thing you most
          need to find looked like a thirteenth theme. It gets its own heading
          and its own space now, with a rule between the two, and exactly one
          swatch across both groups is ever marked: yours when the card is on
          your design, the theme's only while you're trying it. */}
      <div className="flex items-start gap-4">
        {/* Position and colour share one explainer: both describe the card
            itself, so a line under each would say the same thing twice. */}
        <div className="shrink-0">
          <div className="flex items-start gap-4">
            <div className="shrink-0">
              <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-on-surface-variant">
                Card Position
              </p>
              <span title="Where the card sits on your website">
                <PopupDropdown
                  labelClassName="sr-only"
                  label="Position"
                  value={config.promoCard.style.position}
                  options={[
                    { value: 'bottom-right', label: 'Bottom Right' },
                    { value: 'bottom-left', label: 'Bottom Left' },
                  ]}
                  open={showCardPositionDropdown}
                  onOpen={() => {
                    const next = !showCardPositionDropdown;
                    closeAllPromoDropdowns();
                    setShowCardPositionDropdown(next);
                    setCardPositionPos(
                      getDropdownPosition(cardPositionBtnRef.current),
                    );
                  }}
                  onSelect={(v) => {
                    pushPromoState();
                    setConfig({
                      ...config,
                      promoCard: {
                        ...config.promoCard,
                        style: {
                          ...config.promoCard.style,
                          position: v as PromoCard['style']['position'],
                        },
                      },
                    });
                    markChanged();
                    setShowCardPositionDropdown(false);
                  }}
                  buttonRef={cardPositionBtnRef}
                  menuRef={cardPositionMenuRef}
                  menuPosition={cardPositionPos}
                  compact={true}
                  // Sits low in the panel, so there is often no room beneath
                  // it — without this the menu opened past the fold.
                  flip
                  buttonClassName="flex h-10 items-center gap-2 whitespace-nowrap rounded-lg border border-border bg-surface px-3 text-left text-sm font-medium text-on-surface shadow-sm transition-colors hover:border-primary/70 hover:text-primary"
                />
              </span>
            </div>

            <div className="shrink-0">
              <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-on-surface-variant">
                Card Color
              </p>
              <button
                ref={cardBgPopupBtnRef}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  closeAllPromoDropdowns();
                  setShowPersistentScaffold(true);
                  setShowCardBgPopup((prev) => {
                    if (prev) return false;
                    const card = promoCardRef.current;
                    const canvas = card?.closest(
                      '[data-promo-canvas]',
                    ) as HTMLElement | null;
                    if (card && canvas) {
                      const cardRect = card.getBoundingClientRect();
                      const canvasRect = canvas.getBoundingClientRect();
                      setCardBgPopupTop(
                        Math.round(canvasRect.top + 8 - cardRect.top),
                      );
                    }
                    return true;
                  });
                }}
                className="inline-flex h-10 items-center gap-2 whitespace-nowrap rounded-lg border border-border bg-surface px-3 text-sm font-medium text-on-surface shadow-sm transition-colors hover:border-primary/70 hover:text-primary"
                title="The card's own background colors"
              >
                <Palette className="h-4 w-4" /> Edit Colors
              </button>
            </div>
          </div>
          <p className="mt-1.5 text-[11px] text-on-surface-variant">
            Card sits on website, and the colors it uses there.
          </p>
        </div>

        <div className="mt-4 h-10 w-px shrink-0 bg-border" />

        <div className="min-w-0 flex-1">
          <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-on-surface-variant">
            Themes
          </p>
          {/* Vertical padding is not decoration: overflow-x also clips the Y
              axis, and the selected swatch's ring sits 2px outside its box, so
              without room the marker is sliced off top and bottom. */}
          <div className="campaign-custom-scrollbar flex gap-2 overflow-x-auto px-1 pb-2 pt-1.5">
            {/* Your own design leads the row rather than sitting in a group of
                its own. It is chosen the same way a theme is, so it belongs
                among them; the separate section made the one design you cannot
                lose look like a different kind of thing, and cost a label and
                two rules to say so. The revert badge marks it as yours. */}
            {hasCurrentDesign && (
              <button
                type="button"
                title="Your own design — back to how the card looked before you tried a theme"
                onClick={() => {
                  // Already on it: restoring would change nothing, so an
                  // "undo" step and a toast claiming a restore both lie.
                  if (onOwnDesign) return;
                  pushPromoState({ replace: true });
                  samplingThemeRef.current = true;
                  setConfig({
                    ...configRef.current,
                    promoCard: {
                      ...configRef.current.promoCard,
                      style: themeBaseline,
                    },
                  });
                  markChanged();
                  toast('Restored your original design');
                }}
                style={{ background: getBackgroundStyle(themeBaseline.background) }}
                className={`relative h-10 w-14 shrink-0 rounded-lg ring-offset-2 ring-offset-surface transition-all hover:scale-105 ${
                  onOwnDesign
                    ? 'ring-2 ring-primary'
                    : 'ring-1 ring-border hover:ring-primary/60'
                }`}
              >
                <span className="absolute -right-1.5 -top-1.5 grid h-4 w-4 place-items-center rounded-full border border-border bg-surface text-on-surface-variant">
                  <RotateCcw className="h-2.5 w-2.5" />
                </span>
              </button>
            )}
            {sampleTemplates.map((t) => {
              /**
               * Marked when the card is wearing this look — either because it
               * is being tried on, or because the design simply is this
               * template.
               *
               * `onOwnDesign` alone hid the mark in the second case: an
               * untouched template counts as "your design", so no theme lit
               * up, and with the Current swatch hidden for exactly that case
               * nothing in the strip was marked at all.
               */
              const on =
                (!onOwnDesign || baselineIsATheme) &&
                lookSignature((t.promoCard as PromoCard).style) ===
                  lookSignature(config.promoCard.style);
              return (
                <button
                  key={t.id}
                  type="button"
                  title={t.name}
                  onClick={() => {
                    // This look is already applied — re-applying marks the
                    // card changed and stacks an undo step that steps back to
                    // the same picture.
                    if (on) return;
                    pushPromoState({ replace: true });
                    samplingThemeRef.current = true;
                    setConfig({
                      ...configRef.current,
                      promoCard: applyTemplateLook(
                        configRef.current.promoCard,
                        t.promoCard as PromoCard,
                      ),
                    });
                    markChanged();
                  }}
                  style={{
                    background: getBackgroundStyle(
                      (t.promoCard as PromoCard).style.background,
                    ),
                  }}
                  className={`h-10 w-14 shrink-0 rounded-lg ring-offset-2 ring-offset-surface transition-all hover:scale-105 ${
                    on
                      ? 'ring-2 ring-primary'
                      : 'ring-1 ring-border hover:ring-primary/60'
                  }`}
                />
              );
            })}
          </div>
          {/* Sits under Themes, not under the whole row: it explains the
              swatches, and spanning the full width put a sentence about themes
              directly beneath "Card Position".

              Said here rather than in a toast: it explains a control that is on
              screen, so it should be readable while the user is looking at it —
              and still there the second time they wonder, which a toast never
              is. */}
          {hasCurrentDesign && (
            <p className="mt-1.5 text-[11px] text-on-surface-variant">
              Trying a theme keeps your text. Your own design is saved as the{' '}
              <span className="font-semibold text-on-surface">first swatch</span>{' '}
              — tap it to come back.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
