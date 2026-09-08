import { useState } from 'react';
import { LayoutDashboard, Megaphone, Gift, LayoutGrid, Save, Upload, Sun, Moon, LogOut, Loader2, Check, MonitorDown } from 'lucide-react';
import { useInstallPrompt } from '@/hooks/useInstallPrompt';

interface HeaderProps {
  activeTab: 'dashboard' | 'announcement' | 'promo';
  setActiveTab: (tab: 'dashboard' | 'announcement' | 'promo') => void;
  hasAnnouncementChanges: boolean;
  hasPromoChanges: boolean;
  // Announcement still stages via Save → Publish (no dedicated "Save as
  // draft" entry point of its own yet). Promo skipped this step: it saves
  // straight to a draft via the tab strip, so its top button is Publish-only.
  readyToPublishAnnouncement: boolean;
  promoDateInvalid: boolean;
  /** Any announcement scheduled back to front. */
  announcementDateInvalid: boolean;
  /** Hides the status badge and Save/Publish — used outside the promo editor. */
  hideActions?: boolean;
  isPublishing: boolean;
  isDarkMode: boolean;
  toggleDarkMode: () => void;
  handleSaveAnnouncement: () => void;
  handlePublishAnnouncement: () => Promise<void> | void;
  handlePublishPromo: () => Promise<void> | void;
  handleLogout: () => void;
}

