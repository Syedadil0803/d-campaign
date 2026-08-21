-- One row per device, not one per account.
--
-- user_presence keyed on user_id alone could only remember the most recent
-- browser to claim unsaved work. Two devices each holding their own edits meant
-- the second one silently erased the first one's claim, and the account was
-- then told its work lived somewhere it no longer did. Which device is the
-- whole point of the record, so it belongs in the key.
--
-- The old table is dropped rather than migrated. It holds a transient flag that
-- every editor re-asserts as soon as it loads, so there is nothing here worth
-- carrying across.
DROP TABLE IF EXISTS "campaign"."user_presence";

CREATE TABLE IF NOT EXISTS "campaign"."user_device_presence" (
  "user_id" TEXT NOT NULL REFERENCES "campaign"."users"("id") ON DELETE CASCADE,
  "device_id" TEXT NOT NULL,
  "device_label" TEXT NOT NULL,
  "has_unsaved_local_changes" BOOLEAN NOT NULL DEFAULT FALSE,
  "last_unsaved_at" TIMESTAMP NOT NULL DEFAULT NOW(),
  PRIMARY KEY ("user_id", "device_id")
);

-- Every read asks the same question: which OTHER devices are holding unsaved
-- work, newest first.
CREATE INDEX IF NOT EXISTS "user_device_presence_unsaved_idx"
  ON "campaign"."user_device_presence" ("user_id", "has_unsaved_local_changes", "last_unsaved_at" DESC);
