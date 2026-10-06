'use client';

import { createContext, useContext, type RefObject } from 'react';
import type { Announcement, CampaignConfig, GradientStyle } from '@/types/campaign';
import type { AnnouncementTheme } from '@/lib/announcement/announcementThemes';
import type { useRichTextEditor } from '@/hooks/useRichTextEditor';
import type { useEditorHistory } from '@/hooks/useEditorHistory';
import type { EditorSnapshot, LinkSnapshot } from '@/lib/editor/historyManager';
import type { useAnnouncementStyleDropdowns } from '@/components/announcement/useAnnouncementStyleDropdowns';
import type { useAnnouncementPopups } from '@/components/announcement/useAnnouncementPopups';
import type { useAnnouncementSelection } from '@/components/announcement/useAnnouncementSelection';

export interface AnnouncementEditorApi
  extends ReturnType<typeof useAnnouncementStyleDropdowns>,
  ReturnType<typeof useAnnouncementPopups>,
  ReturnType<typeof useAnnouncementSelection>,
  ReturnType<typeof useRichTextEditor>,
  ReturnType<typeof useEditorHistory> {
  config: CampaignConfig;
  setConfig: (config: CampaignConfig) => void;
  markChanged: () => void;

  bg: GradientStyle;
  previewBg: GradientStyle;
  setPreviewDirection: (direction: string | null) => void;
  updateBg: (patch: Partial<GradientStyle>) => void;
  updateBgWithHistory: (patch: Partial<GradientStyle>) => void;
  applyAnnouncementTheme: (theme: AnnouncementTheme) => void;
  activeThemeId: string | null;
  isThemeMode: boolean;

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

  applyingFormatRef: RefObject<boolean>;
  restoringSnapshotRef: RefObject<boolean>;
  isDeletingRef: RefObject<boolean>;
  linkDeletingRef: RefObject<boolean>;
  justDeletedStyledRef: RefObject<boolean>;
  activeFormatsRef: RefObject<ReturnType<typeof useRichTextEditor>['activeFormats']>;
  /** The message added but not yet published. Null means the editor is free. */
  staged: Announcement | null;
  /** Index of the published message the staged one replaces, or null when new. */
  stagedIndex: number | null;
  /** Returns the staged message to the editor and reopens the input. */
  editStaged: () => void;
  /** Drops the staged message without publishing it. */
  discardStaged: () => void;
  /** Moves the staged message into the list and publishes it. */
  publishStaged: () => void;
  publishingStaged: boolean;
  /** New live message's place in the order (1 = top), picked before publishing. */
  stagedPosition: number;
  setStagedPosition: (position: number) => void;
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