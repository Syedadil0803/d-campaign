import { text, timestamp, jsonb, boolean, pgSchema } from 'drizzle-orm/pg-core';

// Define the campaign schema
export const campaignSchema = pgSchema('campaign');

// Create table in the campaign schema
export const campaignConfig = campaignSchema.table('campaign_config', {
  id: text('id').primaryKey().default('default'),
  version: text('version').notNull().default('1.0'),
  announcementBar: jsonb('announcement_bar').notNull(),
  promoCard: jsonb('promo_card').notNull(),
  // Up to MAX_VERSIONS saved promo-card variants ("My Saved"), as a JSON array.
  variants: jsonb('variants'),
  lastUpdated: timestamp('last_updated').notNull().defaultNow(),
});

/**
 * An account.
 *
 * `provider` names how the person signs in. It is a column rather than a
 * separate table because the only thing that changes when Google sign-in
 * arrives is the value in it — 'google' instead of 'password' — and
 * `passwordHash` simply stays null for those rows.
 */
export const users = campaignSchema.table('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  provider: text('provider').notNull().default('password'),
  passwordHash: text('password_hash'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

/**
 * Whether some browser is holding work this account never saved as a draft.
 *
 * The card itself is never stored here. Work that has not been saved on
 * purpose lives in the browser that made it, and copying it to the server on
 * every edit would both cost a round trip per keystroke and quietly keep
 * something the user did not ask us to keep. What another device actually
 * needs to know is far smaller: that unsaved work exists, where it is, and how
 * old it is — which is what these four columns say and nothing more.
 */
export const userPresence = campaignSchema.table('user_presence', {
  userId: text('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  hasUnsavedLocalChanges: boolean('has_unsaved_local_changes').notNull().default(false),
  lastUnsavedDeviceId: text('last_unsaved_device_id'),
  lastUnsavedDeviceLabel: text('last_unsaved_device_label'),
  lastUnsavedAt: timestamp('last_unsaved_at'),
});
