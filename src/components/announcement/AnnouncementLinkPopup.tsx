'use client';

import type { RefObject } from 'react';
import { createPortal } from 'react-dom';
import type { CampaignConfig } from '@/types/campaign';
import type { LinkSnapshot } from '@/lib/editor/historyManager';
import {
  whatsAppUrl,
  whatsAppLooksShort,
  maxNationalDigits,
} from '@/lib/whatsapp';
import { CountryFlag, COUNTRY_CODES } from '@/components/shared/CountryFlag';
import { PopupDropdown } from '@/components/shared/PopupDropdown';

interface AnnouncementLinkPopupProps {
  open: boolean;
  position: { top: number; left: number } | null;
  popupRef: RefObject<HTMLDivElement | null>;
  closePopupAndFocusEditor: () => void;

  /** Which announcement in the list the popup is editing. */
  selectedIndex: number | null;
  config: CampaignConfig;
  setConfig: (config: CampaignConfig) => void;
  markChanged: () => void;

  selectedCtaType: 'link' | 'whatsapp';
  setSelectedCtaType: (kind: 'link' | 'whatsapp') => void;
  selectedUrl: string;
  setSelectedUrl: (url: string) => void;
  selectedOpenInNewTab: boolean;
  setSelectedOpenInNewTab: (open: boolean) => void;
  selectedCountryCode: string;
  setSelectedCountryCode: (code: string) => void;
  selectedWhatsappNumber: string;
  setSelectedWhatsappNumber: (number: string) => void;
  updateSelectedDestination: (next: {
    ctaType?: 'link' | 'whatsapp';
    url?: string;
    whatsappNumber?: string;
    whatsappCountryCode?: string;
  }) => void;

  /** Country picker inside the WhatsApp half. */
  showAnnCountryDropdown: boolean;
  setShowAnnCountryDropdown: (open: boolean | ((prev: boolean) => boolean)) => void;
  annCountryPos: { top: number; left: number; width: number } | null;
  setAnnCountryPos: (
    pos: { top: number; left: number; width: number } | null,
  ) => void;
  annCountryBtnRef: RefObject<HTMLButtonElement | null>;
  annCountryMenuRef: RefObject<HTMLDivElement | null>;

  /** The URL field keeps its own undo stack, separate from the editor's. */
  linkDeletingRef: RefObject<boolean>;
  getLinkSnapshot: () => LinkSnapshot;
  applyLinkSnapshot: (snapshot: LinkSnapshot) => void;
  pushLinkState: (snapshot: LinkSnapshot) => void;
  undoLink: (current: LinkSnapshot) => LinkSnapshot | null;
  redoLink: (current: LinkSnapshot) => LinkSnapshot | null;
}

/**
 * Where an announcement's tap goes: a URL, or a WhatsApp conversation.
 *
 * Rendered into document.body rather than in place — it is positioned against
 * the selected announcement in the list, which sits inside a scrolling panel.
 */
