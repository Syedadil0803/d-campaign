-- Track which card(s) have unsaved work, not just "something is unsaved".
ALTER TABLE campaign.user_device_presence
  ADD COLUMN IF NOT EXISTS has_unsaved_promo BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS has_unsaved_announcement BOOLEAN NOT NULL DEFAULT FALSE;
