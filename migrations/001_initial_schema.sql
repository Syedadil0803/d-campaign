-- Create schema if it doesn't exist
CREATE SCHEMA IF NOT EXISTS "campaign";

-- Create campaign_config table
CREATE TABLE IF NOT EXISTS "campaign"."campaign_config" (
  "id" TEXT PRIMARY KEY DEFAULT 'default',
  "version" TEXT NOT NULL DEFAULT '1.0',
  "announcement_bar" JSONB NOT NULL,
  "promo_card" JSONB NOT NULL,
  "last_updated" TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Insert default config
INSERT INTO "campaign"."campaign_config" (id, version, announcement_bar, promo_card, last_updated)
VALUES (
  'default',
  '1.0',
  '{
    "enabled": false,
    "announcements": [
      {
        "id": "1",
        "text": "Welcome to our store!",
        "link": "",
        "enabled": true
      }
    ],
    "backgroundColor": "#000000",
    "textColor": "#ffffff",
    "fontSize": 14,
    "fontWeight": "normal",
    "textAlign": "center",
    "padding": 12,
    "showCloseButton": true,
    "autoRotate": false,
    "rotationInterval": 5
  }'::jsonb,
  '{
    "enabled": false,
    "title": "Special Offer",
    "description": "Get 20% off your first order",
    "buttonText": "Shop Now",
    "buttonLink": "",
    "imageUrl": "",
    "startDate": "",
    "endDate": "",
    "backgroundColor": "#ffffff",
    "textColor": "#000000",
    "buttonColor": "#000000",
    "buttonTextColor": "#ffffff",
    "backgroundType": "solid",
    "gradientStart": "#667eea",
    "gradientEnd": "#764ba2",
    "gradientDirection": "to right",
    "showTimer": false,
    "timerEndDate": ""
  }'::jsonb,
  NOW()
)
ON CONFLICT (id) DO NOTHING;
