-- The Video Story: a second campaign widget stored beside promo_card, not
-- inside it. The live website reads promo_card, so the card's shape and
-- column stay exactly as they are (see docs/video-story-architecture.md).
--
-- Both nullable. Every row written before this has no video story, and null
-- reads back as the default one. video_story_last_updated is the draft row's
-- own save time for this widget, like promo_last_updated (004) — only draft
-- rows (id LIKE 'draft:%') set it, via saveVideoStoryDraft.
--
-- Run this before deploying the code: the code selects these columns.
ALTER TABLE "campaign"."campaign_config"
  ADD COLUMN IF NOT EXISTS "video_story" JSONB,
  ADD COLUMN IF NOT EXISTS "video_story_last_updated" TIMESTAMP;
