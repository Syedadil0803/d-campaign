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
    <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-4 sm:px-6 z-20 shadow-sm sticky top-0 dark:bg-gray-800 dark:border-gray-700">
      <div className="flex items-center">
        <LayoutDashboard className="w-6 h-6 text-indigo-600 mr-3 hidden sm:block" />
        <h1 className="text-xl font-bold text-gray-800 tracking-tight dark:text-gray-100">Campaign Admin</h1>
      </div>

      <nav className="hidden md:flex items-center space-x-1 ml-8">
        <button
          onClick={() => setActiveTab('dashboard')}
          className={`px-3 py-2 text-sm font-medium rounded-md transition-colors flex items-center ${
            activeTab === 'dashboard'
              ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-200'
              : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-200'
          }`}
        >
          <LayoutGrid className="w-4 h-4 mr-2" />
          Dashboard
        </button>
        <button
          onClick={() => setActiveTab('announcement')}
          className={`px-3 py-2 text-sm font-medium rounded-md transition-colors flex items-center ${
            activeTab === 'announcement'
              ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-200'
              : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-200'
          }`}
        >
          <Megaphone className="w-4 h-4 mr-2" />
          Announcement
          <span
            className={`ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${
              config.announcementBar.active
                ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-200'
                : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
            }`}
          >
            {config.announcementBar.active ? 'ON' : 'OFF'}
          </span>
        </button>
        <button
          onClick={() => setActiveTab('promo')}
          className={`px-3 py-2 text-sm font-medium rounded-md transition-colors flex items-center ${
            activeTab === 'promo'
              ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-200'
              : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-200'
          }`}
        >
          <Gift className="w-4 h-4 mr-2" />
          Promo Card
          <span
            className={`ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${
              config.promoCard.active
                ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-200'
                : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
            }`}
          >
            {config.promoCard.active ? 'ON' : 'OFF'}
          </span>
        </button>
      </nav>

      <div className="flex items-center space-x-3">
        <button
          onClick={toggleDarkMode}
          className="p-2 rounded-lg text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700 transition-colors"
          title="Toggle dark mode"
        >
          {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
        </button>
        {hasChanges && (
          <div className="text-sm text-yellow-600 font-medium flex items-center animate-pulse hidden sm:flex">
            <span className="w-2 h-2 bg-yellow-400 rounded-full mr-2"></span>
            Unsaved changes
          </div>
        )}
        <button
          onClick={handleSave}
          disabled={!hasChanges}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
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
          className="p-2 rounded-lg text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700 transition-colors"
          title="Logout"
        >
          <LogOut className="w-5 h-5" />
        </button>
      </div>
    </header>
  );
}
