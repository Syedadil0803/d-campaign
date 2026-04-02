import { Megaphone, Gift, Calendar } from 'lucide-react';
import { CampaignConfig } from '@/types/campaign';
import { stripHtml } from '@/lib/utils';

interface DashboardProps {
  config: CampaignConfig;
  setActiveTab: (tab: 'dashboard' | 'announcement' | 'promo') => void;
}

export function Dashboard({ config, setActiveTab }: DashboardProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div
        onClick={() => setActiveTab('announcement')}
        className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 cursor-pointer hover:shadow-md hover:border-indigo-200 transition-all group dark:bg-gray-800 dark:border-gray-700 dark:hover:border-indigo-500"
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center">
            <div className="p-2 bg-indigo-100 rounded-lg mr-3">
              <Megaphone className="w-5 h-5 text-indigo-600" />
            </div>
            <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">Announcement Bar</h3>
          </div>
          <span
            className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
              config.announcementBar.active
                ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-200'
                : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
            }`}
          >
            {config.announcementBar.active ? 'Active' : 'Inactive'}
          </span>
        </div>
        <p className="text-sm text-gray-500 mb-3 line-clamp-2 dark:text-gray-400">
          {config.announcementBar.announcements.length === 0 ? (
            'No announcements set'
          ) : config.announcementBar.announcements.length === 1 ? (
            stripHtml(config.announcementBar.announcements[0].text)
          ) : (
            <>
              {stripHtml(config.announcementBar.announcements[0].text)} •{' '}
              {stripHtml(config.announcementBar.announcements[1].text)}
            </>
          )}
        </p>
        <div className="flex items-center text-xs text-gray-400">
          <Megaphone className="w-3.5 h-3.5 mr-1" />
          <span>
            {config.announcementBar.announcements.length} announcement
            {config.announcementBar.announcements.length !== 1 ? 's' : ''}
          </span>
        </div>
        <div className="mt-3 text-xs text-indigo-600 font-medium opacity-0 group-hover:opacity-100 transition-opacity dark:text-indigo-400">
          Click to edit →
        </div>
      </div>

      <div
        onClick={() => setActiveTab('promo')}
        className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 cursor-pointer hover:shadow-md hover:border-pink-200 transition-all group dark:bg-gray-800 dark:border-gray-700 dark:hover:border-pink-500"
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center">
            <div className="p-2 bg-pink-100 rounded-lg mr-3">
              <Gift className="w-5 h-5 text-pink-600" />
            </div>
            <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">Promo Card</h3>
          </div>
          <span
            className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
              config.promoCard.active
                ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-200'
                : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
            }`}
          >
            {config.promoCard.active ? 'Active' : 'Inactive'}
          </span>
        </div>
        <p className="text-sm text-gray-500 mb-1 font-medium dark:text-gray-400">
          {stripHtml(config.promoCard.title) || 'No title set'}
        </p>
        <p className="text-sm text-gray-400 mb-3 line-clamp-2 dark:text-gray-500">
          {stripHtml(config.promoCard.description) || 'No description set'}
        </p>
        <div className="flex items-center text-xs text-gray-400">
          <Calendar className="w-3.5 h-3.5 mr-1" />
          <span>
            {config.promoCard.startDate
              ? `${config.promoCard.startDate} → ${config.promoCard.endDate || '...'}`
              : 'No schedule set'}
          </span>
        </div>
        <div className="mt-3 text-xs text-pink-600 font-medium opacity-0 group-hover:opacity-100 transition-opacity dark:text-pink-400">
          Click to edit →
        </div>
      </div>
    </div>
  );
}
