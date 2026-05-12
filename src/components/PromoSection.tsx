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
  normalizeTimerTemplate,
  formatTimerText,
  calculateTimeRemaining as calcTimerRemaining,
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
        timerRef.current.innerHTML = normalizeTimerTemplate(pc.timerText || getDefaultTimerStorageHTML()) || 'Ends in {hh}:{mm}:{ss}';
      }
    }, 0);
  }

  function onFieldFocus(field: 'title'|'subtitle'|'description'|'timer'|'button', ref: React.RefObject<HTMLDivElement|null>) {
    setCurrentField(field);
    activeEditorRef.current = ref.current;
    setTimeout(() => { detectFormats(); ensureDefaultFontSize(); }, 0);
  }

  function onFieldInput(field: 'title'|'subtitle'|'description'|'button'|'timer') {
    if (field === 'timer') {
      const el = timerRef.current;
      if (!el) return;
      const html = wrapBareTextWithFontSize(el.innerHTML);
      const text = normalizeTimerTemplate(html);
      setConfig({ ...config, promoCard: { ...config.promoCard, timerText: text } });
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

  // Direct style update for a specific style key (used by timer controls)
  function updateFieldStyleDirect(styleKey: string, patch: Record<string, any>) {
    setConfig({
      ...config,
      promoCard: {
        ...config.promoCard,
        style: {
          ...config.promoCard.style,
          [styleKey]: { ...(config.promoCard.style as any)[styleKey], ...patch },
        },
      },
    });
    markChanged();
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
    const rawHtml = config.promoCard.timerText || 'Ends in {hh}:{mm}:{ss}';
    const timerValue = calcTimerRemaining(config.promoCard.endDate || '');

    if ([timerValue.hours, timerValue.minutes, timerValue.seconds, timerValue.days ?? 0].some(Number.isNaN)) {
      // Replace tokens with dashes, preserving HTML structure
      return rawHtml.replace(/\{hhh\}|\{hh\}|\{h\}|\{mmm\}|\{mm\}|\{m\}|\{sss\}|\{ss\}|\{s\}|\{ddd\}|\{dd\}|\{d\}/g, '--');
    }

    // Replace tokens in the HTML while preserving inline styles and spans
    let formattedHtml = rawHtml;
    
    const days = timerValue.days ?? 0;
    
    if (timerValue.hours !== undefined) {
      const hhh = String(timerValue.hours).padStart(3, '0');
      const hh = String(timerValue.hours).padStart(2, '0');
      const h = String(timerValue.hours);
      formattedHtml = formattedHtml.replace(/\{hhh\}/g, hhh).replace(/\{hh\}/g, hh).replace(/\{h\}/g, h);
    }
    
    if (timerValue.minutes !== undefined) {
      const mmm = String(timerValue.minutes).padStart(3, '0');
      const mm = String(timerValue.minutes).padStart(2, '0');
      const m = String(timerValue.minutes);
      formattedHtml = formattedHtml.replace(/\{mmm\}/g, mmm).replace(/\{mm\}/g, mm).replace(/\{m\}/g, m);
    }
    
    if (timerValue.seconds !== undefined) {
      const sss = String(timerValue.seconds).padStart(3, '0');
      const ss = String(timerValue.seconds).padStart(2, '0');
      const s = String(timerValue.seconds);
      formattedHtml = formattedHtml.replace(/\{sss\}/g, sss).replace(/\{ss\}/g, ss).replace(/\{s\}/g, s);
    }
    
    if (timerValue.days !== undefined) {
      const ddd = String(days).padStart(3, '0');
      const dd = String(days).padStart(2, '0');
      const d = String(days);
      formattedHtml = formattedHtml.replace(/\{ddd\}/g, ddd).replace(/\{dd\}/g, dd).replace(/\{d\}/g, d);
    }
    
    return formattedHtml;
  }

  function applyTemplate(template: PromoCard, templateName: string) {
    const cloned = JSON.parse(JSON.stringify(template));
    cloned.timerText = normalizeTimerTemplate(cloned.timerText || getDefaultTimerStorageHTML()) || 'Ends in {hh}:{mm}:{ss}';
    setConfig({ ...config, promoCard: cloned });
    syncEditorsFromConfig(cloned);
    markChanged();
    toast(`Template applied: ${templateName}`);
  }

  return (
    <section className="bg-surface-elevated shadow rounded-lg border border-border overflow-hidden">
      <div className="px-6 py-3 border-b border-border bg-surface/60 flex items-center justify-between">
        <div className="flex items-center">
          <div className="p-2 bg-pink-100 rounded-lg mr-4">
            <Gift className="w-5 h-5 text-pink-600" />
          </div>
          <div>
            <h3 className="text-lg leading-6 font-medium text-on-surface">Promo Card</h3>
            <p className="mt-1 max-w-2xl text-sm text-on-surface-variant">Floating widget for special offers.</p>
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
                if (currentField) onFieldInput(currentField as 'title'|'subtitle'|'description'|'button'|'timer');
              }}
              onColorSelect={(color) => {
                saveSelection();
                applyColor(color);
                if (currentField) onFieldInput(currentField as 'title'|'subtitle'|'description'|'button'|'timer');
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
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 mb-1">Enter text below</p>
              <div ref={titleRef} contentEditable suppressContentEditableWarning
                onInput={()=>onFieldInput('title')} onFocus={()=>onFieldFocus('title',titleRef)}
                onMouseUp={detectFormats} onKeyUp={detectFormats}
                className="rich-editor block w-full border-gray-300 rounded-md p-2 border dark:border-gray-600 min-h-[38px] outline-none break-words focus:ring-indigo-500 focus:border-indigo-500"
                style={{ background: getBackgroundStyle(config.promoCard.style.background) }} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Subtitle</label>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 mb-1">Enter text below</p>
              <div ref={subtitleRef} contentEditable suppressContentEditableWarning
                onInput={()=>onFieldInput('subtitle')} onFocus={()=>onFieldFocus('subtitle',subtitleRef)}
                onMouseUp={detectFormats} onKeyUp={detectFormats}
                className="rich-editor block w-full border-gray-300 rounded-md p-2 border dark:border-gray-600 min-h-[38px] outline-none break-words focus:ring-indigo-500 focus:border-indigo-500"
                style={{ background: getBackgroundStyle(config.promoCard.style.background) }} />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Description</label>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 mb-1">Enter text below</p>
            <div ref={descRef} contentEditable suppressContentEditableWarning
              onInput={()=>onFieldInput('description')} onFocus={()=>onFieldFocus('description',descRef)}
              onMouseUp={detectFormats} onKeyUp={detectFormats}
              className="rich-editor block w-full border-gray-300 rounded-md p-2 border dark:border-gray-600 min-h-[48px] outline-none break-words focus:ring-indigo-500 focus:border-indigo-500"
              style={{ background: getBackgroundStyle(config.promoCard.style.background) }} />
            <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-1.5 italic">
              The background color shown in the editors reflects your card background. Change it anytime under <span className="font-medium not-italic">Card Appearance → Background</span>.
            </p>
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

          {/* Timer Controls — rich text editor */}
          {config.promoCard.showTimer && (
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Timer Text</label>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 mb-1">Enter text below</p>
              <div ref={timerRef} contentEditable suppressContentEditableWarning
                onInput={()=>onFieldInput('timer')} onFocus={()=>onFieldFocus('timer',timerRef)}
                onMouseUp={detectFormats} onKeyUp={detectFormats}
                className="rich-editor shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md p-2 border dark:border-gray-600 outline-none break-words min-h-[48px]"
                style={{ background: getBackgroundStyle(config.promoCard.style.background) }} />
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Use tokens like {`{d}`}, {`{hh}`}, {`{mm}`}, {`{ss}`}. Select text to apply colors and sizes.
              </p>
              <div className="flex flex-wrap gap-1">
                {['{d}', '{hh}', '{mm}', '{ss}'].map((token) => (
                  <button
                    key={token}
                    onMouseDown={(e) => {
                      e.preventDefault(); // Prevent button from stealing focus
                      const el = timerRef.current;
                      if (!el) return;
                      const sel = window.getSelection();
                      if (!sel || sel.rangeCount === 0) {
                        // No selection, append to end
                        el.innerHTML += token;
                      } else {
                        const range = sel.getRangeAt(0);
                        if (el.contains(range.commonAncestorContainer)) {
                          // Insert at cursor position
                          const textNode = document.createTextNode(token);
                          range.deleteContents();
                          range.insertNode(textNode);
                          // Move cursor after inserted token
                          range.setStartAfter(textNode);
                          range.setEndAfter(textNode);
                          sel.removeAllRanges();
                          sel.addRange(range);
                        } else {
                          // Selection outside editor, append to end
                          el.innerHTML += token;
                        }
                      }
                      onFieldInput('timer');
                    }}
                    className="px-2 py-0.5 text-xs bg-indigo-100 text-indigo-700 rounded hover:bg-indigo-200 transition-colors dark:bg-indigo-900 dark:text-indigo-300 dark:hover:bg-indigo-800"
                  >
                    {token}
                  </button>
                ))}
              </div>
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
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 mb-1">Enter text below</p>
                <div ref={buttonRef} contentEditable suppressContentEditableWarning
                  onInput={()=>onFieldInput('button')} onFocus={()=>onFieldFocus('button',buttonRef)}
                  onMouseUp={detectFormats} onKeyUp={detectFormats}
                  className="rich-editor block w-full border-gray-300 rounded-md p-2 border dark:border-gray-600 min-h-[38px] outline-none break-words focus:ring-indigo-500 focus:border-indigo-500"
                  style={{ background: getBackgroundStyle(config.promoCard.style.buttonStyle?.background || config.promoCard.style.background) }} />
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
                      className="mb-4 px-2 py-1 rounded break-words"
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
