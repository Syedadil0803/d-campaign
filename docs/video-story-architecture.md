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
}
```

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
4. **Website.** The Svelte embed renders both widgets (see
   `campaign-widget-plan.md`).

## Deploy order

Run the migration first, then deploy the code. The code reads the new column,
so the column must exist before the code that reads it goes live.
