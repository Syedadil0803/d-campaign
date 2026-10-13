# Campaign widget (site embed)

The one file customers paste on their website. It draws the Broadcasts bar, the
Smart Card and the Video Story from the published `campaign-config.json`, or
nothing when nothing is live. Svelte 5 compiled to a `<campaign-widget>` custom
element with Shadow DOM, so host-page CSS can't reach in and ours can't leak out.

Its own package: its dependencies never touch the admin's `package.json`.

## Build, test, demo

```bash
cd widget
npm install
npm run build    # → dist/campaign.js (one minified IIFE, no runtime to load)
npm test         # vitest: what shows when, placement, countdowns, sanitiser
npm run demo     # builds, then serves http://localhost:5180/demo/
```

The demo has three configs: `?` (bar + card + video), `?config=card-only.json`,
`?config=nothing.json`.

## Embed snippet

```html
<script src="https://cdn.yourdomain.com/campaign.js"
        data-config="https://cdn.yourdomain.com/campaign-config.json" async></script>
```

`data-config` is optional; without it the widget loads `campaign-config.json`
from the same folder as `campaign.js`.

## How the config is loaded

1. On load the script puts one `<campaign-widget>` at the **top** of `<body>`
   (first child, so the bar sits above the page in normal flow; the card and
   video are `position: fixed`). If one is already on the page it is left alone.
2. The element fetches the URL in its `src` attribute (`cache: 'no-cache'`).
   On any failure it renders nothing and logs one `console.warn`.
3. Setting the **`config` property** (an object) instead skips the fetch. This is
   for the admin preview: it will set `el.config = editorConfig` on every edit.

```js
const el = document.createElement('campaign-widget');
el.config = config;          // live, unsaved editor state
document.body.prepend(el);
```

## What it shows

| Piece | Shows when |
|---|---|
| Broadcasts bar | `announcementBar.active` and at least one message inside its own dates |
| Smart Card | `promoCard.active` and today is inside `startDate`–`endDate` (open-ended ignores the end) |
| Video Story | `videoStory.active`, a `videoUrl`, and inside its dates |

Both card and video live → opposite bottom corners (`placeWidgets`, the card's
side wins). Closing the card or video is remembered for the browser session.

The rules are imported from the admin's `src/lib` through the `@/` alias, not
copied: `placeWidgets`, `VIDEO_WIDGET`, `deriveButtonUrl`, `isOpenEnded`,
`isAnnouncementInWindow`, `dwellSeconds`, `marqueeDurationSeconds`,
`calculateTimeRemaining`, `buildTimerDisplayHtml`, `getBackgroundStyle`,
`toLocalISODate`. Those files must stay free of React/Next imports.

## Hosting (from docs/campaign-widget-plan.md)

R2 behind the Cloudflare CDN, on a custom domain (e.g. `cdn.yourdomain.com`, not
`r2.dev`).

| File | Changes when | Cache-Control |
|---|---|---|
| `campaign.js` | a widget release | `public, max-age=300` (or purge on release) |
| `campaign-config.json` | every Publish | `public, max-age=60` (or purge on Publish) |
| `videos/<id>.mp4` | never (new name per video) | `public, max-age=31536000, immutable` |

To do before going live:

1. **Keep the embed address fixed.** Upload new releases to the same key.
2. **Cache-Control on Publish.** `src/lib/publishToR2.ts` writes
   `campaign-config.json` with no `Cache-Control` today; add `CacheControl` to
   its `PutObjectCommand`.
3. **CORS on the bucket.** The widget runs on the customer's domain and fetches
   the JSON from the CDN domain. Minimal R2 CORS rule:

   ```json
   [{ "AllowedOrigins": ["*"], "AllowedMethods": ["GET", "HEAD"], "AllowedHeaders": ["*"], "MaxAgeSeconds": 3600 }]
   ```

   (Narrow `AllowedOrigins` to customer domains if the list is known.) The
   video plays through `<video src>`, which does not need CORS.
4. **Custom domain** for the bucket.
5. **The admin loads the same `campaign.js`** from the CDN, so the preview and
   the site always run the same version.
