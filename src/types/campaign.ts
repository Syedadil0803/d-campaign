export interface GradientStyle {
  type: 'solid' | 'linear' | 'radial';
  startColor: string;
  endColor: string;
  direction?: string;
  midpoint?: number;
}

export interface Announcement {
  text: string;
  url?: string;
  richText?: boolean;
  startDate?: string;
  endDate?: string;
  openInNewTab?: boolean;
}

export interface PromoCard {
  active: boolean;
  title: string;
  subtitle: string;
  description: string;
  buttonText: string;
  buttonUrl: string;
  buttonFullWidth?: boolean;
  startDate: string;
  endDate: string;
  showTimer: boolean;
  showButton: boolean;
  timerText?: string;
  style: {
    position: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
    background: GradientStyle;
    textColor: string;
    titleStyle: {
      background: GradientStyle;
      textColor: string;
      textAlign?: 'left' | 'center' | 'right';
    };
    subheadingStyle: {
      background: GradientStyle;
      textColor: string;
      textAlign?: 'left' | 'center' | 'right';
    };
    descriptionStyle: {
      background: GradientStyle;
      textColor: string;
      textAlign?: 'left' | 'center' | 'right';
    };
    dateStyle: {
      background: GradientStyle;
      textColor: string;
      textAlign?: 'left' | 'center' | 'right';
      fontSize?: number;
    };
    buttonStyle: {
      background: GradientStyle;
      textColor: string;
      textAlign?: 'left' | 'center' | 'right';
    };
  };
}

export interface CampaignConfig {
  version: string;
  lastUpdated: string;
  announcementBar: {
    active: boolean;
    loop?: boolean;
    announcements: Announcement[];
    startDate: string;
    endDate: string;
    style: {
      background: GradientStyle;
      textColor: string;
    };
  };
  promoCard: PromoCard;
}

export const defaultConfig: CampaignConfig = {
  version: '1.0',
  // Keep deterministic for SSR/CSR hydration; API load will set real value.
  lastUpdated: '',
  announcementBar: {
    active: false,
    loop: true,
    announcements: [
      { text: '🎉 Winter Sale is fully live! Keep shopping.' },
      { text: 'Get 5% off on orders above ₹999 and 10% off on orders above ₹1999' },
      { text: 'Win Loyalty Points & Encash discounts on each order' }
    ],
    startDate: '',
    endDate: '',
    style: {
      background: {
        type: 'solid',
        startColor: '#dc2626',
        endColor: '#dc2626',
        direction: 'to right',
        midpoint: 50,
      },
      textColor: '#ffffff',
    },
  },
  promoCard: {
    active: false,
    title: '',
    subtitle: '',
    description: '',
    buttonText: 'Shop Now',
    buttonUrl: '',
    buttonFullWidth: true,
    startDate: '',
    endDate: '',
    showTimer: false,
    showButton: false,
    timerText: 'Ends in {hh}:{mm}:{ss}',
    style: {
      position: 'bottom-right',
      background: {
        type: 'linear',
        startColor: '#ffffff',
        endColor: '#ffffff',
        direction: 'to right',
        midpoint: 50,
      },
      textColor: '#111827',
      titleStyle: {
        background: {
          type: 'solid',
          startColor: '#111827',
          endColor: '#111827',
          midpoint: 50,
        },
        textColor: '#ffffff',
        textAlign: 'center',
      },
      subheadingStyle: {
        background: {
          type: 'solid',
          startColor: '#374151',
          endColor: '#374151',
          midpoint: 50,
        },
        textColor: '#ffffff',
        textAlign: 'center',
      },
      descriptionStyle: {
        background: {
          type: 'solid',
          startColor: '#374151',
          endColor: '#374151',
          midpoint: 50,
        },
        textColor: '#ffffff',
        textAlign: 'left',
      },
      dateStyle: {
        background: {
          type: 'solid',
          startColor: '#6b7280',
          endColor: '#6b7280',
          midpoint: 50,
        },
        textColor: '#ffffff',
        textAlign: 'center',
      },
      buttonStyle: {
        background: {
          type: 'solid',
          startColor: '#6366f1',
          endColor: '#6366f1',
          midpoint: 50,
        },
        textColor: '#ffffff',
        textAlign: 'center',
      },
    },
  },
};
