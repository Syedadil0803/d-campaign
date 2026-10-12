# Campaign widget: plan for later

Agreed 12 October 2026. Not built yet.

## Decision

- The widget customers see on their website (Smart Card or Video Story) is
  built with **Svelte, compiled to a Web Component**.
- It ships as **one embed file**. The customer pastes it once and never changes it:

  ```html
  <script src="https://cdn.yourdomain.com/campaign.js" async></script>
  ```

- That file reads the published settings and decides what to show: the
  **Smart Card**, the **Video Story**, or **nothing** (not live, or outside the
  dates).
- The **admin preview uses the same widget**. The look and behaviour live in one
  place, so the preview and the website can't drift apart.

## Why Svelte

| | Plain JS | Preact | **Svelte** |
|---|---|---|---|
| Library shipped to visitors | none | ~4 KB + add-on | none (compiled away) |
| Becomes a custom HTML tag | by hand | needs `preact-custom-element` | built in |
| Live updates in the admin preview | written by hand per field | automatic | automatic |
| Sealed styles (Shadow DOM) | by hand | by hand | built in |

The deciding point is live updates. The admin preview changes on every
keystroke and colour pick; in plain JS each field needs its own update code,
and that is where the preview and the website start to disagree.

## Inside the embed

```
campaign.js
 └─ <campaign-widget>        decides what to show
     ├─ SmartCard.svelte      when kind = 'card'
     └─ VideoStory.svelte     when kind = 'video'
```

Broadcasts (the top bar) can join the same file later, so a customer embeds
one file for everything.

## Where things load from

| | Widget code (`campaign.js`, how to draw) | Settings (what to draw) |
|---|---|---|
| **Admin** | CDN | **Database (Supabase)**, as today, plus unsaved edits in the browser |
| **Website** | CDN | CDN: the published `campaign-config.json` |

The admin never reads `campaign-config.json` from the CDN. That is why the
preview shows edits before they are published.

## Hosting: R2 behind the Cloudflare CDN

| File | Changes when | Cache |
|---|---|---|
| `campaign.js` | a new widget release | short (about 5 min), or purge on release |
| `campaign-config.json` | every Publish | very short (about 60 s), or purge on Publish |
| `videos/<id>.mp4` | never (each video gets a new name) | long |

Setup to do:

1. **Keep the embed address fixed.** Update the file at the same address; the
   short cache or a purge delivers it.
2. **Set caching on Publish.** Today `publishToR2.ts` writes
   `campaign-config.json` with no `Cache-Control`.
3. **CORS on the bucket.** The widget runs on the customer's domain and fetches
   from the CDN domain.
4. **A custom domain** for R2 (for example `cdn.yourdomain.com`), not `r2.dev`.
5. **The admin loads the same `campaign.js`** from the CDN, so both always run
   the same version.

## Settings changes needed

- `kind: 'card' | 'video'`. Today the Smart Card / Video Story choice lives
  only in the editor and is not saved.
- The video's address, once uploads to R2 exist.

## What this replaces

- The admin's React previews: `PromoCanvas` (card) and `VideoStoryCanvas`
  (video).
- The plain-JS widget in the website repo.
