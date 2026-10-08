'use client';

import { useEffect, type RefObject } from 'react';
import type { CampaignConfig } from '@/types/campaign';
import type { useToast } from '@/hooks/useToast';
import type { useAnnouncementSelection } from '@/components/announcement/useAnnouncementSelection';
import { whatsAppUrl } from '@/lib/whatsapp';
import { startsLater } from '@/lib/announcement/stagedDraft';
import { canSchedule, insertIndexForPosition, SCHEDULE_LIMIT_MESSAGE } from '@/lib/announcement/listSections';

interface UseAnnouncementStagedArgs {
  config: CampaignConfig;
  setConfig: (config: CampaignConfig) => void;
  markChanged: () => void;
  saveDraftNow?: (cfg: CampaignConfig) => boolean;
  publishNow?: (cfg: CampaignConfig, successMessage?: string) => Promise<void>;
  confirmPublish?: (onConfirm: () => Promise<void>) => void;
  /** Taken whole, as useAnnouncementSnapshots does — it is already one group. */
  selection: ReturnType<typeof useAnnouncementSelection>;
  richEditorRef: RefObject<HTMLDivElement | null>;
  setShowRichToolbar: (show: boolean) => void;
  detectFormatsForSelectMode: (html: string) => void;
  detectFormats: () => void;
  getNormalizedHTML: () => string;
  commitHistory: () => void;
  toast: ReturnType<typeof useToast>['toast'];
  /**
   * The staging state stays declared in AnnouncementSection: the editor
   * context reads it too, and leaving it there keeps the hook order as it was.
   */
  publishingStaged: boolean;
  setPublishingStaged: (busy: boolean) => void;
  stagedPosition: number;
  setStagedPosition: (position: number) => void;
  restoreStagedHtmlRef: RefObject<string | null>;
}

/**
 * The staged-message pipeline: Add stages, Edit takes it back into the input,
 * Discard throws it away, Publish moves it into the list and goes live.
 *
 * Holds the effect that refills the input after Edit, so it must be called
 * where that effect used to sit in AnnouncementSection to keep effect order.
 */
