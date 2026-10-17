# Video Story: next changes, plan

Agreed 14 October 2026. Section 1 (preview copy) built 15 October 2026.

## 1. Loading on the website: the Devlin Groby strategy

**Reference:** the Leicester site's store video bubble
(`devlin-Leicester/index.html`).

| | File | Size | Loads when |
|---|---|---|---|
| Bubble | `LeicesterStoreVideo-bubble.mp4`, 480×270, 33 s | 0.7 MB | with the page, autoplay, muted, loop |
| Full video | `LeicesterStoreVideo.mp4`, 1280×720, 33 s | 37 MB | **only on click**, `preload="none"`, fullscreen with spinner and Close |

**For the Video Story:**
- **Every upload produces two files:**
  - a **preview clip**, about 270×480 vertical, silent, 0.5–1 MB;
  - the **full video** at the tool's standard size.
- **The widget** shows only the preview clip, so visitors load under 1 MB.
- **Tapping the widget** opens the full video in an overlay with a spinner, sound and Close. Only then does the full file load.
- The phone bubble already built in the embed follows the same pattern.

**Changes:**
- **Upload flow:** make the preview clip in the browser and upload both files.
- **Settings:** a new `previewUrl` field beside `videoUrl`.
- **Embed:**
  - the widget plays `previewUrl`;
  - the overlay plays `videoUrl` with `preload="none"`;
  - a spinner shows until it can play.
- **Editor preview:** follows the same rule, so preview equals live.

## 2. "Edit it yourself" becomes a popup

**Today:** a fold-out section in the upload card.

**Planned:** an "Edit it yourself" button that opens a popup containing:
- the target spec: MP4 or MOV, the size limit, 9:16, and that 720p is enough;
- links to CapCut, Canva and HandBrake, each opening in a new tab;
- the disclaimer: **"These are third-party tools. We don't own, run or endorse them."**

## 3. Size and format at upload

| Upload | What happens |
|---|---|
| H.264 MP4 up to 150 MB | used as uploaded |
| H.264 MOV up to 150 MB | re-wrapped to MP4 in the browser at upload; same quality, takes seconds |
| HEVC MOV or MP4 | converted to H.264 MP4 in the owner's browser when the browser supports it, at the same resolution; otherwise refused in plain words, suggesting another browser or an MP4 export, with "Edit it yourself". Server conversion later will cover every browser |
| over 150 MB | refused, with the reason and "Edit it yourself" |

- **No compression of the full video,** apart from the HEVC conversion
  above. 150 MB is a hard limit, checked on the picked file and again on the
  MP4 made from it.
- **MOV to MP4 at upload: built.** The frames are copied into an MP4 without
  being encoded again; sound MP4 doesn't take is left out and the owner is
  told. The screen shows only "Preparing your video…" for any MOV or HEVC
  conversion and never says "converting". Details in
  `video-processing-explained.md`, step 2.
- **The preview clip in section 1 is separate.** It's always made small for
  the widget, whatever the size of the full video.

## 4. When do we hit R2's free 10 GB?

**What each site stores on R2:**

| Item | Size |
|---|---|
| `campaign-config.json`: Broadcasts, Smart Card and Video Story settings | 5–20 KB |
| `campaign.js` embed, one copy shared by every site | about 70 KB |
| Broadcasts and Smart Card images or files | none; they're text and styles in the settings |
| Video Story full video | depends on the scenario below |
| Video Story preview clip | about 1 MB |

So **storage is almost entirely Video Story videos.** Broadcasts and Smart
Card add next to nothing: 10 GB holds over 500,000 sites' settings.

**Sites until 10 GB, one live Video Story each:**

| Scenario | Per site | Sites to 10 GB |
|---|---|---|
| Compressed to standard: 9 MB + 1 MB preview | 10 MB | **about 1,000** |
| Mid-size uploads: 30 MB + 1 MB | 31 MB | about 330 |
| Large uploads kept: 150 MB + 1 MB | 151 MB | about 65 |

**Old videos:** if replaced videos are kept, divide by the number kept per
site. With 3 old videos each at standard size, it's about 250 sites. Deleting
replaced videos keeps the standard case at about 1,000.

**Past 10 GB the cost stays small:** R2 storage is $0.015 per GB a month.

| Storage | Monthly cost |
|---|---|
| 10 GB | free |
| 50 GB | $0.60 |
| 100 GB | $1.35 |
| 500 GB | $7.35 |

Bandwidth to visitors stays free on R2.

## 5. Docs to update when these are built

| Doc | Update |
|---|---|
| `video-size-metrics.md` | add the storage table from section 4 and the preview-clip sizes |
| `video-story-architecture.md` | `previewUrl`, the two-file upload, compression |
| `video-browser-storage.md` | cache headers for the preview and full video |
| `campaign-widget-plan.md` | the preview clip in the widget and the full video on tap |

## 6. Order of work

1. "Edit it yourself" popup with the disclaimer. Small, UI only.
2. Compressor and preview clip in the browser, with tests.
3. `previewUrl` in the settings, the editor preview and the validation.
4. Embed: the preview clip in the widget, and the full video loading on tap.
5. Cache headers, and the R2 cleanup of replaced videos.
6. Docs updated.

## 7. Decisions needed

1. **Where processing runs:** own instance, pay-per-use container, or Cloudflare Stream. See `video-processing-explained.md`.
2. **Preview clip length:** the full video length, or a short loop such as the first 6 seconds?
3. **Old videos:** delete them when replaced, or keep the last few?
