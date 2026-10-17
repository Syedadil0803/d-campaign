# Video Story: where to host the videos

Prices for UK visitors (the providers' Europe rates).

Per user: one 150 MB video + a 1 MB widget preview, about 160 MB stored.

## The services

| Option | Storage (videos stored) | CDN (videos delivered) | Minimum to buy |
|---|---|---|---|
| Cloudflare | **R2**: first 10 GB free, then $0.015 per GB a month | **Cloudflare CDN with Smart Tiered Cache**: free, no limit | none |
| Cloudflare Stream | **Stream**: $5 per 1,000 minutes stored | **Stream**: $1 per 1,000 minutes watched | $5 a month |
| Bunny | **Bunny Storage**: $0.01 per GB a month (one region) | **Bunny CDN**: $0.01 per GB in Europe, or $0.005 per GB on the Volume network (fewer locations) | $1 a month |
| AWS | **S3**: $0.023 per GB a month (5 GB free for the first 12 months only) | **CloudFront**: first 1 TB a month free, then $0.085 per GB in Europe | none |

## Cloudflare Smart Tiered Cache

Included free on all Cloudflare plans.

- **How it works:** each video is fetched from R2 once, into the Cloudflare
  data centre closest to the bucket. All other Cloudflare locations are served
  from that copy rather than from R2.
- **Benefit:** fewer reads from R2 and faster first loads in new regions.
- **Requirement:** the R2 bucket must be served from a custom domain, not the
  default r2.dev address.
- **File size:** cached files may be up to 512 MB each, with no limit on the
  number of files. At 64 users, the 128 files (64 videos of 150 MB and 64
  widget previews of 1 MB) are all within the limit.
