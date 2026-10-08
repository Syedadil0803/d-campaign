# Video in the Promo Card: feasibility

**Feasible, and cheap to run.** The website already loads the card from
Cloudflare R2, and R2 charges nothing for bandwidth, which is usually the
expensive part of video.
.

---

## Tool level (Campaign Admin)

- The customer uploads a short video. It goes straight from their browser to
  R2, so our server does no work.
- A still image (poster) is taken from the first frame, in the browser.
- The card stores only the video's address. That is a few bytes, kept in
  Supabase alongside the rest of the card.
- Large phone videos (30–100 MB) need shrinking. That is possible in three ways:
  - size limits that the owner works within (free);
  - compression in the browser (free, but slow);
  - Cloudflare Stream, which compresses automatically (paid).

## User level (the customer)

- Choose **Text** or **Video** for the card.
- The video replaces the title and description. The button stays clickable on
  top of it, so WhatsApp links still work.
- The video plays muted and on loop. Browsers don't allow autoplay with sound.

## Website level (load and network)

- The page shows the still image first. The video loads only after the page has
  finished loading, so the site's speed is not affected.
- Phones in data-saver mode see only the still image.
- A 720p clip of about 1–2 MB is enough for a card about 400 px wide.
- The video is served from Cloudflare's cache, close to each visitor.

---

## Storage and compute

| Job | Where | Cost |
|---|---|---|
| Store video + still image | Cloudflare R2 | $0.015/GB-month, first 10 GB free |
| Deliver to visitors | Cloudflare R2 + cache | $0 bandwidth |
| Upload link | Tool server | Negligible |
| Card data (video address) | Supabase | No change |
| Compression (only if Stream is used) | Cloudflare Stream | Free to encode; paid to store and deliver |

## Cost by monthly card views

Assumptions: a 15 s, 2 MB clip, about 10 videos kept on file, about 30 s watched
per visitor.

| Card views / month | Data served | Cloudflare R2 | Supabase Storage | Cloudflare Stream |
|---|---|---|---|---|
| 50,000 | 100 GB | **$0** | $25 | ~$30 |
| 1.5 million | 3 TB | **$0** | ~$275 | ~$755 |
| 10 million | 20 TB | **~$0–3** | ~$1,800 | ~$5,000 |

- **R2** stays near zero: bandwidth is free, and reads are free up to 10 million
  a month.
- **Supabase** charges $0.09/GB once you pass 250 GB (on the $25 Pro plan).
- **Stream** charges per minute watched, and a looping card keeps adding
  minutes.

---

Sources:
[Cloudflare R2 pricing](https://developers.cloudflare.com/r2/pricing) ·
[Cloudflare Stream pricing](https://developers.cloudflare.com/stream/pricing) ·
[Supabase pricing overview](https://makerkit.dev/blog/saas/supabase-pricing)
