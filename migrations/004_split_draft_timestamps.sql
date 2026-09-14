-- Independent save timestamps for the promo and announcement halves of a
-- draft row. promoCard and announcementBar share one row per account (one
-- draft per user), and until now that meant one lastUpdated for both — any
-- write to either column bumped the same timestamp, so the two dashboard
-- cards could never tell which of them was actually last saved. Every
-- cross-card "saved at" conflict traced back to this.
--
-- Nullable, and only ever populated on draft rows (id LIKE 'draft:%') via
-- savePromoDraft / saveAnnouncementDraft — the 'default' (published) and
-- 'scheduled:*' rows never set these.
ALTER TABLE "campaign"."campaign_config"
  ADD COLUMN IF NOT EXISTS "promo_last_updated" TIMESTAMP,
  ADD COLUMN IF NOT EXISTS "announcement_last_updated" TIMESTAMP;
