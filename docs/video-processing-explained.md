# Video Story: from upload to playback, and the processing decision

Written 14 October 2026. Prices are from the providers' pricing pages,
checked that day. This document is meant to be enough to choose how videos
are processed.

## 1. The whole flow

```
1. Owner uploads a video
2. Format and size check ───┬─ H.264 MP4 up to 150 MB → keep as is
                            ├─ H.264 MOV up to 150 MB → re-wrap to MP4 in the browser
                            ├─ HEVC MOV or MP4        → convert to H.264 MP4 in the browser if it can,
                            │                           else refuse, suggest another browser or an MP4 export
                            └─ over 150 MB            → refuse, show "Edit it yourself"
3. Make the preview clip      (always, for the widget)
4. Store both files
5. Website visitors:
   - see the small preview clip playing in the widget
   - tap it → the full video opens and only then loads
```

- **Steps 2–4 happen once, when the owner uploads.** Visitors never trigger them.
- **Step 5** is the Devlin Groby strategy: a tiny clip on the page, and the
  full video only for those who ask for it.

### Step 2: the format and size rule

| Upload | What happens | Quality |
|---|---|---|
| H.264 MP4 up to 150 MB | used exactly as uploaded | unchanged |
| H.264 MOV up to 150 MB | re-wrapped to MP4 in the browser at upload, in seconds | unchanged |
| HEVC MOV or MP4, the iPhone default | converted to H.264 MP4 in the owner's browser when the browser supports it, at the same resolution; otherwise refused: try another browser, export as MP4, or use "Edit it yourself" | looks the same, encoded again |
| over 150 MB | refused, with the reason and the "Edit it yourself" popup | — |

Formats accepted: MP4 and MOV. Only an HEVC video is ever encoded again, and
only to make it play everywhere.

**Re-wrapping, not converting.** A MOV and an MP4 are two boxes for the same
video. The browser takes the H.264 frames out of the MOV and puts them into
an MP4, untouched, so quality stays exactly the same and a 32 MB clip takes
well under a second. The index goes at the front of the file, so the video
starts playing before it has fully downloaded. Sound MP4 players don't take,
such as a camera's raw PCM, is left out and the result card says
"Sound removed". The re-wrap shows only "Preparing your video…" on screen. Done with the mediabunny library, loaded only when a MOV is
picked; it never encodes, so it works in every browser.

**HEVC: converted in the browser when it can be.** An HEVC video doesn't
play in Chrome or Firefox on many computers, even inside an MP4. So it is
converted to H.264 MP4 in the owner's browser when the browser supports it,
at the same resolution and frame rate; otherwise it is refused. Server
conversion later will cover every browser.

The refusal reads "<name> can't be prepared in this browser. Try another
browser, or export it as MP4 and upload again." with "Edit it yourself" and
a "Technical detail" section naming what the browser lacks. It never says
iPhone, HEVC or "Most Compatible": those mean nothing to most owners. The
dropzone no longer carries the iPhone camera tip either, since HEVC is now
handled for them. For the team: "Most Compatible" is still the iPhone camera
setting that records H.264 and avoids all of this.

- **The check comes first.** The browser must be able to read HEVC and write
  H.264 at the clip's size. Chrome reads HEVC only where the computer's
  hardware or system offers it, so some browsers fail the check and get the
  refusal straight away.
- **Quality.** The H.264 copy uses a rate scaled to the frame size, about
  6 Mbps at 1080p and 23 Mbps at 4K, close to what an iPhone records HEVC
  at, so it looks the same and the file stays near the original's size. A
  fixed rate rather than constant quality, because constant quality has no
  ceiling: a grainy 20 second 1080p test clip came out at 197 MB.
- **Sound.** AAC is copied as is; other sound is converted to AAC, or left
  out with the "Sound removed" note when the browser can't.
- **Time.** A 20 second 1080p clip took about 3 seconds on a Mac.
- **Done quietly.** The owner picked a video; making it play everywhere is
  our job, so the screen never says "converting". Any MOV re-wrap or HEVC
  conversion shows the same bar, "Preparing your video… N%", with a Cancel
  button that goes back to the dropzone. The result card shows the usual
  size, length and the name of the file the owner picked. The one thing it
  does say is "Sound removed", since that changes what the owner hears.
- **The 150 MB limit is checked again on the result.** Over it, the owner
  sees "Once prepared, this video is X MB — the limit is 150 MB." with
  "Edit it yourself".
- **If the conversion fails partway,** the owner gets the same refusal,
  with the error under "Technical detail".
- **While uploads are off,** the result card says "Preview only — this
  video stays in this browser for now."

### Step 3: the preview clip

| | Full video | Preview clip |
|---|---|---|
| Resolution | as uploaded | about 270 × 480 |
| Size | up to 150 MB | 1–2 MB, depending on length |
| Sound | yes | no |
| Shown | full screen, only when the visitor taps | in the widget, about 200 × 355 px, playing on loop |

The preview is lower quality on purpose, but it still looks sharp: the
widget box is smaller than the clip. Visitors who tap get the full-quality
video.

### Step 5: what visitors download

