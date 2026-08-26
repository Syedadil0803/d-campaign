import { text, timestamp, jsonb, boolean, pgSchema, primaryKey } from 'drizzle-orm/pg-core';
// Type-only: erased at build, so nothing from the editor's type module is
// pulled into the server bundle.
import type { CampaignConfig, PromoCard } from '@/types/campaign';

// Define the campaign schema
export const campaignSchema = pgSchema('campaign');

// Create table in the campaign schema
export const campaignConfig = campaignSchema.table('campaign_config', {
  id: text('id').primaryKey().default('default'),
  version: text('version').notNull().default('1.0'),
  announcementBar: jsonb('announcement_bar').$type<CampaignConfig['announcementBar']>().notNull(),
  promoCard: jsonb('promo_card').$type<PromoCard>().notNull(),
  // Up to MAX_VERSIONS saved promo-card variants ("My Saved"), as a JSON array.
  variants: jsonb('variants').$type<PromoCard[]>(),
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
 * Whether a given browser is holding work this account never saved as a draft.
 *
 * One row per device, because which device is the entire point of the record.
 * Keyed on the account alone, a second browser raising its own flag erased the
 * first one's, and the account was then pointed at a machine whose work had
 * already been picked up.
 *
 * The card itself is never stored. Copying work to the server on every edit
 * would cost a round trip per keystroke and quietly keep something the user
 * never asked us to keep. What another device needs is far smaller: that
 * unsaved work exists, whose browser has it, and how old it is.
 */
export const userDevicePresence = campaignSchema.table(
  'user_device_presence',
  {
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    deviceId: text('device_id').notNull(),
    deviceLabel: text('device_label').notNull(),
    hasUnsavedLocalChanges: boolean('has_unsaved_local_changes').notNull().default(false),
    lastUnsavedAt: timestamp('last_unsaved_at').notNull().defaultNow(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.userId, table.deviceId] }),
  }),
);
