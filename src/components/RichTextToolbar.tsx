/**
 * RichTextToolbar.tsx
 * 
 * Reusable formatting toolbar with Bold, Italic, font-size controls, and color picker.
 * 
 * Ported from Vue App.vue lines 238-365
 */

'use client';

import React, { useState, useRef } from 'react';
import PresetColorPicker from './PresetColorPicker';

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
  presetColors?: string[];
  showAlignment?: boolean;
  alignment?: 'left' | 'center' | 'right';
  onAlignmentChange?: (alignment: 'left' | 'center' | 'right') => void;
  showButtonWidth?: boolean;
  buttonFullWidth?: boolean;
  onButtonWidthChange?: (fullWidth: boolean) => void;
}

export default function RichTextToolbar({
  activeFormats,
  onFormat,
  onColorSelect,
  presetColors = [],
  showAlignment = false,
  alignment = 'left',
  onAlignmentChange,
  showButtonWidth = false,
  buttonFullWidth = false,
  onButtonWidthChange,
}: RichTextToolbarProps) {
  const [showColorPicker, setShowColorPicker] = useState(false);
  const colorBtnRef = useRef<HTMLButtonElement>(null);

  const handleFormat = (format: string) => {
    onFormat(format);
  };

  const handleColorSelect = (color: string) => {
    onColorSelect(color);
    setShowColorPicker(false);
  };

  return (
    <div className="flex items-center justify-between w-full">
      <div className="flex flex-wrap gap-1 items-center">
        {/* Color Picker */}
        <div className="relative flex items-center">
          <button
            ref={colorBtnRef}
            className="cursor-pointer flex flex-col items-center px-1.5 py-1 border rounded transition-colors border-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 dark:border-gray-600"
            title="Text Color"
            onMouseDown={(e) => {
              e.preventDefault();
              setShowColorPicker(!showColorPicker);
            }}
          >
            <span className="text-xs font-bold leading-none text-gray-700 dark:text-gray-200">A</span>
            <span 
              className="block w-4 h-1 rounded-sm mt-0.5"
              style={{ backgroundColor: activeFormats.color }}
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
          className={`px-2 py-1 text-xs font-bold border rounded transition-colors ${
            activeFormats.bold
              ? 'bg-indigo-600 text-white border-indigo-600'
              : 'border-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 dark:border-gray-600'
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
          className={`px-2 py-1 text-xs italic border rounded transition-colors ${
            activeFormats.italic
              ? 'bg-indigo-600 text-white border-indigo-600'
              : 'border-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 dark:border-gray-600'
          }`}
          title="Italic"
        >
          I
        </button>

        {/* Divider */}
        <div className="border-l border-gray-300 h-4 mx-1" />

        {/* Size Buttons */}
        {['xs', 'sm', 'md', 'lg', 'xl', 'xxl'].map((size) => (
          <button
            key={size}
            onMouseDown={(e) => {
              e.preventDefault();
              handleFormat(`size-${size}`);
            }}
            className={`px-2 py-1 text-xs border rounded transition-colors ${
              activeFormats.size === size
                ? 'bg-indigo-600 text-white border-indigo-600'
                : 'border-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 dark:border-gray-600'
            }`}
          >
            {size.toUpperCase()}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-1">
        {/* Text Alignment (optional) moved to right side */}
        {showAlignment && (
          <>
            <div className="border-l border-gray-300 h-4 mx-1" />

            <button
              onMouseDown={(e) => {
                e.preventDefault();
                onAlignmentChange?.('left');
              }}
              className={`px-2 py-1 text-xs border rounded transition-colors ${
                alignment === 'left'
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'border-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 dark:border-gray-600'
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
              className={`px-2 py-1 text-xs border rounded transition-colors ${
                alignment === 'center'
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'border-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 dark:border-gray-600'
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
              className={`px-2 py-1 text-xs border rounded transition-colors ${
                alignment === 'right'
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'border-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 dark:border-gray-600'
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
              className={`px-2 py-1 text-xs border rounded transition-colors ${
                buttonFullWidth
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'border-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 dark:border-gray-600'
              }`}
              title="Full Width"
            >
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M3 4h14v2H3V4zm0 4h14v2H3V8zm0 4h14v2H3v-2z" clipRule="evenodd" />
              </svg>
            </button>
          </>
        )}
      </div>
    </div>
  );
}
