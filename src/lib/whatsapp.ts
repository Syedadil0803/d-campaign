/**
 * One place that turns a country code + typed number into a wa.me link.
 *
 * There were two derivations before: the editor preview built one rule and the
 * publish path built another, so they disagreed about whether a number was
 * linkable — a number could be a dead button in the editor and a live, broken
 * link on the website.
 *
 * The old rule also gated on the dialling code and the number CONCATENATED
 * being longer than six digits, which made the real threshold slide by country:
 * +44 needed five typed digits, +1 needed six, +971 needed four. That is why a
 * partly-typed number produced no link at all.
 *
 * The rule now: any typed national digit makes a link. Length is a warning
 * before publishing, never a gate while editing.
 */

/** ITU E.164: a full international number is at most 15 digits. */
const E164_MAX = 15;

/**
 * Minimum national digits per dialling code, used ONLY for the "looks short"
 * warning. Sparse on purpose — the country table carries no length data, and a
 * hand-kept row for all 66 countries would drift out of sync the same way a
 * second flag column would.
 */
const MIN_NATIONAL_DIGITS: Record<string, number> = {
  '+1': 10,
  '+44': 10,
  '+91': 10,
  '+92': 10,
  '+880': 10,
  '+49': 10,
  '+971': 9,
  '+966': 9,
  '+61': 9,
  '+33': 9,
  '+65': 8,
};
const DEFAULT_MIN_NATIONAL_DIGITS = 6;

/** Dialling codes where a leading zero belongs to the number itself. */
const KEEPS_TRUNK_ZERO = new Set(['+39']);

export function normalizeWhatsApp(countryCode?: string, raw?: string) {
  const cc = countryCode || '+44';
  const code = cc.replace(/\D/g, '');
  let national = (raw || '').replace(/\D/g, '');
  // People type their number the way they dial it at home ("07911…"), but the
  // international form drops that trunk prefix.
  if (!KEEPS_TRUNK_ZERO.has(cc)) national = national.replace(/^0+/, '');
  const digits = `${code}${national}`.slice(0, E164_MAX);
  return { cc, code, national, digits };
}

/** The wa.me URL, or null when no national digits have been typed. */
export function whatsAppUrl(countryCode?: string, raw?: string): string | null {
  const { national, digits } = normalizeWhatsApp(countryCode, raw);
  // A dialling code on its own is not a number.
  if (!national) return null;
  return `https://wa.me/${digits}`;
}

/** Usable, but shorter than this country's numbers normally run. */
export function whatsAppLooksShort(countryCode?: string, raw?: string): boolean {
  const { cc, national } = normalizeWhatsApp(countryCode, raw);
  if (!national) return false;
  return national.length < (MIN_NATIONAL_DIGITS[cc] ?? DEFAULT_MIN_NATIONAL_DIGITS);
}

/** How many national digits still fit inside E.164 for this country. */
export function maxNationalDigits(countryCode?: string): number {
  return E164_MAX - (countryCode || '+44').replace(/\D/g, '').length;
}
