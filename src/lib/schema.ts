import { pgTable, text, timestamp, jsonb, pgSchema } from 'drizzle-orm/pg-core';

// Define the campaign schema
export const campaignSchema = pgSchema('campaign');

// Create table in the campaign schema
export const campaignConfig = campaignSchema.table('campaign_config', {
  id: text('id').primaryKey().default('default'),
  announcementBar: jsonb('announcement_bar').notNull(),
  promoCard: jsonb('promo_card').notNull(),
  lastUpdated: timestamp('last_updated').notNull().defaultNow(),
});
