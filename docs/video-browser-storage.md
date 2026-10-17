# Video Story: keeping the video in the visitor's browser

Question (14 October 2026): on the customer's website, can a visitor's
browser keep the video it already downloaded, so a returning visitor doesn't
fetch it from R2 every time?

## Short answer

**Yes. The standard way is HTTP caching**, a header on the video file telling
the browser to keep it. A returning visitor then plays it from their own disk:
no download, no CDN request, no R2 read.

Every video gets a new, unique name when uploaded, and is never changed
afterwards. So it can be cached for a very long time, and a new video is
picked up straight away because its name is different.

## The three layers

```
Visitor's browser cache  ──miss──▶  Cloudflare CDN  ──miss──▶  R2
   (repeat visits: 0 requests)      (first visit nearby)      (rare)
```

| Layer | Who it saves | Today |
|---|---|---|
| Visitor's browser cache | the visitor's data and time, plus every request | **not set up**: no cache header on uploads yet |
| Cloudflare CDN | R2 reads | works once the custom domain is connected |
| R2 | none; it's the source | stores each file once |

## What to set

| File | Header | Why |
|---|---|---|
| `video-story/<id>.mp4`, a MOV is re-wrapped to MP4 before upload | `Cache-Control: public, max-age=31536000, immutable` | a name is never reused, so the file can be kept for a year |
| `campaign-config.json` | `Cache-Control: public, max-age=60` | changes on every Publish, so it must refresh quickly |
| `campaign.js` (the embed) | `Cache-Control: public, max-age=300` | a new release reaches visitors within 5 minutes |

**Where it goes in the code:**
- **Videos:** add the header to the signed upload link (`src/app/api/uploads/video-story/route.ts`), and have the browser send it with the upload.
- **Config:** add it where `campaign-config.json` is written (`src/lib/publishToR2.ts`).
- **Alternative:** a Cloudflare cache rule for `video-story/*` sets the same thing without code.

## Limits to know

| Browser | Keeps large videos? |
|---|---|
| Chrome / Edge | yes, if the cache has room; it can be cleared under disk pressure |
| Firefox | **only files up to about 50 MB** by default. Larger ones are downloaded again |
| Safari | yes, but it may clear the cache sooner than Chrome |

- **The cache belongs to each site.** A video cached on one customer's website
  isn't reused on another website.
- **Visitors who clear their browser data** download it again.
- **Smaller files cache better everywhere.** That's another reason to keep
  clips well under the 150 MB limit.

## Options considered and rejected

| Option | Why not |
|---|---|
| Widget saves the video in the visitor's IndexedDB | stores up to 150 MB on visitors' devices without asking; Safari clears it after about 7 days; more code than a header that does the same job |
| Service worker caching | must be a file hosted on the customer's own domain; our embed can't install one |
| Owner's browser as the source | visitors can never read another person's browser |

## Recommendation

1. **Add the cache headers** above, for videos, the config and the embed. It's
   a small code change with no new infrastructure.
2. **Keep clips small.** Firefox only caches files up to about 50 MB, so
   clips under 50 MB are cached everywhere.
3. **Verify:** in Chrome DevTools → Network, the second visit shows the video as
   "(disk cache)", and Cloudflare Analytics shows few R2 reads.
