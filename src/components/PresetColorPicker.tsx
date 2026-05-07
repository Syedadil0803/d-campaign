/**
 * PresetColorPicker.tsx
 * 
 * Google Docs-style color picker with 80 preset swatches + expandable custom HSV picker.
 * 
 * Ported from Vue App.vue lines 250-328 and 654-755
 */

'use client';

import React, { useState, useRef, useEffect } from 'react';
import { PRESET_COLORS } from '@/lib/richTextUtils';
import { hexToRgbValues, rgbToHsv, hsvToRgb, rgbToHexString } from '@/lib/richTextUtils';

interface PresetColorPickerProps {
  currentColor?: string;
  onColorSelect: (color: string) => void;
  onClose?: () => void;
}

export default function PresetColorPicker({ 
  currentColor = '#000000', 
  onColorSelect, 
  onClose 
}: PresetColorPickerProps) {
  const [showCustomColor, setShowCustomColor] = useState(false);
  const [cpHue, setCpHue] = useState(0);
  const [cpSat, setCpSat] = useState(0);
  const [cpVal, setCpVal] = useState(0);
  const [customColorValue, setCustomColorValue] = useState('#000000');
  
  const gradientAreaRef = useRef<HTMLDivElement>(null);
  const hueSliderRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Initialize color values from currentColor
  useEffect(() => {
    const { r, g, b } = hexToRgbValues(currentColor);
    const { h, s, v } = rgbToHsv(r, g, b);
    setCpHue(h);
    setCpSat(s);
    setCpVal(v);
    setCustomColorValue(currentColor);
  }, [currentColor]);

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        if (onClose) onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  const updateFromHsv = (h: number, s: number, v: number) => {
    setCpHue(h);
    setCpSat(s);
    setCpVal(v);
    const { r, g, b } = hsvToRgb(h, s, v);
    const hex = rgbToHexString(r, g, b);
    setCustomColorValue(hex);
  };

  const onGradientMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!gradientAreaRef.current) return;
    
    const rect = gradientAreaRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
    
    updateFromHsv(cpHue, x * 100, (1 - y) * 100);
  };

  const onHueMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!hueSliderRef.current) return;
    
    const rect = hueSliderRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const hue = x * 360;
    
    updateFromHsv(hue, cpSat, cpVal);
  };

  const onHexChange = (hex: string) => {
    const cleanHex = hex.trim();
    if (!/^#[0-9A-Fa-f]{6}$/.test(cleanHex)) return;
    
    const { r, g, b } = hexToRgbValues(cleanHex);
    const { h, s, v } = rgbToHsv(r, g, b);
    updateFromHsv(h, s, v);
  };

  const onRgbChange = (r: number, g: number, b: number) => {
    if (r < 0 || r > 255 || g < 0 || g > 255 || b < 0 || b > 255) return;
    
    const { h, s, v } = rgbToHsv(r, g, b);
    updateFromHsv(h, s, v);
  };

  const confirmCustomColor = () => {
    onColorSelect(customColorValue);
    setShowCustomColor(false);
  };

  const cancelCustomColor = () => {
    setShowCustomColor(false);
  };

  const { r, g, b } = hexToRgbValues(customColorValue);
  const cpHexInput = customColorValue;
  const cpR = r;
  const cpG = g;
  const cpB = b;

  return (
    <div 
      ref={containerRef}
      className="absolute top-full left-full ml-2 mt-1 z-50 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-xl p-2 w-[228px]"
    >
      <p className="text-[10px] text-gray-500 dark:text-gray-400 font-medium mb-1.5 px-0.5">
        Text color
      </p>
      
      {/* Preset color grid */}
      <div className="grid grid-cols-10 gap-0.5">
        {PRESET_COLORS.map((color) => (
          <button
            key={color}
            onMouseDown={(e) => {
              e.preventDefault();
              onColorSelect(color);
              if (onClose) onClose();
            }}
            className={`w-5 h-5 rounded-sm border transition-transform hover:scale-125 hover:z-10 hover:shadow-md ${
              currentColor === color 
                ? 'ring-2 ring-indigo-500 ring-offset-1 dark:ring-offset-gray-800' 
                : ''
            }`}
            style={{ 
              backgroundColor: color, 
              borderColor: color === '#ffffff' ? '#d1d5db' : color 
            }}
          />
        ))}
      </div>

      {/* Custom color section */}
      <div className="border-t border-gray-200 dark:border-gray-600 mt-2 pt-2">
        {!showCustomColor ? (
          <button
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setShowCustomColor(true);
            }}
            className="flex items-center gap-2 cursor-pointer group px-0.5 w-full text-left"
          >
            <div className="w-5 h-5 rounded-sm border border-gray-300 dark:border-gray-500 bg-gradient-to-br from-red-500 via-yellow-400 to-blue-500" />
            <span className="text-xs text-gray-600 dark:text-gray-300 group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
              Custom…
            </span>
          </button>
        ) : (
          <div className="space-y-2.5">
            {/* Saturation/Brightness gradient area */}
            <div
              ref={gradientAreaRef}
              className="relative w-full h-[140px] rounded cursor-crosshair select-none border border-gray-200 dark:border-gray-600"
              style={{
                background: `linear-gradient(to bottom, transparent, #000), linear-gradient(to right, #fff, hsl(${cpHue}, 100%, 50%))`
              }}
              onMouseDown={onGradientMouseDown}
            >
              <div
                className="absolute w-3.5 h-3.5 rounded-full border-2 border-white shadow-md pointer-events-none -translate-x-1/2 -translate-y-1/2"
                style={{
                  left: `${cpSat}%`,
                  top: `${100 - cpVal}%`,
                  backgroundColor: customColorValue
                }}
              />
            </div>

            {/* Preview circle + Hue slider */}
            <div className="flex items-center gap-2">
              <div
                className="w-7 h-7 rounded-full border-2 border-gray-300 dark:border-gray-500 shrink-0"
                style={{ backgroundColor: customColorValue }}
              />
              <div
                ref={hueSliderRef}
                className="relative flex-1 h-3 rounded-full cursor-pointer select-none"
                style={{
                  background: 'linear-gradient(to right, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)'
                }}
                onMouseDown={onHueMouseDown}
              >
                <div
                  className="absolute w-3.5 h-3.5 rounded-full border-2 border-white shadow-md pointer-events-none -translate-x-1/2 -translate-y-1/2 top-1/2"
                  style={{
                    left: `${(cpHue / 360) * 100}%`,
                    backgroundColor: `hsl(${cpHue}, 100%, 50%)`
                  }}
                />
              </div>
            </div>

            {/* Hex + RGB inputs */}
            <div className="grid grid-cols-4 gap-1.5">
              <div>
                <label className="block text-[9px] text-gray-400 dark:text-gray-500 mb-0.5">Hex</label>
                <input
                  type="text"
                  value={cpHexInput}
                  onChange={(e) => onHexChange(e.target.value)}
                  className="w-full text-[11px] px-1.5 py-1 border rounded bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 dark:text-gray-100 font-mono text-center"
                />
              </div>
              <div>
                <label className="block text-[9px] text-gray-400 dark:text-gray-500 mb-0.5">R</label>
                <input
                  type="number"
                  min="0"
                  max="255"
                  value={cpR}
                  onChange={(e) => onRgbChange(Number(e.target.value), cpG, cpB)}
                  className="w-full text-[11px] px-1.5 py-1 border rounded bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 dark:text-gray-100 text-center"
                />
              </div>
              <div>
                <label className="block text-[9px] text-gray-400 dark:text-gray-500 mb-0.5">G</label>
                <input
                  type="number"
                  min="0"
                  max="255"
                  value={cpG}
                  onChange={(e) => onRgbChange(cpR, Number(e.target.value), cpB)}
                  className="w-full text-[11px] px-1.5 py-1 border rounded bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 dark:text-gray-100 text-center"
                />
              </div>
              <div>
                <label className="block text-[9px] text-gray-400 dark:text-gray-500 mb-0.5">B</label>
                <input
                  type="number"
                  min="0"
                  max="255"
                  value={cpB}
                  onChange={(e) => onRgbChange(cpR, cpG, Number(e.target.value))}
                  className="w-full text-[11px] px-1.5 py-1 border rounded bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 dark:text-gray-100 text-center"
                />
              </div>
            </div>

            {/* Cancel / OK buttons */}
            <div className="flex gap-1.5">
              <button
                onMouseDown={(e) => {
                  e.preventDefault();
                  cancelCustomColor();
                }}
                className="flex-1 px-2 py-1.5 text-xs rounded border border-gray-300 text-gray-600 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onMouseDown={(e) => {
                  e.preventDefault();
                  confirmCustomColor();
                }}
                className="flex-1 px-2 py-1.5 text-xs rounded bg-indigo-600 text-white hover:bg-indigo-700 transition-colors font-medium"
              >
                OK
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
