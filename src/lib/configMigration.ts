import { type CampaignConfig } from '@/types/campaign';
import {
  TIMER_FIXED_TOKEN,
  normalizeLegacyTimerTokens,
} from '@/lib/editor/timerUtils';

/**
 * Bringing an older stored config up to date.
 *
 * Every one of these exists because a shape changed after cards were already
 * saved in it, and the old ones still have to open. Pure reading and rewriting
 * of stored data — no component state — which is why they sit here rather than
 * in the page.
 */
// Migration functions
function migrateAnnouncements(stored: unknown): CampaignConfig['announcementBar']['announcements'] {
  // Data from an older saved config: the shape is a hope, not a fact.
  const config = stored as CampaignConfig;
  if (!Array.isArray(config.announcementBar.announcements)) {
    // The current type says this is always an array, so inside this branch
    // TypeScript has narrowed it to never — which is the point: this branch
    // exists for saved configs written before announcements became objects,
    // when the field held plain strings. The cast names that older shape
    // rather than pretending the branch is unreachable.
    const oldAnnouncements = config.announcementBar
      .announcements as unknown as string[];
    return oldAnnouncements.map((text) => ({
      text,
      richText: false,
    }));
  }
  return config.announcementBar.announcements;
}

function normalizePromoCardFontSizes(stored: unknown): CampaignConfig['promoCard'] {
  // Data from an older saved config: the shape is a hope, not a fact.
  const promoCard = stored as CampaignConfig["promoCard"];
  // Ensure all text fields have explicit font-size in HTML
  const fieldsToNormalize = ['title', 'subtitle', 'description', 'buttonText'] as const;
  const normalized = { ...promoCard };
  
  fieldsToNormalize.forEach(field => {
    if (normalized[field] && typeof normalized[field] === 'string') {
      // Wrap bare text with default font size if no font-size spans exist
      if (!normalized[field].includes('font-size')) {
        normalized[field] = `<span style="font-size: 1rem;">${normalized[field]}</span>`;
      }
    }
  });
  
  return normalized;
}

function migrateTimerText(stored: unknown): CampaignConfig['promoCard'] {
  // Data from an older saved config: the shape is a hope, not a fact.
  const promoCard = stored as CampaignConfig["promoCard"];
  const raw = (promoCard.timerText || '').trim();

  // Already in the new fixed-block format (chip span or {timer} marker) — leave
  // it untouched so the per-word structure/styling survives reloads.
  if (raw.includes('data-timer-fixed') || raw.includes(TIMER_FIXED_TOKEN)) {
    return { ...promoCard, timerText: promoCard.timerText };
  }

  // Empty → countdown only (placeholders guide the rest); no "Ends in" default.
  if (!raw) {
    return { ...promoCard, timerText: TIMER_FIXED_TOKEN };
  }

  // Legacy token / placeholder-span template → flatten to plain text, collapse
  // the {hh}:{mm}:{ss} run into a single {timer}, keep surrounding text as prefix.
  const flattened = raw
    .replace(/<span[^>]*data-timer-placeholder="hhh"[^>]*>.*?<\/span>/gi, '{hh}')
    .replace(/<span[^>]*data-timer-placeholder="mmm"[^>]*>.*?<\/span>/gi, '{mm}')
    .replace(/<span[^>]*data-timer-placeholder="sss"[^>]*>.*?<\/span>/gi, '{ss}')
    .replace(/<span[^>]*data-timer-placeholder="(?:ddd|dd|d)"[^>]*>.*?<\/span>/gi, '{d}')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  const collapsed = normalizeLegacyTimerTokens(flattened);
  const withMarker = collapsed.includes(TIMER_FIXED_TOKEN)
    ? collapsed
    : `${collapsed ? collapsed + ' ' : ''}${TIMER_FIXED_TOKEN}`;

  return { ...promoCard, timerText: withMarker };
}

function migrateButtonStyle(stored: unknown): CampaignConfig['promoCard'] {
  // Data from an older saved config: the shape is a hope, not a fact.
  const promoCard = stored as CampaignConfig["promoCard"];
  // Add default buttonStyle if missing
  if (!promoCard.style.buttonStyle) {
    return {
      ...promoCard,
      style: {
        ...promoCard.style,
        buttonStyle: {
          background: { type: 'solid', startColor: '#3f8f47', endColor: '#3f8f47' },
          textColor: '#ffffff',
          textAlign: 'center'
        }
      }
    };
  }
  return promoCard;
}

function migrateButtonFullWidth(stored: unknown): CampaignConfig['promoCard'] {
  // Data from an older saved config: the shape is a hope, not a fact.
  const promoCard = stored as CampaignConfig["promoCard"];
  // Add default buttonFullWidth if missing
  if (promoCard.buttonFullWidth === undefined) {
    return {
      ...promoCard,
      buttonFullWidth: true
    };
  }
  return promoCard;
}

function normalizeAnnouncementBackgroundType(stored: unknown): CampaignConfig['announcementBar'] {
  // Data from an older saved config: the shape is a hope, not a fact.
  const config = stored as CampaignConfig;
  const announcementBar = { ...config.announcementBar };
  const background = announcementBar?.style?.background;

  if (!background) return announcementBar;

  const normalizedBackground = { ...background };
  const validTypes = ['solid', 'linear', 'radial'];

  if (!validTypes.includes(normalizedBackground.type)) {
    normalizedBackground.type = 'solid';
  }

  // Root-level normalization: same start/end color should persist as solid type.
  if (normalizedBackground.startColor === normalizedBackground.endColor) {
    normalizedBackground.type = 'solid';
  }

  return {
    ...announcementBar,
    style: {
      ...announcementBar.style,
      background: normalizedBackground,
    },
  };
}

export function migrateConfig(stored: unknown, version: string): CampaignConfig {
  // Data from an older saved config: the shape is a hope, not a fact.
  const config = stored as CampaignConfig;
  const migrated = { ...config };

  // Always normalize announcement background style regardless of version.
  migrated.announcementBar = normalizeAnnouncementBackgroundType(migrated);
  
  // Check version and apply appropriate migrations
  if (!version || version === '1.0') {
    // Apply all v1.0+ migrations
    migrated.announcementBar.announcements = migrateAnnouncements(migrated);
    migrated.promoCard = normalizePromoCardFontSizes(migrated.promoCard);
    migrated.promoCard = migrateTimerText(migrated.promoCard);
    migrated.promoCard = migrateButtonStyle(migrated.promoCard);
    migrated.promoCard = migrateButtonFullWidth(migrated.promoCard);
    
    // Update version
    migrated.version = '1.1';
  }
  
  return migrated;
}
