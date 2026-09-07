'use client';

import { announcementThemes, themeBackgroundCss, type AnnouncementTheme } from '@/lib/announcement/announcementThemes';
import { AnnouncementStylePanel } from '@/components/announcement/AnnouncementStylePanel';
import { useAnnouncementEditor } from '@/components/announcement/AnnouncementEditorContext';

interface AnnouncementAppearanceProps {
  /** Which preset the current background matches, or null when it is custom. */
  activeThemeId: string | null;
  applyAnnouncementTheme: (theme: AnnouncementTheme) => void;
}

/**
 * Bar Appearance: preset themes and the custom styling controls side by side,
 * so the whole look of the bar is set in one place. The styling controls read
 * from the editor context, the same source the rest of the section uses.
 */
export function AnnouncementAppearance({
  activeThemeId,
  applyAnnouncementTheme,
}: AnnouncementAppearanceProps) {
  const {
    bg,
    updateBg,
    updateBgWithHistory,
    pushImmediateState,
    getEditorSnapshot,
    showBackgroundTypeDropdown,
    setShowBackgroundTypeDropdown,
    backgroundTypeBtnRef,
    backgroundTypeMenuRef,
    backgroundTypePos,
    showDirectionDropdown,
    setShowDirectionDropdown,
    directionBtnRef,
    directionMenuRef,
    directionPos,
    setPreviewDirection,
  } = useAnnouncementEditor();

  return (
    <div className="rounded-2xl border border-border campaign-card-surface px-6 py-5 shadow-sm">
      <h4 className="mb-3 text-base font-semibold leading-5 text-on-surface">Announcement Bar Appearance</h4>
      <div className="grid grid-cols-1 gap-x-6 gap-y-4 lg:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-bold uppercase tracking-[0.08em] text-on-surface-variant">
            Preset themes
          </label>
          <p className="mb-3 text-xs text-on-surface-variant">
            Click any one to restyle the bar — your message stays as written.
          </p>
          {/* Wrapped rows, not one scrolling line, so the swatches fill the
              column rather than leaving it empty below. */}
          <div className="flex flex-wrap gap-2">
            {announcementThemes.map((theme) => (
              <button
                key={theme.id}
                type="button"
                onClick={() => applyAnnouncementTheme(theme)}
                title={theme.name}
                aria-pressed={activeThemeId === theme.id}
                style={{ background: themeBackgroundCss(theme.background) }}
                className={`h-10 w-16 rounded-md ring-offset-2 ring-offset-surface transition-all hover:scale-105 ${
                  activeThemeId === theme.id ? 'ring-2 ring-primary' : 'ring-1 ring-border hover:ring-primary/60'
                }`}
              />
            ))}
          </div>
        </div>
        <div>
          <AnnouncementStylePanel
            bg={bg}
            updateBg={updateBg}
            updateBgWithHistory={updateBgWithHistory}
            pushImmediateState={pushImmediateState}
            getEditorSnapshot={getEditorSnapshot}
            showBackgroundTypeDropdown={showBackgroundTypeDropdown}
            setShowBackgroundTypeDropdown={setShowBackgroundTypeDropdown}
            backgroundTypeBtnRef={backgroundTypeBtnRef}
            backgroundTypeMenuRef={backgroundTypeMenuRef}
            backgroundTypePos={backgroundTypePos}
            showDirectionDropdown={showDirectionDropdown}
            setShowDirectionDropdown={setShowDirectionDropdown}
            directionBtnRef={directionBtnRef}
            directionMenuRef={directionMenuRef}
            directionPos={directionPos}
            setPreviewDirection={setPreviewDirection}
          />
        </div>
      </div>
    </div>
  );
}
