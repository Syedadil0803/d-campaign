import { PromoCard } from '@/types/campaign';

/**
 * Sample wording for every template, in every trade the tool is sold to.
 *
 * Template Hub is where someone picks a LOOK, and the words on those cards are
 * only examples. But generic examples make the tool feel like it has never met
 * the person using it, and leave them staring at a card with no idea what a
 * good one says. A plumber who sees "Emergency Call-Out" has a shape to edit;
 * one who sees "Special Offer" has a blank page.
 *
 * Each entry is a template's occasion crossed with a trade — Christmas for a
 * garage is a winter check, for a restaurant a festive menu, for an accountant
 * a year-end review. The template keeps its own mood, emoji and type sizes; only
 * the trade changes.
 *
 * The markup is generated from each template's own copy rather than written out
 * here, so a headline can never lose the font-size span or bold that its design
 * depends on.
 */
export interface IndustryOption {
  id: string;
  label: string;
}

export const INDUSTRIES: IndustryOption[] = [
  { id: 'home-trades', label: 'Home & Local Trades' },
  { id: 'retail', label: 'Retail & E-commerce' },
  { id: 'professional', label: 'Professional Services' },
  { id: 'hospitality', label: 'Hospitality & Food' },
  { id: 'wellness', label: 'Health, Beauty & Wellness' },
  { id: 'automotive', label: 'Automotive & Garages' },
  { id: 'creative', label: 'Creative & Freelance' },
  { id: 'education', label: 'Classes & Kids\' Activities' },
  { id: 'property', label: 'Property & Venues' },
];

type Copy = Pick<PromoCard, 'title' | 'subtitle' | 'description' | 'buttonText' | 'timerText'>;

