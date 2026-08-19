/**
 * The WhatsApp country picker's data and flag rendering.
 *
 * Extracted from PromoSection so the announcement bar can offer the same
 * picker. `npm run flags` (scripts/copy-flags.mjs) parses COUNTRY_CODES out of
 * THIS file to decide which SVGs to ship — keep the `flag: '..'` shape.
 *
 * `flag` is an emoji, which macOS and iOS draw as a flag and Windows draws as
 * two letters or as boxes — its emoji font ships no flag glyphs at all, and no
 * CSS can conjure them. So the picker doesn't rely on the font: it renders an
 * SVG we serve ourselves from /public/flags, named by the ISO code derived
 * from the emoji. Same flag everywhere, no CDN, and it still works offline.
 */
/**
 * "🇬🇧" → "gb", the name of its file in /public/flags.
 *
 * A flag emoji is two regional-indicator code points, each 0x1F1E6 above its
 * letter. Deriving the code keeps one source of truth — the table doesn't need
 * a second column that can drift out of sync with the flag.
 */
export function isoFromFlag(flag: string): string {
  const points = Array.from(flag).map((ch) => ch.codePointAt(0) ?? 0);
  if (points.length !== 2) return '';
  return points
    .map((cp) => String.fromCharCode(cp - 0x1f1e6 + 65))
    .join('')
    .toLowerCase();
}

/** The picker's flag: an image, so it looks the same on Windows as on a Mac. */
export function CountryFlag({ flag, name }: { flag: string; name: string }) {
  const code = isoFromFlag(flag);
  if (!code) return null;
  return (
    <img
      src={`/flags/${code}.svg`}
      alt={name}
      width={20}
      height={15}
      loading="lazy"
      className="h-[15px] w-5 shrink-0 rounded-[2px] object-cover ring-1 ring-black/10"
    />
  );
}

/**
 * `aliases` is search-only — never shown. Some rows are abbreviated or known
 * by another name locally, so typing the obvious thing found nothing: UAE is
 * not "Emirates", and nobody searches for "United States" when "USA" is what
 * they type.
 */
export const COUNTRY_CODES: {
  code: string;
  flag: string;
  name: string;
  aliases?: string;
}[] = [
  { code: '+1', flag: '🇺🇸', name: 'United States', aliases: 'USA US America' },
  { code: '+7', flag: '🇷🇺', name: 'Russia' },
  { code: '+20', flag: '🇪🇬', name: 'Egypt' },
  { code: '+27', flag: '🇿🇦', name: 'South Africa' },
  { code: '+30', flag: '🇬🇷', name: 'Greece' },
  { code: '+31', flag: '🇳🇱', name: 'Netherlands', aliases: 'Holland Dutch' },
  { code: '+32', flag: '🇧🇪', name: 'Belgium' },
  { code: '+33', flag: '🇫🇷', name: 'France' },
  { code: '+34', flag: '🇪🇸', name: 'Spain' },
  { code: '+36', flag: '🇭🇺', name: 'Hungary' },
  { code: '+39', flag: '🇮🇹', name: 'Italy' },
  { code: '+40', flag: '🇷🇴', name: 'Romania' },
  { code: '+41', flag: '🇨🇭', name: 'Switzerland' },
  { code: '+43', flag: '🇦🇹', name: 'Austria' },
  { code: '+44', flag: '🇬🇧', name: 'United Kingdom', aliases: 'UK GB Britain England Scotland Wales' },
  { code: '+45', flag: '🇩🇰', name: 'Denmark' },
  { code: '+46', flag: '🇸🇪', name: 'Sweden' },
  { code: '+47', flag: '🇳🇴', name: 'Norway' },
  { code: '+48', flag: '🇵🇱', name: 'Poland' },
  { code: '+49', flag: '🇩🇪', name: 'Germany' },
  { code: '+51', flag: '🇵🇪', name: 'Peru' },
  { code: '+52', flag: '🇲🇽', name: 'Mexico' },
  { code: '+54', flag: '🇦🇷', name: 'Argentina' },
  { code: '+55', flag: '🇧🇷', name: 'Brazil' },
  { code: '+56', flag: '🇨🇱', name: 'Chile' },
  { code: '+57', flag: '🇨🇴', name: 'Colombia' },
  { code: '+58', flag: '🇻🇪', name: 'Venezuela' },
  { code: '+60', flag: '🇲🇾', name: 'Malaysia' },
  { code: '+61', flag: '🇦🇺', name: 'Australia' },
  { code: '+62', flag: '🇮🇩', name: 'Indonesia' },
  { code: '+63', flag: '🇵🇭', name: 'Philippines' },
  { code: '+64', flag: '🇳🇿', name: 'New Zealand' },
  { code: '+65', flag: '🇸🇬', name: 'Singapore' },
  { code: '+66', flag: '🇹🇭', name: 'Thailand' },
  { code: '+81', flag: '🇯🇵', name: 'Japan' },
  { code: '+82', flag: '🇰🇷', name: 'South Korea', aliases: 'Korea' },
  { code: '+84', flag: '🇻🇳', name: 'Vietnam', aliases: 'Viet Nam' },
  { code: '+86', flag: '🇨🇳', name: 'China' },
  { code: '+90', flag: '🇹🇷', name: 'Turkey' },
  { code: '+91', flag: '🇮🇳', name: 'India' },
  { code: '+92', flag: '🇵🇰', name: 'Pakistan' },
  { code: '+93', flag: '🇦🇫', name: 'Afghanistan' },
  { code: '+94', flag: '🇱🇰', name: 'Sri Lanka' },
  { code: '+95', flag: '🇲🇲', name: 'Myanmar' },
  { code: '+98', flag: '🇮🇷', name: 'Iran' },
  { code: '+212', flag: '🇲🇦', name: 'Morocco' },
  { code: '+213', flag: '🇩🇿', name: 'Algeria' },
  { code: '+234', flag: '🇳🇬', name: 'Nigeria' },
  { code: '+254', flag: '🇰🇪', name: 'Kenya' },
  { code: '+351', flag: '🇵🇹', name: 'Portugal' },
  { code: '+353', flag: '🇮🇪', name: 'Ireland' },
  { code: '+358', flag: '🇫🇮', name: 'Finland' },
  { code: '+380', flag: '🇺🇦', name: 'Ukraine' },
  { code: '+852', flag: '🇭🇰', name: 'Hong Kong' },
  { code: '+880', flag: '🇧🇩', name: 'Bangladesh' },
  { code: '+886', flag: '🇹🇼', name: 'Taiwan' },
  { code: '+961', flag: '🇱🇧', name: 'Lebanon' },
  { code: '+962', flag: '🇯🇴', name: 'Jordan' },
  { code: '+965', flag: '🇰🇼', name: 'Kuwait' },
  { code: '+966', flag: '🇸🇦', name: 'Saudi Arabia', aliases: 'KSA Saudi' },
  { code: '+968', flag: '🇴🇲', name: 'Oman' },
  { code: '+971', flag: '🇦🇪', name: 'UAE', aliases: 'United Arab Emirates Dubai Abu Dhabi' },
  { code: '+972', flag: '🇮🇱', name: 'Israel' },
  { code: '+973', flag: '🇧🇭', name: 'Bahrain' },
  { code: '+974', flag: '🇶🇦', name: 'Qatar' },
  { code: '+977', flag: '🇳🇵', name: 'Nepal' },
];
