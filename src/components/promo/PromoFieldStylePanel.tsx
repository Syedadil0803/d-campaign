'use client';

import type { RefObject } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import type {
  CampaignConfig,
  GradientStyle,
  PromoCard,
  PromoField,
} from '@/types/campaign';
import type { ActiveFormats } from '@/hooks/useRichTextEditor';
import { PopupDropdown } from '@/components/shared/PopupDropdown';
import RichTextToolbar from '@/components/shared/RichTextToolbar';
import { GradientControls } from '@/components/promo/GradientControls';

interface PromoFieldStylePanelProps {
  field: PromoField;
  fieldStyle: PromoCard['style']['titleStyle'];
  config: CampaignConfig;
  activeFormats: ActiveFormats;
  fieldPopupHeightRef: RefObject<number>;
  positionStyle: { top?: string; bottom?: string; left?: string };
  fieldLabel: string;
  setCurrentField: (field: PromoField | null) => void;
  handlePromoToolbarFormat: (format: string, value?: string) => void;
  handlePromoToolbarColor: (color: string) => void;
  setFieldAlignment: (align: 'left' | 'center' | 'right') => void;
  updateFieldBg: (patch: Partial<GradientStyle>) => void;
  updateField: <K extends keyof PromoCard>(field: K, value: PromoCard[K]) => void;
  showFieldBgTypeDropdown: boolean;
  setShowFieldBgTypeDropdown: (open: boolean | ((prev: boolean) => boolean)) => void;
  fieldBgTypePos: { top: number; left: number; width: number } | null;
  setFieldBgTypePos: (pos: { top: number; left: number; width: number } | null) => void;
  fieldBgTypeBtnRef: RefObject<HTMLButtonElement | null>;
  fieldBgTypeMenuRef: RefObject<HTMLDivElement | null>;
  closeAllPromoDropdowns: () => void;
  getDropdownPosition: (button: HTMLButtonElement | null) => { top: number; left: number; width: number } | null;
  styleWarning: string | null;
  setStyleWarning: (message: string | null) => void;
}

/**
 * The panel that styles one field of the promo card.
 *
 * Holds no contentEditable of its own — it acts on whichever field is
 * selected, through the handlers passed in — so it can be a component without
 * remounting any editor.
 */
