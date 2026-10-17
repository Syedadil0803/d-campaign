# Two campaign widgets: Smart Card + Video Story

Agreed 12 October 2026.

**Goal.** The Smart Card and the Video Story are two separate widgets. Both can
be live at the same time, in opposite bottom corners. Each has its own:

- content
- Call To Action
- schedule and countdown
- position
- on/off switch

## The architecture decision: expand, don't rename

The standard way to change a shape that is already live, without breaking
anyone, is to **add the new thing next to the old one**. Renaming the old thing
breaks whatever still reads it.

- **`promoCard` stays exactly as it is.** It becomes "the Smart Card". The live
  website reads `promoCard` from `campaign-config.json`, and the database has a
  `promo_card` column, so renaming either would break the live site.
- **`videoStory` is added as a sibling** in `CampaignConfig`. It is optional, so
  every config saved before today still loads.
- **Shared field groups.** The CTA and schedule fields become shared types
  (`CampaignCta`, `CampaignSchedule`). `PromoCard` is built from them, so its
  shape is identical to before, and `VideoStory` reuses them. One definition,
  two widgets.

```ts
interface VideoStory extends CampaignCta, CampaignSchedule {
  active: boolean;
  stoppedByUser?: boolean;
  videoUrl: string;            // stored address, once uploads exist
  position: 'bottom-left' | 'bottom-right';
  timerTextColor: string;      // the countdown is plain text, no background
  buttonStyle: FieldStyle;     // same shape as the card's button style
  title?: string;              // plain text over the top of the clip
  titleColor?: 'white' | 'black';
}
```

## Title

The title mirrors the countdown: plain text along the top edge of the clip,
same type as the countdown, centred, two lines at most. Its rules live in
`src/lib/videoStory/videoTitle.ts`, which the editor, the preview and the
embed all import.

- **Two lines at most, no character count.** As on the Smart Card's
  subtitle, the limit is the space itself: the title is measured at the
  video's size (both lines 128px wide, clear of the hover buttons), and typing, pasting
  or a style that would need a third line is refused with the Smart Card's
  "exceeds the field limit" warning. It is rich text (bold, italic, sizes,
  colours, alignment) set from the Smart Card's style popup.
- **Any colour, with an automatic shade.** It sits on moving footage, so a
  soft shade fades in from the top edge: a dark one behind a light title, a
  light one behind a dark title. Colouring the whole title picks the shade.
- **Old stories.** Both fields are optional. A story saved before the title
  existed reads as empty and white, and the signature leaves both out while
  they hold those defaults, so no existing story reads as edited.
- **Plain text.** The embed renders it as text, never HTML. The phone bubble
  shows no title; its expanded overlay does.

## Rule: opposite corners

A pure helper, `placeWidgets(config)`, owns the rule. When both widgets are
live they take opposite bottom corners: choose a corner for one, and the other
takes the other corner. The editor and the website embed both use this same
helper, so there is no second copy of the rule.

## Persistence

| Layer | Change |
|---|---|
| Database | `migrations/007_video_story.sql` adds nullable `video_story` jsonb and `video_story_last_updated` to `campaign.campaign_config`. Safe to run twice. |
| Repository | `getConfig` / `saveConfig` / `getDraftWithTimestamps` / `listScheduled` carry `videoStory`. New `saveVideoStoryDraft` / `clearVideoStoryDraft`. Inserts seed a default. |
| API | New `/api/draft/video-story` (PUT, DELETE). `/api/config` and `/api/draft` pass the field through. |
| Publish | `campaign-config.json` gains a `videoStory` key automatically. The website ignores it until the embed supports it. |

## Correctness points the change must handle

1. **Scoped publish.** Publishing one widget must keep the other widget's live
   version, as promo and announcement already do for each other. Without this,
   publishing the card would push whatever video story is sitting in the
   editor.
2. **Scheduled promote.** `promoteScheduled` decides "due" only from
   `promoCard.startDate` and copies the whole scheduled config over the live
   one. It must check each widget separately and merge.
3. **Change detection.** `getConfigSignature` must normalise `videoStory` (drop
   `active` / `stoppedByUser`) the way it normalises `promoCard`, or switching
   it on and off would look like an unsaved edit.
4. **Validation.** `validateVideoStory` checks for a clip, the CTA and the
   dates.

## Phases

1. **Data and architecture.** No visible change; the existing card keeps
   working.
   - types
   - defaults and migration
   - database column
   - repository, service and routes
   - scoped publish
   - scheduled promote
   - signatures, validation and the position rule, each with a test
2. **Editor wiring.**
   - Video Story reads and writes `config.videoStory`: its own CTA, schedule,
     countdown and position.
   - Drafts, recovery, Publish and Stop / Go on air per widget.
   - The dashboard shows both widgets.
   - The Smart Card / Video Story tabs become two independent widgets rather
     than an either/or switch.
3. **Video upload.** An upload-pass route, the file sent straight to R2, and
   the address stored in `videoStory.videoUrl`. My Published for video.
   Clip rules (`lib/videoStory/videoRules.ts`): MP4, MOV, M4V, WebM, MKV or
   MTS, up to 150 MB, no length cap (the widget loops). Everything is stored
   as an H.264 MP4, converted in the browser before upload (`decideMov` in
   `lib/videoStory/videoUpload.ts`, `components/videoStory/movToMp4.ts`):
   H.264 in another box is re-wrapped, the same frames copied; HEVC, VP8,
   VP9 and AV1 are re-encoded when the browser can (`decideHevc`), otherwise
   refused with a suggestion to try another browser or export as MP4.
   ProRes, RAW and MJPEG are refused. A horizontal or square video is
   accepted with a notice that its sides will be cut off. Each upload also
   gets a widget preview: a 270×480 silent copy of about 1 MB that the
   widget plays, while the full video loads only in the large view.
   Server conversion later will cover every browser. The screen only ever
   says "Preparing your video…". Uploads stay off
   (`VIDEO_UPLOADS_ENABLED`) until R2's public address and CORS are set.
4. **Website.** The Svelte embed renders both widgets (see
   `campaign-widget-plan.md`).

## Deploy order

Run the migration first, then deploy the code. The code reads the new column,
so the column must exist before the code that reads it goes live.
