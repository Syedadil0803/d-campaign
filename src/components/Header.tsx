import { LayoutDashboard, Megaphone, Gift, LayoutGrid, Save, Sun, Moon, LogOut } from 'lucide-react';
import { CampaignConfig } from '@/types/campaign';

interface HeaderProps {
  activeTab: 'dashboard' | 'announcement' | 'promo';
  setActiveTab: (tab: 'dashboard' | 'announcement' | 'promo') => void;
  config: CampaignConfig;
  hasChanges: boolean;
  isDarkMode: boolean;
  toggleDarkMode: () => void;
  handleSave: () => void;
  handleLogout: () => void;
}

export function Header({
  activeTab,
  setActiveTab,
  config,
  hasChanges,
  isDarkMode,
  toggleDarkMode,
  handleSave,
  handleLogout,
}: HeaderProps) {
  return (
    <header className="sticky top-0 z-20 h-16 border-b border-border bg-surface/95 shadow-sm backdrop-blur">
      <div className="flex h-full items-center justify-between px-4 sm:px-6">
        <div className="flex items-center">
          <LayoutDashboard className="mr-3 hidden h-6 w-6 text-primary sm:block" />
          <h1 className="font-display text-lg font-bold tracking-tight text-on-surface md:text-xl">Campaign Admin</h1>
        </div>
        <nav className="ml-5 flex items-center gap-1 overflow-x-auto whitespace-nowrap md:ml-8">
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
          {hasChanges && (
            <div className="hidden items-center text-sm font-medium text-primary sm:flex">
              <span className="mr-2 h-2 w-2 animate-pulse rounded-full bg-primary"></span>
              Unsaved changes
            </div>
          )}
          <button
            onClick={handleSave}
            disabled={!hasChanges}
            className="inline-flex items-center rounded-md border border-primary/40 bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Save className="w-4 h-4 mr-2" />
            <span className="hidden sm:inline">{hasChanges ? 'Save Changes' : 'Saved'}</span>
            <span className="sm:hidden">Save</span>
          </button>
          <button
            onClick={() => {
              if (hasChanges) {
                if (confirm('You have unsaved changes. Are you sure you want to logout? Any unsaved changes will be lost.')) {
                  handleLogout();
                }
              } else {
                handleLogout();
              }
            }}
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
