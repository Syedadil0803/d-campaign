# Video Story: monthly hosting cost

Prices for UK visitors (the providers' Europe rates).

Per user: one 150 MB video + a 1 MB widget preview, about 160 MB stored.

Storage is a fixed monthly cost. Delivery depends on how many visitors each
user's website gets a month (5,000, 10,000 or 15,000 below).

Each visitor loads the 1 MB widget preview, and half of visitors open the
full 150 MB video.

Cloudflare Stream charges for delivery by **minutes watched**, not by data:
about 15 seconds of the widget per visitor, plus the full 1-minute video for
the half who open it.

## 10 GB stored (64 users)

| Option | Storage | Delivery at 5,000 visitors (24.3 TB) | Delivery at 10,000 visitors (48.6 TB) | Delivery at 15,000 visitors (73 TB) |
|---|---|---|---|---|
| Cloudflare (R2 + CDN) | $0 | $0 | $0 | $0 |
| Cloudflare Stream | $5 | $240 | $480 | $720 |
| Bunny (Storage + CDN) | $0.10 | $243 | $486 | $730 |
| AWS (S3 + CloudFront) | $0.23 | $1,911 | $3,856 | $5,343 |

## 20 GB stored (128 users)

| Option | Storage | Delivery at 5,000 visitors (48.6 TB) | Delivery at 10,000 visitors (97.3 TB) | Delivery at 15,000 visitors (145.9 TB) |
|---|---|---|---|---|
| Cloudflare (R2 + CDN) | $0.15 | $0 | $0 | $0 |
| Cloudflare Stream | $5 | $480 | $960 | $1,440 |
| Bunny (Storage + CDN) | $0.20 | $486 | $973 | $1,459 |
| AWS (S3 + CloudFront) | $0.46 | $3,856 | $6,802 | $9,720 |

Monthly total = storage + delivery at your visitor level.
