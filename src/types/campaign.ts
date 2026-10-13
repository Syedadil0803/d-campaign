import { FIRST_BLANK_LOOK } from '@/lib/promo/blankLooks';
import type { GradientStyle, PromoStyle } from '@/types/promoStyle';

export type { GradientStyle } from '@/types/promoStyle';

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

/**
 * A message with text styling.
 */
interface Message {
  id: string;
  content: string;
  styles: {
    bold?: boolean;
    italic?: boolean;
    color?: string;
    size?: 'sm' | 'md' | 'lg';
  };
  createdAt: string;
}

/**
 * The promo card's five styleable text fields.
 *
 * Shared rather than private to the editor: the panel, the preview and the
 * style popup all name fields, and three copies of the same union drift.
 */
export type PromoField =
  | 'title'
  | 'subtitle'
  | 'description'
  | 'timer'
  | 'button';

/**
 * The Call To Action fields, shared by every widget that carries a button.
 *
 * Pulled out of PromoCard so the Video Story reuses the same definition rather
 * than a copy that drifts. PromoCard extends this, so its shape is unchanged.
 */
export interface CampaignCta {
  buttonText: string;
  buttonUrl: string;
  buttonFullWidth?: boolean;
  ctaType?: 'whatsapp' | 'link' | 'text';
  whatsappNumber?: string;
  whatsappCountryCode?: string;
  showButton: boolean;
}

/** When a widget runs, and its countdown — shared for the same reason. */
export interface CampaignSchedule {
  startDate: string;
  endDate: string | null;
  /**
   * How the campaign is scheduled.
   *
   * 'openEnded' runs from startDate until someone stops it, so it carries no
   * end date and no countdown — a countdown needs something to count towards.
   *
   * Absent means 'range', which is every card made before this existed. An
   * empty endDate is NOT open-ended: that is a range campaign nobody finished
   * scheduling, and Publish still refuses it.
   */
  scheduleMode?: 'range' | 'openEnded';
  showTimer: boolean;
  timerText?: string;
}

export interface PromoCard extends CampaignCta, CampaignSchedule {
  active: boolean;
  title: string;
  subtitle: string;
  description: string;
  cardWidth?: number;
  stoppedByUser?: boolean;
  /** Full Lexical editor state (JSON) for the timer — carries per-character
   *  text styling AND the chip's per-cell styling, which the plain
   *  `timerText` string can't express. Source of truth for the editor +
   *  read-only preview render. */
  timerStateJson?: string;
  style: PromoStyle;
}

/**
 * The second widget: a short looping clip with its own CTA and schedule.
 *
 * A sibling of promoCard rather than a mode of it, so both can be live at once
 * (see docs/video-story-architecture.md). Optional on CampaignConfig, so every
 * config saved before it existed still parses; migrateConfig fills the default.
 */
export interface VideoStory extends CampaignCta, CampaignSchedule {
  active: boolean;
  stoppedByUser?: boolean;
  /** Stored address of the clip, once uploads exist. Empty means no clip. */
  videoUrl: string;
  position: 'bottom-left' | 'bottom-right';
  /** The countdown is plain text over the video, so it has a colour, no background. */
  timerTextColor: string;
  buttonStyle: PromoStyle['buttonStyle'];
}

/**
 * Which widget the Campaigns tab is editing. Lives here rather than in the
 * Video Story context because the page reads it too: the header's Publish and
 * the on-air chip act on whichever widget is open.
 */
export type CampaignKind = 'card' | 'video';

/** How the Broadcasts bar moves its messages. */
export type BarMotion = 'scroll' | 'slide' | 'rollup' | 'fade';

export interface CampaignConfig {
  version: string;
  lastUpdated: string;
  announcementBar: {
    active: boolean;
    loop?: boolean;
    /** Marquee speed in pixels per second (0 = paused). Absent means the default pace. */
    speed?: number;
    /**
     * How messages move. 'scroll' is the marquee; the other three show one
     * message at a time in the centre — 'slide' comes in from the right,
     * 'rollup' rises from below, 'fade' blinks to the next. For those three,
     * speed sets how long each message stays. Absent means 'scroll'.
     */
    motion?: BarMotion;
    announcements: Announcement[];
    /**
     * The one message staged but not yet published. Absent or null means the
     * editor is free. It rides along in the draft config, so a staged message
     * reaches the cloud with the next draft save and is found again on any
     * device. Optional, so configs written before this existed still parse.
     */
    staged?: Announcement | null;
    /**
     * Which published message the staged one replaces, or null when it is a
     * new message. Editing a live message goes through the same stage-then-
     * publish pipeline as writing a new one, so the list only ever changes on
     * Publish — this is how Publish knows whether to replace or append.
     */
    stagedIndex?: number | null;
    startDate: string;
    endDate: string;
    style: {
      background: GradientStyle;
      textColor: string;
    };
    activeThemeId?: string | null;
  };
  promoCard: PromoCard;
  videoStory?: VideoStory;
  messages?: Message[];
}

/**
 * The blank Video Story.
 *
 * Bottom-left because the card's blank look sits bottom-right — the two start
 * in opposite corners, which is where placeWidgets puts them anyway once both
 * are live. Off, with no clip, countdown or button: the same "no decisions made
 * yet" rule as the blank promo card below.
 */
export const defaultVideoStory: VideoStory = {
  active: false,
  videoUrl: '',
  position: 'bottom-left',
  buttonText: '',
  buttonUrl: '',
  ctaType: 'whatsapp',
  whatsappNumber: '',
  showButton: false,
  startDate: '',
  endDate: '',
  scheduleMode: 'range',
  showTimer: false,
  timerTextColor: '#ffffff',
  // The card's blank button, so a new widget's button matches the card's.
  buttonStyle: structuredClone(FIRST_BLANK_LOOK.buttonStyle),
};

export const defaultConfig: CampaignConfig = {
  version: '1.0',
  // Keep deterministic for SSR/CSR hydration; API load will set real value.
  lastUpdated: '',
  announcementBar: {
    active: false,
    loop: true,
    speed: 60,
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
  videoStory: structuredClone(defaultVideoStory),
  messages: [],
};
