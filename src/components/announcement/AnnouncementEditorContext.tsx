'use client';

import { createContext, useContext, type RefObject } from 'react';
import type { CampaignConfig, GradientStyle } from '@/types/campaign';
import type { AnnouncementTheme } from '@/lib/announcement/announcementThemes';
import type { useRichTextEditor } from '@/hooks/useRichTextEditor';
import type { useEditorHistory } from '@/hooks/useEditorHistory';
import type { EditorSnapshot, LinkSnapshot } from '@/lib/editor/historyManager';
import type { useAnnouncementStyleDropdowns } from '@/components/announcement/useAnnouncementStyleDropdowns';
import type { useAnnouncementPopups } from '@/components/announcement/useAnnouncementPopups';
import type { useAnnouncementSelection } from '@/components/announcement/useAnnouncementSelection';
import type { useAnnouncementRowMenu } from '@/components/announcement/useAnnouncementRowMenu';

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