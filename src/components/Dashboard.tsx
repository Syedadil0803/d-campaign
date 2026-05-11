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
        className="bg-surface-elevated rounded-lg border border-border shadow-[0_0_20px_rgba(51,65,85,0.3)] p-6 cursor-pointer hover:shadow-[0_0_30px_rgba(51,65,85,0.5)] hover:border-primary/70 transition-all group"
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center">
            <div className="p-2 bg-background rounded-lg mr-3 border border-border">
              <Megaphone className="w-5 h-5 text-primary" />
            </div>
            <h3 className="text-base font-semibold text-on-surface">Announcement Bar</h3>
          </div>
          <span
            className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
              config.announcementBar.active
                ? 'bg-primary/15 text-primary border border-primary/40'
                : 'bg-surface text-on-surface-variant border border-border'
            }`}
          >
            {config.announcementBar.active ? 'Active' : 'Inactive'}
          </span>
        </div>
        <p className="text-sm text-on-surface-variant mb-3 line-clamp-2">
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
        <div className="flex items-center text-xs text-on-surface-variant">
          <Megaphone className="w-3.5 h-3.5 mr-1" />
          <span>
            {config.announcementBar.announcements.length} announcement
            {config.announcementBar.announcements.length !== 1 ? 's' : ''}
          </span>
        </div>
        <div className="mt-3 text-xs text-primary font-medium opacity-0 group-hover:opacity-100 transition-opacity">
          Click to edit →
        </div>
      </div>

      <div
        onClick={() => setActiveTab('promo')}
        className="bg-surface-elevated rounded-lg border border-border shadow-[0_0_20px_rgba(51,65,85,0.3)] p-6 cursor-pointer hover:shadow-[0_0_30px_rgba(51,65,85,0.5)] hover:border-primary/70 transition-all group"
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center">
            <div className="p-2 bg-background rounded-lg mr-3 border border-border">
              <Gift className="w-5 h-5 text-primary" />
            </div>
            <h3 className="text-base font-semibold text-on-surface">Promo Card</h3>
          </div>
          <span
            className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
              config.promoCard.active
                ? 'bg-primary/15 text-primary border border-primary/40'
                : 'bg-surface text-on-surface-variant border border-border'
            }`}
          >
            {config.promoCard.active ? 'Active' : 'Inactive'}
          </span>
        </div>
        <p className="text-sm text-on-surface-variant mb-1 font-medium">
          {stripHtml(config.promoCard.title) || 'No title set'}
        </p>
        <p className="text-sm text-on-surface-variant mb-3 line-clamp-2">
          {stripHtml(config.promoCard.description) || 'No description set'}
        </p>
        <div className="flex items-center text-xs text-on-surface-variant">
          <Calendar className="w-3.5 h-3.5 mr-1" />
          <span>
            {config.promoCard.startDate
              ? `${config.promoCard.startDate} → ${config.promoCard.endDate || '...'}`
              : 'No schedule set'}
          </span>
        </div>
        <div className="mt-3 text-xs text-primary font-medium opacity-0 group-hover:opacity-100 transition-opacity">
          Click to edit →
        </div>
      </div>
    </div>
  );
}