export function PromoFieldStylePanel({
  field,
  fieldStyle,
  config,
  activeFormats,
  fieldPopupHeightRef,
  positionStyle,
  fieldLabel,
  setCurrentField,
  handlePromoToolbarFormat,
  handlePromoToolbarColor,
  setFieldAlignment,
  updateFieldBg,
  updateField,
  showFieldBgTypeDropdown,
  setShowFieldBgTypeDropdown,
  fieldBgTypePos,
  setFieldBgTypePos,
  fieldBgTypeBtnRef,
  fieldBgTypeMenuRef,
  closeAllPromoDropdowns,
  getDropdownPosition,
  styleWarning,
  setStyleWarning,
}: PromoFieldStylePanelProps) {
  const isButton = field === 'button';
  const fbg = fieldStyle.background;

  return (
                  <div
                    ref={(node) => {
                      if (node) fieldPopupHeightRef.current = node.offsetHeight;
                    }}
                    className="absolute z-30 w-[280px] bg-black/10 backdrop-blur-md border border-white/10 rounded-xl shadow-2xl p-3"
                    style={positionStyle}
                  >
                    <button
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        setCurrentField(null);
                      }}
                      className="absolute -top-[28px] -right-[28px] inline-flex h-7 w-7 items-center justify-center rounded-full border border-border bg-surface-elevated text-on-surface-variant shadow-sm transition-colors hover:border-primary/70 hover:bg-primary/10 hover:text-primary focus:outline-none focus:ring-2 focus:ring-primary/40"
                      aria-label="Close style controls"
                      title="Close"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <label className="text-xs font-semibold text-on-surface">
                        {fieldLabel}
                      </label>
                      <div className="flex items-center gap-1">
                        <button
                          onMouseDown={(e) => {
                            e.preventDefault();
                            setFieldAlignment("left");
                          }}
                          className={`cursor-pointer h-9 w-9 flex items-center justify-center text-[10px] border rounded transition-colors ${(fieldStyle?.textAlign || "left") === "left" ? "bg-primary/10 text-primary border-primary/80" : "border-border hover:border-primary/70 hover:bg-primary/10 hover:text-primary text-on-surface-variant"}`}
                          title="Align Left"
                        >
                          <svg
                            className="w-3.5 h-3.5"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path
                              fillRule="evenodd"
                              d="M3 4h14v1H3V4zm0 4h10v1H3V8zm0 4h14v1H3v-1zm0 4h10v1H3v-1z"
                              clipRule="evenodd"
                            />
                          </svg>
                        </button>
                        <button
                          onMouseDown={(e) => {
                            e.preventDefault();
                            setFieldAlignment("center");
                          }}
                          className={`cursor-pointer h-9 w-9 flex items-center justify-center text-[10px] border rounded transition-colors ${(fieldStyle?.textAlign || "left") === "center" ? "bg-primary/10 text-primary border-primary/80" : "border-border hover:border-primary/70 hover:bg-primary/10 hover:text-primary text-on-surface-variant"}`}
                          title="Align Center"
                        >
                          <svg
                            className="w-3.5 h-3.5"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path
                              fillRule="evenodd"
                              d="M5 4h10v1H5V4zm2 4h6v1H7V8zm-2 4h10v1H5v-1zm2 4h6v1H7v-1z"
                              clipRule="evenodd"
                            />
                          </svg>
                        </button>
                        <button
                          onMouseDown={(e) => {
                            e.preventDefault();
                            setFieldAlignment("right");
                          }}
                          className={`cursor-pointer h-9 w-9 flex items-center justify-center text-[10px] border rounded transition-colors ${(fieldStyle?.textAlign || "left") === "right" ? "bg-primary/10 text-primary border-primary/80" : "border-border hover:border-primary/70 hover:bg-primary/10 hover:text-primary text-on-surface-variant"}`}
                          title="Align Right"
                        >
                          <svg
                            className="w-3.5 h-3.5"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path
                              fillRule="evenodd"
                              d="M7 4h10v1H7V4zm-4 4h14v1H3V8zm4 4h10v1H7v-1zm-4 4h14v1H3v-1z"
                              clipRule="evenodd"
                            />
                          </svg>
                        </button>
                      </div>
                    </div>

                    {/* The app's own style bar drives every field,
                        including the timer. For the timer it routes
                        through the LexicalTimerField imperative handle,
                        which is cell-aware (styles the targeted chip
                        number/word/colon, or the text selection). */}
                    <RichTextToolbar
                      activeFormats={activeFormats}
                      onFormat={handlePromoToolbarFormat}
                      onColorSelect={handlePromoToolbarColor}
                      showAlignment={false}
                      showButtonWidth={isButton}
                      buttonFullWidth={
                        config.promoCard.buttonFullWidth || false
                      }
                      onButtonWidthChange={(fullWidth) =>
                        updateField("buttonFullWidth", fullWidth)
                      }
                      compact={true}
                    />

                    {/* Portalled to the body on purpose. `position:
                        fixed` is measured against the nearest ancestor
                        with a transform or filter, and the panel this
                        sits inside carries backdrop-blur — so a 420px
                        box "centred on the viewport" was really centred
                        on a 280px popup, and hung off both sides. With
                        the popup against the canvas's left edge the
                        overflow-x: hidden above it clipped the warning
                        away entirely. */}
                    {styleWarning && typeof document !== 'undefined' && createPortal(
                      <>
                        {/* No backdrop: an invisible full-screen layer
                            silently eats the user's next click (the
                            same bug the welcome-back banner had). The
                            warning auto-dismisses in 3s and has ✕. */}
                        <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[100] bg-surface-elevated/85 backdrop-blur-sm border border-border text-on-surface rounded-2xl shadow-2xl px-8 py-6 w-[420px] text-center">
                          <button
                            onClick={() => setStyleWarning(null)}
                            className="absolute top-3 right-4 text-on-surface-variant hover:text-on-surface text-lg"
                          >
                            ✕
                          </button>
                          <p className="text-2xl mb-3">⚠️</p>
                          <p className="text-sm text-on-surface font-medium leading-relaxed">{styleWarning}</p>
                        </div>
                      </>,
                      document.body,
                    )}

                    <div className="mt-2 pt-2 border-t border-white/10">
                      {/* Change here to reflect color updates on the selected field preview. */}
                      <label className="block text-xs text-on-surface-variant mb-1">
                        Field Background
                      </label>
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <PopupDropdown
                            label="Type"
                            value={fbg.type}
                            options={[
                              { value: "solid", label: "Solid" },
                              { value: "linear", label: "Linear" },
                              { value: "radial", label: "Radial" },
                            ]}
                            open={showFieldBgTypeDropdown}
                            onOpen={() => {
                              const next = !showFieldBgTypeDropdown;
                              closeAllPromoDropdowns();
                              setShowFieldBgTypeDropdown(next);
                              setFieldBgTypePos(
                                getDropdownPosition(
                                  fieldBgTypeBtnRef.current,
                                ),
                              );
                            }}
                            onSelect={(v) => {
                              updateFieldBg({ type: v as GradientStyle['type'] });
                              setShowFieldBgTypeDropdown(false);
                            }}
                            buttonRef={fieldBgTypeBtnRef}
                            menuRef={fieldBgTypeMenuRef}
                            menuPosition={fieldBgTypePos}
                            compact={true}
                          />
                        </div>
                        <div className="col-span-2">
                          {(fbg.type === "linear" ||
                            fbg.type === "radial") && (
                            <>
                              <label className="block text-xs text-on-surface-variant mb-0.5">
                                Balance: {fbg.midpoint ?? 50}%
                              </label>
                              <input
                                type="range"
                                min="0"
                                max="100"
                                value={fbg.midpoint ?? 50}
                                onChange={(e) =>
                                  updateFieldBg({
                                    midpoint: Number(e.target.value),
                                  })
                                }
                                className="balance-slider mt-3"
                              />
                            </>
                          )}
                        </div>
                      </div>
                      <div className="mt-2 min-h-[56px]">
                        <GradientControls
                          background={fbg}
                          onChange={updateFieldBg}
                          keyPrefix="field"
                        />
                      </div>
                    </div>
                  </div>
  );
}
