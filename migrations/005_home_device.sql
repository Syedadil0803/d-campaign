-- Add home device columns to users table.
-- The first device a user logs in from becomes their home device.
ALTER TABLE campaign.users
  ADD COLUMN IF NOT EXISTS home_device_id TEXT,
  ADD COLUMN IF NOT EXISTS home_device_label TEXT;