export function useAnnouncementStaged({
  config,
  setConfig,
  markChanged,
  saveDraftNow,
  publishNow,
  confirmPublish,
  selection,
  richEditorRef,
  setShowRichToolbar,
  detectFormatsForSelectMode,
  detectFormats,
  getNormalizedHTML,
  commitHistory,
  toast,
  publishingStaged,
  setPublishingStaged,
  stagedPosition,
  setStagedPosition,
  restoreStagedHtmlRef,
}: UseAnnouncementStagedArgs) {
  const {
    selectedIndex,
    setSelectedIndex,
    selectedUrl,
    selectedOpenInNewTab,
    selectedStartDate,
    selectedEndDate,
    selectedCtaType,
    selectedWhatsappNumber,
    selectedCountryCode,
    clearSelection,
    loadAnnouncementFields,
  } = selection;

  function addAnnouncement() {
    // The cap is enforced here, where every route to staging arrives — the
    // button, Enter, anything added later — not only on the disabled button.
    if (
      startsLater(selectedStartDate) &&
      !canSchedule(config.announcementBar.announcements, selectedIndex)
    ) {
      toast(SCHEDULE_LIMIT_MESSAGE, true, undefined, 4000);
      return;
    }
    commitHistory();
    const html = getNormalizedHTML();
    const destination =
      selectedCtaType === 'whatsapp'
        ? {
          ctaType: 'whatsapp' as const,
          url: whatsAppUrl(selectedCountryCode, selectedWhatsappNumber) || undefined,
          whatsappNumber: selectedWhatsappNumber || undefined,
          whatsappCountryCode: selectedCountryCode,
        }
        : {
          ctaType: undefined,
          url: selectedUrl || undefined,
          whatsappNumber: undefined,
          whatsappCountryCode: undefined,
        };

    const composed = {
      text: html,
      ...destination,
      openInNewTab: selectedOpenInNewTab || undefined,
      startDate: selectedStartDate || undefined,
      endDate: selectedEndDate || undefined,
      richText: true,
    };

    /**
     * Nothing reaches the list here, whether the message is new or an edit of
     * a published one. Both stage, and only Publish changes what the site
     * shows — one pipeline, so the Manage Announcements list is never a step
     * ahead of the website.
     *
     * An edit keeps the index of the row it came from, so Publish replaces
     * that row instead of adding a second copy.
     */
    const next: CampaignConfig = {
      ...config,
      announcementBar: {
        ...config.announcementBar,
        staged: composed,
        stagedIndex: selectedIndex,
      },
    };

    setConfig(next);
    clearSelection();
    detectFormats();
    markChanged();
    // Straight to the cloud, so the message is on the user's other devices
    // before they look for it there.
    saveDraftNow?.(next);
    toast(
      startsLater(selectedStartDate)
        ? 'Message staged — schedule when ready'
        : 'Message staged — publish when ready',
      false,
      undefined,
      2500,
    );
  }

  /**
   * Puts the staged message back in the editor and frees the input again.
   *
   * The text cannot be written into the editor here: while a message is staged
   * the panel renders the chip in place of the input, so the contentEditable is
   * not mounted yet and richEditorRef is still null. The HTML is parked for the
   * effect below, which runs once the input is back on screen.
   *
   * Nothing is written to the cloud. The staged record stays as it was until
   * the message is staged again or discarded, so an abandoned edit leaves the
   * saved message intact rather than wiping it.
   */
  function editStaged() {
    const staged = config.announcementBar.staged;
    if (!staged) return;
    restoreStagedHtmlRef.current = loadAnnouncementFields(staged);
    setShowRichToolbar(true);
    // An edit of a published message keeps hold of its row, so staging it
    // again still replaces that row rather than adding a copy.
    setSelectedIndex(config.announcementBar.stagedIndex ?? null);
    setConfig({
      ...config,
      announcementBar: { ...config.announcementBar, staged: null, stagedIndex: null },
    });
    markChanged();
  }

  /**
   * Fills the input once it is back on screen after Edit. Refs are attached
   * before effects run, so by here the contentEditable exists.
   */
  useEffect(() => {
    if (config.announcementBar.staged) return;
    const html = restoreStagedHtmlRef.current;
    const editor = richEditorRef.current;
    if (!html || !editor) return;
    restoreStagedHtmlRef.current = null;
    editor.innerHTML = html;
    editor.focus();
    const range = document.createRange();
    range.selectNodeContents(editor);
    range.collapse(false);
    const selectionNow = window.getSelection();
    selectionNow?.removeAllRanges();
    selectionNow?.addRange(range);
    detectFormatsForSelectMode(html);
  }, [config.announcementBar.staged]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Throws the staged message away. The editor is left empty, not repopulated. */
  function discardStaged() {
    if (!config.announcementBar.staged) return;
    setStagedPosition(1);
    const next: CampaignConfig = {
      ...config,
      announcementBar: { ...config.announcementBar, staged: null, stagedIndex: null },
    };
    setConfig(next);
    clearSelection();
    markChanged();
    saveDraftNow?.(next);
    toast(
      config.announcementBar.stagedIndex != null
        ? 'Edit discarded — the published message is unchanged'
        : 'Message discarded',
      false,
      undefined,
      2500,
    );
  }

  /**
   * Moves the staged message into the list and publishes in one step.
   *
   * The built config is handed to `publishNow` rather than left to state:
   * setConfig has not committed by the time publish reads it, so publishing
   * from state would push the version without the message.
   */
  async function publishStaged() {
    const staged = config.announcementBar.staged;
    if (!staged || publishingStaged) return;

    // Checked again at publish: the list can have filled up since this was
    // staged — on another device, where the draft was picked up from.
    if (
      startsLater(staged.startDate) &&
      !canSchedule(config.announcementBar.announcements, config.announcementBar.stagedIndex ?? null)
    ) {
      toast(SCHEDULE_LIMIT_MESSAGE, true, undefined, 4000);
      return;
    }

    /**
     * An edit replaces the row it came from; a new message joins the end. The
     * index is re-checked rather than trusted: the row can be deleted from the
     * list while its edit sits staged, and adding it is better than writing
     * past the end of the array.
     */
    const list = [...config.announcementBar.announcements];
    const target = config.announcementBar.stagedIndex;
    if (target != null && target >= 0 && target < list.length) {
      list[target] = { ...list[target], ...staged };
    } else if (startsLater(staged.startDate)) {
      // Upcoming messages are ordered by start date, not by position.
      list.unshift(staged);
    } else {
      // The position picked in the chip; 1 (top, newest first) by default.
      list.splice(insertIndexForPosition(list, stagedPosition), 0, staged);
    }

    const next: CampaignConfig = {
      ...config,
      announcementBar: {
        ...config.announcementBar,
        announcements: list,
        staged: null,
        stagedIndex: null,
      },
    };
    // Nothing changes until the user confirms in the same "Publish to
    // website?" dialog the header's Publish uses; Cancel leaves it staged.
    // The slot a new live message went to, for the success toast.
    const placedAt = target == null && !startsLater(staged.startDate) ? stagedPosition : null;
    const run = async () => {
      setPublishingStaged(true);
      try {
        setConfig(next);
        clearSelection();
        setStagedPosition(1);
        // One toast, from the page: it names the slot when there is one.
        await publishNow?.(next, placedAt !== null ? `Announcement published to Slot #${placedAt}` : undefined);
      } finally {
        setPublishingStaged(false);
      }
    };
    if (confirmPublish) confirmPublish(run);
    else await run();
  }

  return { addAnnouncement, editStaged, discardStaged, publishStaged };
}
