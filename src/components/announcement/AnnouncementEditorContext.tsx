'use client';

import { createContext, useContext, type RefObject } from 'react';
import type { CampaignConfig, GradientStyle } from '@/types/campaign';
import type { useRichTextEditor } from '@/hooks/useRichTextEditor';
import type { useEditorHistory } from '@/hooks/useEditorHistory';
import type { EditorSnapshot, LinkSnapshot } from '@/lib/editor/historyManager';
import type { useAnnouncementStyleDropdowns } from '@/components/announcement/useAnnouncementStyleDropdowns';
import type { useAnnouncementPopups } from '@/components/announcement/useAnnouncementPopups';
import type { useAnnouncementSelection } from '@/components/announcement/useAnnouncementSelection';
import type { useAnnouncementRowMenu } from '@/components/announcement/useAnnouncementRowMenu';

/**
 * What the editor panel reads instead of taking a hundred props.
 *
 * Six of the groups are inherited from the hooks that own them rather than
 * listed out, so adding a member to any of those hooks reaches the panel
 * without a change here — and, more to the point, nothing in this file can
 * describe a hook's shape wrongly. Only the section's own values are written
 * by hand below.
 *
 * The names match the section's locals exactly, which is what lets the markup
 * move across unaltered rather than being rewritten into props.
 */
export interface AnnouncementEditorApi
  extends ReturnType<typeof useAnnouncementStyleDropdowns>,
    ReturnType<typeof useAnnouncementPopups>,
    ReturnType<typeof useAnnouncementSelection>,
    ReturnType<typeof useAnnouncementRowMenu>,
    ReturnType<typeof useRichTextEditor>,
    ReturnType<typeof useEditorHistory> {
  config: CampaignConfig;
  setConfig: (config: CampaignConfig) => void;
  markChanged: () => void;

  /** The bar's background as configured, and with any hovered direction. */
  bg: GradientStyle;
  previewBg: GradientStyle;
  setPreviewDirection: (direction: string | null) => void;
  updateBg: (patch: Partial<GradientStyle>) => void;
  updateBgWithHistory: (patch: Partial<GradientStyle>) => void;

  newAnnouncementText: string;
  richEditorRef: RefObject<HTMLDivElement | null>;
  editorDefaultColor: string;
  scheduleRangeInvalid: boolean;

  setShowRichToolbar: (show: boolean) => void;
  setShowShortcutsTip: (show: boolean) => void;
  shortcutsTipShown: RefObject<boolean>;

  addAnnouncement: () => void;
  applyFormatToAll: (action: () => void) => void;
  onRichTextInput: () => void;
  openChatGptWithPrompt: () => void;
  closePopupAndFocusEditor: () => void;
  detectFormatsForSelectMode: (html: string) => void;

  getEditorSnapshot: () => EditorSnapshot;
  applyEditorSnapshot: (snapshot: EditorSnapshot) => void;
  getLinkSnapshot: () => LinkSnapshot;
  applyLinkSnapshot: (snapshot: LinkSnapshot) => void;

  /** Guards the rich-text editor shares with the section's effects. */
  applyingFormatRef: RefObject<boolean>;
  restoringSnapshotRef: RefObject<boolean>;
  isDeletingRef: RefObject<boolean>;
  linkDeletingRef: RefObject<boolean>;
  justDeletedStyledRef: RefObject<boolean>;
  activeFormatsRef: RefObject<ReturnType<typeof useRichTextEditor>['activeFormats']>;
}

const AnnouncementEditorContext = createContext<AnnouncementEditorApi | null>(null);

export const AnnouncementEditorProvider = AnnouncementEditorContext.Provider;

export function useAnnouncementEditor(): AnnouncementEditorApi {
  const api = useContext(AnnouncementEditorContext);
  if (!api) {
    throw new Error('useAnnouncementEditor must be used inside AnnouncementEditorProvider');
  }
  return api;
}