| | Downloads |
|---|---|
| Every visitor | the preview clip only: 1–2 MB |
| A visitor who taps | plus the full video, up to 150 MB |

This keeps the customer's website fast, whatever size the owner uploads.

## 2. Who does steps 2 and 3: the processing

Compressing and making the preview clip needs a video tool, ffmpeg, running
on **a computer in the cloud**. It can't run in the browser reliably,
because that works in some browsers and not others. There are three ways to
do it.

### Option A: own machine, AWS Lightsail

**Flow:**
1. The owner uploads the original straight to R2.
2. The app tells our machine "new video".
3. The machine downloads it, runs ffmpeg for steps 2 and 3, uploads the results to R2, and deletes the original.
4. Visitors play the files from R2.

**We run:** one machine, always switched on, with a queue, monitoring,
restarts and updates.

**Billed:** a **fixed $12.00 a month** for the 2 vCPU, 2 GB plan, even with no
uploads; the 0.5 GB $5 plan is too small for ffmpeg. Plus R2 storage.

### Option B: pay-per-use container, Cloudflare Container

**Flow:** the same as A, except our ffmpeg container **starts only when a video
arrives** and shuts down afterwards.

**We run:** nothing permanent: a container image, plus one call from the app
after each upload.

**Billed:** **only when a video is processed**.
- **Rates:**
  - CPU: $0.000024 per vCPU-second;
  - memory: $0.0000025 per GiB-second.
- **Free each month:** 180,000 vCPU-seconds and 360,000 GiB-seconds.
- **For a 1-minute video:** processing uses about 240 of each, so the
  **first 750 uploads a month are free, then $0.0064 per upload**.
- **Plus:** R2 storage.

### Option C: Cloudflare Stream

**Flow:**
1. The owner uploads to **Stream instead of R2**.
2. Stream converts the video itself, for free.
3. Visitors play it **from Stream, with Stream's player**. The video never goes to R2.

**We run:** nothing. We switch the upload and the player to Stream.

**Billed:**
- **storage by video length, not size:** $5.00 a month for each pack of
  1,000 minutes kept. 100 sites with a 1-minute video is 100 minutes, one pack;
- **plus $1.00 for every 1,000 minutes visitors watch.** The widget loops while
  the page is open, so this is the part that grows.

**A possible mix:** Stream only converts, and the finished MP4 is copied to R2 for
visitors. It avoids the watch charge, but the storage pack is still paid
unless videos are deleted after copying, the copy may count as minutes
watched (to be confirmed with Cloudflare), and it has more moving parts than
B, which already converts straight into R2.

## 3. Storage and playback: R2

Options A and B store everything on **Cloudflare R2**, and visitors play it
from there.

| | Price |
|---|---|
| Storage | $0.015 per GB a month; the first 10 GB is free |
| Visitors watching, bandwidth | free |
| File reads | free up to 10 million a month, then $0.36 per million |

R2 bills **by size**. Stream bills **by time**: minutes kept and minutes watched.

## 4. Side by side

Example: each site has one **1-minute video**, about 100 MB plus a 2 MB
preview, and uploads 2 videos a month. Each visitor keeps the widget playing
for about 1 minute. Every figure is the **total for one month**.

| | How it's billed | Video kept and played from | 100 sites | 1,000 sites | 5,000 sites |
|---|---|---|---|---|---|
| A · Lightsail + R2 | fixed machine fee + R2 storage | R2 | $12 | $13 | $32 |
| B · Cloud Run + R2 | pay per upload + R2 storage | R2 | **$0** | **$9** | **$66** |
| C · Stream | minute packs + pay per minute watched | Stream | $15 | $105 | $525 |

| | A · Lightsail | B · Cloud Run | C · Stream |
|---|---|---|---|
| Cost when nobody uploads | $12 | $0 | $5 pack + watching |
| Grows with | storage | uploads + storage | **visitors watching** |
| We maintain | the whole machine | the container only | nothing |
| Works in every browser | yes | yes | yes |
| Accepts iPhone HEVC uploads in every browser, today only where the browser can convert | yes, after processing | yes, after processing | yes |
| First upload after a quiet spell | instant | waits a few seconds | instant |
| Effort to build | about 2–3 days | about 2–3 days | about 1 day |

## 5. Recommendation

**Option B, Cloud Run + R2.**
- $0 at our current scale, $9 a month at 1,000 sites.
- Nothing to keep switched on or patch.
- Visitors watch from R2, so the bill never grows with traffic.
- Same ffmpeg settings as A, so moving to A later is easy if a fixed bill is preferred.

## 6. Decisions to make

1. **Processing:** A, B or C. Recommended: **B**.
2. **Who owns the account:** a Google Cloud account for B, or AWS for A, with billing set up.
3. **Replaced videos:** delete them from R2 when a new one is uploaded, or keep the last few.

## Sources

- [Cloudflare Stream pricing](https://developers.cloudflare.com/stream/pricing/)
- [Cloudflare R2 pricing](https://developers.cloudflare.com/r2/pricing/)
- [Google Cloud Run pricing](https://cloud.google.com/run/pricing)
- [AWS Lightsail pricing](https://aws.amazon.com/lightsail/pricing/)
