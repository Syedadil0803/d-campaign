import { FIRST_BLANK_LOOK } from '@/lib/blankLooks';

export interface GradientStyle {
  type: 'solid' | 'linear' | 'radial';
  startColor: string;
  endColor: string;
  direction?: string;
  midpoint?: number;
}

export interface Announcement {
  text: string;
  /**
   * Where the message points. For a WhatsApp CTA this holds the derived
   * wa.me link, so the website keeps reading one field no matter which kind
   * of destination was chosen.
   */
  url?: string;
  richText?: boolean;
  startDate?: string;
  endDate?: string;
  openInNewTab?: boolean;
  /** Which kind of destination was authored. Absent means a plain link. */
  ctaType?: 'link' | 'whatsapp';
  /** Kept alongside the derived url so the editor can repopulate the picker. */
  whatsappNumber?: string;
  whatsappCountryCode?: string;
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
    // Blank, like every other copy field. A pre-filled "Shop Now" made a
    // brand-new card render a CTA nobody had written, and made the card count
    // as "not empty" — so Clear Canvas offered to clear a canvas that looked
    // blank. The preview hides the button while this is empty.
    buttonText: '',
    buttonUrl: '',
    ctaType: 'whatsapp',
    whatsappNumber: '',
    buttonFullWidth: true,
    startDate: '',
    endDate: '',
    /**
     * Both off, because this is the blank card.
     *
     * Every path that resets the editor — Clear, create new, and the return to
     * a fresh canvas after saving a draft or publishing — rebuilds from here.
     * Shipping them on meant each of those handed back a card with a countdown
     * already running and a button already placed: two decisions made before
     * the user had seen anything. Turning either on is one click.
     */
    showTimer: false,
    showButton: false,
    timerText: 'Ends in {timer}',
    /**
     * The skeleton every card starts from — palette one, taken from the list.
     *
     * This used to be written out by hand alongside src/lib/blankLooks.ts, and
     * the two drifted twice within a day: first two text colours, then a
     * missing `direction` key on the field backgrounds. Neither was visible on
     * screen, because both cards looked identical — but isBlankLook compares
     * whole style objects, so a single absent key meant a freshly loaded card
     * matched no palette. The skeleton lost its countdown and button outlines,
     * and Clear stayed enabled on an empty canvas.
     *
     * One definition now. To change these colours, edit blankLooks.ts.
     */
    style: JSON.parse(JSON.stringify(FIRST_BLANK_LOOK)) as PromoCard['style'],
  },
};
