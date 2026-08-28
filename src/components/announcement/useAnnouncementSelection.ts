'use client';

import { useRef, useState, type RefObject } from 'react';
import type { CampaignConfig } from '@/types/campaign';
import { wrapBareTextWithFontSize } from '@/lib/editor/richTextUtils';
import { whatsAppUrl } from '@/lib/whatsapp';

interface UseAnnouncementSelectionArgs {
  config: CampaignConfig;
  setConfig: (config: CampaignConfig) => void;
  markChanged: () => void;
  setNewAnnouncementText: (text: string) => void;
  setShowRichToolbar: (show: boolean) => void;
  richEditorRef: RefObject<HTMLDivElement | null>;
  detectFormatsForSelectMode: (html: string) => void;
  /**
   * Closes the link and schedule popups when the selection is cleared.
   *
   * Reached through a ref because the two hooks need each other: the popups
   * hook takes this one's dates so the schedule popup can refuse to close on
   * an invalid range, so it is built second and its setters do not exist yet
   * here. Only ever called from a user action, never during render, which is
   * what makes the indirection safe.
   */
  closeToolbarPopupsRef: RefObject<(() => void) | null>;
}

/**
 * Which announcement is being edited, and everything the editor holds about it.
 *
 * The list is the source of truth; this is the working copy the toolbar, the
 * link popup and the schedule popup all read and write. It owns eleven pieces
 * of state — the message's index, its text destination, its WhatsApp
 * alternative, its schedule, and the country picker that goes with the number.
 */