export function AnnouncementLinkPopup({
  open,
  position,
  popupRef,
  closePopupAndFocusEditor,
  selectedIndex,
  config,
  setConfig,
  markChanged,
  selectedCtaType,
  setSelectedCtaType,
  selectedUrl,
  setSelectedUrl,
  selectedOpenInNewTab,
  setSelectedOpenInNewTab,
  selectedCountryCode,
  setSelectedCountryCode,
  selectedWhatsappNumber,
  setSelectedWhatsappNumber,
  updateSelectedDestination,
  showAnnCountryDropdown,
  setShowAnnCountryDropdown,
  annCountryPos,
  setAnnCountryPos,
  annCountryBtnRef,
  annCountryMenuRef,
  linkDeletingRef,
  getLinkSnapshot,
  applyLinkSnapshot,
  pushLinkState,
  undoLink,
  redoLink,
}: AnnouncementLinkPopupProps) {
  if (!open || !position || typeof document === 'undefined') return null;

  return createPortal(
    <div
      ref={popupRef}
      onMouseDown={(e) => e.stopPropagation()}
      style={{ position: 'absolute', top: position.top, left: position.left, zIndex: 9999 }}
      className="bg-black/10 backdrop-blur-md border border-white/10 rounded-xl shadow-2xl p-3 w-[260px]"
    >
      <button
        onMouseDown={(e) => { e.stopPropagation(); e.preventDefault(); closePopupAndFocusEditor(); }}
        aria-label="Close"
        className="absolute top-0 right-2 text-on-surface-variant hover:text-on-surface p-1 rounded text-xl"
      >
        ×
      </button>
      {/* Two kinds of destination, one field on the website. */}
      <div className="mb-3 flex gap-1 rounded-lg border border-border p-0.5">
        {(['link', 'whatsapp'] as const).map((kind) => (
          <button
            key={kind}
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              // Switch the mode only. Writing here too would clear the
              // destination the moment you flipped the toggle — the other mode
              // has nothing entered yet — so a stray click destroyed a link
              // that was already set.
              setSelectedCtaType(kind);
            }}
            className={`flex-1 rounded-md px-2 py-1 text-xs font-medium transition-colors ${
              selectedCtaType === kind
                ? 'bg-primary/10 text-primary'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            {kind === 'link' ? 'Link' : 'WhatsApp'}
          </button>
        ))}
      </div>

      {selectedCtaType === 'whatsapp' ? (
        <>
          <p className="text-xs font-medium text-on-surface mb-2">
            WhatsApp number
          </p>
          <div className="flex items-center gap-1.5">
            <PopupDropdown
              labelClassName="sr-only"
              label="Country code"
              value={selectedCountryCode}
              // Same shape as the promo card's picker: the name reads first
              // because that is what people search by, with the dialling code
              // trailing as the detail.
              options={COUNTRY_CODES.map(({ code, flag, name }) => ({
                value: code,
                label: name,
                meta: code,
                searchText: name,
                icon: <CountryFlag flag={flag} name={name} />,
              }))}
              open={showAnnCountryDropdown}
              onOpen={() => {
                const btn = annCountryBtnRef.current;
                if (btn) {
                  const r = btn.getBoundingClientRect();
                  setAnnCountryPos({
                    top: r.bottom + window.scrollY,
                    left: r.left + window.scrollX,
                    width: r.width,
                  });
                }
                setShowAnnCountryDropdown((v) => !v);
              }}
              onSelect={(v) => {
                setSelectedCountryCode(v);
                updateSelectedDestination({ whatsappCountryCode: v });
                setShowAnnCountryDropdown(false);
              }}
              buttonRef={annCountryBtnRef}
              menuRef={annCountryMenuRef}
              menuPosition={annCountryPos}
              compact
              flip
              searchable
              searchPlaceholder="Search country"
              // Five rows and the search box. Sixty-six countries behind a tall
              // menu is a wall of names to read past; five is enough to show the
              // list scrolls and that typing is the faster way through it.
              menuMaxHeight={200}
              triggerContent={(() => {
                const c = COUNTRY_CODES.find(
                  (x) => x.code === selectedCountryCode,
                );
                return (
                  <span className="flex items-center gap-1.5">
                    {c ? <CountryFlag flag={c.flag} name={c.name} /> : null}
                    <span>{selectedCountryCode}</span>
                  </span>
                );
              })()}
              buttonClassName="flex h-9 w-[92px] shrink-0 items-center justify-between gap-1 rounded-md border border-border bg-surface px-2 text-sm text-on-surface transition-colors hover:border-primary/70"
            />
            <input
              type="tel"
              inputMode="numeric"
              value={selectedWhatsappNumber}
              onChange={(e) => {
                const digits = e.target.value
                  .replace(/\D/g, '')
                  .slice(0, maxNationalDigits(selectedCountryCode));
                setSelectedWhatsappNumber(digits);
                updateSelectedDestination({ whatsappNumber: digits });
              }}
              className="block w-full rounded-md border border-border bg-surface p-2 text-sm text-on-surface"
              placeholder="7911123456"
              autoFocus
            />
          </div>
          {/* A short number still links — length is a warning, not a gate,
              matching how the promo card treats it. */}
          {whatsAppLooksShort(selectedCountryCode, selectedWhatsappNumber) && (
            <p className="mt-1.5 text-[11px] text-amber-600 dark:text-amber-500">
              That looks short for {selectedCountryCode}. Double-check it
              before publishing.
            </p>
          )}
          {whatsAppUrl(selectedCountryCode, selectedWhatsappNumber) && (
            <p className="mt-1.5 break-all text-[11px] text-on-surface-variant">
              Opens{' '}
              {whatsAppUrl(selectedCountryCode, selectedWhatsappNumber)}
            </p>
          )}
        </>
      ) : (
      <>
      <p className="text-xs font-medium text-on-surface mb-2">Link URL</p>
      <input
        type="url"
        value={selectedUrl}
        onKeyDown={(e) => {
          const mod = e.metaKey || e.ctrlKey;
          if (mod && (e.key.toLowerCase() === 'z' || e.key.toLowerCase() === 'y')) {
            e.preventDefault();
            const isUndo = e.key.toLowerCase() === 'z' && !e.shiftKey;
            const isRedo = (e.key.toLowerCase() === 'z' && e.shiftKey) || e.key.toLowerCase() === 'y';
            if (isUndo) {
              const snapshot = undoLink(getLinkSnapshot());
              if (snapshot) applyLinkSnapshot(snapshot);
            } else if (isRedo) {
              const snapshot = redoLink(getLinkSnapshot());
              if (snapshot) applyLinkSnapshot(snapshot);
            }
            linkDeletingRef.current = false;
            return;
          }
          // Push before destroying existing URL (first backspace only)
          if (selectedUrl && (e.key === 'Backspace' || e.key === 'Delete')) {
            if (!linkDeletingRef.current) {
              linkDeletingRef.current = true;
              pushLinkState(getLinkSnapshot());
            }
          } else if (selectedUrl && e.key.length === 1 && !mod) {
            const input = e.target as HTMLInputElement;
            if (input.selectionStart !== input.selectionEnd) {
              // About to overwrite selected text
              if (!linkDeletingRef.current) {
                linkDeletingRef.current = true;
                pushLinkState(getLinkSnapshot());
              }
            } else {
              // Typing forward — reset delete mode
              if (e.key === ' ') linkDeletingRef.current = false;
            }
          }
        }}
        onChange={(e) => {
          const nextUrl = e.target.value;
          setSelectedUrl(nextUrl);
          if (selectedIndex !== null) {
            const updated = [...config.announcementBar.announcements];
            updated[selectedIndex] = { ...updated[selectedIndex], url: nextUrl || undefined, richText: true };
            setConfig({ ...config, announcementBar: { ...config.announcementBar, announcements: updated } });
            markChanged();
          }
        }}
        className="block w-full border-border rounded-md p-2 border bg-surface text-on-surface text-sm"
        placeholder="https://example.com"
        autoFocus
      />
      <div className="flex items-center mt-3 mb-2">
        <input
          type="checkbox"
          id="openInNewTab"
          checked={selectedOpenInNewTab}
          onChange={(e) => {
            const nextValue = e.target.checked;
            setSelectedOpenInNewTab(nextValue);
            if (selectedIndex !== null) {
              const updated = [...config.announcementBar.announcements];
              updated[selectedIndex] = { ...updated[selectedIndex], openInNewTab: nextValue || undefined, richText: true };
              setConfig({ ...config, announcementBar: { ...config.announcementBar, announcements: updated } });
              markChanged();
            }
          }}
          className="w-4 h-4 rounded border-border text-primary"
        />
        <label htmlFor="openInNewTab" className="ml-2 text-xs text-on-surface cursor-pointer">Open in new tab</label>
      </div>
      <p className="text-[10px] text-on-surface-variant mt-1">In this editor, links always open in a new tab. <br /> This setting applies to your live site only.</p>
      </>
      )}
      <div className="flex justify-between items-center mt-2">
        {(selectedUrl || selectedWhatsappNumber) && (
          <button
            onMouseDown={(e) => {
              e.preventDefault();
              setSelectedUrl('');
              setSelectedWhatsappNumber('');
              setSelectedOpenInNewTab(true);
              if (selectedIndex !== null) {
                const updated = [...config.announcementBar.announcements];
                updated[selectedIndex] = {
                  ...updated[selectedIndex],
                  url: undefined,
                  openInNewTab: undefined,
                  whatsappNumber: undefined,
                  whatsappCountryCode: undefined,
                  richText: true,
                };
                setConfig({ ...config, announcementBar: { ...config.announcementBar, announcements: updated } });
                markChanged();
              }
            }}
            className="text-xs text-primary hover:opacity-80"
          >
            Clear
          </button>
        )}
        <button
          onMouseDown={(e) => {
            e.preventDefault();
            closePopupAndFocusEditor();
          }}
          className="ml-auto text-xs bg-primary text-on-primary px-3 py-1 rounded hover:opacity-95"
        >
          Done
        </button>
      </div>
    </div>,
    document.body,
  );
}
