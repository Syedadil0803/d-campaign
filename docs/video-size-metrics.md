# Video Story: file-size impact and metrics to verify

Decided 14 October 2026, formats widened 15 October: videos can be **up to
150 MB**. The tool accepts **MP4, MOV, M4V, WebM, MKV and MTS/M2TS**; every
video is stored as an **H.264 MP4**. H.264 in another box is re-wrapped (same
frames); HEVC, VP8, VP9 and AV1 are re-encoded in the browser at upload; ProRes,
RAW and MJPEG are refused with a plain message. There is no
length limit. The size limit is one constant, `VIDEO_MAX_BYTES` in `src/lib/videoStory/videoRules.ts`.

Figures below are estimates from published pricing and published UK speed
data, with the sources linked.

## 1. Where the video travels

```
Tool (browser) ──upload──▶ R2 bucket ──▶ Cloudflare CDN ──▶ Website (browser)
        ▲
        └── our app server only signs the upload link
```

- **Our app server never receives the video.** Its load does
  not change with file size.
- **R2** stores the file and charges per stored GB and per operation. It does
  **not** charge for bandwidth.
- **The Cloudflare CDN** caches the file close to the people viewing the website. A cached view does
  not reach R2 at all. The CDN caches files up to 512 MB, so 150 MB is fine.
- **The website** downloads only the widget preview, about 1 MB, until
  someone opens the expanded video. **This is where size matters.**

## 2. Per video

Every upload is stored as two files, named the same way everywhere below:

- **Widget preview:** made in the browser at upload, 270×480, silent,
  about 1 MB (measured on real clips: 0.4–1.0 MB). The widget plays it.
- **Expanded video:** the video as uploaded, converted to MP4 when needed, up
  to 150 MB. It loads only when someone opens the large view.

| | Widget preview | Expanded video, at the 150 MB limit |
|---|---|---|
| App server work | 1 signing request | 1 signing request |
| R2 write operations | 1 | 1 |
| R2 storage / month, at $0.015 per GB | $0.00002 | $0.0022 |
| CDN can cache it | yes | yes |

Pricing used: R2 storage $0.015 per GB a month, with the first 10 GB free;
write operations $4.50 per million; read operations $0.36 per million;
bandwidth free.

## 2a. Speeds used

One speed per connection, used for both uploading in the tool and loading on
the website:

| Connection | Speed |
|---|---|
| Home Wi-Fi | 18.4 Mbps |
| Mobile data | 15 Mbps |

## 3. Upload time in the tool

The person picks one video and waits only for it:

| | Wi-Fi | Mobile data |
|---|---|---|
| Video at the 150 MB limit | 1 min 12 s | 1 min 28 s |

The tool makes the widget preview by itself and uploads it afterwards in the
background; nobody picks it, uploads it or waits for it.

## 4. Loading time on the website

| | Loads when | Fully downloaded, Wi-Fi | Fully downloaded, mobile data |
|---|---|---|---|
| Widget preview | with the page | about 0.5 s | about 0.5 s |
| Expanded video, at the 150 MB limit | only when opened | 1 min 12 s | 1 min 28 s |

The expanded video plays while it downloads, so nobody waits for the full
download: it starts after about a second and keeps playing.

At 10,000 widget views a month, widget previews deliver about 10 GB; each
expanded view adds up to 150 MB. R2 charges nothing for this delivery, and
reads stay inside the 10 million free a month. The CDN keeps R2 and our
servers quiet; it does not shrink what each browser downloads, which is why
the widget preview exists.

## 5. When R2's free 10 GB runs out

**10 GB runs out at about 64 users**, each with:
- Broadcasts, Smart Card and Video Story;
- 1 video at the 150 MB limit;
- 5 Smart Card variants.

| Per user | What it is | Space in R2 |
|---|---|---|
| Settings | the text, colours, dates and links of Broadcasts, Smart Card and Video Story | 5.5 KB (measured) |
| Expanded video | the video the user uploaded | 150 MB |
| Widget preview | the small copy of that video the widget plays | 1 MB |
| 5 Smart Card variants | saved in the database, not in R2 | 0 MB |
| **Total** | | **151 MB + 5.5 KB, rounded up to 160 MB** |

10 GB is 10,240 MB, and 10,240 ÷ 160 = **64 users**.

### Without a video

**10 GB runs out at about 1 million users**, each with Broadcasts and Smart
Card (and Video Story switched off, no video), plus 5 Smart Card variants.

| Per user | What it is | Space in R2 |
|---|---|---|
| Settings | the text, colours, dates and links of Broadcasts, Smart Card and Video Story | 5.5 KB (measured) |
| 5 Smart Card variants | saved in the database, not in R2 | 0 KB |
| **Total** | | **5.5 KB, rounded up to 10 KB** |

10 GB is 10,485,760 KB, and 10,485,760 ÷ 10 ≈ **1 million users**.