export function useAnnouncementSelection({
  config,
  setConfig,
  markChanged,
  setNewAnnouncementText,
  setShowRichToolbar,
  richEditorRef,
  detectFormatsForSelectMode,
  closeToolbarPopupsRef,
}: UseAnnouncementSelectionArgs) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [selectedUrl, setSelectedUrl] = useState('');
  const [selectedOpenInNewTab, setSelectedOpenInNewTab] = useState(true);
  const [selectedStartDate, setSelectedStartDate] = useState('');
  const [selectedEndDate, setSelectedEndDate] = useState('');
  const [selectedCtaType, setSelectedCtaType] = useState<'link' | 'whatsapp'>('link');
  const [selectedWhatsappNumber, setSelectedWhatsappNumber] = useState('');
  const [selectedCountryCode, setSelectedCountryCode] = useState('+44');
  const [showAnnCountryDropdown, setShowAnnCountryDropdown] = useState(false);
  const [annCountryPos, setAnnCountryPos] = useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);
  const annCountryBtnRef = useRef<HTMLButtonElement>(null);
  const annCountryMenuRef = useRef<HTMLDivElement>(null);
  const selectedIndexRef = useRef<number | null>(null);

  function clearSelection() {
    setSelectedIndex(null);
    setNewAnnouncementText('');
    setSelectedUrl('');
    setSelectedOpenInNewTab(true);
    setSelectedStartDate('');
    setSelectedEndDate('');
    setShowRichToolbar(true);
    closeToolbarPopupsRef.current?.();
    if (richEditorRef.current) {
      richEditorRef.current.innerHTML = '';
      richEditorRef.current.blur();
    }
    window.getSelection()?.removeAllRanges();
  }

  /**
   * Write the selected message's destination.
   *
   * `url` stays the one field the website reads, so a WhatsApp CTA is stored
   * as its derived wa.me link; the raw number and dialling code ride along
   * only so reopening the popup can repopulate the picker.
   */
  function updateSelectedDestination(next: {
    ctaType?: 'link' | 'whatsapp';
    url?: string;
    whatsappNumber?: string;
    whatsappCountryCode?: string;
  }) {
    if (selectedIndex === null) return;
    const ctaType = next.ctaType ?? selectedCtaType;
    const number = next.whatsappNumber ?? selectedWhatsappNumber;
    const code = next.whatsappCountryCode ?? selectedCountryCode;
    const plainUrl = next.url ?? selectedUrl;

    const updated = [...config.announcementBar.announcements];
    const resolved =
      ctaType === 'whatsapp' ? whatsAppUrl(code, number) : plainUrl || undefined;
    const current = updated[selectedIndex];
    const nextAnnouncement = {
      ...current,
      richText: true,
      ctaType: ctaType === 'whatsapp' ? ('whatsapp' as const) : undefined,
      url: resolved || undefined,
      whatsappNumber: ctaType === 'whatsapp' ? number || undefined : undefined,
      whatsappCountryCode: ctaType === 'whatsapp' ? code : undefined,
    };
    /**
     * Nothing changed, nothing written.
     *
     * This runs whenever the link popup closes, which includes opening it and
     * pressing Escape. Writing the same destination back would still hand the
     * page a new config object and light up "unsaved changes" for a popup the
     * user only looked at. richText is left out of the comparison on purpose:
     * it is a flag the editor sets, not a destination the user chose, and
     * counting it would make the first look at any plain message dirty.
     */
    if (
      nextAnnouncement.url === current.url &&
      nextAnnouncement.ctaType === current.ctaType &&
      nextAnnouncement.whatsappNumber === current.whatsappNumber &&
      nextAnnouncement.whatsappCountryCode === current.whatsappCountryCode
    ) {
      return;
    }
    updated[selectedIndex] = nextAnnouncement;
    setConfig({
      ...config,
      announcementBar: { ...config.announcementBar, announcements: updated },
    });
    markChanged();
  }

  /**
   * Copies one announcement's fields into the selection state, and returns its
   * text with a font size applied if it had none.
   *
   * Shared by the two ways of selecting: the editor's own select, which then
   * focuses the editor and puts the caret at the end, and clicking a pill in
   * the list, which deliberately does the opposite — blurs and clears the
   * selection so the list stays where the user is looking.
   *
   * Only the loading is shared. What happens to focus afterwards is the whole
   * difference between the two, so it stays at each call site where it can be
   * read.
   */
  function loadAnnouncementIntoSelection(index: number): string {
    const ann = config.announcementBar.announcements[index];
    setSelectedIndex(index);
    setSelectedUrl(ann.url || '');
    setSelectedCtaType(ann.ctaType === 'whatsapp' ? 'whatsapp' : 'link');
    setSelectedWhatsappNumber(ann.whatsappNumber || '');
    setSelectedCountryCode(ann.whatsappCountryCode || '+44');
    setSelectedOpenInNewTab(ann.openInNewTab !== undefined ? ann.openInNewTab : true);
    setSelectedStartDate(ann.startDate || '');
    setSelectedEndDate(ann.endDate || '');
    const normalizedText = ann.richText ? ann.text : wrapBareTextWithFontSize(ann.text);
    setNewAnnouncementText(normalizedText);
    return normalizedText;
  }

  // ── Select announcement (load into editor in edit mode) ──
  function selectAnnouncement(index: number) {
    const normalizedText = loadAnnouncementIntoSelection(index);
    setShowRichToolbar(true);
    if (richEditorRef.current) {
      richEditorRef.current.innerHTML = normalizedText;
      richEditorRef.current.focus();
      // Place cursor at end
      const sel = window.getSelection();
      if (sel) {
        sel.removeAllRanges();
        const range = document.createRange();
        range.selectNodeContents(richEditorRef.current);
        range.collapse(false);
        sel.addRange(range);
      }
    }
    detectFormatsForSelectMode(normalizedText);
  }

  return {
    selectedIndex,
    setSelectedIndex,
    selectedUrl,
    setSelectedUrl,
    selectedOpenInNewTab,
    setSelectedOpenInNewTab,
    selectedStartDate,
    setSelectedStartDate,
    selectedEndDate,
    setSelectedEndDate,
    selectedCtaType,
    setSelectedCtaType,
    selectedWhatsappNumber,
    setSelectedWhatsappNumber,
    selectedCountryCode,
    setSelectedCountryCode,
    showAnnCountryDropdown,
    setShowAnnCountryDropdown,
    annCountryPos,
    setAnnCountryPos,
    annCountryBtnRef,
    annCountryMenuRef,
    selectedIndexRef,
    clearSelection,
    updateSelectedDestination,
    loadAnnouncementIntoSelection,
    selectAnnouncement,
  };
}
