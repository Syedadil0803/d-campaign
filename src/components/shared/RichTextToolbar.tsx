/**
 * RichTextToolbar.tsx
 * 
 * Reusable formatting toolbar with Bold, Italic, font-size controls, and color picker.
 * 
 * Ported from Vue App.vue lines 238-365
 */

'use client';

import React, { useState, useRef, useEffect } from 'react';
import PresetColorPicker from '@/components/shared/PresetColorPicker';
import { FONT_SIZE_DISPLAY_MAP } from '@/lib/editor/fontSizeUtils';

interface ActiveFormats {
  bold: boolean;
  italic: boolean;
  size: string;
  color: string;
}

interface RichTextToolbarProps {
  activeFormats: ActiveFormats;
  onFormat: (format: string) => void;
  onColorSelect: (color: string) => void;
  extraActions?: React.ReactNode;
  rightActions?: React.ReactNode;
  presetColors?: string[];
  showAlignment?: boolean;
  alignment?: 'left' | 'center' | 'right';
  onAlignmentChange?: (alignment: 'left' | 'center' | 'right') => void;
  showButtonWidth?: boolean;
  buttonFullWidth?: boolean;
  onButtonWidthChange?: (fullWidth: boolean) => void;
  compact?: boolean;
}

export default function RichTextToolbar({
  activeFormats,
  onFormat,
  onColorSelect,
  extraActions,
  rightActions,
  showAlignment = false,
  alignment = 'left',
  onAlignmentChange,
  showButtonWidth = false,
  buttonFullWidth = false,
  onButtonWidthChange,
  compact = false,
}: RichTextToolbarProps) {
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showSizeDropdown, setShowSizeDropdown] = useState(false);
  const colorBtnRef = useRef<HTMLButtonElement>(null);
  const sizeBtnRef = useRef<HTMLButtonElement>(null);
  const sizeMenuRef = useRef<HTMLDivElement>(null);
  const baseBtnClass = compact
    ? 'px-1.5 py-0.5 text-[10px] border rounded transition-colors border-border hover:border-primary/70 hover:bg-primary/10 hover:text-primary text-on-surface-variant'
    : 'px-2 py-1 text-xs border rounded transition-colors border-border hover:border-primary/70 hover:bg-primary/10 hover:text-primary text-on-surface-variant';
  const activeBtnClass = 'bg-primary/10 text-primary border-primary/80';

  const handleFormat = (format: string) => {
    onFormat(format);
  };

  const handleColorSelect = (color: string) => {
    onColorSelect(color);
    setShowColorPicker(false);
  };

  useEffect(() => {
    const onDocMouseDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (sizeBtnRef.current?.contains(target) || sizeMenuRef.current?.contains(target)) return;
      setShowSizeDropdown(false);
    };
    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, []);

  return (
    <div className="flex items-center justify-between w-full">
      <div className="flex flex-wrap gap-1 items-center">
        {/* Color Picker */}
        <div className="relative flex items-center">
          <button
            ref={colorBtnRef}
            className={`${baseBtnClass} flex flex-col items-center px-1.5`}
            title="Text Color"
            onMouseDown={(e) => {
              e.preventDefault();
              setShowColorPicker(!showColorPicker);
            }}
          >
            <span className="text-xs font-bold leading-none">A</span>
            {/*
              An empty color means the selection holds more than one, so the
              bar is left unpainted rather than showing whichever colour came
              first. A hairline keeps the control the same size either way.
            */}
            <span
              className={`block w-4 h-1 rounded-sm mt-0.5 ${
                activeFormats.color ? '' : 'border border-dashed border-current opacity-50'
              }`}
              style={activeFormats.color ? { backgroundColor: activeFormats.color } : undefined}
            />
          </button>

          {showColorPicker && (
            <PresetColorPicker
              anchorEl={colorBtnRef.current}
              currentColor={activeFormats.color}
              onColorSelect={handleColorSelect}
              onClose={() => setShowColorPicker(false)}
            />
          )}
        </div>

        {/* Divider */}
        <div className="border-l border-gray-300 h-4 mx-0.5" />

        {/* Bold Button */}
        <button
          onMouseDown={(e) => {
            e.preventDefault();
            handleFormat('bold');
          }}
          className={`${baseBtnClass} font-bold ${
            activeFormats.bold ? activeBtnClass : ''
          }`}
          title="Bold"
        >
          B
        </button>

        {/* Italic Button */}
        <button
          onMouseDown={(e) => {
            e.preventDefault();
            handleFormat('italic');
          }}
          className={`${baseBtnClass} italic ${
            activeFormats.italic ? activeBtnClass : ''
          }`}
          title="Italic"
        >
          I
        </button>

        {/* Divider */}
        <div className="border-l border-gray-300 h-4 mx-1" />

        {/* Size — one control showing the current size, the rest a click away.
            Six buttons side by side made the toolbar read as a row of shouty
            abbreviations, and five of them were always wrong for the text
            selected. */}
        {!compact ? (
          <div className="relative">
            <button
              ref={sizeBtnRef}
              onMouseDown={(e) => {
                e.preventDefault();
                setShowSizeDropdown((v) => !v);
              }}
              className={`${baseBtnClass} flex w-[58px] items-center justify-between gap-1`}
              title="Text size"
              aria-haspopup="listbox"
              aria-expanded={showSizeDropdown}
            >
              <span>{activeFormats.size ? (FONT_SIZE_DISPLAY_MAP[activeFormats.size] ?? 'MD') : '\u2014'}</span>
              <svg
                className={`h-3 w-3 shrink-0 text-on-surface-variant transition-transform duration-200 ${
                  showSizeDropdown ? 'rotate-180' : 'rotate-0'
                }`}
                viewBox="0 0 20 20"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
              >
                <path d="M6 8l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            {showSizeDropdown && (
              <div
                ref={sizeMenuRef}
                role="listbox"
                className="absolute left-0 mt-1 z-50 min-w-[72px] rounded-lg border border-border bg-surface-elevated p-1.5 shadow-lg"
              >
                {Object.entries(FONT_SIZE_DISPLAY_MAP).map(([value, label]) => (
                  <button
                    key={value}
                    role="option"
                    aria-selected={activeFormats.size === value}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      handleFormat(`size-${value}`);
                      setShowSizeDropdown(false);
                    }}
                    className={`block w-full rounded px-2 py-1 text-left text-xs transition-colors hover:bg-primary/10 ${
                      activeFormats.size === value
                        ? 'font-semibold text-primary'
                        : 'text-on-surface'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : null}

        {extraActions}
      </div>

      <div className="flex items-center gap-1">
        {compact && (
          <div className="relative">
            <button
              ref={sizeBtnRef}
              onMouseDown={(e) => {
                e.preventDefault();
                setShowSizeDropdown((v) => !v);
              }}
              className="cursor-pointer h-6 w-[60px] px-1 py-1 text-[10px] rounded-md border border-white/10 bg-black/10 text-on-surface shadow-2xl backdrop-blur-md hover:border-primary/70 flex items-center justify-between"
              title="Font Size"
            >
              <span>
                {activeFormats.size ? (FONT_SIZE_DISPLAY_MAP[activeFormats.size] ?? '16') : '\u2014'}
              </span>
              <svg className={`h-3 w-3 flex-shrink-0 text-on-surface-variant transition-transform duration-200 ${showSizeDropdown ? 'rotate-180' : 'rotate-0'}`} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M6 8l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            {showSizeDropdown && (
              <div
                ref={sizeMenuRef}
                className="absolute right-0 mt-1 z-50 min-w-[80px] bg-black/10 backdrop-blur-md border border-white/10 shadow-2xl p-1.5 rounded-lg"
              >
                {Object.entries(FONT_SIZE_DISPLAY_MAP).map(([value, label]) => ({
                  value,
                  label,
                })).map((size) => (
                    <button
                      key={size.value}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        handleFormat(`size-${size.value}`);
                        setShowSizeDropdown(false);
                      }}
                      className={`block w-full rounded px-2 py-1 text-left text-[11px] transition-colors ${
                        activeFormats.size === size.value ? 'text-primary' : 'text-on-surface'
                      } hover:bg-surface-subtle`}
                    >
                      {size.label}
                    </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Text Alignment (optional) moved to right side */}
        {showAlignment && (
          <>
            <div className="border-l border-gray-300 h-4 mx-1" />

            <button
              onMouseDown={(e) => {
                e.preventDefault();
                onAlignmentChange?.('left');
              }}
              className={`${baseBtnClass} ${
                alignment === 'left'
                  ? activeBtnClass
                  : ''
              }`}
              title="Align Left"
            >
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M3 4h14v1H3V4zm0 4h10v1H3V8zm0 4h14v1H3v-1zm0 4h10v1H3v-1z" clipRule="evenodd" />
              </svg>
            </button>

            <button
              onMouseDown={(e) => {
                e.preventDefault();
                onAlignmentChange?.('center');
              }}
              className={`${baseBtnClass} ${
                alignment === 'center'
                  ? activeBtnClass
                  : ''
              }`}
              title="Align Center"
            >
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M5 4h10v1H5V4zm2 4h6v1H7V8zm-2 4h10v1H5v-1zm2 4h6v1H7v-1z" clipRule="evenodd" />
              </svg>
            </button>

            <button
              onMouseDown={(e) => {
                e.preventDefault();
                onAlignmentChange?.('right');
              }}
              className={`${baseBtnClass} ${
                alignment === 'right'
                  ? activeBtnClass
                  : ''
              }`}
              title="Align Right"
            >
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M7 4h10v1H7V4zm-4 4h14v1H3V8zm4 4h10v1H7v-1zm-4 4h14v1H3v-1z" clipRule="evenodd" />
              </svg>
            </button>
          </>
        )}

        {/* Button Width Toggle (optional) */}
        {showButtonWidth && (
          <>
            <div className="border-l border-gray-300 h-4 mx-1" />

            <button
              onMouseDown={(e) => {
                e.preventDefault();
                onButtonWidthChange?.(!buttonFullWidth);
              }}
              className={`${baseBtnClass} ${
                buttonFullWidth
                  ? activeBtnClass
                  : ''
              }`}
              title="Full Width"
            >
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M3 4h14v2H3V4zm0 4h14v2H3V8zm0 4h14v2H3v-2z" clipRule="evenodd" />
              </svg>
            </button>
          </>
        )}

        {rightActions}
      </div>
    </div>
  );
}
