'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Gift, X } from 'lucide-react';
import { CampaignConfig, PromoCard } from '@/types/campaign';
import { getBackgroundStyle } from '@/lib/utils';
import { SamplePromoTemplates } from './SamplePromoTemplates';
import { useRichTextEditor } from '@/hooks/useRichTextEditor';
import { wrapBareTextWithFontSize } from '@/lib/richTextUtils';
import RichTextToolbar from './RichTextToolbar';
import { 
  getDefaultTimerStorageHTML, 
  cleanTimerForStorage, 
  buildTimerEditorHTML, 
  ensureTimerPlaceholders,
  hasTimerPlaceholders,
  TIMER_EDITOR_COLOR_MAP,
  TIMER_EDITOR_BASE_STYLE
} from '@/lib/timerUtils';

interface PromoSectionProps {
  config: CampaignConfig;
  setConfig: (config: CampaignConfig) => void;
  markChanged: () => void;
  toast: (message: string, isError?: boolean) => void;
}

export function PromoSection({ config, setConfig, markChanged, toast }: PromoSectionProps) {
  const [currentTime, setCurrentTime] = useState(Date.now());
  const [currentField, setCurrentField] = useState<'title'|'subtitle'|'description'|'timer'|'button'|null>(null);

  // Refs for each contenteditable editor
  const titleRef = useRef<HTMLDivElement>(null);
  const subtitleRef = useRef<HTMLDivElement>(null);
  const descRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<HTMLDivElement>(null);
  const activeEditorRef = useRef<HTMLDivElement>(null);

  // Single hook instance — activeEditorRef is swapped on focus
  const {
    activeFormats, formatText, applyColor, detectFormats,
    ensureDefaultFontSize, saveSelection, getNormalizedHTML,
  } = useRichTextEditor(activeEditorRef, { defaultColor: '#ffffff' });

  // Populate editors from config on mount
  useEffect(() => {
    if (titleRef.current) titleRef.current.innerHTML = config.promoCard.title || '';
    if (subtitleRef.current) subtitleRef.current.innerHTML = config.promoCard.subtitle || '';
    if (descRef.current) descRef.current.innerHTML = config.promoCard.description || '';
    if (buttonRef.current) buttonRef.current.innerHTML = config.promoCard.buttonText || '';
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function syncEditorsFromConfig(pc: PromoCard) {
    setTimeout(() => {
      if (titleRef.current) titleRef.current.innerHTML = pc.title || '';
      if (subtitleRef.current) subtitleRef.current.innerHTML = pc.subtitle || '';
      if (descRef.current) descRef.current.innerHTML = pc.description || '';
      if (buttonRef.current) buttonRef.current.innerHTML = pc.buttonText || '';
      if (timerRef.current) {
        const timerHtml = pc.timerText || getDefaultTimerStorageHTML();
        timerRef.current.innerHTML = buildTimerEditorHTML(timerHtml);
      }
    }, 0);
  }

  function onFieldFocus(field: 'title'|'subtitle'|'description'|'timer'|'button', ref: React.RefObject<HTMLDivElement|null>) {
    setCurrentField(field);
    activeEditorRef.current = ref.current;
    setTimeout(() => { detectFormats(); ensureDefaultFontSize(); }, 0);
  }

  function insertTimerPlaceholder(placeholder: 'hhh' | 'mmm' | 'sss') {
    const el = timerRef.current;
    if (!el) return;
    
    const span = document.createElement('span');
    span.setAttribute('data-timer-placeholder', placeholder);
    span.setAttribute('contenteditable', 'false');
    
    const displayText: Record<string, string> = { hhh: 'hh', mmm: 'mm', sss: 'ss' };
    span.textContent = displayText[placeholder];
    
    // Apply editor styling
    const style = (TIMER_EDITOR_COLOR_MAP[placeholder] || '') + TIMER_EDITOR_BASE_STYLE;
    span.setAttribute('style', style);
    
    insertNodeAtCursor(span);
    onFieldInput('timer');
  }

  function insertTimerText(text: string) {
    const el = timerRef.current;
    if (!el) return;
    
    const textNode = document.createTextNode(text);
    insertNodeAtCursor(textNode);
    onFieldInput('timer');
  }

  function insertNodeAtCursor(node: Node) {
    const el = timerRef.current;
    if (!el) return;
    
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
      el.appendChild(node);
    } else {
      const range = selection.getRangeAt(0);
      range.deleteContents();
      range.insertNode(node);
      range.collapse(false);
      selection.removeAllRanges();
      selection.addRange(range);
    }
    el.focus();
  }

  function onFieldInput(field: 'title'|'subtitle'|'description'|'button'|'timer') {
    if (field === 'timer') {
      const el = timerRef.current;
      if (!el) return;
      const html = cleanTimerForStorage(el.innerHTML);
      setConfig({ ...config, promoCard: { ...config.promoCard, timerText: html } });
      markChanged();
      detectFormats();
      return;
    }
    
    const refMap = { title: titleRef, subtitle: subtitleRef, description: descRef, button: buttonRef };
    const el = refMap[field].current;
    if (!el) return;
    const html = wrapBareTextWithFontSize(el.innerHTML);
    const fieldMap = { title: 'title', subtitle: 'subtitle', description: 'description', button: 'buttonText' } as const;
    setConfig({ ...config, promoCard: { ...config.promoCard, [fieldMap[field]]: html } });
    markChanged();
    detectFormats();
  }

  // Style key map for field → config path
  const STYLE_KEY_MAP = { title: 'titleStyle', subtitle: 'subheadingStyle', description: 'descriptionStyle', button: 'buttonStyle' } as const;

  // Get current field's style object
  function getFieldStyle() {
    if (!currentField) return null;
    if (currentField === 'timer') {
      // Timer uses dateStyle
      return config.promoCard.style.dateStyle;
    }
    const key = STYLE_KEY_MAP[currentField];
    return config.promoCard.style[key];
  }

  // Update a property on current field's style
  function updateFieldStyle(patch: Record<string, any>) {
    if (!currentField) return;
    
    if (currentField === 'timer') {
      // Timer uses dateStyle
      setConfig({
        ...config,
        promoCard: {
          ...config.promoCard,
          style: { 
            ...config.promoCard.style, 
            dateStyle: { ...config.promoCard.style.dateStyle, ...patch } 
          },
        },
      });
    } else {
      const key = STYLE_KEY_MAP[currentField];
      setConfig({
        ...config,
        promoCard: {
          ...config.promoCard,
          style: { ...config.promoCard.style, [key]: { ...config.promoCard.style[key], ...patch } },
        },
      });
    }
    markChanged();
  }

  // Update a property on the current field's background
  function updateFieldBg(patch: Record<string, any>) {
    if (!currentField) return;
    
    if (currentField === 'timer') {
      // Timer uses dateStyle
      const style = config.promoCard.style.dateStyle;
      setConfig({
        ...config,
        promoCard: {
          ...config.promoCard,
          style: { 
            ...config.promoCard.style, 
            dateStyle: { ...style, background: { ...style.background, ...patch } } 
          },
        },
      });
    } else {
      const key = STYLE_KEY_MAP[currentField];
      const style = config.promoCard.style[key];
      setConfig({
        ...config,
        promoCard: {
          ...config.promoCard,
          style: { ...config.promoCard.style, [key]: { ...style, background: { ...style.background, ...patch } } },
        },
      });
    }
    markChanged();
  }

  // Alignment helper
  function setFieldAlignment(align: 'left'|'center'|'right') {
    updateFieldStyle({ textAlign: align });
  }

  // Card-level background update
  function updateCardBg(patch: Record<string, any>) {
    setConfig({
      ...config,
      promoCard: {
        ...config.promoCard,
        style: { ...config.promoCard.style, background: { ...config.promoCard.style.background, ...patch } },
      },
    });
    markChanged();
  }

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  function toggleActive() {
    setConfig({
      ...config,
      promoCard: {
        ...config.promoCard,
        active: !config.promoCard.active,
      },
    });
    markChanged();
  }

  function updateField(field: keyof PromoCard, value: any) {
    setConfig({
      ...config,
      promoCard: {
        ...config.promoCard,
        [field]: value,
      },
    });
    markChanged();
  }

  function calculateTimeRemaining(): string {
    if (!config.promoCard.startDate || !config.promoCard.endDate) {
      return '00:00:00';
    }

    const now = new Date(currentTime);
    const start = new Date(config.promoCard.startDate);
    const end = new Date(config.promoCard.endDate);

    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);

    if (now < start) {
      const diff = start.getTime() - now.getTime();
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);
      return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }

    if (now > end) {
      return '00:00:00';
    }

    const remaining = end.getTime() - now.getTime();
    const hours = Math.floor(remaining / (1000 * 60 * 60));
    const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((remaining % (1000 * 60)) / 1000);
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }

  function getFormattedTimerText(): string {
    const timerValue = calculateTimeRemaining();
    const [hours, minutes, seconds] = timerValue.split(':');
    const template = config.promoCard.timerText || getDefaultTimerStorageHTML();
    
    // If template doesn't have timer placeholders, use default
    if (!hasTimerPlaceholders(template)) {
      return getDefaultTimerStorageHTML()
        .replace(/data-timer-placeholder="hhh"[^>]*>hh<\/span>/g, `<span data-timer-placeholder="hhh" style="color: inherit">${hours}</span>`)
        .replace(/data-timer-placeholder="mmm"[^>]*>mm<\/span>/g, `<span data-timer-placeholder="mmm" style="color: inherit">${minutes}</span>`)
        .replace(/data-timer-placeholder="sss"[^>]*>ss<\/span>/g, `<span data-timer-placeholder="sss" style="color: inherit">${seconds}</span>`);
    }
    
    // Parse HTML and replace placeholder content while preserving styles
    if (typeof document !== 'undefined') {
      const parser = new DOMParser();
      const doc = parser.parseFromString(`<div>${template}</div>`, 'text/html');
      const container = doc.body.firstElementChild as HTMLElement;
      
      if (container) {
        // Apply current text color to all timer placeholders
        const currentTextColor = config.promoCard.style.dateStyle.textColor;
        container.querySelectorAll('[data-timer-placeholder]').forEach(el => {
          const htmlEl = el as HTMLElement;
          if (!htmlEl.style.color || htmlEl.style.color === 'inherit') {
            htmlEl.style.color = currentTextColor;
          }
        });
        
        // Find and update timer placeholders
        const hhPlaceholder = container.querySelector('[data-timer-placeholder="hhh"]');
        const mmPlaceholder = container.querySelector('[data-timer-placeholder="mmm"]');
        const ssPlaceholder = container.querySelector('[data-timer-placeholder="sss"]');
        
        if (hhPlaceholder) hhPlaceholder.textContent = hours;
        if (mmPlaceholder) mmPlaceholder.textContent = minutes;
        if (ssPlaceholder) ssPlaceholder.textContent = seconds;
        
        return container.innerHTML;
      }
    }
    
    // Fallback to simple string replacement if DOM parsing fails
    return template
      .replace(/data-timer-placeholder="hhh"[^>]*>hh<\/span>/g, `<span data-timer-placeholder="hhh" style="color: inherit">${hours}</span>`)
      .replace(/data-timer-placeholder="mmm"[^>]*>mm<\/span>/g, `<span data-timer-placeholder="mmm" style="color: inherit">${minutes}</span>`)
      .replace(/data-timer-placeholder="sss"[^>]*>ss<\/span>/g, `<span data-timer-placeholder="sss" style="color: inherit">${seconds}</span>`);
  }

  function applyTemplate(template: PromoCard, templateName: string) {
    const cloned = JSON.parse(JSON.stringify(template));
    setConfig({ ...config, promoCard: cloned });
    syncEditorsFromConfig(cloned);
    markChanged();
    toast(`Template applied: ${templateName}`);
  }

  return (
    <section className="bg-white shadow rounded-lg border border-gray-200 overflow-hidden dark:bg-gray-800 dark:border-gray-700">
      <div className="px-6 py-3 border-b border-gray-200 bg-gray-50/50 flex items-center justify-between dark:border-gray-700 dark:bg-gray-700/50">
        <div className="flex items-center">
          <div className="p-2 bg-pink-100 rounded-lg mr-4">
            <Gift className="w-5 h-5 text-pink-600" />
          </div>
          <div>
            <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-gray-100">Promo Card</h3>
            <p className="mt-1 max-w-2xl text-sm text-gray-500 dark:text-gray-400">Floating widget for special offers.</p>
          </div>
        </div>

        <button
          onClick={toggleActive}
          className={`relative inline-flex flex-shrink-0 h-6 w-11 border-2 border-transparent rounded-full cursor-pointer transition-colors ease-in-out duration-200 ${
            config.promoCard.active ? 'bg-indigo-600' : 'bg-gray-200'
          }`}
        >
          <span
            className={`pointer-events-none relative inline-block h-5 w-5 rounded-full bg-white shadow transform transition ${
              config.promoCard.active ? 'translate-x-5' : 'translate-x-0'
            }`}
          ></span>
        </button>
      </div>

      <div className="p-4 grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          {/* Global Style Toolbar */}
          <div className="border border-gray-300 rounded-md p-2 bg-gray-50 dark:bg-gray-700 dark:border-gray-600">
            <label className="block text-xs font-medium text-gray-700 mb-1.5 dark:text-gray-300">
              Style Controls {currentField && `(${currentField})`}
            </label>
            <RichTextToolbar
              activeFormats={activeFormats}
              onFormat={(format) => {
                saveSelection();
                formatText(format);
              }}
              onColorSelect={(color) => {
                saveSelection();
                applyColor(color);
              }}
              showAlignment={currentField !== null}
              alignment={getFieldStyle()?.textAlign || 'left'}
              onAlignmentChange={setFieldAlignment}
              showButtonWidth={currentField === 'button'}
              buttonFullWidth={config.promoCard.buttonFullWidth || false}
              onButtonWidthChange={(fullWidth) => {
                updateField('buttonFullWidth', fullWidth);
              }}
            />

            {/* Per-field background/text color controls */}
            {currentField && (() => {
              const fs = getFieldStyle();
              if (!fs) return null;
              const fbg = fs.background;
              return (
                <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-600">
                  <label className="block text-xs text-gray-500 mb-1.5 dark:text-gray-400">Field Background ({currentField})</label>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] text-gray-400 mb-0.5">Type</label>
                      <select value={fbg.type} onChange={e => updateFieldBg({ type: e.target.value })} className="block w-full border-gray-300 rounded p-1.5 border bg-white dark:bg-gray-600 dark:border-gray-500 dark:text-gray-100 text-xs">
                        <option value="solid">Solid</option><option value="linear">Linear</option><option value="radial">Radial</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] text-gray-400 mb-0.5">Start</label>
                      <input type="color" value={fbg.startColor} onChange={e => updateFieldBg({ startColor: e.target.value })} className="h-8 w-full rounded border border-gray-300 cursor-pointer dark:border-gray-500" />
                    </div>
                  </div>
                  {(fbg.type === 'linear' || fbg.type === 'radial') && (
                    <div className="grid grid-cols-3 gap-2 mt-2">
                      <div>
                        <label className="block text-[10px] text-gray-400 mb-0.5">End</label>
                        <input type="color" value={fbg.endColor} onChange={e => updateFieldBg({ endColor: e.target.value })} className="h-8 w-full rounded border border-gray-300 cursor-pointer dark:border-gray-500" />
                      </div>
                      {fbg.type === 'linear' && (
                        <div>
                          <label className="block text-[10px] text-gray-400 mb-0.5">Direction</label>
                          <select value={fbg.direction || 'to right'} onChange={e => updateFieldBg({ direction: e.target.value })} className="block w-full border-gray-300 rounded p-1.5 border bg-white dark:bg-gray-600 dark:border-gray-500 dark:text-gray-100 text-xs">
                            <option value="to right">→</option><option value="to left">←</option><option value="to bottom">↓</option><option value="to top">↑</option>
                            <option value="to bottom right">↘</option><option value="to bottom left">↙</option><option value="to top right">↗</option><option value="to top left">↖</option>
                          </select>
                        </div>
                      )}
                      <div>
                        <label className="block text-[10px] text-gray-400 mb-0.5">Balance: {fbg.midpoint ?? 50}%</label>
                        <input type="range" min="0" max="100" value={fbg.midpoint ?? 50} onChange={e => updateFieldBg({ midpoint: Number(e.target.value) })} className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-600 mt-1" />
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Title</label>
              <div ref={titleRef} contentEditable suppressContentEditableWarning
                onInput={()=>onFieldInput('title')} onFocus={()=>onFieldFocus('title',titleRef)}
                onMouseUp={detectFormats} onKeyUp={detectFormats}
                className="mt-1 block w-full border-gray-300 rounded-md p-2 border bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 min-h-[38px] outline-none break-words focus:ring-indigo-500 focus:border-indigo-500"
                data-placeholder="Get 20% OFF" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Subtitle</label>
              <div ref={subtitleRef} contentEditable suppressContentEditableWarning
                onInput={()=>onFieldInput('subtitle')} onFocus={()=>onFieldFocus('subtitle',subtitleRef)}
                onMouseUp={detectFormats} onKeyUp={detectFormats}
                className="mt-1 block w-full border-gray-300 rounded-md p-2 border bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 min-h-[38px] outline-none break-words focus:ring-indigo-500 focus:border-indigo-500"
                data-placeholder="Limited time offer" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Description</label>
            <div ref={descRef} contentEditable suppressContentEditableWarning
              onInput={()=>onFieldInput('description')} onFocus={()=>onFieldFocus('description',descRef)}
              onMouseUp={detectFormats} onKeyUp={detectFormats}
              className="mt-1 block w-full border-gray-300 rounded-md p-2 border bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 min-h-[48px] outline-none break-words focus:ring-indigo-500 focus:border-indigo-500"
              data-placeholder="Sign up for our newsletter today!" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Start Date</label>
              <input
                type="date"
                value={config.promoCard.startDate}
                onChange={(e) => updateField('startDate', e.target.value)}
                className="mt-1 block w-full border-gray-300 rounded-md p-2 border bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">End Date</label>
              <input
                type="date"
                value={config.promoCard.endDate}
                onChange={(e) => updateField('endDate', e.target.value)}
                className="mt-1 block w-full border-gray-300 rounded-md p-2 border bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
              />
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Enable Timer</label>
              {/* Tooltip info icon */}
              <div className="relative group">
                <svg className="w-4 h-4 text-gray-400 dark:text-gray-500 cursor-help" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 16v-4M12 8h.01" />
                </svg>
                <div className="absolute bottom-full left-0 mb-2 w-64 p-2.5 bg-gray-900 dark:bg-gray-700 text-white text-[11px] leading-relaxed rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 pointer-events-none">
                  <p className="font-semibold mb-1">How timer works:</p>
                  <p className="mb-1">Dates are <strong>calendar-based</strong>, not relative to when you set them.</p>
                  <ul className="space-y-0.5 list-disc list-inside">
                    <li><strong>Start date</strong> begins at <strong>12:00 AM</strong> (midnight)</li>
                    <li><strong>End date</strong> runs until <strong>11:59 PM</strong> (end of day)</li>
                  </ul>
                  <p className="mt-1 text-gray-300 dark:text-gray-400">e.g. Start: Feb 19 → End: Feb 21 means timer counts down from now until Feb 21, 11:59 PM.</p>
                  <div className="absolute top-full left-4 w-0 h-0 border-l-[6px] border-r-[6px] border-t-[6px] border-l-transparent border-r-transparent border-t-gray-900 dark:border-t-gray-700"></div>
                </div>
              </div>
            </div>
            <button
              onClick={() => updateField('showTimer', !config.promoCard.showTimer)}
              className={`relative inline-flex h-6 w-11 border-2 border-transparent rounded-full transition-colors ${
                config.promoCard.showTimer ? 'bg-indigo-600' : 'bg-gray-200'
              }`}
            >
              <span
                className={`inline-block h-5 w-5 rounded-full bg-white shadow transform transition ${
                  config.promoCard.showTimer ? 'translate-x-5' : 'translate-x-0'
                }`}
              ></span>
            </button>
          </div>

          {/* Timer Text Editor */}
          {config.promoCard.showTimer && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-300">Timer Text</label>
              
              {/* Timer Placeholder Buttons */}
              <div className="flex flex-wrap gap-1 mb-2">
                <button
                  onClick={() => insertTimerPlaceholder('hhh')}
                  className="px-2 py-1 text-xs bg-indigo-100 text-indigo-700 rounded hover:bg-indigo-200 dark:bg-indigo-900 dark:text-indigo-300 dark:hover:bg-indigo-800 transition-colors"
                  title="Insert hours placeholder"
                >
                  hhh
                </button>
                <button
                  onClick={() => insertTimerPlaceholder('mmm')}
                  className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200 dark:bg-green-900 dark:text-green-300 dark:hover:bg-green-800 transition-colors"
                  title="Insert minutes placeholder"
                >
                  mmm
                </button>
                <button
                  onClick={() => insertTimerPlaceholder('sss')}
                  className="px-2 py-1 text-xs bg-orange-100 text-orange-700 rounded hover:bg-orange-200 dark:bg-orange-900 dark:text-orange-300 dark:hover:bg-orange-800 transition-colors"
                  title="Insert seconds placeholder"
                >
                  sss
                </button>
                <button
                  onClick={() => insertTimerText(':')}
                  className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600 transition-colors"
                  title="Insert separator"
                >
                  :
                </button>
              </div>
              
              <div 
                ref={timerRef} 
                contentEditable 
                suppressContentEditableWarning
                onInput={() => onFieldInput('timer')} 
                onMouseUp={detectFormats} 
                onKeyUp={detectFormats}
                onFocus={() => onFieldFocus('timer', timerRef)}
                className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md p-2 border bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 min-h-[48px] outline-none break-words overflow-wrap-anywhere"
                data-placeholder="Click buttons above to insert placeholders or type your text" 
              />
              <p className="text-xs text-gray-500 mt-1 dark:text-gray-400">
                <span className="inline-flex items-center gap-1">
                  <span className="inline-block px-1 py-0.5 bg-indigo-100 text-indigo-700 rounded text-[10px] font-mono dark:bg-indigo-900 dark:text-indigo-300">hhh</span>
                  <span className="inline-block px-1 py-0.5 bg-green-100 text-green-700 rounded text-[10px] font-mono dark:bg-green-900 dark:text-green-300">mmm</span>
                  <span className="inline-block px-1 py-0.5 bg-orange-100 text-orange-700 rounded text-[10px] font-mono dark:bg-orange-900 dark:text-orange-300">sss</span>
                  are timer placeholders — click buttons to insert them.
                </span>
              </p>
            </div>
          )}

          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Enable Button</label>
            <button
              onClick={() => updateField('showButton', !config.promoCard.showButton)}
              className={`relative inline-flex h-6 w-11 border-2 border-transparent rounded-full transition-colors ${
                config.promoCard.showButton ? 'bg-indigo-600' : 'bg-gray-200'
              }`}
            >
              <span
                className={`inline-block h-5 w-5 rounded-full bg-white shadow transform transition ${
                  config.promoCard.showButton ? 'translate-x-5' : 'translate-x-0'
                }`}
              ></span>
            </button>
          </div>

          {config.promoCard.showButton && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Button Text</label>
                <div ref={buttonRef} contentEditable suppressContentEditableWarning
                  onInput={()=>onFieldInput('button')} onFocus={()=>onFieldFocus('button',buttonRef)}
                  onMouseUp={detectFormats} onKeyUp={detectFormats}
                  className="mt-1 block w-full border-gray-300 rounded-md p-2 border bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 min-h-[38px] outline-none break-words focus:ring-indigo-500 focus:border-indigo-500"
                  data-placeholder="Shop Now" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Button URL</label>
                <input
                  type="text"
                  value={config.promoCard.buttonUrl}
                  onChange={(e) => updateField('buttonUrl', e.target.value)}
                  className="mt-1 block w-full border-gray-300 rounded-md p-2 border bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
                />
              </div>
            </div>
          )}
        </div>

        <div className="space-y-4">
          {/* Card Appearance */}
          <div className="border border-gray-200 rounded-lg p-4 bg-white dark:bg-gray-800 dark:border-gray-700">
            <label className="block text-sm font-medium text-gray-900 mb-2 dark:text-gray-100">Card Appearance</label>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-gray-500 mb-1 dark:text-gray-400">Position</label>
                  <select value={config.promoCard.style.position} onChange={e => { setConfig({...config, promoCard:{...config.promoCard, style:{...config.promoCard.style, position: e.target.value as any}}}); markChanged(); }} className="block w-full border-gray-300 rounded-md p-2 border bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 text-sm">
                    <option value="bottom-right">Bottom Right</option>
                    <option value="bottom-left">Bottom Left</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1 dark:text-gray-400">Background Type</label>
                  <select value={config.promoCard.style.background.type} onChange={e => updateCardBg({ type: e.target.value })} className="block w-full border-gray-300 rounded-md p-2 border bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 text-sm">
                    <option value="solid">Solid</option>
                    <option value="linear">Linear</option>
                    <option value="radial">Gradient</option>
                  </select>
                </div>
              </div>

              {/* Linear Gradient Controls */}
              {config.promoCard.style.background.type === 'linear' && (
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1 dark:text-gray-400">Start Color</label>
                    <input type="color" value={config.promoCard.style.background.startColor} onChange={e => updateCardBg({ startColor: e.target.value })} className="h-9 w-full rounded border border-gray-300 cursor-pointer dark:border-gray-600" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1 dark:text-gray-400">End Color</label>
                    <input type="color" value={config.promoCard.style.background.endColor} onChange={e => updateCardBg({ endColor: e.target.value })} className="h-9 w-full rounded border border-gray-300 cursor-pointer dark:border-gray-600" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1 dark:text-gray-400">Direction</label>
                    <select value={config.promoCard.style.background.direction || 'to right'} onChange={e => updateCardBg({ direction: e.target.value })} className="block w-full border-gray-300 rounded-md p-2 border bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 text-sm">
                      <option value="to right">To Right →</option>
                      <option value="to left">To Left ←</option>
                      <option value="to bottom">To Bottom ↓</option>
                      <option value="to top">To Top ↑</option>
                      <option value="to bottom right">To Bottom Right ↘</option>
                      <option value="to bottom left">To Bottom Left ↙</option>
                      <option value="to top right">To Top Right ↗</option>
                      <option value="to top left">To Top Left ↖</option>
                    </select>
                  </div>
                </div>
              )}

              {/* Solid Background Colors */}
              {config.promoCard.style.background.type === 'solid' && (
                <div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1 dark:text-gray-400">Background Color</label>
                    <input type="color" value={config.promoCard.style.background.startColor} onChange={e => updateCardBg({ startColor: e.target.value })} className="h-9 w-full rounded border border-gray-300 cursor-pointer dark:border-gray-600" />
                  </div>
                </div>
              )}

              {/* Radial Gradient Colors */}
              {config.promoCard.style.background.type === 'radial' && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1 dark:text-gray-400">Center Color</label>
                    <input type="color" value={config.promoCard.style.background.startColor} onChange={e => updateCardBg({ startColor: e.target.value })} className="h-9 w-full rounded border border-gray-300 cursor-pointer dark:border-gray-600" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1 dark:text-gray-400">Outer Color</label>
                    <input type="color" value={config.promoCard.style.background.endColor} onChange={e => updateCardBg({ endColor: e.target.value })} className="h-9 w-full rounded border border-gray-300 cursor-pointer dark:border-gray-600" />
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="bg-gray-100 rounded-lg p-4 relative self-start min-h-[260px] border border-gray-200 bg-[url('https://lib.shadcn.com/placeholder.svg')] bg-center bg-no-repeat bg-contain dark:bg-gray-700 dark:border-gray-600">
            <div className="absolute inset-0 flex items-center justify-center text-gray-400 text-sm font-medium pointer-events-none">
              Website Content Area
            </div>

            <div className="relative z-10 w-full min-h-[228px] grid">
              {config.promoCard.active && (
                <div
                  className={`relative w-[400px] rounded-xl shadow-2xl p-5 transition-all duration-300 flex flex-col ${
                    config.promoCard.style.position === 'bottom-right' ? 'justify-self-end self-end' :
                    config.promoCard.style.position === 'bottom-left' ? 'justify-self-start self-end' :
                    config.promoCard.style.position === 'top-right' ? 'justify-self-end self-start' :
                    'justify-self-start self-start'
                  }`}
                  style={{ background: getBackgroundStyle(config.promoCard.style.background) }}
                >
                  <button className="absolute top-2 right-2 opacity-60 hover:opacity-100 p-1">
                    <X className="w-4 h-4" />
                  </button>

                  <h3
                    className="text-base font-normal mb-1 px-2 py-1 rounded break-words"
                    style={{
                      background: getBackgroundStyle(config.promoCard.style.titleStyle.background),
                      color: config.promoCard.style.titleStyle.textColor,
                      textAlign: config.promoCard.style.titleStyle.textAlign || 'center',
                    }}
                    dangerouslySetInnerHTML={{ __html: config.promoCard.title || 'Title' }}
                  />

                  {config.promoCard.subtitle && (
                    <h4
                      className="text-base font-normal mb-2 px-2 py-1 rounded break-words"
                      style={{
                        background: getBackgroundStyle(config.promoCard.style.subheadingStyle.background),
                        color: config.promoCard.style.subheadingStyle.textColor,
                        textAlign: config.promoCard.style.subheadingStyle.textAlign || 'center',
                      }}
                      dangerouslySetInnerHTML={{ __html: config.promoCard.subtitle }}
                    />
                  )}

                  <p
                    className="text-base font-normal mb-2 px-2 py-1 rounded break-words"
                    style={{
                      background: getBackgroundStyle(config.promoCard.style.descriptionStyle.background),
                      color: config.promoCard.style.descriptionStyle.textColor,
                      textAlign: config.promoCard.style.descriptionStyle.textAlign || 'left',
                    }}
                    dangerouslySetInnerHTML={{ __html: config.promoCard.description || 'Description' }}
                  />

                  {config.promoCard.showTimer && (
                    <div
                      className="text-base mb-4 px-2 py-1 rounded break-words"
                      style={{
                        background: getBackgroundStyle(config.promoCard.style.dateStyle.background),
                        color: config.promoCard.style.dateStyle.textColor,
                        textAlign: config.promoCard.style.dateStyle.textAlign || 'center',
                      }}
                      dangerouslySetInnerHTML={{ __html: getFormattedTimerText() }}
                    />
                  )}

                  {config.promoCard.showButton && config.promoCard.buttonText && (
                    <div className={config.promoCard.buttonFullWidth ? '' : 'flex justify-center'}>
                      <button
                        className={`py-2 px-4 rounded-lg text-base font-semibold ${
                          config.promoCard.buttonFullWidth ? 'w-full' : ''
                        }`}
                        style={{
                          background: getBackgroundStyle(config.promoCard.style.buttonStyle.background),
                          color: config.promoCard.style.buttonStyle.textColor,
                        }}
                        dangerouslySetInnerHTML={{ __html: config.promoCard.buttonText }}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <SamplePromoTemplates onApplyTemplate={applyTemplate} />
    </section>
  );
}