/** Keyed by template id, then industry id. */
const COPY: Record<string, Record<string, Copy>> = {
  'midnight-neon': {
    'home-trades': {
      title: '<strong>Emergency Call-Out</strong>',
      subtitle: '<span style="font-size: 1.125rem;"><strong>Out in 60 Minutes</strong></span> across the county',
      description: 'After-hours cover for leaks, outages and lockouts. One call and an engineer is on the way.',
      buttonText: 'Call an Engineer',
      timerText: 'Night rate ends in {timer}',
    },
    'retail': {
      title: '<strong>Midnight Flash Drop</strong>',
      subtitle: '<span style="font-size: 1.125rem;"><strong>Buy 1 Get 1</strong></span> on selected lines',
      description: 'Late-night pricing on the pieces people ask for most. Live until the small hours only.',
      buttonText: 'Shop the Drop',
      timerText: 'Flash ends in {timer}',
    },
    'professional': {
      title: '<strong>Out-of-Hours Advice</strong>',
      subtitle: '<span style="font-size: 1.125rem;"><strong>Same-Day Answers</strong></span> on urgent matters',
      description: 'For deadlines that will not wait. Speak to an adviser tonight and know where you stand.',
      buttonText: 'Request a Call',
      timerText: 'Line closes in {timer}',
    },
    'hospitality': {
      title: '<strong>Late Kitchen Tonight</strong>',
      subtitle: '<span style="font-size: 1.125rem;"><strong>Two for One</strong></span> on small plates',
      description: 'Doors open until late with the full menu running. Walk-ins welcome while tables last.',
      buttonText: 'Reserve a Table',
      timerText: 'Kitchen closes in {timer}',
    },
    'wellness': {
      title: '<strong>Late Openings Tonight</strong>',
      subtitle: '<span style="font-size: 1.125rem;"><strong>Evening Slots</strong></span> after work',
      description: 'Appointments running past six for anyone who cannot make the daytime. Book while free.',
      buttonText: 'Grab a Late Slot',
      timerText: 'Last slot in {timer}',
    },
    'automotive': {
      title: '<strong>Out-of-Hours Recovery</strong>',
      subtitle: '<span style="font-size: 1.125rem;"><strong>24 Hour Callout</strong></span> county-wide',
      description: 'Breakdown cover through the night, with recovery and a courtesy car where available.',
      buttonText: 'Call Recovery',
      timerText: 'Night cover ends in {timer}',
    },
    'creative': {
      title: '<strong>Last-Minute Booking</strong>',
      subtitle: '<span style="font-size: 1.125rem;"><strong>Rush Turnaround</strong></span> this week only',
      description: 'A gap has opened in the diary. Quick-turnaround work taken on at short notice.',
      buttonText: 'Claim the Slot',
      timerText: 'Slot goes in {timer}',
    },
    'education': {
      title: '<strong>Evening Classes</strong>',
      subtitle: '<span style="font-size: 1.125rem;"><strong>After-Work Sessions</strong></span> starting soon',
      description: 'Small evening groups for anyone learning around a job. A few places left this term.',
      buttonText: 'Join a Class',
      timerText: 'Enrolment ends in {timer}',
    },
    'property': {
      title: '<strong>Evening Viewings</strong>',
      subtitle: '<span style="font-size: 1.125rem;"><strong>After Six</strong></span> by appointment',
      description: 'Viewings arranged outside working hours, so you can see the place without taking leave.',
      buttonText: 'Book a Viewing',
      timerText: 'Diary closes in {timer}',
    },
  },
  'christmas-evergreen-gold': {
    'home-trades': {
      title: '<span style="font-size:0.75rem;">❄ THE</span> <strong style="font-size:1.6rem;">CHRISTMAS</strong> <span style="font-size:0.9rem;">Check</span>',
      subtitle: '<span style="font-size:1.3rem;"><strong>£30 OFF</strong></span> <span style="font-size:0.8rem;">+ free safety report</span>',
      description: 'Get the boiler and wiring checked before the family arrives. Engineers booking up fast.',
      buttonText: '🎁 Book Before Christmas',
      timerText: 'Engineer diary closes in {timer}',
    },
    'retail': {
      title: '<span style="font-size:0.75rem;">❄ THE</span> <strong style="font-size:1.6rem;">CHRISTMAS</strong> <span style="font-size:0.9rem;">Sale</span>',
      subtitle: '<span style="font-size:1.3rem;"><strong>Up to 50% OFF</strong></span> <span style="font-size:0.8rem;">+ free gift wrapping</span>',
      description: 'Everything you need for the tree, the table and the stockings, wrapped and ready to go.',
      buttonText: '🎁 Claim Holiday Deal',
      timerText: 'Last posting in {timer}',
    },
    'professional': {
      title: '<span style="font-size:0.75rem;">❄ THE</span> <strong style="font-size:1.6rem;">YEAR END</strong> <span style="font-size:0.9rem;">Review</span>',
      subtitle: '<span style="font-size:1.3rem;"><strong>Free Review</strong></span> <span style="font-size:0.8rem;">+ fixed-fee quote</span>',
      description: 'Close the books before the break. Bring your paperwork in and start January clear.',
      buttonText: '🎁 Book Year-End Review',
      timerText: 'Office closes in {timer}',
    },
    'hospitality': {
      title: '<span style="font-size:0.75rem;">❄ THE</span> <strong style="font-size:1.6rem;">CHRISTMAS</strong> <span style="font-size:0.9rem;">Menu</span>',
      subtitle: '<span style="font-size:1.3rem;"><strong>Three Courses</strong></span> <span style="font-size:0.8rem;">+ a drink on arrival</span>',
      description: 'Festive menu now taking bookings, for parties of any size. Private room available.',
      buttonText: '🎁 Book the Table',
      timerText: 'Party dates go in {timer}',
    },
    'wellness': {
      title: '<span style="font-size:0.75rem;">❄ THE</span> <strong style="font-size:1.6rem;">CHRISTMAS</strong> <span style="font-size:0.9rem;">Edit</span>',
      subtitle: '<span style="font-size:1.3rem;"><strong>Gift Vouchers</strong></span> <span style="font-size:0.8rem;">+ a free add-on</span>',
      description: 'Party-season appointments and gift vouchers that always fit. Late openings all December.',
      buttonText: '🎁 Buy a Voucher',
      timerText: 'December fills in {timer}',
    },
    'automotive': {
      title: '<span style="font-size:0.75rem;">❄ THE</span> <strong style="font-size:1.6rem;">WINTER</strong> <span style="font-size:0.9rem;">Check</span>',
      subtitle: '<span style="font-size:1.3rem;"><strong>Free Check</strong></span> <span style="font-size:0.8rem;">+ tyres from £45</span>',
      description: 'Battery, tyres and antifreeze checked before the cold sets in. Ten minutes, no booking.',
      buttonText: '🎁 Book Winter Check',
      timerText: 'Offer ends in {timer}',
    },
    'creative': {
      title: '<span style="font-size:0.75rem;">❄ THE</span> <strong style="font-size:1.6rem;">CHRISTMAS</strong> <span style="font-size:0.9rem;">Slots</span>',
      subtitle: '<span style="font-size:1.3rem;"><strong>Two Dates Left</strong></span> <span style="font-size:0.8rem;">before the new year</span>',
      description: 'Festive shoots and campaign work still possible if booked this week. Diary closing soon.',
      buttonText: '🎁 Check the Diary',
      timerText: 'Last dates go in {timer}',
    },
    'education': {
      title: '<span style="font-size:0.75rem;">❄ THE</span> <strong style="font-size:1.6rem;">HOLIDAY</strong> <span style="font-size:0.9rem;">Club</span>',
      subtitle: '<span style="font-size:1.3rem;"><strong>Full Week</strong></span> <span style="font-size:0.8rem;">+ sibling discount</span>',
      description: 'Holiday clubs running through the break, with qualified coaches and hot lunches daily.',
      buttonText: '🎁 Reserve a Place',
      timerText: 'Places go in {timer}',
    },
    'property': {
      title: '<span style="font-size:0.75rem;">❄ THE</span> <strong style="font-size:1.6rem;">CHRISTMAS</strong> <span style="font-size:0.9rem;">Party</span>',
      subtitle: '<span style="font-size:1.3rem;"><strong>Rooms From £250</strong></span> <span style="font-size:0.8rem;">+ decorations included</span>',
      description: 'Party dates still available for December, dressed and staffed. Deposit holds the date.',
      buttonText: '🎁 Hold My Date',
      timerText: 'December books up in {timer}',
    },
  },
  'luxury-gold': {
    'home-trades': {
      title: '<strong>Master Craftsman Service</strong> <span style="font-size:0.8rem;">VETTED TRADES</span>',
      subtitle: 'Time-Served <strong>Trades</strong> for work worth doing once',
      description: 'Heritage skills for restoration and finish work. Fully insured, referenced and guaranteed.',
      buttonText: 'Request a Quote',
      timerText: 'Consultation window closes in {timer}',
    },
    'retail': {
      title: '<strong>Royal Loom Collection</strong> <span style="font-size:0.8rem;">SIGNATURE EDIT</span>',
      subtitle: 'Exclusive <strong>Members Access</strong> to limited drops',
      description: 'Handmade statement pieces with heritage finishes. Priority pricing is live for members.',
      buttonText: 'Enter Private Sale',
      timerText: 'Private window closes in {timer}',
    },
    'professional': {
      title: '<strong>Private Client Service</strong> <span style="font-size:0.8rem;">BY REFERRAL</span>',
      subtitle: 'Direct <strong>Partner Access</strong> no account handlers',
      description: 'Discreet advice for complex affairs, handled by the partner who takes your first call.',
      buttonText: 'Arrange a Meeting',
      timerText: 'Introductions close in {timer}',
    },
    'hospitality': {
      title: '<strong>Chef\'s Table Evenings</strong> <span style="font-size:0.8rem;">TWELVE SEATS</span>',
      subtitle: 'An <strong>Invited Sitting</strong> once a month',
      description: 'Twelve seats, one menu, cooked in front of you. Wine pairing chosen for the evening.',
      buttonText: 'Request a Seat',
      timerText: 'Seats released in {timer}',
    },
    'wellness': {
      title: '<strong>Signature Treatments</strong> <span style="font-size:0.8rem;">PRIVATE SUITE</span>',
      subtitle: 'Exclusive <strong>Suite Access</strong> for the full afternoon',
      description: 'The room, the therapist and the afternoon are yours. Nothing is rushed or shared.',
      buttonText: 'Book the Suite',
      timerText: 'Suite is held for {timer}',
    },
    'automotive': {
      title: '<strong>Marque Specialist Care</strong> <span style="font-size:0.8rem;">FACTORY TRAINED</span>',
      subtitle: 'Factory <strong>Trained Technicians</strong> for prestige marques',
      description: 'Servicing and diagnostics by technicians trained on the marque. Collection arranged.',
      buttonText: 'Arrange Collection',
      timerText: 'Workshop books up in {timer}',
    },
    'creative': {
      title: '<strong>Signature Commission</strong> <span style="font-size:0.8rem;">FOUR A YEAR</span>',
      subtitle: 'Limited to <strong>Four Commissions</strong> each year',
      description: 'A full creative engagement from concept to delivery, with only four taken annually.',
      buttonText: 'Enquire About a Commission',
      timerText: 'Enquiries close in {timer}',
    },
    'education': {
      title: '<strong>One-to-One Tuition</strong> <span style="font-size:0.8rem;">BY ASSESSMENT</span>',
      subtitle: 'Places by <strong>Assessment Only</strong> six pupils a term',
      description: 'Individual tuition with a specialist, following an initial assessment. Six places a term.',
      buttonText: 'Request an Assessment',
      timerText: 'Assessment slots close in {timer}',
    },
    'property': {
      title: '<strong>Signature Venue Hire</strong> <span style="font-size:0.8rem;">EXCLUSIVE USE</span>',
      subtitle: 'Exclusive <strong>Whole-Venue Use</strong> for the full day',
      description: 'The house, the grounds and the team for a single day. One booking at a time, always.',
      buttonText: 'Request Availability',
      timerText: 'Dates released in {timer}',
    },
  },
  'newyear-champagne-confetti': {
    'home-trades': {
      title: '<span style="font-size:2rem;"><strong>2026</strong></span> <span style="font-size:0.8rem;">NEW YEAR, NEW BATHROOM</span>',
      subtitle: '<span style="font-size:0.85rem;">Book now for</span> <span style="font-size:1.35rem;"><strong>£500 OFF fitting</strong></span>',
      description: 'Start the year with the job you have been putting off. January fitting dates open now.',
      buttonText: 'Book a Survey 🥂',
      timerText: 'January dates go in {timer}',
    },
    'retail': {
      title: '<span style="font-size:2rem;"><strong>2026</strong></span> <span style="font-size:0.8rem;">NEW YEAR SALE</span>',
      subtitle: '<span style="font-size:0.85rem;">Pop into savings —</span> <span style="font-size:1.35rem;"><strong>up to 60% OFF</strong></span>',
      description: 'Everything from last season reduced to clear. New stock lands the moment it is gone.',
      buttonText: 'Toast to the Deal 🥂',
      timerText: 'Countdown to midnight: {timer}',
    },
    'professional': {
      title: '<span style="font-size:2rem;"><strong>2026</strong></span> <span style="font-size:0.8rem;">NEW YEAR, NEW BOOKS</span>',
      subtitle: '<span style="font-size:0.85rem;">Start clean with</span> <span style="font-size:1.35rem;"><strong>three months free</strong></span>',
      description: 'Move your bookkeeping across in January and the first quarter is on us. No tie-in.',
      buttonText: 'Start the Switch 🥂',
      timerText: 'Offer closes in {timer}',
    },
    'hospitality': {
      title: '<span style="font-size:2rem;"><strong>2026</strong></span> <span style="font-size:0.8rem;">NEW YEAR MENU</span>',
      subtitle: '<span style="font-size:0.85rem;">See it in with</span> <span style="font-size:1.35rem;"><strong>a five-course sitting</strong></span>',
      description: 'New Year sitting with a glass on arrival and a room that stays open past midnight.',
      buttonText: 'Book the Night 🥂',
      timerText: 'Countdown to midnight: {timer}',
    },
    'wellness': {
      title: '<span style="font-size:2rem;"><strong>2026</strong></span> <span style="font-size:0.8rem;">NEW YEAR, NEW ROUTINE</span>',
      subtitle: '<span style="font-size:0.85rem;">Begin with</span> <span style="font-size:1.35rem;"><strong>six sessions for four</strong></span>',
      description: 'Book a block in January and two sessions are free. Same therapist throughout.',
      buttonText: 'Start in January 🥂',
      timerText: 'Block pricing ends in {timer}',
    },
    'automotive': {
      title: '<span style="font-size:2rem;"><strong>2026</strong></span> <span style="font-size:0.8rem;">NEW YEAR SERVICE</span>',
      subtitle: '<span style="font-size:0.85rem;">Full service from</span> <span style="font-size:1.35rem;"><strong>£99 all in</strong></span>',
      description: 'Start the year with everything checked, topped up and stamped. Courtesy car included.',
      buttonText: 'Book It In 🥂',
      timerText: 'January slots go in {timer}',
    },
    'creative': {
      title: '<span style="font-size:2rem;"><strong>2026</strong></span> <span style="font-size:0.8rem;">NOW TAKING BOOKINGS</span>',
      subtitle: '<span style="font-size:0.85rem;">Diary opens with</span> <span style="font-size:1.35rem;"><strong>early-bird pricing</strong></span>',
      description: 'Next year is open. Book before the end of January and hold this year’s rates.',
      buttonText: 'Hold My Date 🥂',
      timerText: 'Early pricing ends in {timer}',
    },
    'education': {
      title: '<span style="font-size:2rem;"><strong>2026</strong></span> <span style="font-size:0.8rem;">SPRING TERM ENROLLING</span>',
      subtitle: '<span style="font-size:0.85rem;">Join with</span> <span style="font-size:1.35rem;"><strong>a free first session</strong></span>',
      description: 'Spring term places are open. Come to one session before deciding, at no cost.',
      buttonText: 'Reserve a Place 🥂',
      timerText: 'Term starts in {timer}',
    },
    'property': {
      title: '<span style="font-size:2rem;"><strong>2026</strong></span> <span style="font-size:0.8rem;">NEW YEAR, NEW ADDRESS</span>',
      subtitle: '<span style="font-size:0.85rem;">Move in with</span> <span style="font-size:1.35rem;"><strong>no admin fees</strong></span>',
      description: 'January listings are live and admin fees are waived on anything agreed this month.',
      buttonText: 'Browse Listings 🥂',
      timerText: 'Fee waiver ends in {timer}',
    },
  },
  'autumn-harvest': {
    'home-trades': {
      title: '<strong>Autumn Boiler Service</strong> <span style="font-size:0.8rem;">BEFORE THE COLD</span>',
      subtitle: '<span style="font-size:0.85rem;">Up to</span> <span style="font-size:1.35rem;"><strong>£40 OFF</strong></span> a full service',
      description: 'Get it looked at before the first cold snap, when every engineer in the county is booked.',
      buttonText: 'Book a Service',
      timerText: 'Autumn slots end in {timer}',
    },
    'retail': {
      title: '<strong>Autumn Harvest Sale</strong> <span style="font-size:0.8rem;">AUTUMN EDIT</span>',
      subtitle: '<span style="font-size:0.85rem;">Up to</span> <span style="font-size:1.35rem;"><strong>40% OFF</strong></span> autumn ranges',
      description: 'Warm tones, heavier fabrics and everything you need as the evenings start drawing in.',
      buttonText: 'Shop Autumn Edit',
      timerText: 'Harvest deal ends in {timer}',
    },
    'professional': {
      title: '<strong>Autumn Tax Review</strong> <span style="font-size:0.8rem;">BEFORE JANUARY</span>',
      subtitle: '<span style="font-size:0.85rem;">From</span> <span style="font-size:1.35rem;"><strong>£150</strong></span> fixed fee',
      description: 'Sort the return now rather than over Christmas. Fixed fee agreed before we start.',
      buttonText: 'Book a Review',
      timerText: 'Autumn pricing ends in {timer}',
    },
    'hospitality': {
      title: '<strong>Autumn Menu Is In</strong> <span style="font-size:0.8rem;">NEW SEASON</span>',
      subtitle: '<span style="font-size:0.85rem;">Two courses</span> <span style="font-size:1.35rem;"><strong>£22</strong></span> midweek',
      description: 'Game, root vegetables and something warming by the fire. Midweek sittings now open.',
      buttonText: 'Book a Table',
      timerText: 'Midweek offer ends in {timer}',
    },
    'wellness': {
      title: '<strong>Autumn Reset</strong> <span style="font-size:0.8rem;">NEW SEASON</span>',
      subtitle: '<span style="font-size:0.85rem;">Save</span> <span style="font-size:1.35rem;"><strong>25%</strong></span> on a course of four',
      description: 'Skin and body take a knock as the weather turns. A short course puts it right.',
      buttonText: 'Book a Course',
      timerText: 'Course pricing ends in {timer}',
    },
    'automotive': {
      title: '<strong>Autumn Safety Check</strong> <span style="font-size:0.8rem;">BEFORE THE COLD</span>',
      subtitle: '<span style="font-size:0.85rem;">Free</span> <span style="font-size:1.35rem;"><strong>22-Point Check</strong></span> no booking needed',
      description: 'Tyres, battery, lights and wipers checked before the dark evenings arrive. Ten minutes.',
      buttonText: 'Drop In Today',
      timerText: 'Free checks end in {timer}',
    },
    'creative': {
      title: '<strong>Autumn Campaign Slots</strong> <span style="font-size:0.8rem;">AUTUMN EDIT</span>',
      subtitle: '<span style="font-size:0.85rem;">Save</span> <span style="font-size:1.35rem;"><strong>15%</strong></span> on autumn shoots',
      description: 'Autumn light is the best of the year. Two shoot dates left before the clocks change.',
      buttonText: 'Check the Diary',
      timerText: 'Autumn dates go in {timer}',
    },
    'education': {
      title: '<strong>Autumn Term Places</strong> <span style="font-size:0.8rem;">NOW ENROLLING</span>',
      subtitle: '<span style="font-size:0.85rem;">Save</span> <span style="font-size:1.35rem;"><strong>10%</strong></span> on a full term',
      description: 'A few places left across the autumn timetable. Pay for the term and save on the block.',
      buttonText: 'Reserve a Place',
      timerText: 'Term starts in {timer}',
    },
    'property': {
      title: '<strong>Autumn Lettings</strong> <span style="font-size:0.8rem;">AVAILABLE NOW</span>',
      subtitle: '<span style="font-size:0.85rem;">From</span> <span style="font-size:1.35rem;"><strong>£850 pcm</strong></span> bills included',
      description: 'Properties available before the winter. Move-in dates through October and November.',
      buttonText: 'Browse Available',
      timerText: 'Listings refresh in {timer}',
    },
  },
  'summer-sunset-splash': {
    'home-trades': {
      title: '<strong>Summer Garden Refresh</strong> <span style="font-size:0.8rem;">OUTDOOR WORK</span>',
      subtitle: '<span style="font-size:1.4rem;"><strong>Garden Jobs Booked Now</strong></span> <span style="font-size:0.8rem;">decking, fencing, patios</span>',
      description: 'The dry weeks are the ones to use. Outdoor work booked in while the ground is firm.',
      buttonText: 'Get a Summer Quote 🌊',
      timerText: 'Summer diary closes in {timer}',
    },
    'retail': {
      title: '<strong>Summer Sunset Sale</strong> <span style="font-size:0.8rem;">SEASON EDIT</span>',
      subtitle: '<span style="font-size:1.4rem;"><strong>Buy 2 Get 1 Free</strong></span> <span style="font-size:0.8rem;">on all summer lines</span>',
      description: 'Lighter pieces in brighter shades, priced to move before the season turns. Stock is limited.',
      buttonText: 'Dive Into Savings 🌊',
      timerText: 'Heat ends in {timer}',
    },
    'professional': {
      title: '<strong>Quiet Season Rates</strong> <span style="font-size:0.8rem;">AUGUST ONLY</span>',
      subtitle: '<span style="font-size:1.4rem;"><strong>Quiet-Season Rates</strong></span> <span style="font-size:0.8rem;">through August</span>',
      description: 'August is our quietest month and the rates reflect it. Same team, same work, less waiting.',
      buttonText: 'Book While Quiet 🌊',
      timerText: 'Summer rates end in {timer}',
    },
    'hospitality': {
      title: '<strong>The Garden Is Open</strong> <span style="font-size:0.8rem;">ALL SUMMER</span>',
      subtitle: '<span style="font-size:1.4rem;"><strong>Garden Now Open</strong></span> <span style="font-size:0.8rem;">and the grill is on</span>',
      description: 'Long tables outside, cold drinks and the grill running from noon. No booking needed before six.',
      buttonText: 'Grab a Table 🌊',
      timerText: 'Garden closes in {timer}',
    },
    'wellness': {
      title: '<strong>Summer Ready in Four</strong> <span style="font-size:0.8rem;">FOUR WEEKS</span>',
      subtitle: '<span style="font-size:1.4rem;"><strong>Summer Ready in Four</strong></span> <span style="font-size:0.8rem;">sessions, not months</span>',
      description: 'A short, sensible plan before the holiday, with a therapist who will not oversell it.',
      buttonText: 'Start This Week 🌊',
      timerText: 'Summer offer ends in {timer}',
    },
    'automotive': {
      title: '<strong>Holiday Road Check</strong> <span style="font-size:0.8rem;">BEFORE YOU GO</span>',
      subtitle: '<span style="font-size:1.4rem;"><strong>Free Holiday Check</strong></span> <span style="font-size:0.8rem;">before you set off</span>',
      description: 'Tyres, coolant and air-con checked before the long drive. Booked in and out the same morning.',
      buttonText: 'Book Before You Go 🌊',
      timerText: 'Holiday checks end in {timer}',
    },
    'creative': {
      title: '<strong>Golden Hour Sessions</strong> <span style="font-size:0.8rem;">SUMMER DATES</span>',
      subtitle: '<span style="font-size:1.4rem;"><strong>Summer Dates Open</strong></span> <span style="font-size:0.8rem;">golden hour only</span>',
      description: 'Evening shoots through July and August, when the light does most of the work for us.',
      buttonText: 'Check Availability 🌊',
      timerText: 'Summer dates go in {timer}',
    },
    'education': {
      title: '<strong>Summer Camp Weeks</strong> <span style="font-size:0.8rem;">SCHOOL HOLIDAYS</span>',
      subtitle: '<span style="font-size:1.4rem;"><strong>Summer Camp Weeks</strong></span> <span style="font-size:0.8rem;">full days, hot lunch</span>',
      description: 'Week-long camps through the holidays with qualified coaches and everything provided.',
      buttonText: 'Book a Week 🌊',
      timerText: 'Camp places go in {timer}',
    },
    'property': {
      title: '<strong>Summer Party Dates</strong> <span style="font-size:0.8rem;">OUTDOOR VENUE</span>',
      subtitle: '<span style="font-size:1.4rem;"><strong>Summer Party Dates</strong></span> <span style="font-size:0.8rem;">marquee included</span>',
      description: 'Outdoor dates still open across July and August, with the marquee and staffing included.',
      buttonText: 'Check Dates 🌊',
      timerText: 'Summer dates go in {timer}',
    },
  },
  'professional-slate': {
    'home-trades': {
      title: '<strong>Commercial Property Maintenance</strong>',
      subtitle: '<span style="font-size:0.9rem;">Planned and reactive cover for managed buildings</span>',
      description: 'Scheduled maintenance and call-out cover for landlords and managing agents. One contact, one invoice.',
      buttonText: 'Request Terms',
      timerText: '{timer} left for contract pricing',
    },
    'retail': {
      title: '<strong>Trade & Wholesale Accounts</strong>',
      subtitle: '<span style="font-size:0.9rem;">Volume pricing for stockists and resellers</span>',
      description: 'Open a trade account for wholesale rates, priority stock allocation and thirty-day terms.',
      buttonText: 'Open an Account',
      timerText: '{timer} left for launch pricing',
    },
    'professional': {
      title: '<strong>Retained Advisory Service</strong>',
      subtitle: '<span style="font-size:0.9rem;">Designed for growing businesses and their boards</span>',
      description: 'Ongoing advice on a fixed monthly fee, so the questions get asked before they become problems.',
      buttonText: 'View Terms',
      timerText: '{timer} left for retainer pricing',
    },
    'hospitality': {
      title: '<strong>Corporate & Private Dining</strong>',
      subtitle: '<span style="font-size:0.9rem;">For boards, away days and client entertaining</span>',
      description: 'Private rooms, set menus and dedicated service for business bookings of eight and above.',
      buttonText: 'Request a Menu',
      timerText: '{timer} left for corporate rates',
    },
    'wellness': {
      title: '<strong>Workplace Wellbeing Programme</strong>',
      subtitle: '<span style="font-size:0.9rem;">On-site sessions for teams and their managers</span>',
      description: 'Regular on-site sessions delivered at your premises, with reporting for HR where required.',
      buttonText: 'View the Programme',
      timerText: '{timer} left for programme pricing',
    },
    'automotive': {
      title: '<strong>Fleet Servicing Contracts</strong>',
      subtitle: '<span style="font-size:0.9rem;">For vans, company cars and managed fleets</span>',
      description: 'Scheduled servicing, MOTs and repairs across your fleet, with one account and one invoice.',
      buttonText: 'Request Fleet Terms',
      timerText: '{timer} left for fleet pricing',
    },
    'creative': {
      title: '<strong>Retained Creative Partner</strong>',
      subtitle: '<span style="font-size:0.9rem;">For brands that need output every month</span>',
      description: 'A fixed monthly retainer covering design, copy and production, with agreed turnaround times.',
      buttonText: 'View Retainer Terms',
      timerText: '{timer} left for retainer pricing',
    },
    'education': {
      title: '<strong>Corporate Training Programmes</strong>',
      subtitle: '<span style="font-size:0.9rem;">Accredited courses delivered at your offices</span>',
      description: 'Accredited training delivered on site, scheduled around your shifts and reported for compliance.',
      buttonText: 'Request a Syllabus',
      timerText: '{timer} left for group pricing',
    },
    'property': {
      title: '<strong>Corporate Venue Partnership</strong>',
      subtitle: '<span style="font-size:0.9rem;">Preferred rates for regular business bookings</span>',
      description: 'Preferential rates and held dates for organisations booking meeting space through the year.',
      buttonText: 'Request Partner Rates',
      timerText: '{timer} left for partner pricing',
    },
  },
  'home-makeover-editorial': {
    'home-trades': {
      title: '<span style="font-size:0.75rem;">THE</span> <strong style="font-size:1.6rem;">REFIT</strong> <span style="font-size:0.75rem;">EVENT</span>',
      subtitle: 'One team, one price — <strong>start to finish</strong>. No subcontractors.',
      description: 'Kitchens and bathrooms taken from strip-out to snagging by the same team throughout.',
      buttonText: 'Start My Refit →',
      timerText: 'Fitting dates go in {timer}',
    },
    'retail': {
      title: '<span style="font-size:0.75rem;">THE</span> <strong style="font-size:1.6rem;">MAKEOVER</strong> <span style="font-size:0.75rem;">EVENT</span>',
      subtitle: 'Redesign every room — <strong>floor up</strong>. Curated looks, styled for you.',
      description: 'Our stylists picked the pieces that change a room in a single weekend. Shop the whole look.',
      buttonText: 'Start My Makeover →',
      timerText: 'Styling event ends in {timer}',
    },
    'professional': {
      title: '<span style="font-size:0.75rem;">THE</span> <strong style="font-size:1.6rem;">RESTRUCTURE</strong> <span style="font-size:0.75rem;">REVIEW</span>',
      subtitle: 'Rebuild the finances — <strong>ground up</strong>. One review, one plan.',
      description: 'A full look at structure, tax and reporting, ending with a plan you can actually follow.',
      buttonText: 'Book the Review →',
      timerText: 'Review slots go in {timer}',
    },
    'hospitality': {
      title: '<span style="font-size:0.75rem;">THE</span> <strong style="font-size:1.6rem;">NEW MENU</strong> <span style="font-size:0.75rem;">LAUNCH</span>',
      subtitle: 'Rewritten from — <strong>the ground up</strong>. Same kitchen, new everything.',
      description: 'Every dish reworked with new suppliers and a shorter, sharper list. Tasting nights first.',
      buttonText: 'Book a Tasting →',
      timerText: 'Tasting nights go in {timer}',
    },
    'wellness': {
      title: '<span style="font-size:0.75rem;">THE</span> <strong style="font-size:1.6rem;">TRANSFORM</strong> <span style="font-size:0.75rem;">PROGRAMME</span>',
      subtitle: 'Twelve weeks — <strong>start to finish</strong>. Measured, not guessed.',
      description: 'A structured twelve weeks with the same therapist, reviewed fortnightly against real numbers.',
      buttonText: 'Start the Programme →',
      timerText: 'Programme places go in {timer}',
    },
    'automotive': {
      title: '<span style="font-size:0.75rem;">THE</span> <strong style="font-size:1.6rem;">RESTORE</strong> <span style="font-size:0.75rem;">PROJECT</span>',
      subtitle: 'Body, paint, interior — <strong>the lot</strong>. Photographed at every stage.',
      description: 'Full restoration handled in one workshop, with progress photographed and shared weekly.',
      buttonText: 'Start My Project →',
      timerText: 'Bay bookings go in {timer}',
    },
    'creative': {
      title: '<span style="font-size:0.75rem;">THE</span> <strong style="font-size:1.6rem;">REBRAND</strong> <span style="font-size:0.75rem;">PACKAGE</span>',
      subtitle: 'Identity, site and print — <strong>in one go</strong>. Six weeks, fixed price.',
      description: 'Everything from logo to launch handled together, so nothing is left half-finished.',
      buttonText: 'Start the Rebrand →',
      timerText: 'Project slots go in {timer}',
    },
    'education': {
      title: '<span style="font-size:0.75rem;">THE</span> <strong style="font-size:1.6rem;">CATCH UP</strong> <span style="font-size:0.75rem;">PROGRAMME</span>',
      subtitle: 'Assessed, planned — <strong>then taught</strong>. Reported every fortnight.',
      description: 'An assessment, a plan and weekly sessions, with a written update to parents each fortnight.',
      buttonText: 'Book an Assessment →',
      timerText: 'Places go in {timer}',
    },
    'property': {
      title: '<span style="font-size:0.75rem;">THE</span> <strong style="font-size:1.6rem;">REFURBISH</strong> <span style="font-size:0.75rem;">SERVICE</span>',
      subtitle: 'Empty to let — <strong>in six weeks</strong>. Managed throughout.',
      description: 'Refurbishment, compliance and photography handled together so the place lets faster.',
      buttonText: 'Book a Walkthrough →',
      timerText: 'Project slots go in {timer}',
    },
  },
  'easter-pastel-egg': {
    'home-trades': {
      title: '<strong>Easter Break Repairs</strong> <span style="font-size:0.8rem;">LONG WEEKEND</span>',
      subtitle: '<span style="font-size:0.85rem;">Book over Easter for</span> <span style="font-size:1.4rem;"><strong>£50 OFF</strong></span> <span style="font-size:0.85rem;">+ a free callout</span>',
      description: 'The long weekend is the easiest time to have work done. Two teams available across the break.',
      buttonText: 'Book the Weekend 🥚',
      timerText: 'Easter slots go in {timer}',
    },
    'retail': {
      title: '<strong>Easter Sale</strong> <span style="font-size:0.8rem;">SPRING EDIT</span>',
      subtitle: '<span style="font-size:0.85rem;">Hop in for</span> <span style="font-size:1.4rem;"><strong>30% OFF</strong></span> <span style="font-size:0.85rem;">+ free delivery</span>',
      description: 'Spring stock reduced across the long weekend, with everything sent out the same day.',
      buttonText: 'Unwrap the Offer 🥚',
      timerText: 'Basket closes in {timer}',
    },
    'professional': {
      title: '<strong>Sorted Before Easter</strong> <span style="font-size:0.8rem;">NEW QUARTER</span>',
      subtitle: '<span style="font-size:0.85rem;">Book before Easter for</span> <span style="font-size:1.4rem;"><strong>Free Setup</strong></span> <span style="font-size:0.85rem;">+ first month free</span>',
      description: 'Get the paperwork moving before the break so the new quarter starts in order.',
      buttonText: 'Start Before Easter 🥚',
      timerText: 'Offer closes in {timer}',
    },
    'hospitality': {
      title: '<strong>Easter Sunday Lunch</strong> <span style="font-size:0.8rem;">FAMILY TABLES</span>',
      subtitle: '<span style="font-size:0.85rem;">Easter Sunday from</span> <span style="font-size:1.4rem;"><strong>£26</strong></span> <span style="font-size:0.85rem;">+ egg hunt for children</span>',
      description: 'Roast, pudding and an egg hunt in the garden. Family tables filling up fast.',
      buttonText: 'Book Easter Sunday 🥚',
      timerText: 'Tables go in {timer}',
    },
    'wellness': {
      title: '<strong>An Easter Treat</strong> <span style="font-size:0.8rem;">LONG WEEKEND</span>',
      subtitle: '<span style="font-size:0.85rem;">Easter treat —</span> <span style="font-size:1.4rem;"><strong>20% OFF</strong></span> <span style="font-size:0.85rem;">+ a free add-on</span>',
      description: 'A quiet hour to yourself over the long weekend, with an extra treatment on the house.',
      buttonText: 'Book a Treat 🥚',
      timerText: 'Weekend slots go in {timer}',
    },
    'automotive': {
      title: '<strong>Bank Holiday Check</strong> <span style="font-size:0.8rem;">BEFORE YOU DRIVE</span>',
      subtitle: '<span style="font-size:0.85rem;">Before you drive off —</span> <span style="font-size:1.4rem;"><strong>Free Check</strong></span> <span style="font-size:0.85rem;">+ £20 off a service</span>',
      description: 'A quick check before the bank holiday traffic. Tyres, oil and coolant, while you wait.',
      buttonText: 'Book Before You Go 🥚',
      timerText: 'Easter checks end in {timer}',
    },
    'creative': {
      title: '<strong>Blossom Season Shoots</strong> <span style="font-size:0.8rem;">EASTER DATES</span>',
      subtitle: '<span style="font-size:0.85rem;">Spring shoots from</span> <span style="font-size:1.4rem;"><strong>£250</strong></span> <span style="font-size:0.85rem;">+ ten edited images</span>',
      description: 'Bright, soft light and a garden full of blossom. Two weekend dates left over Easter.',
      buttonText: 'Book a Session 🥚',
      timerText: 'Easter dates go in {timer}',
    },
    'education': {
      title: '<strong>Easter Holiday Club</strong> <span style="font-size:0.8rem;">FULL WEEKS</span>',
      subtitle: '<span style="font-size:0.85rem;">Easter club —</span> <span style="font-size:1.4rem;"><strong>Full Week</strong></span> <span style="font-size:0.85rem;">+ sibling discount</span>',
      description: 'Holiday club through the Easter break, with coaches, lunch and everything provided.',
      buttonText: 'Book the Week 🥚',
      timerText: 'Places go in {timer}',
    },
    'property': {
      title: '<strong>Easter Open Viewings</strong> <span style="font-size:0.8rem;">ALL WEEKEND</span>',
      subtitle: '<span style="font-size:0.85rem;">Easter viewings —</span> <span style="font-size:1.4rem;"><strong>All Weekend</strong></span> <span style="font-size:0.85rem;">+ no admin fees</span>',
      description: 'Open viewings across the long weekend, with admin fees waived on anything agreed.',
      buttonText: 'Book a Viewing 🥚',
      timerText: 'Viewings close in {timer}',
    },
  },
  'spring-bloom': {
    'home-trades': {
      title: '<strong>Spring Garden Refresh</strong> <span style="font-size:0.8rem;">NEW SEASON</span>',
      subtitle: 'Fencing, <strong>decking and turf</strong> booked in now',
      description: 'Get the outside sorted before summer. Ground is workable and the diary is still open.',
      buttonText: 'Get a Spring Quote',
      timerText: 'Spring dates end in {timer}',
    },
    'retail': {
      title: '<strong>Spring Refresh</strong> <span style="font-size:0.8rem;">NEW SEASON</span>',
      subtitle: 'Bring <strong>fresh colours</strong> and lighter pieces home',
      description: 'Pastels, florals and lighter fabrics to brighten every corner as the season turns.',
      buttonText: 'Shop The Bloom Edit',
      timerText: 'Spring deal ends in {timer}',
    },
    'professional': {
      title: '<strong>New Tax Year Setup</strong> <span style="font-size:0.8rem;">APRIL START</span>',
      subtitle: 'Start the year with <strong>clean books</strong> and fixed monthly fees',
      description: 'Get the new tax year set up properly from April, with fees agreed before we begin.',
      buttonText: 'Book a Setup Call',
      timerText: 'April slots end in {timer}',
    },
    'hospitality': {
      title: '<strong>Spring Menu Is In</strong> <span style="font-size:0.8rem;">NEW SEASON</span>',
      subtitle: 'Lighter plates, <strong>longer evenings</strong> and the garden open',
      description: 'New season menu with the garden open again and tables outside from midday.',
      buttonText: 'Book a Table',
      timerText: 'Garden tables go in {timer}',
    },
    'wellness': {
      title: '<strong>Spring Reset</strong> <span style="font-size:0.8rem;">NEW SEASON</span>',
      subtitle: 'Book a <strong>course of four</strong> and save a fifth',
      description: 'Skin, sleep and energy all shift with the season. A short course helps them settle.',
      buttonText: 'Book a Course',
      timerText: 'Course pricing ends in {timer}',
    },
    'automotive': {
      title: '<strong>Spring Service Offer</strong> <span style="font-size:0.8rem;">NEW SEASON</span>',
      subtitle: 'Full service and <strong>free valet</strong> booked together',
      description: 'Winter is hard on a car. Service, check and a proper clean before the better weather.',
      buttonText: 'Book a Service',
      timerText: 'Spring offer ends in {timer}',
    },
    'creative': {
      title: '<strong>Spring Sessions Open</strong> <span style="font-size:0.8rem;">NEW SEASON</span>',
      subtitle: 'Blossom, <strong>golden light</strong> and long evenings',
      description: 'Spring is the best light of the year for outdoor work. Weekend dates going quickly.',
      buttonText: 'Check Availability',
      timerText: 'Spring dates go in {timer}',
    },
    'education': {
      title: '<strong>Summer Term Enrolling</strong> <span style="font-size:0.8rem;">NOW OPEN</span>',
      subtitle: 'Small groups, <strong>real progress</strong> and a free first session',
      description: 'Summer term places are open across the timetable. Come to one session before deciding.',
      buttonText: 'Reserve a Place',
      timerText: 'Term starts in {timer}',
    },
    'property': {
      title: '<strong>Spring Viewings</strong> <span style="font-size:0.8rem;">NOW OPEN</span>',
      subtitle: 'See it <strong>at its best</strong> with the garden in bloom',
      description: 'Spring is when these places show best. Weekend viewings now open across the portfolio.',
      buttonText: 'Arrange a Viewing',
      timerText: 'Weekend slots go in {timer}',
    },
  },
  'all-features': {
    'home-trades': {
      title: '<strong>Weekend Booking Window</strong> <span style="font-size: 0.8rem;">LIMITED SLOTS</span>',
      subtitle: '<span style="font-size: 0.85rem;">Flat</span> <span style="font-size: 1.35rem;"><strong>15% OFF</strong></span> + free callout',
      description: 'Weekend work at weekday prices. Quote code <strong>WEEKEND15</strong> when you call.',
      buttonText: 'Reveal My Offer',
      timerText: 'Offer ends in {timer}',
    },
    'retail': {
      title: '<strong>Weekend Festival</strong> <span style="font-size: 0.8rem;">LIMITED DROP</span>',
      subtitle: '<span style="font-size: 0.85rem;">Flat</span> <span style="font-size: 1.35rem;"><strong>35% OFF</strong></span> + free delivery',
      description: 'A full weekend of reductions across the range. Use <strong>COZY35</strong> before it closes.',
      buttonText: 'Reveal My Offer',
      timerText: 'Offer ends in {timer}',
    },
    'professional': {
      title: '<strong>Free Consultation Week</strong> <span style="font-size: 0.8rem;">LIMITED SLOTS</span>',
      subtitle: '<span style="font-size: 0.85rem;">Flat</span> <span style="font-size: 1.35rem;"><strong>£0</strong></span> for the first hour',
      description: 'One free hour with an adviser, no obligation. Quote <strong>FIRSTHOUR</strong> to book.',
      buttonText: 'Reveal My Offer',
      timerText: 'Offer ends in {timer}',
    },
    'hospitality': {
      title: '<strong>Weekend Set Menu</strong> <span style="font-size: 0.8rem;">LIMITED COVERS</span>',
      subtitle: '<span style="font-size: 0.85rem;">Flat</span> <span style="font-size: 1.35rem;"><strong>£25</strong></span> for three courses',
      description: 'Three courses at one price, Friday to Sunday. Mention <strong>WEEKEND25</strong> when booking.',
      buttonText: 'Reveal My Offer',
      timerText: 'Offer ends in {timer}',
    },
    'wellness': {
      title: '<strong>Weekend Treatment Event</strong> <span style="font-size: 0.8rem;">LIMITED SLOTS</span>',
      subtitle: '<span style="font-size: 0.85rem;">Flat</span> <span style="font-size: 1.35rem;"><strong>30% OFF</strong></span> + a free add-on',
      description: 'Two days of reduced pricing on every treatment. Quote <strong>RESET30</strong> to book.',
      buttonText: 'Reveal My Offer',
      timerText: 'Offer ends in {timer}',
    },
    'automotive': {
      title: '<strong>Weekend Service Event</strong> <span style="font-size: 0.8rem;">LIMITED BAYS</span>',
      subtitle: '<span style="font-size: 0.85rem;">Flat</span> <span style="font-size: 1.35rem;"><strong>£89</strong></span> + free valet',
      description: 'Full service at one price across the weekend. Quote <strong>SERVICE89</strong> to book a bay.',
      buttonText: 'Reveal My Offer',
      timerText: 'Offer ends in {timer}',
    },
    'creative': {
      title: '<strong>Mini Session Weekend</strong> <span style="font-size: 0.8rem;">LIMITED SLOTS</span>',
      subtitle: '<span style="font-size: 0.85rem;">Flat</span> <span style="font-size: 1.35rem;"><strong>£150</strong></span> + five edited images',
      description: 'Twenty-minute sessions across one weekend only. Quote <strong>MINI150</strong> to book.',
      buttonText: 'Reveal My Offer',
      timerText: 'Offer ends in {timer}',
    },
    'education': {
      title: '<strong>Open Weekend</strong> <span style="font-size: 0.8rem;">LIMITED PLACES</span>',
      subtitle: '<span style="font-size: 0.85rem;">Flat</span> <span style="font-size: 1.35rem;"><strong>£0</strong></span> for a taster session',
      description: 'Come and try any class free across the weekend. Quote <strong>TASTER</strong> to reserve.',
      buttonText: 'Reveal My Offer',
      timerText: 'Offer ends in {timer}',
    },
    'property': {
      title: '<strong>Open House Weekend</strong> <span style="font-size: 0.8rem;">LIMITED VIEWINGS</span>',
      subtitle: '<span style="font-size: 0.85rem;">Flat</span> <span style="font-size: 1.35rem;"><strong>£0 fees</strong></span> + same-day decisions',
      description: 'Open viewings all weekend with fees waived. Quote <strong>OPENHOUSE</strong> on arrival.',
      buttonText: 'Reveal My Offer',
      timerText: 'Offer ends in {timer}',
    },
  },
  'earthy-cozy': {
    'home-trades': {
      title: '<strong>Warm Home Week</strong> <span style="font-size:0.8rem;">INSULATION</span>',
      subtitle: 'Draughts, lofts and lagging, sorted in a day',
      description: 'Small jobs that make a house noticeably warmer, done in a single visit and priced upfront.',
      buttonText: 'Book a Warm-Up',
      timerText: 'Warm home week ends in {timer}',
    },
    'retail': {
      title: '<strong>Cozy Home Week</strong> <span style="font-size:0.8rem;">CALM LIVING</span>',
      subtitle: 'Natural tones, soft textures, and calm spaces',
      description: 'Warm materials and quiet colours, chosen to make a room feel settled rather than styled.',
      buttonText: 'Build My Cozy Space',
      timerText: 'Cozy week ends in {timer}',
    },
    'professional': {
      title: '<strong>Quiet Quarter Offer</strong> <span style="font-size:0.8rem;">NO RUSH</span>',
      subtitle: 'Unhurried advice, taken at a sensible pace',
      description: 'Our quietest months, which means longer meetings and answers that are not squeezed in.',
      buttonText: 'Book an Unhurried Hour',
      timerText: 'Quiet quarter ends in {timer}',
    },
    'hospitality': {
      title: '<strong>Fireside Suppers</strong> <span style="font-size:0.8rem;">SLOW FOOD</span>',
      subtitle: 'Long tables, slow cooking, no rush to leave',
      description: 'Braises, bread and a fire lit from four. Tables held for the whole evening, not turned.',
      buttonText: 'Book by the Fire',
      timerText: 'Fireside tables go in {timer}',
    },
    'wellness': {
      title: '<strong>Slow Treatment Week</strong> <span style="font-size:0.8rem;">UNHURRIED</span>',
      subtitle: 'Ninety minutes, no clock-watching, no upsell',
      description: 'Longer appointments at the usual price, because rushing is what makes treatments useless.',
      buttonText: 'Book Ninety Minutes',
      timerText: 'Slow week ends in {timer}',
    },
    'automotive': {
      title: '<strong>Winter Comfort Check</strong> <span style="font-size:0.8rem;">COLD MORNINGS</span>',
      subtitle: 'Heating, battery and screenwash, all checked',
      description: 'The things that matter on a cold morning, checked properly while you have a coffee.',
      buttonText: 'Book a Comfort Check',
      timerText: 'Winter checks end in {timer}',
    },
    'creative': {
      title: '<strong>Slow Craft Sessions</strong> <span style="font-size:0.8rem;">NO RUSH</span>',
      subtitle: 'Unhurried shoots, shot on film where you like',
      description: 'Half-day sessions with time to get it right, rather than an hour and a shot list.',
      buttonText: 'Book a Half Day',
      timerText: 'Slow sessions end in {timer}',
    },
    'education': {
      title: '<strong>Small Group Term</strong> <span style="font-size:0.8rem;">SIX PER CLASS</span>',
      subtitle: 'Six pupils a class, so nobody gets lost',
      description: 'Deliberately small groups where every child is heard, taught by one consistent coach.',
      buttonText: 'Reserve a Place',
      timerText: 'Small group places go in {timer}',
    },
    'property': {
      title: '<strong>Quiet Retreat Hire</strong> <span style="font-size:0.8rem;">NO NEIGHBOURS</span>',
      subtitle: 'Space, silence, and nobody else on site',
      description: 'Somewhere genuinely quiet for a retreat or a small gathering, with exclusive use throughout.',
      buttonText: 'Check Quiet Dates',
      timerText: 'Quiet dates go in {timer}',
    },
  },};

/**
 * A template's look, wearing a trade's words.
 *
 * Only the five text fields move. Style, width, button width, schedule and
 * every toggle stay as the template defines them, which is what stops choosing
 * a trade from quietly restyling the card.
 */
export function withIndustryCopy(
  template: PromoCard,
  templateId: string,
  industryId: string | null,
): PromoCard {
  if (!industryId) return template;
  const copy = COPY[templateId]?.[industryId];
  if (!copy) return template;
  return { ...template, ...copy };
}
