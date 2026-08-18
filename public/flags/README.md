# Country flags

SVGs for the WhatsApp country picker, copied from the `flag-icons` package
(MIT) by `npm run flags`.

They are served as images because Windows ships no flag emoji glyphs — the
emoji in `COUNTRY_CODES` renders there as two letters or as empty boxes, so the
picker can't rely on the font. Self-hosted rather than fetched from a CDN, so
the picker works offline and makes no third-party request.

Only the countries the picker offers are copied. Add one to `COUNTRY_CODES` in
`PromoSection.tsx`, then re-run `npm run flags`.
