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
  ctaType?: 'whatsapp' | 'link' | 'text';
  whatsappNumber?: string;
  whatsappCountryCode?: string;
  cardWidth?: number;
  startDate: string;
  endDate: string;
  showTimer: boolean;
  showButton: boolean;
  stoppedByUser?: boolean;
  timerText?: string;
  /** Full Lexical editor state (JSON) for the timer — carries per-character
   *  text styling AND the chip's per-cell styling, which the plain
   *  `timerText` string can't express. Source of truth for the editor +
   *  read-only preview render. */
  timerStateJson?: string;
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
        // Warm cream — a soft ivory bar with gentle warmth and subtle presence,
        // readable on both light and dark surroundings.
        startColor: '#fdf6e3',
        endColor: '#fdf6e3',
        direction: 'to right',
        midpoint: 50,
      },
      // Warm amber-brown text, readable on the cream background.
      textColor: '#7c5e10',
    },
  },
  promoCard: {
    active: false,
    title: '',
    subtitle: '',
    description: '',
    buttonText: 'Shop Now',
    buttonUrl: '',
    ctaType: 'whatsapp',
    whatsappNumber: '',
    buttonFullWidth: true,
    startDate: '',
    endDate: '',
    showTimer: true,
    showButton: true,
    timerText: 'Ends in {timer}',
    style: {
      position: 'bottom-right',
      background: {
        type: 'linear',
        startColor: '#2c8da0',
        endColor: '#4d9a52',
        direction: 'to right',
        midpoint: 50,
      },
      textColor: '#ffffff',
      titleStyle: {
        background: {
          type: 'solid',
          startColor: '#1f7a8c',
          endColor: '#1f7a8c',
          midpoint: 50,
        },
        textColor: '#ffffff',
        textAlign: 'center',
      },
      subheadingStyle: {
        background: {
          type: 'solid',
          startColor: '#2c8da0',
          endColor: '#2c8da0',
          midpoint: 50,
        },
        textColor: '#ffffff',
        textAlign: 'center',
      },
      descriptionStyle: {
        background: {
          type: 'solid',
          startColor: '#4d9a52',
          endColor: '#4d9a52',
          midpoint: 50,
        },
        textColor: '#ffffff',
        textAlign: 'left',
      },
      dateStyle: {
        background: {
          type: 'solid',
          startColor: '#aed136',
          endColor: '#aed136',
          midpoint: 50,
        },
        textColor: '#1f2937',
        textAlign: 'center',
      },
      buttonStyle: {
        background: {
          type: 'solid',
          startColor: '#3f8f47',
          endColor: '#3f8f47',
          midpoint: 50,
        },
        textColor: '#ffffff',
        textAlign: 'center',
      },
    },
  },
};
