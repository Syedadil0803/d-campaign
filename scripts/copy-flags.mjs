/**
 * Refresh the country flags the WhatsApp picker serves from /public/flags.
 *
 * Windows ships no flag emoji glyphs, so the picker renders images instead of
 * the emoji. Run this after adding a country to COUNTRY_CODES:
 *
 *   npm run flags
 *
 * Source: the flag-icons package (MIT), a devDependency — only its SVGs ship,
 * and only the ones this picker actually offers.
 */

import { readFileSync, mkdirSync, copyFileSync, existsSync } from 'node:fs';

const src = readFileSync('src/components/PromoSection.tsx', 'utf8');
const start = src.indexOf('const COUNTRY_CODES');
if (start === -1) {
  console.error('Could not find COUNTRY_CODES in PromoSection.tsx');
  process.exit(1);
}
const table = src.slice(start, src.indexOf('];', start));
const flags = [...table.matchAll(/flag: '([^']+)'/g)].map((m) => m[1]);

/** "🇬🇧" → "gb" — the same derivation the component uses for the file name. */
const iso = (flag) =>
  Array.from(flag)
    .map((ch) => String.fromCharCode((ch.codePointAt(0) ?? 0) - 0x1f1e6 + 65))
    .join('')
    .toLowerCase();

mkdirSync('public/flags', { recursive: true });

const missing = [];
let copied = 0;
for (const flag of flags) {
  const code = iso(flag);
  const from = `node_modules/flag-icons/flags/4x3/${code}.svg`;
  if (!existsSync(from)) {
    missing.push(code);
    continue;
  }
  copyFileSync(from, `public/flags/${code}.svg`);
  copied++;
}

console.log(`countries in the picker: ${flags.length}`);
console.log(`flags copied: ${copied}`);
if (missing.length) {
  // A country with no SVG would render as a broken image in the picker.
  console.error(`MISSING (no SVG in flag-icons): ${missing.join(', ')}`);
  process.exit(1);
}
console.log('missing: none');
