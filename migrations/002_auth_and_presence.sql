-- Accounts, and the one flag that lets unsaved work be seen from another device.

-- Sign-in is a column, not a table, so adding Google later is a new row value
-- rather than a schema change. password_hash is only ever set for
-- provider='password' — the seeded test account — and stays NULL for the rest.
CREATE TABLE IF NOT EXISTS "campaign"."users" (
  "id" TEXT PRIMARY KEY,
  "email" TEXT NOT NULL UNIQUE,
  "name" TEXT NOT NULL,
  "provider" TEXT NOT NULL DEFAULT 'password',
  "password_hash" TEXT,
  "created_at" TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Deliberately tiny. The work itself never comes here — only the fact that
-- some browser is holding work that was never saved as a draft, and which
-- browser that is. Writing the card on every edit would mean a database round
-- trip per keystroke for something the user has not asked us to keep; writing
-- one boolean costs nothing and answers the only question another device has.
CREATE TABLE IF NOT EXISTS "campaign"."user_presence" (
  "user_id" TEXT PRIMARY KEY REFERENCES "campaign"."users"("id") ON DELETE CASCADE,
  "has_unsaved_local_changes" BOOLEAN NOT NULL DEFAULT FALSE,
  "last_unsaved_device_id" TEXT,
  "last_unsaved_device_label" TEXT,
  "last_unsaved_at" TIMESTAMP
);

-- The draft was a single global row back when the tool had no accounts. It is
-- now keyed per user, so hand the existing one to the seeded account rather
-- than stranding it.
UPDATE "campaign"."campaign_config"
   SET "id" = 'draft:test-user'
 WHERE "id" = 'draft';
