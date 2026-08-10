import { useState } from 'react';
import { LayoutDashboard, Megaphone, Gift, LayoutGrid, Save, Upload, Sun, Moon, LogOut, Loader2, Check, Eye, Pencil } from 'lucide-react';

interface HeaderProps {
  activeTab: 'dashboard' | 'announcement' | 'promo';
  setActiveTab: (tab: 'dashboard' | 'announcement' | 'promo') => void;
  editorMode: 'view' | 'edit';
  onEnterEdit: () => void;
  hasAnnouncementChanges: boolean;
  hasPromoChanges: boolean;
  readyToPublishAnnouncement: boolean;
  readyToPublishPromo: boolean;
  isPublishing: boolean;
  isDarkMode: boolean;
  toggleDarkMode: () => void;
  handleSaveAnnouncement: () => void;
  handleSavePromo: () => void;
  handlePublishAnnouncement: () => Promise<void> | void;
  handlePublishPromo: () => Promise<void> | void;
  handleLogout: () => void;
}

export function Header({
  activeTab,
  setActiveTab,
  editorMode,
  onEnterEdit,
  hasAnnouncementChanges,
  hasPromoChanges,
  readyToPublishAnnouncement,
  readyToPublishPromo,
  isPublishing,
  isDarkMode,
  toggleDarkMode,
  handleSaveAnnouncement,
  handleSavePromo,
  handlePublishAnnouncement,
  handlePublishPromo,
  handleLogout,
}: HeaderProps) {
  const [saving, setSaving] = useState(false);

  const currentHasChanges =
    activeTab === 'announcement' ? hasAnnouncementChanges :
    activeTab === 'promo' ? hasPromoChanges :
    false;
  const currentReadyToPublish =
    activeTab === 'announcement' ? readyToPublishAnnouncement :
    activeTab === 'promo' ? readyToPublishPromo :
    false;

  const state: 'published' | 'unsaved' | 'ready' =
    currentReadyToPublish ? 'ready' :
    currentHasChanges ? 'unsaved' :
    'published';

  async function onSave() {
    setSaving(true);
    // Brief acknowledgment only — the actual save is instant (local draft).
    // Kept at 500ms to match the publish loader for a consistent feel.
    await new Promise(r => setTimeout(r, 500));
    if (activeTab === 'announcement') handleSaveAnnouncement();
    else handleSavePromo();
    setSaving(false);
  }

  async function onPublish() {
    if (activeTab === 'announcement') await handlePublishAnnouncement();
    else await handlePublishPromo();
  }

  return (
    <header className="sticky top-0 z-20 h-16 border-b border-border bg-surface/95 shadow-sm backdrop-blur">
      <div className="flex h-full items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-12">
          <LayoutDashboard className="mr-3 hidden h-6 w-6 text-primary sm:block" />
          <h1 className="font-display text-lg font-bold tracking-tight text-on-surface md:text-xl">Campaign Admin</h1>
        </div>
        <nav className="absolute left-1/2 -translate-x-1/2 flex items-center gap-6 overflow-x-auto whitespace-nowrap">
        <button
          onClick={() => setActiveTab('dashboard')}
          className={`flex items-center rounded-md border-b-2 px-3 py-2 text-sm font-semibold transition-colors ${
            activeTab === 'dashboard'
              ? 'border-primary text-primary'
              : 'border-transparent text-on-surface-variant hover:text-on-surface'
          }`}
        >
          <LayoutGrid className="mr-2 h-4 w-4" />
          Dashboard
        </button>
        <button
          onClick={() => setActiveTab('announcement')}
          className={`flex items-center rounded-md border-b-2 px-3 py-2 text-sm font-semibold transition-colors ${
            activeTab === 'announcement'
              ? 'border-primary text-primary'
              : 'border-transparent text-on-surface-variant hover:text-on-surface'
          }`}
        >
          <Megaphone className="mr-2 h-4 w-4" />
          Announcement
        </button>
        <button
          onClick={() => setActiveTab('promo')}
          className={`flex items-center rounded-md border-b-2 px-3 py-2 text-sm font-semibold transition-colors ${
            activeTab === 'promo'
              ? 'border-primary text-primary'
              : 'border-transparent text-on-surface-variant hover:text-on-surface'
          }`}
        >
          <Gift className="mr-2 h-4 w-4" />
          Promo Card
        </button>
        </nav>

        <div className="flex items-center space-x-2">
          <button
            onClick={toggleDarkMode}
            className="rounded-lg p-2 text-on-surface-variant transition-colors hover:bg-surface-elevated hover:text-on-surface"
            title="Toggle dark mode"
          >
            {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>

          {activeTab !== 'dashboard' && editorMode === 'view' && (
            <>
              <div className="hidden items-center text-sm font-medium text-on-surface-variant sm:flex">
                <Eye className="mr-1.5 h-4 w-4" />
                Viewing
              </div>
              <button
                onClick={onEnterEdit}
                className="inline-flex items-center rounded-md border border-primary/40 bg-primary px-4 py-2 text-sm font-semibold text-on-primary shadow-sm transition-all hover:opacity-95"
              >
                <Pencil className="w-4 h-4 mr-2" />
                <span>Edit</span>
              </button>
            </>
          )}

          {activeTab !== 'dashboard' && editorMode === 'edit' && (
            <>
              {/* Status badge */}
              {state === 'unsaved' && (
                <div className="hidden items-center text-sm font-medium text-primary sm:flex">
                  <span className="mr-2 h-2 w-2 animate-pulse rounded-full bg-primary"></span>
                  Unsaved changes
                </div>
              )}
              {state === 'ready' && (
                <div className="hidden items-center text-sm font-medium text-primary sm:flex">
                  <span className="mr-2 h-2 w-2 rounded-full bg-primary"></span>
                  Unpublished changes
                </div>
              )}
              {state === 'published' && (
                <div className="hidden items-center text-sm font-medium text-primary sm:flex">
                  <Check className="mr-1.5 h-4 w-4" />
                  All changes published
                </div>
              )}

              {/* Action button */}
              {state === 'unsaved' && (
                <button
                  onClick={onSave}
                  disabled={saving}
                  className="inline-flex items-center rounded-md border border-primary/40 bg-primary px-4 py-2 text-sm font-semibold text-on-primary shadow-sm transition-all hover:opacity-95 disabled:opacity-70"
                >
                  {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                  <span>{saving ? 'Saving...' : 'Save'}</span>
                </button>
              )}
              {state === 'ready' && (
                <button
                  onClick={onPublish}
                  disabled={isPublishing}
                  className="inline-flex items-center rounded-md border border-primary/40 bg-primary px-4 py-2 text-sm font-semibold text-on-primary shadow-sm transition-all hover:opacity-95 disabled:opacity-70"
                >
                  {isPublishing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
                  <span>{isPublishing ? 'Publishing...' : 'Publish'}</span>
                </button>
              )}
              {state === 'published' && (
                <button
                  disabled
                  aria-label="No unpublished changes remain"
                  title="No unpublished changes remain"
                  className="inline-flex items-center rounded-md border border-primary/20 bg-primary/10 px-4 py-2 text-sm font-semibold text-primary shadow-sm cursor-default opacity-60"
                >
                  <span>Published</span>
                </button>
              )}
            </>
          )}

          <button
            onClick={handleLogout}
            className="rounded-lg p-2 text-on-surface-variant transition-colors hover:bg-surface-elevated hover:text-on-surface"
            title="Logout"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </div>
    </header>
  );
}