export function Header({
  activeTab,
  setActiveTab,
  hasAnnouncementChanges,
  hasPromoChanges,
  readyToPublishAnnouncement,
  promoDateInvalid,
  announcementDateInvalid,
  hideActions,
  isPublishing,
  isDarkMode,
  toggleDarkMode,
  handleSaveAnnouncement,
  handlePublishAnnouncement,
  handlePublishPromo,
  handleLogout,
}: HeaderProps) {
  const [saving, setSaving] = useState(false);

  // Only ever true on a browser that can actually install, and only until it
  // has been installed — so this adds a control to the header rarely and
  // temporarily, rather than parking a permanent one there.
  const { canInstall, install } = useInstallPrompt();

  // Announcement: three states (unsaved → Save; ready → Publish; published).
  // Promo: two states only — editing goes straight to "ready to Publish",
  // since drafting lives in the tab strip instead of this button.
  const state: 'published' | 'unsaved' | 'ready' =
    activeTab === 'announcement'
      ? (readyToPublishAnnouncement ? 'ready' : hasAnnouncementChanges ? 'unsaved' : 'published')
      : (hasPromoChanges ? 'ready' : 'published');

  // Block the action while the tab's schedule is back to front (start > end).
  // Announcement was missing here: its editor refused to close the schedule
  // popup on a bad range, but Save and Publish stayed live in the header, so
  // the range the popup would not let you leave could be saved from up here.
  const blockForDateRange =
    (activeTab === 'promo' && promoDateInvalid) ||
    (activeTab === 'announcement' && announcementDateInvalid);
  // Name the blocked action — announcement stages through Save first, so
  // always saying "publish" was wrong on the Save button — and, for
  // announcements, say where to look. One bad message out of several locks
  // this button, and the button itself cannot show which one; the offending
  // message is ringed red in the list.
  const blockedAction = state === 'unsaved' ? 'save' : 'publish';
  const dateRangeTooltip =
    activeTab === 'announcement'
      ? `A message ends before it starts — it is outlined in red in the list. Fix or clear its schedule to ${blockedAction}.`
      : `Fix invalid date range to ${blockedAction}.`;

  async function onSave() {
    setSaving(true);
    // Brief acknowledgment only — the actual save is instant.
    await new Promise(r => setTimeout(r, 500));
    handleSaveAnnouncement();
    setSaving(false);
  }

  async function onPublish() {
    if (activeTab === 'announcement') await handlePublishAnnouncement();
    else await handlePublishPromo();
  }

  return (
    <header className="sticky top-0 z-20 h-14 border-b border-border bg-surface/95 shadow-sm backdrop-blur px-6 py-3">
      <div className="flex h-full items-center justify-between">
        {/* Left Group */}
        <div className="flex items-center">
          <LayoutDashboard className="mr-3 hidden h-6 w-6 text-primary sm:block" />
          <h1 className="text-xl font-bold leading-7 text-on-surface">Campaign Admin</h1>
        </div>

        {/* Center Group - Navigation Tabs */}
        <nav className="absolute left-1/2 -translate-x-1/2 flex items-center gap-6 overflow-x-auto whitespace-nowrap">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`rounded-md border-b-2 px-3 py-2 text-sm font-semibold leading-5 transition-colors ${activeTab === 'dashboard'
              ? 'border-primary text-primary'
              : 'border-transparent text-on-surface-variant hover:text-on-surface'
              }`}
          >
            Dashboard
          </button>
          <button
            onClick={() => setActiveTab('announcement')}
            className={`rounded-md border-b-2 px-3 py-2 text-sm font-semibold leading-5 transition-colors ${activeTab === 'announcement'
              ? 'border-primary text-primary'
              : 'border-transparent text-on-surface-variant hover:text-on-surface'
              }`}
          >
            Announcement
          </button>
          <button
            onClick={() => setActiveTab('promo')}
            className={`rounded-md border-b-2 px-3 py-2 text-sm font-semibold leading-5 transition-colors ${activeTab === 'promo'
              ? 'border-primary text-primary'
              : 'border-transparent text-on-surface-variant hover:text-on-surface'
              }`}
          >
            Promo Card
          </button>
        </nav>

        {/* Right Group */}
        <div className="flex items-center gap-3">
          {canInstall && activeTab === 'dashboard' && (
            <button
              onClick={install}
              title="Opens in its own window, without the browser bar"
              className="group inline-flex items-center rounded-md border border-primary/25 bg-primary/5 px-3 py-2 text-sm font-semibold text-primary shadow-sm transition-all hover:border-primary/40 hover:bg-primary/10"
            >
              <MonitorDown className="h-4 w-4 transition-transform group-hover:translate-y-px sm:mr-2" />
              <span className="hidden sm:inline">Install app</span>
            </button>
          )}

          {/* Theme Toggle - Moon/Sun Icons */}
          <button
            onClick={toggleDarkMode}
            className="rounded-lg p-2 text-on-surface-variant transition-colors hover:bg-surface-elevated hover:text-on-surface"
            title="Toggle dark mode"
          >
            {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>

          {activeTab !== 'dashboard' && !hideActions && (
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

              {/* Action button - consistent h-9 px-4 text-xs */}
              {state === 'unsaved' && (
                <button
                  onClick={onSave}
                  disabled={saving || blockForDateRange}
                  title={blockForDateRange ? dateRangeTooltip : undefined}
                  className="inline-flex items-center h-9 px-4 rounded-md text-xs font-semibold border border-primary/40 bg-primary text-on-primary shadow-sm transition-all hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saving ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Save className="w-3.5 h-3.5 mr-1.5" />}
                  <span>{saving ? 'Saving...' : 'Save'}</span>
                </button>
              )}
              {state === 'ready' && (
                <button
                  data-tour="header-publish"
                  onClick={onPublish}
                  disabled={isPublishing || blockForDateRange}
                  title={blockForDateRange ? dateRangeTooltip : undefined}
                  className="inline-flex items-center h-9 px-4 rounded-md text-xs font-semibold border border-primary/40 bg-primary text-on-primary shadow-sm transition-all hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isPublishing ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Upload className="w-3.5 h-3.5 mr-1.5" />}
                  <span>{isPublishing ? 'Publishing...' : 'Publish'}</span>
                </button>
              )}
              {state === 'published' && (
                <button
                  disabled
                  aria-label="No unpublished changes remain"
                  title="No unpublished changes remain"
                  className="inline-flex items-center h-9 px-4 rounded-md text-xs font-semibold border border-primary/20 bg-primary/10 text-primary shadow-sm cursor-default opacity-60"
                >
                  <span>Published</span>
                </button>
              )}
            </>
          )}

          {/* Logout Circle Trigger - w-9 h-9 rounded-full */}
          <button
            onClick={handleLogout}
            className="w-9 h-9 rounded-full flex items-center justify-center text-on-surface-variant transition-colors hover:bg-surface-elevated hover:text-on-surface"
            title="Logout"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </div>
    </header>
  );
}
