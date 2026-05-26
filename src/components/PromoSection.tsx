'use client';

import { useState, useEffect, useRef, useCallback, type RefObject, type Dispatch, type SetStateAction } from 'react';
import { Gift, X, Palette } from 'lucide-react';
import { CampaignConfig, PromoCard } from '@/types/campaign';
import { getBackgroundStyle } from '@/lib/utils';
import { SamplePromoTemplates } from './SamplePromoTemplates';
import { useRichTextEditor } from '@/hooks/useRichTextEditor';
import { wrapBareTextWithFontSize } from '@/lib/richTextUtils';
import RichTextToolbar from './RichTextToolbar';
import { PopupDropdown } from './PopupDropdown';
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
  const getISODateWithOffset = useCallback((daysFromToday = 0): string => {
    const date = new Date();
    date.setDate(date.getDate() + daysFromToday);
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }, []);
  const [currentTime, setCurrentTime] = useState(Date.now());
  const [currentField, setCurrentField] = useState<'title'|'subtitle'|'description'|'timer'|'button'|null>(null);

  // Refs for each contenteditable editor
  const titleRef = useRef<HTMLDivElement>(null);
  const subtitleRef = useRef<HTMLDivElement>(null);
  const descRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<HTMLDivElement>(null);
  const previewTitleRef = useRef<HTMLDivElement>(null);
  const previewSubtitleRef = useRef<HTMLDivElement>(null);
  const previewDescriptionRef = useRef<HTMLDivElement>(null);
  const previewButtonRef = useRef<HTMLDivElement>(null);
  const previewTimerRef = useRef<HTMLDivElement>(null);
  const activeEditorRef = useRef<HTMLDivElement>(null);
  const cardPositionBtnRef = useRef<HTMLButtonElement>(null);
  const cardPositionMenuRef = useRef<HTMLDivElement>(null);
  const cardBgTypeBtnRef = useRef<HTMLButtonElement>(null);
  const cardBgTypeMenuRef = useRef<HTMLDivElement>(null);
  const fieldBgTypeBtnRef = useRef<HTMLButtonElement>(null);
  const fieldBgTypeMenuRef = useRef<HTMLDivElement>(null);
  const fieldDirectionBtnRef = useRef<HTMLButtonElement>(null);
  const fieldDirectionMenuRef = useRef<HTMLDivElement>(null);
  const cardBgPopupBtnRef = useRef<HTMLButtonElement>(null);
  const cardBgPopupRef = useRef<HTMLDivElement>(null);
  const cardAngleWheelRef = useRef<HTMLDivElement>(null);
  const startDatePickerRef = useRef<HTMLDivElement>(null);
  const endDatePickerRef = useRef<HTMLDivElement>(null);

  const [showCardPositionDropdown, setShowCardPositionDropdown] = useState(false);
  const [showCardBgTypeDropdown, setShowCardBgTypeDropdown] = useState(false);
  const [showFieldBgTypeDropdown, setShowFieldBgTypeDropdown] = useState(false);
  const [showFieldDirectionDropdown, setShowFieldDirectionDropdown] = useState(false);
  const [showCardBgPopup, setShowCardBgPopup] = useState(false);
  const [previewFieldDirection, setPreviewFieldDirection] = useState<string | null>(null);
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  const [startDateView, setStartDateView] = useState<Date>(() => {
    const base = config.promoCard.startDate ? new Date(`${config.promoCard.startDate}T00:00:00`) : new Date();
    return new Date(base.getFullYear(), base.getMonth(), 1);
  });
  const [endDateView, setEndDateView] = useState<Date>(() => {
    const base = config.promoCard.endDate ? new Date(`${config.promoCard.endDate}T00:00:00`) : new Date();
    return new Date(base.getFullYear(), base.getMonth(), 1);
  });

  const [cardPositionPos, setCardPositionPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const [cardBgTypePos, setCardBgTypePos] = useState<{ top: number; left: number; width: number } | null>(null);
  const [fieldBgTypePos, setFieldBgTypePos] = useState<{ top: number; left: number; width: number } | null>(null);
  const [fieldDirectionPos, setFieldDirectionPos] = useState<{ top: number; left: number; width: number } | null>(null);

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

  // Keep preview subtitle DOM in sync without re-rendering innerHTML every state change,
  // so text selection in preview is not reset.
  useEffect(() => {
    const el = previewTitleRef.current;
    if (!el) return;
    const nextHtml = config.promoCard.title || '';
    if (el.innerHTML !== nextHtml) {
      el.innerHTML = nextHtml;
    }
  }, [config.promoCard.title]);

  useEffect(() => {
    const el = previewSubtitleRef.current;
    if (!el) return;
    const nextHtml = config.promoCard.subtitle || '';
    if (el.innerHTML !== nextHtml) {
      el.innerHTML = nextHtml;
    }
  }, [config.promoCard.subtitle]);

  useEffect(() => {
    const el = previewDescriptionRef.current;
    if (!el) return;
    const nextHtml = config.promoCard.description || '';
    if (el.innerHTML !== nextHtml) {
      el.innerHTML = nextHtml;
    }
  }, [config.promoCard.description]);

  useEffect(() => {
    const el = previewButtonRef.current;
    if (!el) return;
    const nextHtml = config.promoCard.buttonText || '';
    if (el.innerHTML !== nextHtml) {
      el.innerHTML = nextHtml;
    }
  }, [config.promoCard.buttonText]);

  useEffect(() => {
    const el = previewTimerRef.current;
    if (!el) return;
    const nextHtml = getFormattedTimerText();
    if (el.innerHTML !== nextHtml) {
      el.innerHTML = nextHtml;
    }
  }, [config.promoCard.timerText, config.promoCard.endDate, currentTime]);

  useEffect(() => {
    const el = timerRef.current;
    if (!el) return;
    const nextHtml = normalizeTimerTemplate(config.promoCard.timerText || getDefaultTimerStorageHTML()) || 'Ends in {hh}:{mm}:{ss}';
    if (el.innerHTML !== nextHtml) {
      el.innerHTML = nextHtml;
    }
  }, [config.promoCard.timerText, config.promoCard.showTimer]);

  useEffect(() => {
    const nextStart = config.promoCard.startDate || getISODateWithOffset(0);
    const nextEnd = config.promoCard.endDate || getISODateWithOffset(1);
    if (config.promoCard.startDate && config.promoCard.endDate) return;
    setConfig({
      ...config,
      promoCard: {
        ...config.promoCard,
        startDate: nextStart,
        endDate: nextEnd,
      },
    });
  }, [config, setConfig, getISODateWithOffset]);

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

  function onFieldFocus(field: 'title'|'subtitle'|'description'|'timer'|'button', ref: RefObject<HTMLDivElement|null>) {
    setCurrentField(field);
    activeEditorRef.current = ref.current;
    setTimeout(() => { detectFormats(); ensureDefaultFontSize(); }, 0);
  }

  function onFieldInput(field: 'title'|'subtitle'|'description'|'button'|'timer') {
    if (field === 'timer') {
      const fallbackEl = timerRef.current;
      const el = (currentField === 'timer' && activeEditorRef.current) ? activeEditorRef.current : fallbackEl;
      if (!el) return;
      const html = wrapBareTextWithFontSize(el.innerHTML);
      const text = normalizeTimerTemplate(html);
      setConfig({ ...config, promoCard: { ...config.promoCard, timerText: text } });
      markChanged();
      detectFormats();
      return;
    }
    
    const refMap = { title: titleRef, subtitle: subtitleRef, description: descRef, button: buttonRef };
    const fallbackEl = refMap[field].current;
    const el = (currentField === field && activeEditorRef.current) ? activeEditorRef.current : fallbackEl;
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

  const getDropdownPosition = useCallback((button: HTMLButtonElement | null) => {
    if (!button) return null;
    const rect = button.getBoundingClientRect();
    return { top: rect.bottom + 6, left: rect.left, width: rect.width };
  }, []);

  useEffect(() => {
    const onDocMouseDown = (e: MouseEvent) => {
      const target = e.target as Node;
      const pairs: Array<[RefObject<HTMLButtonElement | null>, RefObject<HTMLDivElement | null>, Dispatch<SetStateAction<boolean>>]> = [
        [cardPositionBtnRef, cardPositionMenuRef, setShowCardPositionDropdown],
        [cardBgTypeBtnRef, cardBgTypeMenuRef, setShowCardBgTypeDropdown],
        [fieldBgTypeBtnRef, fieldBgTypeMenuRef, setShowFieldBgTypeDropdown],
        [fieldDirectionBtnRef, fieldDirectionMenuRef, setShowFieldDirectionDropdown],
      ];
      pairs.forEach(([btnRef, menuRef, setOpen]) => {
        if (btnRef.current?.contains(target) || menuRef.current?.contains(target)) return;
        setOpen(false);
      });
      if (!startDatePickerRef.current?.contains(target)) setShowStartDatePicker(false);
      if (!endDatePickerRef.current?.contains(target)) setShowEndDatePicker(false);
      // Keep card background popup open until explicit close (X button).
    };
    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, []);

  const closeAllPromoDropdowns = useCallback(() => {
    setShowCardPositionDropdown(false);
    setShowCardBgTypeDropdown(false);
    setShowFieldBgTypeDropdown(false);
    setShowFieldDirectionDropdown(false);
    setShowCardBgPopup(false);
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

  function getPopupTopForField(field: 'title'|'subtitle'|'description'|'button'|'timer'): number {
    const refMap = {
      title: previewTitleRef,
      subtitle: previewSubtitleRef,
      description: previewDescriptionRef,
      button: previewButtonRef,
      timer: previewTimerRef,
    } as const;
    const el = refMap[field].current;
    return el ? Math.max(8, el.offsetTop) : 8;
  }

  function getPopupPositionStyle(field: PopupField): { top?: string; bottom?: string } {
    const isBottomCard = config.promoCard.style.position === 'bottom-right' || config.promoCard.style.position === 'bottom-left';
    const isLowerField = field === 'button' || field === 'timer';
    if (isBottomCard && isLowerField) {
      return { bottom: '8px' };
    }
    return { top: `${getPopupTopForField(field)}px` };
  }

  const popupEditableFields = ['title', 'subtitle', 'description', 'button', 'timer'] as const;
  type PopupField = typeof popupEditableFields[number];

  function getPopupFieldStyle(field: PopupField) {
    if (field === 'title') return config.promoCard.style.titleStyle;
    if (field === 'subtitle') return config.promoCard.style.subheadingStyle;
    if (field === 'description') return config.promoCard.style.descriptionStyle;
    if (field === 'timer') return config.promoCard.style.dateStyle;
    return config.promoCard.style.buttonStyle;
  }

  function getPopupFieldLabel(field: PopupField) {
    if (field === 'title') return 'Title Style';
    if (field === 'subtitle') return 'Subtitle Style';
    if (field === 'description') return 'Description Style';
    if (field === 'timer') return 'Timer Style';
    return 'Button Style';
  }

  function getPreviewFieldBackground(field: PopupField) {
    const bg = getPopupFieldStyle(field).background;
    if (currentField === field && previewFieldDirection && bg.type === 'linear') {
      return { ...bg, direction: previewFieldDirection };
    }
    return bg;
  }

  function isPreviewFieldActive() {
    const editor = activeEditorRef.current;
    return editor === previewTitleRef.current
      || editor === previewSubtitleRef.current
      || editor === previewDescriptionRef.current
      || editor === previewTimerRef.current
      || editor === previewButtonRef.current;
  }

  function getFormattedTimerText(): string {
    const rawHtml = config.promoCard.timerText || 'Ends in {hh}:{mm}:{ss}';
    const timerValue = calcTimerRemaining(config.promoCard.endDate || '');

    if ([timerValue.hours, timerValue.minutes, timerValue.seconds, timerValue.days ?? 0].some(Number.isNaN)) {
      // Replace tokens with dashes, preserving HTML structure
      return rawHtml.replace(/\{hhh\}|\{hh\}|\{h\}|\{mmm\}|\{mm\}|\{m\}|\{sss\}|\{ss\}|\{s\}|\{ddd\}|\{dd\}|\{d\}/g, '--');
    }
    return formatTimerText(rawHtml, timerValue);
  }

  function applyTemplate(template: PromoCard, templateName: string) {
    const cloned = JSON.parse(JSON.stringify(template));
    cloned.timerText = normalizeTimerTemplate(cloned.timerText || getDefaultTimerStorageHTML()) || 'Ends in {hh}:{mm}:{ss}';
    setConfig({ ...config, promoCard: cloned });
    syncEditorsFromConfig(cloned);
    markChanged();
    toast(`Template applied: ${templateName}`);
  }

  function formatDateLabel(value: string): string {
    if (!value) return 'Select date';
    const date = new Date(`${value}T00:00:00`);
    if (Number.isNaN(date.getTime())) return 'Select date';
    return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  }

  function toISODate(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  function buildMonthDays(viewDate: Date): Date[] {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const first = new Date(year, month, 1);
    const startOffset = first.getDay();
    const gridStart = new Date(year, month, 1 - startOffset);
    return Array.from({ length: 42 }, (_, i) => new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i));
  }

  function renderDatePicker(params: {
    mode: 'start' | 'end';
    value: string;
    viewDate: Date;
    setViewDate: (date: Date) => void;
    open: boolean;
    setOpen: (open: boolean) => void;
    onSelect: (value: string) => void;
  }) {
    const { mode, value, viewDate, setViewDate, open, setOpen, onSelect } = params;
    const days = buildMonthDays(viewDate);
    const month = viewDate.getMonth();
    const selected = value;
    const today = toISODate(new Date());
    return (
      <div ref={mode === 'start' ? startDatePickerRef : endDatePickerRef} className="relative mt-1">
        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            setOpen(!open);
          }}
          className="flex w-full items-center justify-between rounded-md border border-border bg-surface px-3 py-2 text-sm text-on-surface transition-colors hover:border-primary/70"
        >
          <span className={selected ? 'text-on-surface' : 'text-on-surface-variant'}>{formatDateLabel(value)}</span>
          <svg
            className={`h-4 w-4 flex-shrink-0 text-on-surface-variant transition-transform duration-200 ${open ? 'rotate-180' : 'rotate-0'}`}
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
          >
            <path d="M6 8l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        {open && (
          <div className={`absolute z-40 mt-1 w-[260px] rounded-md border border-border bg-surface-elevated p-2 shadow-lg ${mode === 'end' ? 'right-0' : 'left-0'}`}>
            <div className="mb-2 flex items-center justify-between">
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1));
                }}
                className="h-7 w-7 rounded border border-border text-on-surface-variant hover:border-primary/70 hover:text-primary"
                aria-label="Previous month"
              >
                <svg className="mx-auto h-4 w-4" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M12 6l-4 4 4 4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              <div className="text-xs font-semibold text-on-surface">
                {viewDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
              </div>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1));
                }}
                className="h-7 w-7 rounded border border-border text-on-surface-variant hover:border-primary/70 hover:text-primary"
                aria-label="Next month"
              >
                <svg className="mx-auto h-4 w-4" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M8 6l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>
            <div className="mb-1 grid grid-cols-7 gap-1 text-center text-[10px] font-medium text-on-surface-variant">
              {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((day) => <div key={day}>{day}</div>)}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {days.map((date) => {
                const iso = toISODate(date);
                const inMonth = date.getMonth() === month;
                const isSelected = selected === iso;
                const isToday = today === iso;
                return (
                  <button
                    key={iso}
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      onSelect(iso);
                      setOpen(false);
                    }}
                    className={`h-8 rounded text-xs transition-colors ${
                      isSelected
                        ? 'bg-primary text-on-primary'
                        : inMonth
                          ? 'text-on-surface hover:bg-primary/10 hover:text-primary'
                          : 'text-on-surface-variant/60 hover:bg-primary/5'
                    } ${isToday && !isSelected ? 'ring-1 ring-primary/40' : ''}`}
                  >
                    {date.getDate()}
                  </button>
                );
              })}
            </div>
            <div className="mt-2 flex items-center justify-between border-t border-border pt-2">
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  onSelect('');
                  setOpen(false);
                }}
                className="text-xs text-on-surface-variant hover:text-primary"
              >
                Clear
              </button>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  const now = new Date();
                  onSelect(toISODate(now));
                  setViewDate(new Date(now.getFullYear(), now.getMonth(), 1));
                  setOpen(false);
                }}
                className="text-xs font-medium text-primary hover:opacity-80"
              >
                Today
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  function directionToAngle(direction?: string): number {
    if (!direction) return 90;
    const normalized = direction.trim().toLowerCase();
    const degreeMatch = normalized.match(/^(-?\d+(?:\.\d+)?)deg$/);
    if (degreeMatch) return Number(degreeMatch[1]);
    const map: Record<string, number> = {
      'to top': 0,
      'to top right': 45,
      'to right': 90,
      'to bottom right': 135,
      'to bottom': 180,
      'to bottom left': 225,
      'to left': 270,
      'to top left': 315,
    };
    return map[normalized] ?? 90;
  }

  function normalizeAngle(angle: number): number {
    return ((angle % 360) + 360) % 360;
  }

  function angleToCssDirection(angle: number): string {
    return `${Math.round(normalizeAngle(angle))}deg`;
  }

  function setCardDirectionAngle(angle: number) {
    updateCardBg({ direction: angleToCssDirection(angle) });
  }

  function getAngleFromPointer(clientX: number, clientY: number): number | null {
    const wheel = cardAngleWheelRef.current;
    if (!wheel) return null;
    const rect = wheel.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const dx = clientX - centerX;
    const dy = clientY - centerY;
    const distance = Math.hypot(dx, dy);
    if (distance < 10) return null;
    const raw = Math.atan2(dy, dx) * (180 / Math.PI);
    return normalizeAngle(raw + 90);
  }

  const presetDirections = [
    { label: '↑', angle: 0 },
    { label: '↗', angle: 45 },
    { label: '→', angle: 90 },
    { label: '↘', angle: 135 },
    { label: '↓', angle: 180 },
    { label: '↙', angle: 225 },
    { label: '←', angle: 270 },
    { label: '↖', angle: 315 },
  ];

  const cardAngle = directionToAngle(config.promoCard.style.background.direction || 'to right');
  const cardAngleNormalized = normalizeAngle(cardAngle);

  function hasVisibleContent(html: string | undefined): boolean {
    if (!html) return false;
    const plainText = html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
    return plainText.length > 0;
  }

  const hasTitle = hasVisibleContent(config.promoCard.title);
  const hasSubtitle = hasVisibleContent(config.promoCard.subtitle);
  const hasDescription = hasVisibleContent(config.promoCard.description);
  const hasButtonText = hasVisibleContent(config.promoCard.buttonText);

  return (
    <>
      <div className="p-4 flex gap-5 overflow-hidden" style={{ height: 'calc(100vh - 120px)' }}>
        {/* Left: All editables — 30% width, scrollable */}
        <div className="promo-left-scrollbar w-[30%] min-h-0 shrink-0 overflow-y-auto overflow-x-hidden pr-2 space-y-4">
          {/* Header + Toggle */}
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div className="p-2 bg-pink-100 rounded-lg mr-3">
                <Gift className="w-4 h-4 text-pink-600" />
              </div>
              <div>
                <h3 className="text-lg leading-6 font-semibold text-on-surface">Promo Card</h3>
                <p className="mt-0.5 max-w-2xl text-xs text-on-surface-variant">Floating widget for special offers.</p>
              </div>
            </div>
            <button
              onClick={toggleActive}
              className={`relative inline-flex flex-shrink-0 h-6 w-11 border-2 border-transparent rounded-full cursor-pointer transition-all duration-200 hover:shadow-sm hover:shadow-primary/20 ${
                config.promoCard.active ? 'bg-primary' : 'bg-surface-subtle hover:bg-primary/20'
              }`}
            >
              <span
                className={`pointer-events-none relative inline-block h-5 w-5 rounded-full bg-white shadow transform transition ${
                  config.promoCard.active ? 'translate-x-5' : 'translate-x-0'
                }`}
              ></span>
            </button>
          </div>

          <div className="pt-1">
            <h4 className="text-xs font-semibold text-on-surface-variant uppercase tracking-wide mb-2">Content</h4>
            <p className="text-xs text-on-surface-variant mb-2">Main promo copy shown in the card.</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-on-surface">Title</label>
            <p className="text-xs text-on-surface-variant mt-0.5 mb-1">Enter text below</p>
            <div ref={titleRef} contentEditable suppressContentEditableWarning
              onInput={()=>onFieldInput('title')} onFocus={()=>onFieldFocus('title',titleRef)}
              onMouseUp={detectFormats} onKeyUp={detectFormats}
              className={`rich-editor promo-standard-editor block w-full rounded-md p-2 border min-h-[38px] outline-none break-words transition-colors ${
                currentField === 'title'
                  ? 'border-primary/70'
                  : 'border-border'
              } focus:ring-primary/60 focus:border-primary/80 hover:border-primary/70`}
              style={{ background: getBackgroundStyle(config.promoCard.style.background) }} />
          </div>
          <div>
            <label className="block text-sm font-medium text-on-surface">Subtitle</label>
            <p className="text-xs text-on-surface-variant mt-0.5 mb-1">Enter text below</p>
            <div ref={subtitleRef} contentEditable suppressContentEditableWarning
              onInput={()=>onFieldInput('subtitle')} onFocus={()=>onFieldFocus('subtitle',subtitleRef)}
              onMouseUp={detectFormats} onKeyUp={detectFormats}
              className={`rich-editor promo-standard-editor block w-full rounded-md p-2 border min-h-[38px] outline-none break-words transition-colors ${
                currentField === 'subtitle'
                  ? 'border-primary/70'
                  : 'border-border'
              } focus:ring-primary/60 focus:border-primary/80 hover:border-primary/70`}
              style={{ background: getBackgroundStyle(config.promoCard.style.background) }} />
          </div>

          <div>
            <label className="block text-sm font-medium text-on-surface">Description</label>
            <p className="text-xs text-on-surface-variant mt-0.5 mb-1">Enter text below</p>
            <div ref={descRef} contentEditable suppressContentEditableWarning
              onInput={()=>onFieldInput('description')} onFocus={()=>onFieldFocus('description',descRef)}
              onMouseUp={detectFormats} onKeyUp={detectFormats}
              className={`rich-editor promo-standard-editor block w-full rounded-md p-2 border min-h-[48px] outline-none break-words transition-colors ${
                currentField === 'description'
                  ? 'border-primary/70'
                  : 'border-border'
              } focus:ring-primary/60 focus:border-primary/80 hover:border-primary/70`}
              style={{ background: getBackgroundStyle(config.promoCard.style.background) }} />
                      </div>

          <div className="pt-1">
            <h4 className="text-xs font-semibold text-on-surface-variant uppercase tracking-wide mb-2">Schedule</h4>
            <p className="text-xs text-on-surface-variant mb-2">Control when the promo card is active.</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-on-surface">Start Date</label>
              {renderDatePicker({
                mode: 'start',
                value: config.promoCard.startDate,
                viewDate: startDateView,
                setViewDate: setStartDateView,
                open: showStartDatePicker,
                setOpen: setShowStartDatePicker,
                onSelect: (nextValue) => updateField('startDate', nextValue),
              })}
            </div>
            <div>
              <label className="block text-sm font-medium text-on-surface">End Date</label>
              {renderDatePicker({
                mode: 'end',
                value: config.promoCard.endDate,
                viewDate: endDateView,
                setViewDate: setEndDateView,
                open: showEndDatePicker,
                setOpen: setShowEndDatePicker,
                onSelect: (nextValue) => updateField('endDate', nextValue),
              })}
            </div>
          </div>

          <div className="pt-1">
            <h4 className="text-xs font-semibold text-on-surface-variant uppercase tracking-wide mb-2">Timer</h4>
            <p className="text-xs text-on-surface-variant mb-2">Optional countdown messaging for urgency.</p>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <label className="text-sm font-medium text-on-surface">Enable Timer</label>
              {/* Tooltip info icon */}
              <div className="relative group">
                <svg className="w-4 h-4 text-on-surface-variant cursor-help" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
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
                  <p className="mt-1 text-gray-300 dark:text-gray-300">e.g. Start: Feb 19 → End: Feb 21 means timer counts down from now until Feb 21, 11:59 PM.</p>
                  <div className="absolute top-full left-4 w-0 h-0 border-l-[6px] border-r-[6px] border-t-[6px] border-l-transparent border-r-transparent border-t-gray-900 dark:border-t-gray-700"></div>
                </div>
              </div>
            </div>
            <button
              onClick={() => updateField('showTimer', !config.promoCard.showTimer)}
              className={`relative inline-flex h-6 w-11 border-2 border-transparent rounded-full transition-all duration-200 hover:shadow-sm hover:shadow-primary/20 ${
                config.promoCard.showTimer ? 'bg-primary' : 'bg-surface-subtle hover:bg-primary/20'
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
              <label className="block text-sm font-medium text-on-surface">Timer Text</label>
              <p className="text-xs text-on-surface-variant mt-0.5 mb-1">Enter text below</p>
              <div ref={timerRef} contentEditable suppressContentEditableWarning
                onInput={()=>onFieldInput('timer')} onFocus={()=>onFieldFocus('timer',timerRef)}
                onMouseUp={detectFormats} onKeyUp={detectFormats}
                className={`rich-editor promo-standard-editor shadow-sm focus:ring-primary/60 focus:border-primary/80 hover:border-primary/70 block w-full sm:text-sm rounded-md p-2 border outline-none break-words min-h-[48px] transition-colors ${
                  currentField === 'timer'
                    ? 'border-primary/70'
                    : 'border-border'
                }`}
                style={{ background: getBackgroundStyle(config.promoCard.style.background) }} />
              <p className="text-xs text-on-surface-variant">
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
                    className="px-2 py-0.5 text-xs rounded transition-colors border border-border hover:border-primary/70 hover:bg-primary/10 hover:text-primary text-on-surface-variant"
                  >
                    {token}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="pt-1">
            <h4 className="text-xs font-semibold text-on-surface-variant uppercase tracking-wide mb-2">Call To Action</h4>
            <p className="text-xs text-on-surface-variant mb-2">Configure button text and destination.</p>
          </div>

          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-on-surface">Enable Button</label>
            <button
              onClick={() => updateField('showButton', !config.promoCard.showButton)}
              className={`relative inline-flex h-6 w-11 border-2 border-transparent rounded-full transition-all duration-200 hover:shadow-sm hover:shadow-primary/20 ${
                config.promoCard.showButton ? 'bg-primary' : 'bg-surface-subtle hover:bg-primary/20'
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
                <label className="block text-sm font-medium text-on-surface">Button Text</label>
                <div ref={buttonRef} contentEditable suppressContentEditableWarning
                  data-placeholder="Enter text here"
                  onInput={()=>onFieldInput('button')} onFocus={()=>onFieldFocus('button',buttonRef)}
                  onMouseUp={detectFormats} onKeyUp={detectFormats}
                  className={`rich-editor promo-standard-editor block w-full rounded-md p-2 border min-h-[38px] outline-none break-words transition-colors ${
                    currentField === 'button'
                      ? 'border-primary/70'
                      : 'border-border'
                  } focus:ring-primary/60 focus:border-primary/80 hover:border-primary/70`}
                  style={{ background: getBackgroundStyle(config.promoCard.style.buttonStyle?.background || config.promoCard.style.background) }} />
              </div>
              <div>
                <label className="block text-sm font-medium text-on-surface">Button URL</label>
                <input
                  type="text"
                  value={config.promoCard.buttonUrl}
                  onChange={(e) => updateField('buttonUrl', e.target.value)}
                  className="mt-1 block w-full border-border rounded-md p-2 border bg-surface text-on-surface text-sm"
                />
              </div>
            </div>
          )}

        </div>

        {/* Right: Preview — 70% width, fixed */}
        <div className="flex-1 min-h-0 h-full pr-2 flex flex-col gap-4 overflow-x-hidden">
          <div className="space-y-1">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h4 className="text-xs font-semibold text-on-surface-variant uppercase tracking-wide">Preview</h4>
                <p className="text-xs text-on-surface-variant">Live card rendering with editable field styles.</p>
              </div>
              <div className="flex flex-col items-end gap-1">
                <p className="text-[11px] text-primary font-medium flex items-center animate-pulse">💡 click Position to place the card • click Style to edit card background</p>
                <div className="flex flex-wrap items-center justify-end gap-1.5">
                  <PopupDropdown
                    label="Position"
                    value={config.promoCard.style.position}
                    options={[{ value: 'bottom-right', label: 'Bottom Right' }, { value: 'bottom-left', label: 'Bottom Left' }]}
                    open={showCardPositionDropdown}
                    onOpen={() => { const next = !showCardPositionDropdown; closeAllPromoDropdowns(); setShowCardPositionDropdown(next); setCardPositionPos(getDropdownPosition(cardPositionBtnRef.current)); }}
                    onSelect={(v) => { setConfig({ ...config, promoCard: { ...config.promoCard, style: { ...config.promoCard.style, position: v as any } } }); markChanged(); setShowCardPositionDropdown(false); }}
                    buttonRef={cardPositionBtnRef}
                    menuRef={cardPositionMenuRef}
                    menuPosition={cardPositionPos}
                    compact={true}
                  />
                  <div>
                    <label className="block text-[10px] text-on-surface-variant mb-0.5">Style</label>
                      <button
                        ref={cardBgPopupBtnRef}
                        type="button"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          closeAllPromoDropdowns();
                          setCurrentField(null);
                          setShowCardBgPopup((prev) => !prev);
                        }}
                      className="inline-flex h-9 items-center justify-center rounded-md border border-white/10 bg-black/10 px-2 text-on-surface shadow-2xl backdrop-blur-md transition-colors hover:border-primary/70 hover:bg-black/10"
                      title="Card Style"
                    >
                      <Palette className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="bg-gray-100 rounded-lg p-5 relative h-[420px] border border-gray-200 bg-[url('https://lib.shadcn.com/placeholder.svg')] bg-center bg-no-repeat bg-contain dark:bg-gray-700 dark:border-gray-600">
            <div className="absolute inset-0 flex items-center justify-center text-gray-400 text-sm font-medium pointer-events-none">
              Website Content Area
            </div>

            <div className="relative z-10 w-full h-full min-h-[228px] grid">
              {config.promoCard.active && (
                <div
                  className={`relative w-[400px] rounded-xl shadow-2xl p-5 transition-all duration-300 flex flex-col ${
                    config.promoCard.style.position === 'bottom-right' ? 'justify-self-end self-end' :
                    config.promoCard.style.position === 'bottom-left' ? 'justify-self-start self-end' :
                    config.promoCard.style.position === 'top-right' ? 'justify-self-end self-start' :
                    'justify-self-start self-start'
                  }`}
                  style={{
                    background: getBackgroundStyle(
                      config.promoCard.style.background
                    ),
                  }}
                >
                  <button className="absolute top-2 right-2 opacity-60 hover:opacity-100 p-1">
                    <X className="w-4 h-4" />
                  </button>

                  {hasTitle && (
                    <div
                      ref={previewTitleRef}
                      contentEditable
                      suppressContentEditableWarning
                      className={`text-base font-normal mb-1 px-2 py-1 rounded break-words cursor-pointer ${currentField === 'title' ? 'ring-1 ring-primary/70' : ''}`}
                      onMouseDown={() => {
                        activeEditorRef.current = previewTitleRef.current;
                      }}
                      onClick={() => {
                        setShowCardBgPopup(false);
                        if (currentField !== 'title') setCurrentField('title');
                        activeEditorRef.current = previewTitleRef.current;
                        setTimeout(() => detectFormats(), 0);
                      }}
                      onFocus={() => {
                        activeEditorRef.current = previewTitleRef.current;
                      }}
                      onMouseUp={() => {
                        detectFormats();
                      }}
                      onInput={() => onFieldInput('title')}
                      onKeyDown={(e) => e.preventDefault()}
                      onPaste={(e) => e.preventDefault()}
                      onDrop={(e) => e.preventDefault()}
                      style={{
                        background: getBackgroundStyle(getPreviewFieldBackground('title')),
                        color: config.promoCard.style.titleStyle.textColor,
                        textAlign: config.promoCard.style.titleStyle.textAlign || 'center',
                        caretColor: 'transparent',
                        userSelect: 'text',
                        WebkitUserSelect: 'text',
                        cursor: 'text',
                      }}
                    />
                  )}

                  {hasSubtitle && (
                    <div
                      ref={previewSubtitleRef}
                      contentEditable
                      suppressContentEditableWarning
                      className={`text-base font-normal mb-2 px-2 py-1 rounded break-words cursor-pointer ${currentField === 'subtitle' ? 'ring-1 ring-primary/70' : ''}`}
                      onMouseDown={() => {
                        // Don't trigger state updates while dragging selection.
                        activeEditorRef.current = previewSubtitleRef.current;
                      }}
                      onClick={() => {
                        setShowCardBgPopup(false);
                        // Plain click activates subtitle style mode.
                        if (currentField !== 'subtitle') setCurrentField('subtitle');
                        activeEditorRef.current = previewSubtitleRef.current;
                        setTimeout(() => detectFormats(), 0);
                      }}
                      onFocus={() => {
                        activeEditorRef.current = previewSubtitleRef.current;
                      }}
                      onMouseUp={() => {
                        detectFormats();
                      }}
                      onInput={() => onFieldInput('subtitle')}
                      onKeyDown={(e) => {
                        // Preview is for selecting + styling only, not text typing/editing.
                        e.preventDefault();
                      }}
                      onPaste={(e) => e.preventDefault()}
                      onDrop={(e) => e.preventDefault()}
                      style={{
                        background: getBackgroundStyle(getPreviewFieldBackground('subtitle')),
                        color: config.promoCard.style.subheadingStyle.textColor,
                        textAlign: config.promoCard.style.subheadingStyle.textAlign || 'center',
                        caretColor: 'transparent',
                        userSelect: 'text',
                        WebkitUserSelect: 'text',
                        cursor: 'text',
                      }}
                    />
                  )}

                  {hasDescription && (
                    <div
                      ref={previewDescriptionRef}
                      contentEditable
                      suppressContentEditableWarning
                      className={`text-base font-normal mb-2 px-2 py-1 rounded break-words cursor-pointer ${currentField === 'description' ? 'ring-1 ring-primary/70' : ''}`}
                      onMouseDown={() => {
                        activeEditorRef.current = previewDescriptionRef.current;
                      }}
                      onClick={() => {
                        setShowCardBgPopup(false);
                        if (currentField !== 'description') setCurrentField('description');
                        activeEditorRef.current = previewDescriptionRef.current;
                        setTimeout(() => detectFormats(), 0);
                      }}
                      onFocus={() => {
                        activeEditorRef.current = previewDescriptionRef.current;
                      }}
                      onMouseUp={() => {
                        detectFormats();
                      }}
                      onInput={() => onFieldInput('description')}
                      onKeyDown={(e) => {
                        e.preventDefault();
                      }}
                      onPaste={(e) => e.preventDefault()}
                      onDrop={(e) => e.preventDefault()}
                      style={{
                        background: getBackgroundStyle(getPreviewFieldBackground('description')),
                        color: config.promoCard.style.descriptionStyle.textColor,
                        textAlign: config.promoCard.style.descriptionStyle.textAlign || 'left',
                        caretColor: 'transparent',
                        userSelect: 'text',
                        WebkitUserSelect: 'text',
                        cursor: 'text',
                      }}
                    />
                  )}

                  {config.promoCard.showTimer && (
                    <div
                      ref={previewTimerRef}
                      contentEditable
                      suppressContentEditableWarning
                      className={`mb-4 px-2 py-1 rounded break-words cursor-pointer ${currentField === 'timer' ? 'ring-1 ring-primary/70' : ''}`}
                      onMouseDown={() => {
                        activeEditorRef.current = previewTimerRef.current;
                      }}
                      onClick={() => {
                        setShowCardBgPopup(false);
                        if (currentField !== 'timer') setCurrentField('timer');
                        activeEditorRef.current = previewTimerRef.current;
                        setTimeout(() => detectFormats(), 0);
                      }}
                      onFocus={() => {
                        activeEditorRef.current = previewTimerRef.current;
                      }}
                      onMouseUp={() => {
                        detectFormats();
                      }}
                      onInput={() => onFieldInput('timer')}
                      onKeyDown={(e) => e.preventDefault()}
                      onPaste={(e) => e.preventDefault()}
                      onDrop={(e) => e.preventDefault()}
                      style={{
                        background: getBackgroundStyle(getPreviewFieldBackground('timer')),
                        color: config.promoCard.style.dateStyle.textColor,
                        textAlign: config.promoCard.style.dateStyle.textAlign || 'center',
                        caretColor: 'transparent',
                        userSelect: 'text',
                        WebkitUserSelect: 'text',
                        cursor: 'text',
                      }}
                    />
                  )}

                  {config.promoCard.showButton && hasButtonText && (
                    <div
                      className={
                        config.promoCard.buttonFullWidth
                          ? ''
                          : `flex ${
                              (config.promoCard.style.buttonStyle.textAlign || 'center') === 'left'
                                ? 'justify-start'
                                : (config.promoCard.style.buttonStyle.textAlign || 'center') === 'right'
                                  ? 'justify-end'
                                  : 'justify-center'
                            }`
                      }
                    >
                      <div
                        ref={previewButtonRef}
                        contentEditable
                        suppressContentEditableWarning
                        className={`py-2 px-4 rounded-lg text-base font-semibold ${
                          config.promoCard.buttonFullWidth ? 'w-full' : ''
                        } ${currentField === 'button' ? 'ring-1 ring-primary/70' : ''} cursor-pointer`}
                        onMouseDown={() => {
                          activeEditorRef.current = previewButtonRef.current;
                        }}
                        onClick={() => {
                          setShowCardBgPopup(false);
                          if (currentField !== 'button') setCurrentField('button');
                          activeEditorRef.current = previewButtonRef.current;
                          setTimeout(() => detectFormats(), 0);
                        }}
                        onFocus={() => {
                          activeEditorRef.current = previewButtonRef.current;
                        }}
                        onMouseUp={() => {
                          detectFormats();
                        }}
                        onInput={() => onFieldInput('button')}
                        onKeyDown={(e) => e.preventDefault()}
                        onPaste={(e) => e.preventDefault()}
                        onDrop={(e) => e.preventDefault()}
                        style={{
                          background: getBackgroundStyle(getPreviewFieldBackground('button')),
                          color: config.promoCard.style.buttonStyle.textColor,
                          textAlign: config.promoCard.style.buttonStyle.textAlign || 'center',
                          caretColor: 'transparent',
                          userSelect: 'text',
                          WebkitUserSelect: 'text',
                          cursor: 'text',
                        }}
                      />
                    </div>
                  )}

                  {popupEditableFields.includes(currentField as PopupField) && isPreviewFieldActive() && !showCardBgPopup && (() => {
                    const field = currentField as PopupField;
                    const fieldStyle = getPopupFieldStyle(field);
                    const isButton = field === 'button';
                    const fbg = fieldStyle.background;
                    return (
                      <div
                        className={`absolute z-30 w-[280px] border border-gray-200 rounded-md p-2 bg-white/95 backdrop-blur shadow-lg dark:bg-gray-800/95 dark:border-gray-700 ${
                          config.promoCard.style.position === 'bottom-right' || config.promoCard.style.position === 'top-right'
                            ? 'right-full mr-3'
                            : 'left-full ml-3'
                        }`}
                        style={getPopupPositionStyle(field)}
                      >
                        <button
                          type="button"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            setCurrentField(null);
                          }}
                          className="absolute -top-3.5 -right-3.5 inline-flex h-7 w-7 items-center justify-center rounded-full border border-border bg-surface-elevated text-on-surface-variant shadow-sm transition-colors hover:border-primary/70 hover:bg-primary/10 hover:text-primary focus:outline-none focus:ring-2 focus:ring-primary/40"
                          aria-label="Close style controls"
                          title="Close"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <label className="text-xs font-semibold text-on-surface">{getPopupFieldLabel(field)}</label>
                          <div className="flex items-center gap-1">
                            <button onMouseDown={(e)=>{e.preventDefault();setFieldAlignment('left');}} className={`cursor-pointer h-9 w-9 flex items-center justify-center text-[10px] border rounded transition-colors ${(fieldStyle?.textAlign || 'left') === 'left' ? 'bg-primary/10 text-primary border-primary/80' : 'border-border hover:border-primary/70 hover:bg-primary/10 hover:text-primary text-on-surface-variant'}`} title="Align Left"><svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M3 4h14v1H3V4zm0 4h10v1H3V8zm0 4h14v1H3v-1zm0 4h10v1H3v-1z" clipRule="evenodd" /></svg></button>
                            <button onMouseDown={(e)=>{e.preventDefault();setFieldAlignment('center');}} className={`cursor-pointer h-9 w-9 flex items-center justify-center text-[10px] border rounded transition-colors ${(fieldStyle?.textAlign || 'left') === 'center' ? 'bg-primary/10 text-primary border-primary/80' : 'border-border hover:border-primary/70 hover:bg-primary/10 hover:text-primary text-on-surface-variant'}`} title="Align Center"><svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5 4h10v1H5V4zm2 4h6v1H7V8zm-2 4h10v1H5v-1zm2 4h6v1H7v-1z" clipRule="evenodd" /></svg></button>
                            <button onMouseDown={(e)=>{e.preventDefault();setFieldAlignment('right');}} className={`cursor-pointer h-9 w-9 flex items-center justify-center text-[10px] border rounded transition-colors ${(fieldStyle?.textAlign || 'left') === 'right' ? 'bg-primary/10 text-primary border-primary/80' : 'border-border hover:border-primary/70 hover:bg-primary/10 hover:text-primary text-on-surface-variant'}`} title="Align Right"><svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M7 4h10v1H7V4zm-4 4h14v1H3V8zm4 4h10v1H7v-1zm-4 4h14v1H3v-1z" clipRule="evenodd" /></svg></button>
                          </div>
                        </div>

                        <RichTextToolbar
                          activeFormats={activeFormats}
                          onFormat={(format)=>{saveSelection();formatText(format);onFieldInput(field);}}
                          onColorSelect={(color)=>{saveSelection();applyColor(color);onFieldInput(field);}}
                          showAlignment={false}
                          showButtonWidth={isButton}
                          buttonFullWidth={config.promoCard.buttonFullWidth || false}
                          onButtonWidthChange={(fullWidth)=>updateField('buttonFullWidth', fullWidth)}
                          compact={true}
                        />

                        <div className="mt-2 pt-2 border-t border-white/10">
                            <label className="block text-xs text-on-surface-variant mb-1">Field Background</label>
                            <div className="grid grid-cols-3 gap-2">
                              <div>
                                <PopupDropdown
                                  label="Type"
                                  value={fbg.type}
                                  options={[
                                    { value: 'solid', label: 'Solid' },
                                    { value: 'linear', label: 'Linear' },
                                    { value: 'radial', label: 'Radial' },
                                  ]}
                                  open={showFieldBgTypeDropdown}
                                  onOpen={() => {
                                    const next = !showFieldBgTypeDropdown;
                                    closeAllPromoDropdowns();
                                    setShowFieldBgTypeDropdown(next);
                                    setFieldBgTypePos(getDropdownPosition(fieldBgTypeBtnRef.current));
                                  }}
                                  onSelect={(v) => {
                                    updateFieldBg({ type: v });
                                    setShowFieldBgTypeDropdown(false);
                                  }}
                                  buttonRef={fieldBgTypeBtnRef}
                                  menuRef={fieldBgTypeMenuRef}
                                  menuPosition={fieldBgTypePos}
                                  compact={true}
                                />
                              </div>
                              <div className="col-span-2">
                                {(fbg.type === 'linear' || fbg.type === 'radial') && (
                                  <>
                                    <label className="block text-xs text-on-surface-variant mb-0.5">Balance: {fbg.midpoint ?? 50}%</label>
                                    <input type="range" min="0" max="100" value={fbg.midpoint ?? 50} onChange={e => updateFieldBg({ midpoint: Number(e.target.value) })} className="balance-slider mt-3" />
                                  </>
                                )}
                              </div>
                            </div>
                            <div className="mt-2 min-h-[56px]">
                              {fbg.type === 'solid' && (
                                <div className="grid grid-cols-3 gap-2">
                                  <div>
                                    <label className="block text-xs text-on-surface-variant mb-0.5">Background</label>
                                    <input type="color" value={fbg.startColor} onChange={e => updateFieldBg({ startColor: e.target.value })} className="bg-color-picker h-9 w-full rounded cursor-pointer" />
                                  </div>
                                  <div aria-hidden="true" />
                                  <div aria-hidden="true" />
                                </div>
                              )}
                              {fbg.type === 'linear' && (
                                <div className="grid grid-cols-3 gap-2">
                                  <div>
                                    <label className="block text-xs text-on-surface-variant mb-0.5">Start</label>
                                    <input type="color" value={fbg.startColor} onChange={e => updateFieldBg({ startColor: e.target.value })} className="bg-color-picker h-9 w-full rounded cursor-pointer" />
                                  </div>
                                  <div>
                                    <label className="block text-xs text-on-surface-variant mb-0.5">End</label>
                                    <input type="color" value={fbg.endColor} onChange={e => updateFieldBg({ endColor: e.target.value })} className="bg-color-picker h-9 w-full rounded cursor-pointer" />
                                  </div>
                                  <div>
                                    <PopupDropdown
                                      label="Direction"
                                      value={fbg.direction || 'to right'}
                                      options={[
                                        { value: 'to right', label: '→' },
                                        { value: 'to left', label: '←' },
                                        { value: 'to bottom', label: '↓' },
                                        { value: 'to top', label: '↑' },
                                        { value: 'to bottom right', label: '↘' },
                                        { value: 'to bottom left', label: '↙' },
                                        { value: 'to top right', label: '↗' },
                                        { value: 'to top left', label: '↖' },
                                      ]}
                                      open={showFieldDirectionDropdown}
                                      onOpen={() => {
                                        const next = !showFieldDirectionDropdown;
                                        closeAllPromoDropdowns();
                                        setShowFieldDirectionDropdown(next);
                                        setFieldDirectionPos(getDropdownPosition(fieldDirectionBtnRef.current));
                                      }}
                                      onSelect={(v) => {
                                        updateFieldBg({ direction: v });
                                        setShowFieldDirectionDropdown(false);
                                        setPreviewFieldDirection(null);
                                      }}
                                      onHover={(dir) => setPreviewFieldDirection(dir)}
                                      onHoverEnd={() => setPreviewFieldDirection(null)}
                                      buttonRef={fieldDirectionBtnRef}
                                      menuRef={fieldDirectionMenuRef}
                                      menuPosition={fieldDirectionPos}
                                      compact={true}
                                    />
                                  </div>
                                </div>
                              )}
                              {fbg.type === 'radial' && (
                                <div className="grid grid-cols-3 gap-2">
                                  <div>
                                    <label className="block text-xs text-on-surface-variant mb-0.5">Center</label>
                                    <input type="color" value={fbg.startColor} onChange={e => updateFieldBg({ startColor: e.target.value })} className="bg-color-picker h-9 w-full rounded cursor-pointer" />
                                  </div>
                                  <div>
                                    <label className="block text-xs text-on-surface-variant mb-0.5">Outer</label>
                                    <input type="color" value={fbg.endColor} onChange={e => updateFieldBg({ endColor: e.target.value })} className="bg-color-picker h-9 w-full rounded cursor-pointer" />
                                  </div>
                                  <div aria-hidden="true" />
                                </div>
                              )}
                            </div>
                          </div>
                      </div>
                    );
                  })()}
                  {showCardBgPopup && (
                    <div
                      ref={cardBgPopupRef}
                      className={`absolute z-30 w-[320px] border border-gray-200 rounded-lg p-3 bg-white/95 backdrop-blur shadow-lg dark:bg-gray-800/95 dark:border-gray-700 ${
                        config.promoCard.style.position === 'bottom-right' || config.promoCard.style.position === 'top-right'
                          ? 'right-full mr-3'
                          : 'left-full ml-3'
                      }`}
                      style={{ top: '8px' }}
                    >
                      <button
                        type="button"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          setShowCardBgPopup(false);
                        }}
                        className="absolute -top-3.5 -right-3.5 inline-flex h-7 w-7 items-center justify-center rounded-full border border-border bg-surface-elevated text-on-surface-variant shadow-sm transition-colors hover:border-primary/70 hover:bg-primary/10 hover:text-primary focus:outline-none focus:ring-2 focus:ring-primary/40"
                        aria-label="Close card background controls"
                        title="Close"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                      <label className="text-xs font-semibold text-on-surface">Card Background</label>
                      <div className="mt-2.5 space-y-2">
                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <PopupDropdown label="Type" value={config.promoCard.style.background.type} options={[{ value: 'solid', label: 'Solid' }, { value: 'linear', label: 'Linear' }, { value: 'radial', label: 'Gradient' }]} open={showCardBgTypeDropdown} onOpen={() => { const next = !showCardBgTypeDropdown; closeAllPromoDropdowns(); setShowCardBgPopup(true); setShowCardBgTypeDropdown(next); setCardBgTypePos(getDropdownPosition(cardBgTypeBtnRef.current)); }} onSelect={(v) => { updateCardBg({ type: v }); setShowCardBgTypeDropdown(false); }} buttonRef={cardBgTypeBtnRef} menuRef={cardBgTypeMenuRef} menuPosition={cardBgTypePos} compact={true} />
                          </div>
                          <div className="col-span-2">
                            {(config.promoCard.style.background.type === 'linear' || config.promoCard.style.background.type === 'radial') && (
                              <>
                                <label className="block text-xs text-on-surface-variant mb-0.5">Balance: {config.promoCard.style.background.midpoint ?? 50}%</label>
                                <input type="range" min="0" max="100" value={config.promoCard.style.background.midpoint ?? 50} onChange={(e) => updateCardBg({ midpoint: Number(e.target.value) })} className="balance-slider mt-3" />
                              </>
                            )}
                          </div>
                        </div>
                        <div className="mt-2 min-h-[56px]">
                          {config.promoCard.style.background.type === 'solid' && (
                            <div className="grid grid-cols-3 gap-2">
                              <div>
                                <label className="block text-xs text-on-surface-variant mb-0.5">Background</label>
                                <input type="color" value={config.promoCard.style.background.startColor} onChange={e => updateCardBg({ startColor: e.target.value })} className="bg-color-picker h-9 w-full rounded cursor-pointer" />
                              </div>
                              <div aria-hidden="true" />
                              <div aria-hidden="true" />
                            </div>
                          )}
                          {config.promoCard.style.background.type === 'linear' && (
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="block text-xs text-on-surface-variant mb-0.5">Start</label>
                                <input type="color" value={config.promoCard.style.background.startColor} onChange={e => updateCardBg({ startColor: e.target.value })} className="bg-color-picker h-9 w-full rounded cursor-pointer" />
                              </div>
                              <div>
                                <label className="block text-xs text-on-surface-variant mb-0.5">End</label>
                                <input type="color" value={config.promoCard.style.background.endColor} onChange={e => updateCardBg({ endColor: e.target.value })} className="bg-color-picker h-9 w-full rounded cursor-pointer" />
                              </div>
                              <div className="col-span-2 mt-2 rounded-md border border-border/70 bg-surface/30 p-3">
                                <div className="mb-1 flex items-center justify-between">
                                  <label className="block text-xs text-on-surface-variant">Gradient Direction</label>
                                  <span className="text-[11px] font-medium text-on-surface-variant">{Math.round(cardAngleNormalized)}deg</span>
                                </div>
                                <div className="flex items-center justify-center">
                                  <div
                                    ref={cardAngleWheelRef}
                                    className="relative h-28 w-28 rounded-full border border-border/80 bg-[conic-gradient(from_0deg,_rgba(255,255,255,0.14),_rgba(255,255,255,0.03),_rgba(255,255,255,0.14))] shadow-inner cursor-grab active:cursor-grabbing"
                                    onMouseDown={(e) => {
                                      e.preventDefault();
                                      const updateFromMouse = (clientX: number, clientY: number) => {
                                        const nextAngle = getAngleFromPointer(clientX, clientY);
                                        if (nextAngle !== null) setCardDirectionAngle(nextAngle);
                                      };
                                      updateFromMouse(e.clientX, e.clientY);
                                      const onMove = (moveEvent: MouseEvent) => updateFromMouse(moveEvent.clientX, moveEvent.clientY);
                                      const onUp = () => {
                                        window.removeEventListener('mousemove', onMove);
                                        window.removeEventListener('mouseup', onUp);
                                      };
                                      window.addEventListener('mousemove', onMove);
                                      window.addEventListener('mouseup', onUp);
                                    }}
                                  >
                                    <div
                                      className="pointer-events-none absolute left-1/2 top-1/2 z-40 h-[2px] w-[42%] origin-left bg-primary"
                                      style={{ transform: `translateY(-50%) rotate(${cardAngleNormalized - 90}deg)` }}
                                    />
                                    <div
                                      className="pointer-events-none absolute left-1/2 top-1/2 z-50 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border border-primary bg-surface-elevated"
                                    />
                                    {presetDirections.map((preset) => (
                                      <button
                                        key={`wheel-${preset.angle}`}
                                        type="button"
                                        onMouseDown={(e) => {
                                          e.preventDefault();
                                          e.stopPropagation();
                                          setCardDirectionAngle(preset.angle);
                                        }}
                                        onClick={(e) => {
                                          e.preventDefault();
                                          e.stopPropagation();
                                        }}
                                        className={`absolute left-1/2 top-1/2 z-20 h-6 w-6 -translate-x-1/2 -translate-y-1/2 text-[12px] leading-none transition-colors ${
                                          Math.abs(cardAngleNormalized - preset.angle) < 0.6
                                            ? 'font-semibold text-primary'
                                            : 'text-on-surface-variant hover:text-primary'
                                        }`}
                                        style={{
                                          left: `calc(50% + ${Math.sin((preset.angle * Math.PI) / 180) * 37}px)`,
                                          top: `calc(50% - ${Math.cos((preset.angle * Math.PI) / 180) * 37}px)`,
                                        }}
                                        title={`${preset.angle}deg`}
                                      >
                                        {preset.label}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}
                          {config.promoCard.style.background.type === 'radial' && (
                            <div className="grid grid-cols-3 gap-2">
                              <div>
                                <label className="block text-xs text-on-surface-variant mb-0.5">Center</label>
                                <input type="color" value={config.promoCard.style.background.startColor} onChange={e => updateCardBg({ startColor: e.target.value })} className="bg-color-picker h-9 w-full rounded cursor-pointer" />
                              </div>
                              <div>
                                <label className="block text-xs text-on-surface-variant mb-0.5">Outer</label>
                                <input type="color" value={config.promoCard.style.background.endColor} onChange={e => updateCardBg({ endColor: e.target.value })} className="bg-color-picker h-9 w-full rounded cursor-pointer" />
                              </div>
                              <div aria-hidden="true" />
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

          </div>

        </div>
      </div>

      <SamplePromoTemplates onApplyTemplate={applyTemplate} />
      <style jsx global>{`
        .promo-standard-editor,
        .promo-standard-editor * {
          color: rgb(var(--on-surface)) !important;
          font-size: 14px !important;
          font-weight: 400 !important;
          font-style: normal !important;
          letter-spacing: normal !important;
          line-height: 1.5 !important;
          text-decoration: none !important;
          text-transform: none !important;
          text-align: left !important;
          background: transparent !important;
        }
      `}</style>
    </>
  );
}
