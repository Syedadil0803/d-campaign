'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { X, Loader2, SlidersHorizontal, Clock } from 'lucide-react';
import { CampaignConfig, PromoCard, defaultConfig } from '@/types/campaign';
import { whatsAppUrl, whatsAppLooksShort } from '@/lib/whatsapp';
import { cardIsNotUserWork, lookSignature } from '@/lib/promoAuthorship';
import { BLANK_LOOK } from '@/lib/promoTemplate';
import { sampleTemplates } from '@/components/SamplePromoTemplates';
import { normalizeLegacyTimerTokens, TIMER_FIXED_TOKEN } from '@/lib/timerUtils';
import { fieldOverflows } from '@/lib/promoFit';
import { Header } from '@/components/Header';
import { Dashboard } from '@/components/Dashboard';
import { AnnouncementSection } from '@/components/AnnouncementSection';
import { PromoFlow } from '@/components/PromoFlow';
import { PromoSetupDialog } from '@/components/PromoSetupDialog';
import { Toast, ToastAction, TOAST_ACTION_MS } from '@/components/Toast';
import { getISODateWithOffset, toLocalISODate } from '@/lib/utils';
import { describeWhen, fetchUnsavedElsewhere, reportUnsaved } from '@/lib/presenceClient';
import {
  askNotificationPermission,
  closeIdleNotification,
  describeDuration,
  notificationPermission,
  notificationsSupported,
  osNotificationHint,
  restoreTitle,
  setAppBadge,
  setFaviconAlert,
  setTitleCountdown,
  showIdleNotification,
  unblockSteps,
} from '@/lib/sessionWarning';
import {
  listVersions,
  MAX_VERSIONS,
  markLiveVersion,
  saveVersion,
  updateVersion,
  type PromoVersion,
} from '@/lib/promoVersions';

/**
 * How long the editor sits untouched before signing itself out.
 *
 * Deliberately tiny while this is being tried out: thirty seconds of quiet,
 * then thirty seconds of countdown. Both want raising well before anyone
 * relies on them — the flow they exercise is the interesting part, not the
 * numbers.
 */
const IDLE_LIMIT_MS = 60_000;

/**
 * How much of that is spent counting down in front of the user.
 *
 * A lead time rather than a second absolute figure, so raising the limit can
 * never leave the warning firing after the sign-out it is warning about.
 */
const IDLE_WARNING_LEAD_MS = 30_000;


// Migration functions
function migrateAnnouncements(config: any): CampaignConfig['announcementBar']['announcements'] {
  if (!Array.isArray(config.announcementBar.announcements)) {
    // Convert old string format to new object format
    const oldAnnouncements = config.announcementBar.announcements;
    return oldAnnouncements.map((text: string, index: number) => ({
      text,
      richText: false
    }));
  }
  return config.announcementBar.announcements;
}

function normalizePromoCardFontSizes(promoCard: any): CampaignConfig['promoCard'] {
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

function migrateTimerText(promoCard: any): CampaignConfig['promoCard'] {
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

function migrateButtonStyle(promoCard: any): CampaignConfig['promoCard'] {
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

function migrateButtonFullWidth(promoCard: any): CampaignConfig['promoCard'] {
  // Add default buttonFullWidth if missing
  if (promoCard.buttonFullWidth === undefined) {
    return {
      ...promoCard,
      buttonFullWidth: true
    };
  }
  return promoCard;
}

function normalizeAnnouncementBackgroundType(config: any): CampaignConfig['announcementBar'] {
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

function migrateConfig(config: any, version: string): CampaignConfig {
  let migrated = { ...config };

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

export default function Home() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'announcement' | 'promo'>('dashboard');
  // `config` is the editing/draft state (what the editors show). `publishedConfig`
  // is what's actually LIVE on the website — the Dashboard renders this so it
  // never shows unpublished draft content as if it were live.
  const [config, setConfig] = useState<CampaignConfig>(defaultConfig);
  const [publishedConfig, setPublishedConfig] = useState<CampaignConfig>(defaultConfig);
  const [hasAnnouncementChanges, setHasAnnouncementChanges] = useState(false);
  const [hasPromoChanges, setHasPromoChanges] = useState(false);
  // Announcement still stages via Save → Publish (promo saves straight to a
  // draft from the tab strip instead, so it has no staged/"ready" state).
  const [readyToPublishAnnouncement, setReadyToPublishAnnouncement] = useState(false);
  const hasChanges = hasAnnouncementChanges || hasPromoChanges;
  const [pendingDraftAction, setPendingDraftAction] = useState<
    | { type: 'tab'; tab: 'dashboard' | 'announcement' | 'promo' }
    | { type: 'logout' }
    | null
  >(null);
  const [pendingVariantSave, setPendingVariantSave] = useState<{
    config: CampaignConfig;
    versions: PromoVersion[];
    // Whether this dialog was opened from a plain Save or from Publish — Publish
    // must finish going live after the variant is stored, not just save.
    mode: 'save' | 'publish';
  } | null>(null);
  const [selectedPromoVersionId, setSelectedPromoVersionId] = useState<string | null>(null);
  /**
   * Everything in My Published.
   *
   * The unsaved-work guard needs these synchronously: a card sitting in My
   * Published is already recoverable, so offering to save it to My Draft is
   * asking the user to keep a second copy of something they haven't lost.
   */
  const [promoVariants, setPromoVariants] = useState<PromoVersion[]>([]);

  const refreshPromoVariants = useCallback(() => {
    listVersions()
      .then(setPromoVariants)
      .catch(() => {});
  }, []);

  useEffect(() => {
    refreshPromoVariants();
  }, [refreshPromoVariants]);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastIsError, setToastIsError] = useState(false);
  const [toastAction, setToastAction] = useState<ToastAction | null>(null);
  // One timer owns the toast's life, so a second toast doesn't inherit the
  // first one's countdown and vanish early.
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [publishConfirm, setPublishConfirm] = useState<{
    warnings: string[];
    onConfirm: () => Promise<void> | void;
    title?: string;
    message?: string;
    confirmLabel?: string;
    cancelLabel?: string;
    // When true, confirm runs onConfirm as-is (e.g. to open a follow-up popup)
    // WITHOUT the "Publishing…" state — avoids a flicker when chaining popups.
    deferPublish?: boolean;
    // Runs when the popup is dismissed (Cancel / backdrop) — e.g. to revert a
    // provisional state change.
    onCancel?: () => void;
  } | null>(null);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  // Explicit "Save as draft" — writing in progress, and the replace-confirm
  // shown when a draft already exists (only one draft slot).
  const [savingDraft, setSavingDraft] = useState(false);
  const [confirmReplaceDraft, setConfirmReplaceDraft] = useState(false);
  // Signature of the draft actually stored in the DB (null = no draft). Kept
  // in state, not a ref, so the "Save as draft" button can disable itself when
  // the editor already matches the draft — re-saving identical content only
  // produces a pointless "Replace saved draft?" prompt.
  const [savedDraftSignature, setSavedDraftSignature] = useState<string | null>(null);
  /**
   * Mirrors savedDraftSignature for the unload handler, which is registered
   * once and would otherwise read whatever the value was at mount.
   */
  const savedDraftSignatureRef = useRef<string | null>(null);
  savedDraftSignatureRef.current = savedDraftSignature;
  /** A draft found on load, waiting for the promo editor to be opened. */
  const offeredDraftRef = useRef<CampaignConfig | null>(null);
  /** The draft currently being offered in the welcome-back dialog. */
  const [draftOffer, setDraftOffer] = useState<CampaignConfig | null>(null);
  /** Asks what to do with a draft that survived a publish, when it differs. */
  const [postPublishDraft, setPostPublishDraft] = useState(false);
  /**
   * The promo card as it exists in the saved draft.
   *
   * `savedDraftSignature` is a JSON signature of the WHOLE config, so it drifts
   * whenever the app re-normalises HTML by itself — font-size spans, the timer
   * chip, the auto card width. After a tab switch the editor stopped
   * recognising that its card WAS the saved draft, and started asking to save
   * a card that was already saved. Comparing the card itself, field by field,
   * survives that noise.
   */
  const [draftPromoCard, setDraftPromoCard] = useState<CampaignConfig['promoCard'] | null>(null);
  // Which guided-flow step the promo tab is on. Publish is an editor action, so
  // the header hides it while the user is still picking a start or writing copy.
  // Where the promo tab opens. Dashboard's View/Edit act on an existing
  // campaign, so they go straight to the editor; the nav tab starts fresh.
  // Includes 'ai' so the dashboard's create dialog can send someone straight
  // to the AI screen without passing through the editor first.
  // Where the promo tab opens: the editor, or the editor with the AI panel
  // already up. There is no separate start screen any more.
  const [promoEntryStep, setPromoEntryStep] = useState<'ai' | 'build' | 'editor'>('editor');
  const mainScrollRef = useRef<HTMLElement>(null);
  const configRef = useRef(config);
  configRef.current = config;
  const hasChangesRef = useRef(hasChanges);
  hasChangesRef.current = hasChanges;
  const hasAnnouncementChangesRef = useRef(hasAnnouncementChanges);
  hasAnnouncementChangesRef.current = hasAnnouncementChanges;
  // Any pending draft work (unsaved edits OR a staged-but-unpublished
  // announcement) — a live on-air toggle must preserve this, not discard it.
  const pendingDraft = hasChanges || readyToPublishAnnouncement;
  const pendingDraftRef = useRef(pendingDraft);
  pendingDraftRef.current = pendingDraft;
  const draftSignatureRef = useRef<string | null>(null);
  const savedPromoSignatureRef = useRef<string | null>(null);
  const publishedConfigRef = useRef<string | null>(null);
  // The published config object (not just its signature) — lets draft checks
  // compare the announcement against what's live.
  const publishedConfigObjRef = useRef<CampaignConfig | null>(null);

  /**
   * Strips differences the APP creates on its own, so they don't read as edits.
   *
   * The editors rewrite their own HTML constantly: bare text gets wrapped in a
   * default font-size span on sync, the timer chip re-serialises, contentEditable
   * leaves zero-width characters behind, and cardWidth flips 400↔440 by itself.
   * A raw JSON compare counted every one of those as an unpublished change, so
   * the badge appeared without the user editing anything.
   *
   * Real edits still register: text, formatting other than the injected default,
   * and every style field are all preserved here.
   */
  function normalizeForCompare(html: unknown): unknown {
    if (typeof html !== 'string') return html;
    return (
      html
        // The default-size wrapper the editors inject around bare text — it
        // changes the markup without changing what anything looks like.
        .replace(/<span style="font-size:\s*1rem;?">([\s\S]*?)<\/span>/gi, '$1')
        .replace(/[\u200B\u200C\u200D\uFEFF]/g, '')
        .replace(/\s+/g, ' ')
        .trim()
    );
  }

  function normalizePromoForCompare(card: Record<string, unknown>) {
    const clone = { ...card };
    delete clone.active;
    delete clone.stoppedByUser;
    // Recomputed by the fit logic, never chosen by the user.
    delete clone.cardWidth;
    (['title', 'subtitle', 'description', 'buttonText'] as const).forEach((k) => {
      clone[k] = normalizeForCompare(clone[k]);
    });
    // The countdown's markup is regenerated on every render; only its wording
    // is the user's.
    clone.timerText = String(clone.timerText ?? '')
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    return clone;
  }

  function getConfigSignature(cfg: CampaignConfig) {
    // `active` / `stoppedByUser` are live on/off flags managed by Go-on-air /
    // Stop, not content. Exclude them so the Save/dirty check reflects real
    // content changes only — e.g. re-applying an already-live variant (which
    // flips active) must not read as "unsaved changes". Mirrors the reactivate
    // comparison below.
    const strip = (o: Record<string, unknown>) => {
      const clone = { ...o };
      delete clone.active;
      delete clone.stoppedByUser;
      return clone;
    };
    // `lastUpdated` is rewritten on every save, so including it made two
    // identical configs compare as different — which meant a draft could never
    // match what's published, and the "Welcome back" banner fired for drafts
    // holding no real changes.
    const { lastUpdated: _ignored, ...content } = cfg;
    return JSON.stringify({
      ...content,
      announcementBar: strip(cfg.announcementBar as unknown as Record<string, unknown>),
      promoCard: normalizePromoForCompare(
        cfg.promoCard as unknown as Record<string, unknown>,
      ),
    });
  }

  function hasChangesSinceDraft() {
    return hasChangesRef.current && draftSignatureRef.current !== getConfigSignature(configRef.current);
  }

  function getPromoSignature(cfg: CampaignConfig) {
    return JSON.stringify(cfg.promoCard);
  }

  function getAutoVariantLabel() {
    return `Saved ${new Date().toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })}`;
  }

  async function getPromoVariantSaveStatus(
    cfg: CampaignConfig,
  ): Promise<{ status: 'skipped' | 'pending' | 'ready'; variantId?: string }> {
    const promoSignature = getPromoSignature(cfg);
    // The saved-signature cache is only trustworthy when the card is ACTUALLY in
    // the saved list. loadConfig seeds savedPromoSignatureRef from the *published*
    // card — which is NOT itself a saved variant — so an early ref short-circuit
    // makes publishing a freshly loaded card return 'skipped' and record nothing
    // in My Published (the reported "empty after publishing" bug). Consult the
    // list itself as the source of truth instead.
    const existingVersions = await listVersions();
    const match = existingVersions.find(
      (version) => JSON.stringify(version.promoCard) === promoSignature,
    );
    if (match) {
      savedPromoSignatureRef.current = promoSignature;
      // Already recorded — make sure it's the highlighted "Live" entry.
      setSelectedPromoVersionId(match.id);
      return { status: 'skipped', variantId: match.id };
    }

    return {
      status: existingVersions.length >= MAX_VERSIONS ? 'pending' : 'ready',
    };
  }

  /**
   * Record which variant is going live, so My Published can tag it by identity
   * instead of guessing from content.
   *
   * The flag lives on the variant, not on the config: the config row has fixed
   * columns and quietly drops anything else, so a pointer stored there survived
   * in memory and vanished on the next read.
   */
  async function markVariantLive(variantId: string | null) {
    await markLiveVersion(variantId);
    refreshPromoVariants();
  }

  async function savePromoVariant(cfg: CampaignConfig, allowOverflow = false) {
    const updatedVersions = await saveVersion(cfg.promoCard, getAutoVariantLabel(), { allowOverflow });
    const savedId = updatedVersions[updatedVersions.length - 1]?.id ?? null;
    setSelectedPromoVersionId(savedId);
    savedPromoSignatureRef.current = getPromoSignature(cfg);
    refreshPromoVariants();
    return savedId;
  }

  useEffect(() => {
    loadConfig();
    
    const savedDarkMode = localStorage.getItem('darkMode');
    if (savedDarkMode !== null) {
      setIsDarkMode(savedDarkMode === 'true');
    } else {
      setIsDarkMode(window.matchMedia('(prefers-color-scheme: dark)').matches);
    }
  }, []);

  /**
   * Send the promo editor back to the default card.
   *
   * Runs once the work is safely somewhere else — published, or written to the
   * draft. Leaving the finished card sitting in the editor made the next visit
   * ambiguous: what is on screen looks like work in progress, but is really a
   * copy of something already saved, and editing it silently diverges from what
   * is live. Starting from the default card makes "this is new" unmistakable.
   *
   * The signatures are re-baselined at the same time, otherwise the reset would
   * itself register as unsaved work — and the unload rescue would then write
   * this blank card over the draft that was just saved.
   */
  function resetPromoEditorToDefault() {
    const next: CampaignConfig = {
      ...configRef.current,
      promoCard: JSON.parse(JSON.stringify(defaultConfig.promoCard)),
    };
    setConfig(next);
    savedPromoSignatureRef.current = getPromoSignature(next);
    draftSignatureRef.current = getConfigSignature(next);
    setHasPromoChanges(false);
    setPromoEntryStep('build');
    // Makes the editors re-read from config — without it the contentEditable
    // fields keep showing the card that was just cleared.
    setConfigLoadedSignal((n) => n + 1);
  }

  /**
   * Drafting is manual — except when the work is about to be lost.
   *
   * On tab close or refresh we take one rescue copy so unsaved work survives,
   * and warn with the native prompt.
   *
   * The test is whether anything would actually be lost, which is a narrower
   * question than "has anything changed".
   *
   * Comparing against the published card alone was wrong, and so was
   * comparing against the saved draft alone: a card can equally be sitting in
   * My Published, and one the user never authored — a blank canvas, an
   * untouched template — is not worth stopping anybody over. The promo half
   * reuses the check the dashboard already makes, which weighs all three
   * places a card can be recovered from and whether it is the user's work at
   * all.
   *
   * A prompt that fires when there is nothing to lose is one people learn to
   * click through without reading, which costs more than it saves.
   *
   * Nothing is written on the way out. The local copy is for moving around
   * inside the tool, not for closing it: if the user is told their work may be
   * lost and leaves anyway, quietly keeping it makes the warning a lie.
   */
  /**
   * Keep a local copy of work in progress, continuously.
   *
   * The unload handler below covers a deliberate close, but it is not a
   * guarantee: a crash, a killed tab, a battery running out or a phone
   * switching apps never fire it. Writing as the user works means the copy is
   * already there whatever happens next.
   *
   * Debounced because this runs on every keystroke's worth of state, and
   * localStorage writes are synchronous — doing it eagerly would stutter the
   * editor it is meant to protect.
   *
   * Only real work is kept: the same at-risk test the close prompt uses, so a
   * blank canvas, a stock template or the published card unedited never
   * displaces something worth recovering.
   */
  /** True once a card has been loaded — see the recovery effect below. */
  const hasLoadedOnceRef = useRef(false);

  useEffect(() => {
    const promoAtRisk = promoWorkNotInDraftRef.current;
    const announcementAtRisk =
      hasAnnouncementChanges &&
      draftSignatureRef.current !== getConfigSignature(config);

    if (!promoAtRisk && !announcementAtRisk) {
      /**
       * Nothing at risk means nothing to recover — so the copy goes.
       *
       * Leaving it was the bug behind "Clear doesn't clear": clearing the
       * canvas puts the card beyond risk, this effect returned without writing
       * anything, and the copy taken a moment earlier stayed on disk. The next
       * visit dutifully restored the card the user had just thrown away.
       *
       * Guarded on a load having happened, because on first mount the config
       * is the default and nothing is at risk yet — clearing here would delete
       * the very copy loadConfig is about to read.
       */
      if (hasLoadedOnceRef.current) clearRecovery();
      return;
    }

    const id = window.setTimeout(() => writeRecovery(config), 800);
    return () => window.clearTimeout(id);
  }, [config, hasAnnouncementChanges]);

  /**
   * Keep the account's one-bit answer to "is work sitting unsaved somewhere?"
   * current.
   *
   * This is the only thing the server is told about unsaved work. Not the
   * card — that is the point of it being unsaved, and copying it up on every
   * edit would both cost a round trip per keystroke and quietly keep something
   * the user never asked us to keep. A boolean, the browser it is in, and when:
   * enough for another device to explain itself, and nothing more.
   *
   * Sent on the change, never on a timer, and `false` only when this browser
   * was the one that said `true`. Reporting "all clear" unconditionally would
   * let a second device wipe out the first device's claim just by loading the
   * editor, which is exactly the warning this exists to give.
   */
  useEffect(() => {
    const atRisk =
      promoWorkNotInDraftRef.current ||
      (hasAnnouncementChanges && draftSignatureRef.current !== getConfigSignature(config));
    if (reportedUnsavedRef.current === atRisk) return;

    const id = window.setTimeout(() => {
      reportedUnsavedRef.current = atRisk;
      reportUnsaved(atRisk);
    }, 1000);
    return () => window.clearTimeout(id);
  }, [config, hasAnnouncementChanges]);

  /**
   * Sign out after a spell of inactivity — and treat it as an accident, not a
   * decision.
   *
   * Someone who walks away has not chosen to stop working, so the order
   * matters: the local copy is written first, while the page is still ours,
   * and only then is anything attempted that can fail. If the logout request
   * never lands, the work is still on disk and the next visit restores it.
   *
   * A minute before that, the countdown appears. It is a dialog in the page,
   * which everyone gets, plus a desktop notification for anyone who granted
   * permission and has switched to another window — the case where the dialog
   * alone would be invisible and the sign-out would arrive unexplained.
   */
  useEffect(() => {
    let idleTimer: number | undefined;
    let warnTimer: number | undefined;
    let tick: number | undefined;

    const signOutIdle = () => {
      const atRisk =
        promoWorkNotInDraftRef.current ||
        (hasAnnouncementChangesRef.current &&
          draftSignatureRef.current !== getConfigSignature(configRef.current));

      if (atRisk) {
        writeRecovery(configRef.current);
        // Raised now rather than left to the debounced reporter, which will not
        // get another turn before this page is gone.
        reportUnsaved(true);
      }

      standDown();
      exitReasonRef.current = 'timeout';
      fetch('/api/auth/logout', { method: 'POST', keepalive: true })
        .catch(() => {})
        .finally(() => {
          window.location.href = '/login?reason=timeout';
        });
    };

    /**
     * Put the warning wherever the user actually is.
     *
     * The dialog is always rendered — it costs nothing in a tab nobody is
     * looking at, and it means someone coming back mid-countdown finds the
     * warning already there instead of being signed out mid-glance. The
     * desktop notification is what reaches them when they are elsewhere, and
     * is suppressed while the tab is visible because the dialog has it covered.
     */
    /**
     * Take every alarm back down.
     *
     * Gathered into one call because there are now four of them — dialog,
     * notification, tab title, icon, dock badge — and each exit from the
     * countdown used to remember them individually. Forgetting one leaves a
     * tab wearing a red dot over a session that is perfectly fine.
     */
    const standDown = () => {
      closeIdleNotification();
      restoreTitle();
      setFaviconAlert(false);
      setAppBadge(null);
    };

    const reachUser = () => {
      // Only while a countdown is actually running. Without this, a listener
      // outliving its warning — clicking the notification restarts the timer,
      // and the next tab switch arrives before the teardown has settled —
      // posts a notification for a warning that is already over.
      if (idleSecondsLeftRef.current === null) {
        standDown();
        return;
      }
      if (document.visibilityState === 'hidden') {
        setTitleCountdown(idleSecondsLeftRef.current);
        setFaviconAlert(true);
        setAppBadge(idleSecondsLeftRef.current);
        showIdleNotification(describeDuration(IDLE_LIMIT_MS - IDLE_WARNING_LEAD_MS), () =>
          restart(),
        );
      } else {
        // Back on the page, where the dialog speaks for itself. Leaving the
        // notification or the title alarm up would have them dismissing the
        // same warning twice.
        standDown();
      }
    };

    const beginWarning = () => {
      const seconds = Math.round(IDLE_WARNING_LEAD_MS / 1000);
      // The ref is written here as well as during render, because what reads
      // it is an event handler that can fire before React has re-rendered —
      // clicking the notification and switching tabs in the same breath.
      idleSecondsLeftRef.current = seconds;
      setIdleSecondsLeft(seconds);
      reachUser();

      // Watched for the whole countdown, not just its first moment. Switching
      // away after the dialog appeared used to mean no notification at all —
      // the warning sat in a tab the user could not see, and the sign-out
      // arrived unannounced.
      document.addEventListener('visibilitychange', reachUser);

      tick = window.setInterval(() => {
        setIdleSecondsLeft((left) => {
          if (left === null) return null;
          const next = Math.max(0, left - 1);
          idleSecondsLeftRef.current = next;
          // Only while they are elsewhere. Rewriting the title of a tab
          // somebody is looking at changes nothing they can see and leaves the
          // window chrome flickering behind the dialog.
          if (document.visibilityState === 'hidden') {
            setTitleCountdown(next);
            setAppBadge(next);
          }
          return next;
        });
      }, 1000);
    };

    const clearAll = () => {
      window.clearTimeout(idleTimer);
      window.clearTimeout(warnTimer);
      window.clearInterval(tick);
      document.removeEventListener('visibilitychange', reachUser);
    };

    function restart() {
      clearAll();
      idleSecondsLeftRef.current = null;
      setIdleSecondsLeft(null);
      standDown();
      /**
       * No clock at all while the tab is on screen.
       *
       * The guard lives here rather than at each caller because there are
       * three — the visibility change, any real input, and the "I'm still
       * here" button — and two of them fire while the page is visible. Without
       * it, typing would start a countdown that then interrupted the person
       * typing.
       */
      if (document.visibilityState === 'visible') return;
      warnTimer = window.setTimeout(beginWarning, IDLE_LIMIT_MS - IDLE_WARNING_LEAD_MS);
      idleTimer = window.setTimeout(signOutIdle, IDLE_LIMIT_MS);
    }

    // Real input only, and only while nothing is being asked. A mousemove
    // listener would keep the session alive under a sleeping cursor, and once
    // the countdown is up it wants an answer rather than a twitch.
    const onActivity = () => {
      if (idleSecondsLeftRef.current !== null) return;
      restart();
    };

    const events: (keyof WindowEventMap)[] = ['pointerdown', 'keydown', 'wheel', 'touchstart'];
    events.forEach((event) => window.addEventListener(event, onActivity, { passive: true }));

    /**
     * The clock only runs while the user is somewhere else.
     *
     * Sitting on the tool reading your own card was enough to be counted idle,
     * because idleness was measured by input alone — so a modal countdown
     * interrupted someone who was plainly present and looking straight at it.
     * Being on the page IS the activity.
     *
     * So the timer starts when the tab is hidden and stops when it comes back,
     * which also means the warning can only ever reach someone who has left —
     * exactly who it is for.
     */
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        restart();
      } else {
        clearAll();
        idleSecondsLeftRef.current = null;
        setIdleSecondsLeft(null);
        standDown();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    if (document.visibilityState === 'hidden') restart();
    idleRestartRef.current = restart;

    return () => {
      clearAll();
      standDown();
      document.removeEventListener('visibilitychange', onVisibility);
      events.forEach((event) => window.removeEventListener(event, onActivity));
    };
  }, []);

  /**
   * Raise the notification card, once per visit.
   *
   * Silent only when the permission is already granted. Denied still gets a
   * card, because the way it usually happens is someone accepting here and
   * then hitting Block in the browser's prompt — they wanted this and ended up
   * without it. What it says changes, though: an Allow button against a denied
   * permission is a button that does nothing.
   */
  useEffect(() => {
    if (!notificationsSupported()) return;
    const permission = notificationPermission();
    if (permission === 'granted') return; // Nothing to ask for.
    setAskNotifications(permission === 'denied' ? 'blocked' : 'ask');
  }, []);

  /**
   * Is any OTHER browser holding unsaved work for this account?
   *
   * This browser names itself so the server can leave it out — its own flag is
   * still up while it holds work, and reporting that back would tell someone
   * their edits are elsewhere while they are looking at them. A device holding
   * unsaved work cannot hand it over either, so the answer only ever explains
   * why that work is not here.
   */
  useEffect(() => {
    let cancelled = false;
    fetchUnsavedElsewhere().then((elsewhere) => {
      if (cancelled || !elsewhere) return;
      setElsewhereNotice({ deviceLabel: elsewhere.deviceLabel, at: elsewhere.at });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  /**
   * Leaving is never a question any more.
   *
   * The browser's "Leave site?" prompt used to guard this, with the tool
   * offering a draft to anyone who cancelled. It went because it was answering
   * the wrong question. Closing a tab is not a decision about the work — most
   * of the time it is a machine going to sleep, a window being tidied, or a
   * shutdown — and a prompt there asks people to make a call about something
   * they were not thinking about, at the one moment they are trying to be
   * elsewhere. Worse, it could only ever be a warning: the browser will not
   * say which button was pressed, so the tool had to guess, and answering
   * Leave threw the work away on the strength of that guess.
   *
   * What replaces it is the same thing that already handles a crash: the work
   * is on disk before the page goes, and it comes back on the way in. Nothing
   * is asked, and nothing is lost.
   */
  useEffect(() => {
    const preserveWork = () => {
      const atRisk =
        promoWorkNotInDraftRef.current ||
        (hasAnnouncementChangesRef.current &&
          draftSignatureRef.current !== getConfigSignature(configRef.current));
      if (!atRisk) return;

      // Synchronous, so it completes while the page still exists — the
      // debounced autosave may have up to 800ms of edits still pending.
      writeRecovery(configRef.current);
      // Raised now rather than left to the debounced reporter, which will not
      // get another turn. keepalive carries it past the page's death.
      if (!reportedUnsavedRef.current) reportUnsaved(true);
    };

    /**
     * The page is going.
     *
     * `persisted` means it is being frozen for back/forward cache rather than
     * closed — it will be resumed with everything still in memory, so there is
     * nothing to save and no visit to restore on.
     *
     * Signing out is the one exit that still discards: it is a deliberate act,
     * and the user was offered the draft slot on the way. Everything else —
     * closing, timing out, the lid shutting — keeps the copy.
     */
    const handlePageHide = (e: PageTransitionEvent) => {
      if (e.persisted) return;
      if (exitReasonRef.current === 'logout') return;
      preserveWork();
    };

    /**
     * A tab is hidden before it is discarded, and on mobile a page can be
     * killed while hidden without `pagehide` ever firing. Saving here as well
     * costs a localStorage write on a tab switch and buys the phone case.
     */
    const handleVisibility = () => {
      if (document.visibilityState === 'hidden' && !exitReasonRef.current) preserveWork();
    };

    window.addEventListener('pagehide', handlePageHide);
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      window.removeEventListener('pagehide', handlePageHide);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  useEffect(() => {
    mainScrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, [activeTab]);

  /**
   * Offer the saved draft once the promo editor is actually open.
   *
   * A dialog rather than a toast: this is a question, and a toast is a poor
   * place to ask one — it times out while the user is still reading, and
   * answering it means hitting a target that is about to disappear.
   *
   * The ref is cleared as it opens, so switching tabs back and forth doesn't
   * re-ask about a draft already passed on. Declining leaves it saved and
   * reachable from the My Draft chip.
   */
  useEffect(() => {
    if (activeTab !== 'promo') {
      // Leaving the tab answers it: the question was about this editor, and a
      // dialog rendered at page level would otherwise follow the user to the
      // dashboard and be waiting again on every return. The draft is not
      // touched — it stays on the My Draft chip.
      setDraftOffer(null);
      return;
    }
    if (!offeredDraftRef.current) return;
    setDraftOffer(offeredDraftRef.current);
    offeredDraftRef.current = null;
  }, [activeTab]);

  /** Take up the offered draft — what the old silent restore did, on request. */
  function acceptOfferedDraft(draft: CampaignConfig) {
    setDraftOffer(null);
    setConfig(draft);
    draftSignatureRef.current = getConfigSignature(draft);
    setSavedDraftSignature(getConfigSignature(draft));
    setDraftPromoCard(JSON.parse(JSON.stringify(draft.promoCard)));
    savedPromoSignatureRef.current = getPromoSignature(draft);
    setHasAnnouncementChanges(true);
    setHasPromoChanges(true);
    setReadyToPublishAnnouncement(true);
    setPromoEntryStep('editor');
    setConfigLoadedSignal((n) => n + 1);
    toast('Picked up where you left off');
  }

  // Consent before discarding a draft (destructive).
  const [confirmDiscardDraft, setConfirmDiscardDraft] = useState(false);
  /**
   * A dashboard action held back because the editor has work that isn't in the
   * draft. Both entries lead somewhere that replaces the canvas, so the user
   * is offered the save here rather than losing it silently.
   */
  const [pendingDashboardAction, setPendingDashboardAction] = useState<
    'create' | 'published' | null
  >(null);
  /**
   * True when the editor holds promo work that is NOT in the saved draft.
   *
   * A ref because the dashboard handlers are stable callbacks — reading state
   * inside them would capture whatever it was when they were created.
   */
  const promoWorkNotInDraftRef = useRef(false);
  // Bumped to open the build panel when the flow is already mounted.
  const [openBuildSignal, setOpenBuildSignal] = useState(0);
  // Bumped once the real card lands from the DB. The editor mounts on
  // defaultConfig, so anything the editor seeds from the card at mount time
  // would otherwise freeze on the default template's look.
  const [configLoadedSignal, setConfigLoadedSignal] = useState(0);

  /**
   * The promo canvas was cleared and nothing has been chosen since.
   *
   * Held here rather than inside the editor because the editor unmounts every
   * time the user visits another tab. It went with it, so a cleared card came
   * back without its countdown and button outlines and looked like it had
   * quietly lost half of itself. The flag describes the card, and the card
   * lives here.
   */
  const [promoBlankStart, setPromoBlankStart] = useState(false);

  /**
   * May the countdown switch itself on once both dates exist?
   *
   * Only after Clear, where the end date is genuinely missing and supplying it
   * is the user finishing the schedule. Create new collects both dates before
   * the card has been seen, so the same behaviour there is the app deciding
   * for them — which is why this is a separate flag and not `promoBlankStart`.
   */
  const [promoTimerAutoArmed, setPromoTimerAutoArmed] = useState(false);

  /**
   * Rebuild both flags from the card whenever one is loaded.
   *
   * They are React state, so a reload wipes them — and a reload is exactly
   * when work comes back. Typing a title, closing the tool and returning
   * restored the card but not the fact that its canvas had been cleared, so
   * the countdown and button outlines were missing from a card that plainly
   * still needed them.
   *
   * Both are readable from the card, which is the real record: a card still
   * wearing the blank look has had no design chosen, and one with no end date
   * has a schedule left to finish. Deriving them here means every path that
   * loads a card — recovery, draft, published, a fresh page — gets the same
   * answer without having to remember to set anything.
   */
  useEffect(() => {
    if (!configLoadedSignal) return;
    const card = configRef.current.promoCard;
    const wearingBlank = lookSignature(card.style) === lookSignature(BLANK_LOOK);
    /**
     * A blank start needs an empty card, not just an unstyled one.
     *
     * Publishing a card with only a headline and opening it again showed
     * "A supporting line" and "A little more about the offer" in the fields
     * left empty — placeholders, but indistinguishable from the tool having
     * written copy nobody asked for. Whatever was empty when it was saved has
     * to be empty when it comes back.
     */
    const plain = (html?: string) => String(html ?? '').replace(/<[^>]*>/g, '').trim();
    const hasWords = Boolean(
      plain(card.title) || plain(card.subtitle) || plain(card.description) || plain(card.buttonText),
    );
    setPromoBlankStart(wearingBlank && !hasWords);
    hasLoadedOnceRef.current = true;
    // Only armed while the end date is still the missing piece. A restored
    // card that already has one must not have its countdown switched on for it.
    setPromoTimerAutoArmed(wearingBlank && !card.endDate);
  }, [configLoadedSignal]);

  /**
   * The session ended without the user ending it — a timeout, or the machine
   * going away — and their work was put back.
   *
   * Shown after the fact, never as a question. They did not choose to stop, so
   * the editor restores what they had and then says so; asking "want it back?"
   * makes an accident into a decision they have to get right.
   */
  const [restoreNotice, setRestoreNotice] = useState<{
    /** When the local copy was taken. Empty for copies written before it was recorded. */
    localSavedAt: string | null;
    /** When the parked draft was saved, if there is one. Null means there isn't. */
    draftSavedAt: string | null;
    /**
     * The draft is newer than the work being restored.
     *
     * Which means it was saved after this browser stopped — from somewhere
     * else, by definition, since this browser was gone. Worth saying before
     * they replace it, because the usual assumption is the opposite: that the
     * draft is the older thing and these edits move it forward.
     */
    draftIsNewer: boolean;
  } | null>(null);

  /**
   * Unsaved work is sitting in a different browser.
   *
   * There is nothing to restore here — that is the whole message. Work that was
   * never saved as a draft stays in the browser that made it, so the only
   * honest thing to say is where it is and how to get it back.
   */
  const [elsewhereNotice, setElsewhereNotice] = useState<{
    deviceLabel: string;
    at: string | null;
  } | null>(null);

  /**
   * Why the page is leaving, when the app is the one making it leave.
   *
   * Both cases have to skip the browser's leave prompt — it is meant for a
   * user closing a tab, not for the app navigating on their behalf. They then
   * split on the local copy: signing out is a decision, and follows the same
   * rule as answering Leave to the close prompt, so the copy goes. Timing out
   * is not a decision at all, so the copy stays and is what gets restored on
   * the way back in.
   */
  const exitReasonRef = useRef<'logout' | 'timeout' | null>(null);

  /** What we last told the server, so a save clears only a flag we raised. */
  const reportedUnsavedRef = useRef(false);

  /**
   * Seconds left before an idle sign-out, or null when nothing is pending.
   *
   * Only the button clears it. Ordinary activity resets the timer right up
   * until the warning appears, but once it is on screen it wants an answer —
   * a stray scroll from a cat on the keyboard is not somebody saying they are
   * still there, and the dialog blocks the editor anyway.
   */
  const [idleSecondsLeft, setIdleSecondsLeft] = useState<number | null>(null);

  /**
   * The notification card, and which of two things it has to say.
   *
   * 'ask' is the offer, shown before the browser's own prompt so that "Not
   * now" costs nothing — it dismisses ours and returns next visit, and the
   * real prompt is only ever reached by someone who chose Allow.
   *
   * 'blocked' is the awkward middle: they chose Allow here and then Block in
   * the browser. They asked for this and do not have it, so staying silent
   * would strand them — but the offer cannot be repeated either, because a
   * denied permission makes requestPermission() resolve instantly without
   * prompting. All that is left to do is say where the switch is.
   */
  const [askNotifications, setAskNotifications] = useState<
    'ask' | 'blocked' | 'enabled' | null
  >(null);

  /** Mirrors the countdown for the activity listener, which is bound once. */
  const idleSecondsLeftRef = useRef<number | null>(null);
  idleSecondsLeftRef.current = idleSecondsLeft;
  /** Lets the dialog's button reach the timer that owns the countdown. */
  const idleRestartRef = useRef<(() => void) | null>(null);

  /**
   * Everything worth saying about arriving, gathered into one answer.
   *
   * Three facts can be true at once: this browser rescued edits from a session
   * that ended, a draft is parked, and another device is holding unsaved work
   * of its own. They were up to three dialogs queued behind one another, so
   * the second device — the awkward case, where all three apply — greeted
   * people with a stack of boxes describing one situation from three angles.
   *
   * The lead is whichever fact needs acting on soonest: rescued edits first,
   * because they are already on the canvas; then a parked draft, which is a
   * real question; then work stranded on another device, which is only ever
   * news. The others become lines underneath.
   */
  const welcomeBack = (() => {
    if (activeTab !== 'promo') return null;
    // Stands down while the sign-out countdown is up. Two glass panels stacked
    // on each other read as one broken thing, and arriving is not the pressing
    // matter when the session is about to end. It comes straight back when the
    // countdown is answered, since none of its state has been touched.
    if (idleSecondsLeft !== null) return null;
    const elsewhere = elsewhereNotice;
    if (restoreNotice) return { mode: 'restored' as const, ...restoreNotice, elsewhere };
    if (draftOffer) {
      return { mode: 'draft' as const, draftSavedAt: draftOffer.lastUpdated ?? null, elsewhere };
    }
    if (elsewhere) return { mode: 'elsewhere' as const, elsewhere };
    return null;
  })();

  function dismissWelcomeBack() {
    setRestoreNotice(null);
    setDraftOffer(null);
    setElsewhereNotice(null);
  }

  // A picker the editor should open as soon as it mounts, set by the
  // dashboard's "Edit published". Cleared by the editor once acted on.
  const [pendingPromoPopup, setPendingPromoPopup] = useState<'published' | 'draft' | null>(null);
  // The schedule dialog serves two intents, and they end differently:
  //   'new'      → starting a campaign, so it continues to the build panel
  //   'schedule' → an existing card just missing dates, so it returns to work
  const [createIntent, setCreateIntent] = useState<'new' | 'schedule'>('new');
  const [showCreateSetup, setShowCreateSetup] = useState(false);
  const [createStart, setCreateStart] = useState('');
  const [createEnd, setCreateEnd] = useState('');
  /** Bumped to remount the editors so they re-read a reverted config. */
  const [editorResetKey, setEditorResetKey] = useState(0);

  // Invalid promo schedule = both dates set and start is after end. Blocks
  // Save/Publish (disabled CTA); the ping triggers PromoSection's scroll+flash
  // fallback if a save is somehow still attempted.
  const promoDateRangeInvalid = (() => {
    const s = config.promoCard.startDate;
    const e = config.promoCard.endDate;
    return !!(s && e && s > e);
  })();
  const [promoDateErrorPing, setPromoDateErrorPing] = useState(0);
  // Returns true (and fires the fallback guard) when a promo save/publish must
  // be blocked because the date range is invalid.
  function blockPromoSaveIfInvalidRange(): boolean {
    const s = configRef.current.promoCard.startDate;
    const e = configRef.current.promoCard.endDate;
    if (s && e && s > e) {
      setPromoDateErrorPing((n) => n + 1);
      return true;
    }
    return false;
  }

  // Tab switches no longer auto-save a draft — drafting is explicit only
  // ("Save as draft"), so switching tabs just switches tabs.
  const handleTabSwitch = useCallback(
    (tab: 'dashboard' | 'announcement' | 'promo') => {
      if (tab === activeTab) return;
      // The Promo Card tab goes straight into the editor on the last edited
      // state — same as every other route into promo.
      if (tab === 'promo') {
        setPromoEntryStep('editor');
        // Reaching the editor by the tab used to skip the schedule question
        // entirely, so a card started this way had no dates — while the editor
        // marks Campaign Duration REQUIRED and Publish refuses without it.
        // Ask here too, so the date step can't be missed whichever door is used.
        const pc = configRef.current.promoCard;
        /**
         * Only worth asking once there is a card to schedule.
         *
         * A cleared canvas deliberately has no end date — the user sets it in
         * the panel, and that is what switches the countdown on. Forcing the
         * dialog on the way back into the tab took that decision off them and
         * refilled the field they had just been left to fill.
         *
         * Publish still refuses without dates, so nothing escapes unscheduled;
         * the ask simply waits until there is something to schedule.
         */
        const nothingToSchedule = cardIsNotUserWork(
          pc,
          sampleTemplates.map((t) => t.promoCard as CampaignConfig['promoCard']),
        );
        if (!nothingToSchedule && (!pc.startDate || !pc.endDate)) {
          setCreateIntent('schedule');
          setCreateStart(pc.startDate || getISODateWithOffset(0));
          setCreateEnd(pc.endDate || '');
          setShowCreateSetup(true);
        }
      }
      setActiveTab(tab);
    },
    [activeTab],
  );

  /**
   * AI content landed on the card. Nothing is saved here — drafting stays
   * explicit — but the promo tab should now reopen on the editor rather than
   * the start picker, so leaving and coming back keeps the generated card.
   */
  const handleAiApplied = useCallback(() => {
    setPromoEntryStep('editor');
  }, []);

  /**
   * "Create promo card" on an empty dashboard. The schedule + build-method
   * dialog opens HERE, over the dashboard, rather than sending the user to a
   * picker first — there's nothing to pick from on a first run.
   */
  const handleCreatePromo = useCallback(() => {
    if (promoWorkNotInDraftRef.current) {
      setPendingDashboardAction('create');
      return;
    }
    startCreatePromo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** The actual create flow, once nothing is at risk. */
  const startCreatePromo = useCallback(() => {
    setCreateIntent('new');
    setCreateStart(getISODateWithOffset(0));
    setCreateEnd('');
    setShowCreateSetup(true);
  }, []);

  /**
   * Dashboard → the editor with a picker already open.
   *
   * The choice of WHICH card belongs in front of the canvas it loads onto, so
   * these entries don't load anything themselves — they open My Published or
   * My Draft and let the user pick there.
   */
  const handleOpenPublishedPromo = useCallback(() => {
    if (promoWorkNotInDraftRef.current) {
      setPendingDashboardAction('published');
      return;
    }
    openPublishedPicker();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Loads the LIVE card into the editor, once nothing is at risk.
   *
   * Straight to the card rather than the picker: this comes from Edit on the
   * dashboard thumbnail, which shows the live card — so that's the card the
   * user means. My Published is still there for choosing a different one.
   */
  const openPublishedPicker = useCallback(() => {
    const live = publishedConfigObjRef.current;
    if (live) {
      const next: CampaignConfig = {
        ...configRef.current,
        promoCard: JSON.parse(JSON.stringify(live.promoCard)),
      };
      setConfig(next);
      configRef.current = next;
      draftSignatureRef.current = getConfigSignature(next);
      savedPromoSignatureRef.current = getPromoSignature(next);
      setHasPromoChanges(getConfigSignature(next) !== publishedConfigRef.current);
      setEditorResetKey((k) => k + 1);
    }
    setPromoEntryStep('editor');
    setActiveTab('promo');
    toast('Your live card is loaded — edit it here, or use Improve with AI.');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Commits the schedule from the dashboard dialog and opens the editor with
   * the build panel up. The dashboard asks WHEN; the editor asks HOW, next to
   * the card that the answer applies to.
   */
  function startNewPromo() {
    /**
     * "Create new" starts from a blank card, not from whatever was last on the
     * canvas. Keeping the old card meant AI wrote on top of a previous
     * campaign's leftovers, and the AI panel previewed a card the user wasn't
     * making. Unsaved work is already protected by the guard that runs before
     * this — by the time we're here, the user has agreed to move on.
     *
     * The schedule-only path (an existing card missing dates) leaves the card
     * alone: nothing about that flow says "start over".
     */
    const startingFresh = createIntent === 'new';

    setConfig((prev) => ({
      ...prev,
      promoCard: startingFresh
        ? {
            ...(JSON.parse(JSON.stringify(defaultConfig.promoCard)) as CampaignConfig['promoCard']),
            // On-air state belongs to the website, not the card being drafted;
            // creating a new one must never take the live campaign down.
            active: prev.promoCard.active,
            stoppedByUser: prev.promoCard.stoppedByUser,
            startDate: createStart,
            endDate: createEnd,
          }
        : { ...prev.promoCard, startDate: createStart, endDate: createEnd },
    }));
    markPromoChanged();
    if (startingFresh) {
      // A blank card, so the skeleton outlines belong here too...
      setPromoBlankStart(true);
      // ...but the dates were answered in the dialog a moment ago, so the
      // countdown stays off until the user asks for it. Without this the
      // auto-on rule sees a blank card with a complete schedule and switches
      // it on before they have even seen the card.
      setPromoTimerAutoArmed(false);
    }
    // Remount so the contentEditable fields re-read the blank card; without it
    // the old text stays visible even though state has been replaced.
    if (startingFresh) setEditorResetKey((k) => k + 1);
    setShowCreateSetup(false);
    // "Create new" always continues to the build panel — that's the point of
    // it. The schedule-only prompt returns to the card it interrupted, unless
    // that card is blank, in which case building is what comes next anyway.
    const hasContent = promoHasVisibleContent(configRef.current.promoCard);
    const goToBuild = createIntent === 'new' || !hasContent;
    setPromoEntryStep(goToBuild ? 'build' : 'editor');
    // Covers the case where the promo tab is already open: initialStep is only
    // read at mount, so without this the dialog closed onto nothing.
    if (goToBuild) setOpenBuildSignal((n) => n + 1);
    setActiveTab('promo');
  }

  // Dashboard shortcuts (Edit / the card itself) open an existing campaign, so
  // they bypass the guided picker and land in the editor.
  const handleDashboardTabSwitch = useCallback(
    (tab: 'dashboard' | 'announcement' | 'promo') => {
      if (tab === activeTab) return;
      if (tab === 'promo') setPromoEntryStep('editor');
      setActiveTab(tab);
    },
    [activeTab],
  );

  // A draft is only worth persisting/restoring when it carries real content —
  // visible text in a promo field or an announcement message. A blank card
  // (e.g. right after Start Fresh, which sets the dirty flag but has no text)
  // differs from published only by defaults (dates/style), which isn't work
  // worth a "You have an unpublished draft" banner.
  function htmlHasVisibleText(html: string | undefined): boolean {
    if (!html) return false;
    return html
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/[\u200B\u200C\u200D\uFEFF]/g, '')
      .trim().length > 0;
  }
  function promoHasVisibleContent(pc: CampaignConfig['promoCard']): boolean {
    return (
      htmlHasVisibleText(pc.title) ||
      htmlHasVisibleText(pc.subtitle) ||
      htmlHasVisibleText(pc.description) ||
      htmlHasVisibleText(pc.buttonText)
    );
  }
  // Announcement signature (live on/off excluded) — to tell a real announcement
  // edit apart from the default messages.
  function announcementSignature(cfg: CampaignConfig): string {
    const ann = { ...(cfg.announcementBar as unknown as Record<string, unknown>) };
    delete ann.active;
    return JSON.stringify(ann);
  }
  // Authoritative: is a draft worth restoring (→ show the banner)? Yes only if
  // the promo has authored text, OR the announcement actually differs from
  // what's published. A blank promo (Start Fresh) with unchanged announcements
  // is NOT restorable work, even though the announcement carries its messages.
  function draftHasRestorableWork(
    draft: CampaignConfig,
    published: CampaignConfig | null,
  ): boolean {
    if (promoHasVisibleContent(draft.promoCard)) return true;
    if (!published) return false;
    return announcementSignature(draft) !== announcementSignature(published);
  }

  // Persist the draft only if it carries restorable work — real promo text or a
  // changed announcement. A fresh/blank promo (even one that replaced a full
  // published card) is trivially recreatable, so it's not worth a draft.
  // Returns whether a draft was actually written.
  // The draft lives in the DB via /api/draft. The DB write is fired without
  // awaiting (with keepalive so it survives page unload); the decision — save
  // vs skip, and the returned boolean the callers use for the toast — stays
  // synchronous so call sites don't change.
  function saveDraft(
    cfg: CampaignConfig,
    options: { markHandled?: boolean } = {},
  ): boolean {
    /**
     * Nothing worth keeping in the editor — so write nothing. It must NOT
     * clear the slot.
     *
     * This used to delete the draft, on the reasoning that a blank card should
     * not leave a stale one behind. But the two are unrelated: the draft is
     * whatever was parked there earlier, and an empty canvas says nothing
     * about it. The unload rescue runs this on every close, so closing the tab
     * with a cleared canvas silently destroyed a draft the user had saved
     * days before and never touched in that session.
     *
     * Deleting a draft stays where the user can see it: the My Draft popup,
     * and publishing, which supersedes it.
     */
    if (!draftHasRestorableWork(cfg, publishedConfigObjRef.current)) {
      return false;
    }

    fetch('/api/draft', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cfg),
      keepalive: true,
    }).catch(() => {});
    setSavedDraftSignature(getConfigSignature(cfg));
    setDraftPromoCard(JSON.parse(JSON.stringify(cfg.promoCard)));
    if (options.markHandled !== false) {
      draftSignatureRef.current = getConfigSignature(cfg);
    }
    return true;
  }

  /**
   * Crash recovery, kept apart from the draft.
   *
   * These are two different jobs that were sharing one slot and had opposite
   * rules. A draft is parked on purpose and must never be overwritten without
   * asking. A recovery copy is taken automatically and *should* be replaced by
   * the next one. Sharing the slot meant one of them always lost: either the
   * rescue clobbered a deliberate draft, or — once that was stopped — work in
   * progress had nowhere to go because the slot was taken.
   *
   * Recovery lives in localStorage: it is per-browser, survives a reload, and
   * costs no round trip on the way out, which matters when the page is already
   * closing.
   */
  const RECOVERY_KEY = 'campaign-admin:recovery';

  /**
   * Stored with the moment it was taken, not just the config.
   *
   * The config's own `lastUpdated` is when it was last published, which says
   * nothing about when this copy was made — and without that, a draft saved
   * from another device in the meantime cannot be told from one saved before
   * the user ever walked away.
   */
  interface RecoveryEnvelope {
    savedAt: string;
    config: CampaignConfig;
  }

  function writeRecovery(cfg: CampaignConfig) {
    try {
      const envelope: RecoveryEnvelope = { savedAt: new Date().toISOString(), config: cfg };
      localStorage.setItem(RECOVERY_KEY, JSON.stringify(envelope));
    } catch {
      // Private mode or quota — nothing to fall back to, and the close must
      // not be blocked by it.
    }
  }

  /**
   * Reads either shape.
   *
   * Copies written before this carried the bare config. They belong to someone
   * who is mid-edit right now, so the change must not throw their work away —
   * it reads as a recovery with an unknown time, which is exactly what it is.
   */
  function readRecoveryEnvelope(): RecoveryEnvelope | null {
    try {
      const raw = localStorage.getItem(RECOVERY_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed.savedAt === 'string' && parsed.config) {
        return parsed as RecoveryEnvelope;
      }
      return { savedAt: '', config: parsed as CampaignConfig };
    } catch {
      return null;
    }
  }

  function readRecovery(): CampaignConfig | null {
    return readRecoveryEnvelope()?.config ?? null;
  }

  function clearRecovery() {
    try {
      localStorage.removeItem(RECOVERY_KEY);
    } catch {
      /* nothing to do */
    }
  }

  function clearDraft() {
    fetch('/api/draft', { method: 'DELETE', keepalive: true }).catch(() => {});
    draftSignatureRef.current = null;
    setSavedDraftSignature(null);
    setDraftPromoCard(null);
  }

  /**
   * Deleting the saved draft, from the My Draft popup.
   *
   * If the canvas is showing exactly that draft, it goes back to what's live —
   * otherwise the "deleted" work stays on screen, still counts as unsaved, and
   * every entry point starts offering to save it again. Mirrors what deleting
   * a live variant already does.
   *
   * Edits made since the draft was saved are left alone: those are the user's
   * current work, not the thing they just deleted.
   */
  function handleDeleteDraft() {
    const deleted = draftPromoCard;
    const live = publishedConfigObjRef.current;
    clearDraft();
    if (!deleted || !live) return;
    // Normalised for the same reason as everywhere else — otherwise the app's
    // own HTML rewrites make the canvas look "edited since saving" and the
    // deleted draft is left sitting on it.
    const sig = (card: CampaignConfig['promoCard']) =>
      JSON.stringify(normalizePromoForCompare(card as unknown as Record<string, unknown>));
    if (sig(configRef.current.promoCard) !== sig(deleted)) return;

    const next: CampaignConfig = {
      ...configRef.current,
      promoCard: JSON.parse(JSON.stringify(live.promoCard)),
    };
    setConfig(next);
    configRef.current = next;
    draftSignatureRef.current = getConfigSignature(next);
    savedPromoSignatureRef.current = getPromoSignature(next);
    setHasPromoChanges(getConfigSignature(next) !== publishedConfigRef.current);
    setEditorResetKey((k) => k + 1);
  }

  // Explicit "Save as draft" — the ONLY way a draft is ever written now.
  // Unlike the automatic saveDraft() above, this always writes what's in the
  // editor: an explicit click means the user wants it saved, blank or not.
  function writeDraftNow() {
    const cfg = configRef.current;
    setSavingDraft(true);
    fetch('/api/draft', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cfg),
    })
      .then((res) => {
        if (res.ok) {
          draftSignatureRef.current = getConfigSignature(cfg);
          setSavedDraftSignature(getConfigSignature(cfg));
          setDraftPromoCard(JSON.parse(JSON.stringify(cfg.promoCard)));
          // Safe in the draft now, so the recovery copy has nothing to rescue.
          clearRecovery();
          toast('Saved draft updated');
          // Parked in My Draft — the editor is free for the next card.
          resetPromoEditorToDefault();
        } else {
          toast('Couldn’t save your draft', true);
        }
      })
      .catch(() => toast('Couldn’t save your draft', true))
      .finally(() => setSavingDraft(false));
  }

  // There's only one draft slot — if it's already occupied, confirm before
  // overwriting it.
  async function handleSaveAsDraft() {
    setSavingDraft(true);
    let exists = false;
    try {
      const res = await fetch('/api/draft');
      const data = res.ok ? await res.json() : null;
      exists = Boolean(data?.draft);
    } catch {
      // Can't tell — fall through and just write; worst case is an
      // unconfirmed overwrite, better than silently failing to save.
    }
    setSavingDraft(false);
    if (exists) {
      setConfirmReplaceDraft(true);
      return;
    }
    writeDraftNow();
  }

  function completePendingDraftAction(action = pendingDraftAction) {
    if (!action) return;
    setPendingDraftAction(null);
    if (action.type === 'tab') {
      setActiveTab(action.tab);
      return;
    }
    // Only 'logout' is left, and it means what it says.
    performLogout();
  }

  function saveDraftAndContinue() {
    if (saveDraft(configRef.current)) toast('Saved draft updated');
    completePendingDraftAction();
  }

  function continueWithoutDraft() {
    draftSignatureRef.current = getConfigSignature(configRef.current);
    completePendingDraftAction();
  }

  /**
   * Whatever is on the website has a saved copy behind it.
   *
   * Publishing the promo saved a variant, but that was the only path that did.
   * Publishing the ANNOUNCEMENT writes the whole config — promo card included —
   * so unpublished promo edits went live with nothing saved and no live-variant
   * pointer; the same was true of Go on air when the recorded variant had since
   * been deleted. The card was then live and unlisted, which is how you end up
   * with something serving that My Published can't show you.
   *
   * So the guarantee lives here, at the single write both paths go through,
   * rather than in each publish handler where the next new path would miss it.
   */
  async function ensureLivePromoVariant(
    cfg: CampaignConfig,
  ): Promise<CampaignConfig> {
    if (!cfg.promoCard?.active) return cfg;
    // A blank card is trivially recreatable — saving it would just spend a slot.
    if (!promoHasVisibleContent(cfg.promoCard)) return cfg;

    const signature = (card: PromoCard) =>
      JSON.stringify(
        normalizePromoForCompare(card as unknown as Record<string, unknown>),
      );

    const live = signature(cfg.promoCard);
    const existing = await listVersions();
    const match = existing.find((version) => signature(version.promoCard) === live);
    if (match) {
      // Already saved — just make sure the marker names it. Compared on
      // normalized content, so the app's own HTML rewrites don't file a second
      // copy of a card that's already in the list.
      if (!match.isLive) {
        setSelectedPromoVersionId(match.id);
        await markVariantLive(match.id);
      }
      return cfg;
    }

    // Overflow is allowed on purpose: the list is capped at five, and dropping
    // the oldest saved design is better than the live card having no copy at
    // all. The publish flow still asks first when it can (see
    // getPromoVariantSaveStatus); this is the backstop for paths that can't.
    const savedId = await savePromoVariant(cfg, true);
    await markVariantLive(savedId);
    return cfg;
  }

  async function persistConfig(
    cfg: CampaignConfig,
    successMessage = 'Settings saved successfully',
    scope?: 'announcement' | 'promo',
    options: { preserveDraft?: boolean } = {},
  ) {
    try {
      // Anything going live gets a saved variant first, so the write below can
      // never publish a card that My Published doesn't know about.
      const guaranteed = await ensureLivePromoVariant(cfg);
      // Build the button destination from the CTA type
      const cfgToSend = { ...guaranteed };
      const pc = cfgToSend.promoCard;
      const cta = pc.ctaType || 'whatsapp';
      if (cta === 'whatsapp') {
        // The same builder the editor preview uses, so what goes live is
        // exactly what the preview button opens. Unconditional, so switching
        // from a link CTA to WhatsApp can't publish the old URL.
        cfgToSend.promoCard = {
          ...pc,
          buttonUrl: whatsAppUrl(pc.whatsappCountryCode, pc.whatsappNumber) ?? '',
        };
      } else if (cta === 'text') {
        // Plain text CTA: styled button with no link
        cfgToSend.promoCard = { ...pc, buttonUrl: '' };
      }

      const response = await fetch('/api/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cfgToSend),
      });

      if (response.ok) {
        // Whatever we just persisted IS the live site now — the Dashboard reads
        // this. Record the guaranteed config, not the one passed in: it carries
        // the live-variant pointer, and without it My Published would show no
        // Live tag until the next reload.
        setPublishedConfig(guaranteed);
        publishedConfigRef.current = getConfigSignature(guaranteed);
        publishedConfigObjRef.current = guaranteed;
        // A live on-air toggle (preserveDraft) must not reset the "unpublished
        // changes" flags — only a real publish does.
        if (!options.preserveDraft) {
          if (scope === 'announcement') setHasAnnouncementChanges(false);
          else if (scope === 'promo') setHasPromoChanges(false);
          else { setHasAnnouncementChanges(false); setHasPromoChanges(false); }
          /**
           * What happens to the saved draft is the user's call, not ours.
           *
           * Publishing used to delete it outright, on the reasoning that going
           * live supersedes the parked copy. Sometimes true — but a draft is
           * whatever the user put aside, often work on a different card, and
           * publishing says nothing about wanting that gone.
           *
           * So: if the draft is what was just published, it is redundant and
           * goes quietly — nothing can be lost, the content is live. If it
           * differs, it is asked about rather than assumed.
           */
          // Live now, so anything the recovery slot was holding is moot.
          clearRecovery();
          if (savedDraftSignatureRef.current !== null) {
            if (savedDraftSignatureRef.current === getConfigSignature(guaranteed)) {
              clearDraft();
            } else {
              setPostPublishDraft(true);
            }
          }
          // The card is live now, so the editor starts fresh for the next one.
          // Undefined scope saves both, so it counts as a promo publish too.
          if (scope !== 'announcement') resetPromoEditorToDefault();
        }
        toast(successMessage);
      } else {
        toast('Failed to save settings', true);
      }
    } catch (error) {
      console.error('Failed to save config:', error);
      toast('Failed to save settings', true);
    }
  }

  // The variant popup closes on click and the publish continues in the
  // background — so in publish mode we light up the header Publish button's
  // loader (isPublishing) until the persist finishes, exactly like a direct
  // publish. Otherwise the publish would run with no in-progress feedback.
  async function savePendingVariantAndClose() {
    if (!pendingVariantSave) return;
    const { config: cfg, mode } = pendingVariantSave;
    setPendingVariantSave(null);
    if (mode === 'publish') setIsPublishing(true);
    try {
      const savedId = await savePromoVariant(cfg, true);
      if (mode === 'publish') {
        // cfg already has active:true — finish going live, don't re-prompt to publish.
        await markVariantLive(savedId);
        await persistConfig(cfg, 'Campaign is live on your website', 'promo');
      } else {
        await persistConfig(cfg, 'Settings saved and promo variant saved');
      }
    } finally {
      if (mode === 'publish') setIsPublishing(false);
    }
  }

  async function updateExistingVariantAndClose(versionId: string) {
    if (!pendingVariantSave) return;
    const { config: cfg, mode, versions } = pendingVariantSave;
    const version = versions.find((item) => item.id === versionId);
    setPendingVariantSave(null);
    if (mode === 'publish') setIsPublishing(true);
    try {
      await updateVersion(versionId, cfg.promoCard, version?.label);
      setSelectedPromoVersionId(versionId);
      savedPromoSignatureRef.current = getPromoSignature(cfg);
      if (mode === 'publish') {
        await markVariantLive(versionId);
        await persistConfig(cfg, 'Campaign is live on your website', 'promo');
      } else {
        await persistConfig(cfg, 'Settings saved and promo variant updated');
      }
    } finally {
      if (mode === 'publish') setIsPublishing(false);
    }
  }

  function cancelPendingVariantSave() {
    setPendingVariantSave(null);
  }

  function getSelectedPendingVariant() {
    if (!pendingVariantSave || !selectedPromoVersionId) return null;
    return (
      pendingVariantSave.versions.find(
        (version) => version.id === selectedPromoVersionId,
      ) ?? null
    );
  }

  async function loadConfig() {
    try {
      // Always fetch the published config + the saved draft from the DB.
      const [response, draftResponse] = await Promise.all([
        fetch('/api/config'),
        fetch('/api/draft'),
      ]);
      let publishedCfg: CampaignConfig | null = null;
      if (response.ok) {
        const data = await response.json();
        publishedCfg = migrateConfig(data, data.version);
        publishedConfigRef.current = getConfigSignature(publishedCfg);
        publishedConfigObjRef.current = publishedCfg;
        // Dashboard always mirrors the live/published config, even when a draft
        // is restored into the editors below.
        setPublishedConfig(publishedCfg);
      }

      let draft: CampaignConfig | null = null;
      if (draftResponse.ok) {
        const draftData = await draftResponse.json();
        draft = (draftData?.draft as CampaignConfig | null) ?? null;
      }

      /**
       * Work that was in progress when the page went away comes back first,
       * and without being asked about.
       *
       * The user did not choose to stop, so finding anything other than where
       * they left off reads as data loss. It is cleared as it is taken up —
       * one accident, one restore — and a draft parked in My Draft is left
       * exactly where it is, still on its chip.
       */
      const recoveredEnvelope = readRecoveryEnvelope();
      const recovered = recoveredEnvelope?.config ?? null;
      if (recovered && publishedCfg) {
        const restored = migrateConfig(recovered, recovered.version);
        if (getConfigSignature(restored) !== getConfigSignature(publishedCfg)) {
          clearRecovery();
          setConfig(restored);
          draftSignatureRef.current = getConfigSignature(publishedCfg);
          savedPromoSignatureRef.current = getPromoSignature(publishedCfg);
          /**
           * Flag only what is genuinely the user's, rather than marking
           * everything changed on the way in.
           *
           * A recovery copy is the whole config, so it carries the promo card
           * even when the announcements were the part at risk. Marking the
           * promo changed regardless would report unpublished work for a card
           * that is a stock template, or the published one unedited — and
           * every guard downstream reads those flags.
           */
          const promoIsOwnWork = !cardIsNotUserWork(
            restored.promoCard,
            sampleTemplates.map((t) => t.promoCard as CampaignConfig['promoCard']),
          );
          setHasAnnouncementChanges(
            announcementSignature(restored) !== announcementSignature(publishedCfg),
          );
          setHasPromoChanges(
            promoIsOwnWork &&
              getPromoSignature(restored) !== getPromoSignature(publishedCfg),
          );
          setPromoEntryStep('editor');
          setConfigLoadedSignal((n) => n + 1);

          /**
           * A parked draft is left exactly where it is.
           *
           * The restored work goes on the canvas and the draft stays on its
           * chip, because they are two different things: one is where the user
           * was, the other is what they last decided to keep. Overwriting the
           * draft with the rescue would spend a deliberate save on an accident.
           * The notice then has to name both, or the user is looking at a
           * canvas and a draft chip that disagree with no explanation.
           */
          let draftSavedAt: string | null = null;
          let draftIsNewer = false;
          if (draft) {
            const migratedDraft = migrateConfig(draft, draft.version);
            setSavedDraftSignature(getConfigSignature(migratedDraft));
            setDraftPromoCard(JSON.parse(JSON.stringify(migratedDraft.promoCard)));
            draftSavedAt = migratedDraft.lastUpdated ?? null;

            // Only claimable when both times are known: a recovery written
            // before copies carried a timestamp has nothing to compare, and
            // guessing would put a warning in front of the wrong person.
            const takenAt = recoveredEnvelope?.savedAt;
            if (takenAt && draftSavedAt) {
              draftIsNewer = new Date(draftSavedAt).getTime() > new Date(takenAt).getTime();
            }
          }
          setRestoreNotice({
            localSavedAt: recoveredEnvelope?.savedAt || null,
            draftSavedAt,
            draftIsNewer,
          });
          return;
        }
        // Identical to what is live — nothing was lost, so drop it quietly.
        clearRecovery();
      }

      if (draft) {
        const migrated = migrateConfig(draft, draft.version);
        /**
         * Nothing worth restoring in it — so do not offer it. It is left on
         * disk rather than deleted: this runs on every load, with no user
         * action behind it, and the test is a heuristic. Getting it wrong
         * should cost a missing prompt, not the user's saved work.
         */
        if (!draftHasRestorableWork(migrated, publishedCfg)) {
          // deliberately nothing
        } else if (publishedCfg && getConfigSignature(migrated) !== getConfigSignature(publishedCfg)) {
          /**
           * A draft exists and differs from what's live. It used to be poured
           * straight into the editor, which meant landing on half-finished work
           * with no way to tell it apart from the published card.
           *
           * Now the canvas starts clear and the draft is offered: the toast
           * says it's there, and taking it is a decision rather than a
           * surprise. Declining leaves it saved — the My Draft dot still shows.
           */
          /**
           * The canvas starts on the default card, not the published one.
           *
           * Loading the live card here made "Start something new" a lie — the
           * user declined the draft and was left holding a copy of what is
           * already out there, which then reads as work in progress and
           * diverges from the live card the moment it is touched. The
           * published card stays one click away under My Published.
           *
           * Only the promo card is reset; the announcement bar keeps its
           * published content.
           */
          const forEditor: CampaignConfig = {
            ...publishedCfg,
            promoCard: JSON.parse(JSON.stringify(defaultConfig.promoCard)),
          };
          setConfig(forEditor);
          draftSignatureRef.current = getConfigSignature(forEditor);
          savedPromoSignatureRef.current = getPromoSignature(forEditor);
          setSavedDraftSignature(getConfigSignature(migrated));
          setPromoEntryStep('build');
          setConfigLoadedSignal((n) => n + 1);
          // Held, not announced: the draft is about the promo editor, so the
          // offer waits until that is the screen being looked at. Raised on
          // the dashboard it interrupts a page the draft has nothing to do
          // with, and expires before the user reaches the editor.
          offeredDraftRef.current = migrated;
          return;
        } else {
          /**
           * The draft is identical to what is live, so there is nothing to
           * offer — but it is not deleted either.
           *
           * Nothing here is a user action, and the app should not be removing
           * saved things on its own. Keeping it costs a dot on the My Draft
           * chip; deleting it costs the user something they chose to save,
           * every time this heuristic is wrong.
           */
        }
      }

      if (publishedCfg) {
        /**
         * Nothing pending: the work is done and live, so the editor opens on
         * the default card rather than a copy of what is already out there.
         *
         * Only the promo card is reset — the announcement bar keeps its
         * published content, and the dashboard reads publishedConfig, so what
         * is live is unaffected either way. The published card stays one click
         * away under My Published.
         *
         * Loading the live card here was what made a cleared canvas come back
         * as the published design after a refresh: the entry step opened the
         * picker, but the card underneath was still the live one.
         */
        const forEditor: CampaignConfig = {
          ...publishedCfg,
          promoCard: JSON.parse(JSON.stringify(defaultConfig.promoCard)),
        };
        setConfig(forEditor);
        draftSignatureRef.current = getConfigSignature(forEditor);
        savedPromoSignatureRef.current = getPromoSignature(forEditor);
        setPromoEntryStep('build');
        setConfigLoadedSignal((n) => n + 1);
      }
    } catch (error) {
      console.error('Failed to load config:', error);
    }
  }

  // Stage the announcement for publish. No automatic draft write here —
  // drafting is explicit-only ("Save as draft" in the Promo tab strip, which
  // covers the full config including the announcement) — this just flips the
  // header to "ready to Publish" and asks whether to publish now.
  function handleSaveAnnouncement() {
    setHasAnnouncementChanges(false);
    setReadyToPublishAnnouncement(true);
    toast('Changes saved — please publish to go live');
    setPublishConfirm({
      warnings: [],
      onConfirm: handlePublishAnnouncement,
      title: 'Changes saved',
      message: 'Ready to publish, or you can review and publish later.',
      confirmLabel: 'Publish now',
      cancelLabel: 'Publish later',
    });
  }

  // Publishing content turns the campaign On Air (BR: "On Air starts the moment
  // you click Publish"). New/edited content always goes live on publish.
  async function handlePublishAnnouncement() {
    const next = {
      ...config,
      announcementBar: { ...config.announcementBar, active: true },
    };
    // Flip the chip to On Air only AFTER the publish finishes — so it appears
    // when the "Publishing…" loader completes, not at the start.
    await persistConfig(next, 'Campaign is live on your website', 'announcement');
    setConfig(next);
    setReadyToPublishAnnouncement(false);
  }

  // Immediate live on/off from the status chip / Dashboard — no Save → Publish.
  // Toggles ONLY the active flag on the PUBLISHED content (never pushes an
  // unpublished draft live) and preserves any pending draft. `active` is
  // excluded from the dirty signature, so mirroring it into the editing config
  // doesn't create phantom "unsaved changes".
  async function setLiveActive(scope: 'promo' | 'announcement', active: boolean) {
    const pending = pendingDraftRef.current;
    const base = publishedConfigObjRef.current ?? configRef.current;
    const next: CampaignConfig =
      scope === 'promo'
        ? { ...base, promoCard: { ...base.promoCard, active, stoppedByUser: !active } }
        : { ...base, announcementBar: { ...base.announcementBar, active } };
    setConfig((c) =>
      scope === 'promo'
        ? { ...c, promoCard: { ...c.promoCard, active, stoppedByUser: !active } }
        : { ...c, announcementBar: { ...c.announcementBar, active } },
    );
    // Optimistically reflect the live status on the Dashboard right away;
    // persistConfig re-confirms it on a successful write.
    setPublishedConfig(next);
    publishedConfigObjRef.current = next;
    await persistConfig(
      next,
      active
        ? 'Campaign is live on your website'
        : 'Campaign switched off — no longer on your website',
      scope,
      { preserveDraft: pending },
    );
  }

  async function stopAnnouncementNow() {
    await setLiveActive('announcement', false);
  }

  async function goOnAirAnnouncementNow() {
    await setLiveActive('announcement', true);
  }

  // Turning a stopped promo back on from the status chip: flip it on
  // provisionally and ask whether to go live. Publish → live; Cancel → revert
  // to the previous (stopped) state.
  // Immediate status changes from the promo status chip — no Save → Publish.
  // Stopping takes the card off now; "Go on air" reactivates the same content.
  async function stopPromoNow() {
    await setLiveActive('promo', false);
  }

  // Deleting the live card from "My Published" is a real removal, not a Stop:
  // besides taking it off air we clear its content from the published config so
  // /api/config and the R2 copy stop carrying it. Unlike Stop, this can't be
  // undone with "Go on air" — the content is gone from the live config.
  async function removeLivePromo() {
    const base = publishedConfigObjRef.current ?? configRef.current;
    await markLiveVersion(null);
    refreshPromoVariants();
    const next: CampaignConfig = {
      ...base,
      promoCard: {
        ...defaultConfig.promoCard,
        active: false,
        stoppedByUser: true,
      },
    };
    setPublishedConfig(next);
    publishedConfigObjRef.current = next;
    await persistConfig(next, 'Removed from your website', 'promo', {
      preserveDraft: pendingDraftRef.current,
    });
  }

  async function goOnAirPromoNow() {
    await setLiveActive('promo', true);
  }

  async function handlePublishPromo() {
    // Publishing content turns the campaign On Air ("On Air starts the moment
    // you click Publish"). Off is reached via the Stop chip, not by publishing.
    const cfgToSave = {
      ...config,
      promoCard: { ...config.promoCard, active: true, stoppedByUser: false },
    };
    const successMsg = 'Campaign is live on your website';

    const variantStatus = await getPromoVariantSaveStatus(cfgToSave);
    if (variantStatus.status === 'pending') {
      // Variant decision dialog handles the actual publish next.
      setConfig(cfgToSave);
      setPendingVariantSave({ config: cfgToSave, versions: await listVersions(), mode: 'publish' });
      return;
    }

    // Flip the chip to On Air only AFTER the publish finishes — so it appears
    // when the "Publishing…" loader completes, not at the start.
    if (variantStatus.status === 'ready') {
      const savedId = await savePromoVariant(cfgToSave);
      await markVariantLive(savedId);
      // persistConfig returns the editor to the default card on success, so
      // there is deliberately no setConfig here: writing the published card
      // back afterwards is what left the finished one sitting on the canvas.
      await persistConfig(cfgToSave, successMsg, 'promo');
      return;
    }

    // 'skipped' — the card is already saved, so that entry is the live one.
    await markVariantLive(variantStatus.variantId ?? null);
    await persistConfig(cfgToSave, successMsg, 'promo');
  }

  function validatePromo(): string[] {
    const warnings: string[] = [];
    const pc = config.promoCard;
    const strip = (html: string) => html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
    const formatDate = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

    // 1. Content fields
    if (!strip(pc.title || '')) warnings.push('Title is empty');
    if (!strip(pc.subtitle || '')) warnings.push('Subtitle is empty');
    if (!strip(pc.description || '')) warnings.push('Description is empty');

    // 1b. DOM overflow check — shared with the guided flow's live fit warnings
    // so the publish gate and the inline hints can never disagree.
    (['title', 'subtitle', 'description'] as const).forEach((field) => {
      if (fieldOverflows(pc[field], field, pc.cardWidth)) {
        warnings.push(`${field.charAt(0).toUpperCase() + field.slice(1)} text may overflow the card layout`);
      }
    });

    // 2. Schedule — publishing turns the card On Air, so it will run.
    if (!pc.startDate || !pc.endDate) {
      warnings.push('Start date or end date is not set');
    } else {
      // Local, not UTC: east of Greenwich a UTC "today" is still yesterday
      // for the first hours of the day, which would flag a campaign ending
      // today as already expired.
      const today = toLocalISODate(new Date());
      if (pc.endDate < today) {
        warnings.push('End date is in the past');
      } else if (pc.startDate <= today) {
        warnings.push(`Campaign will run from ${formatDate(pc.startDate)} – ${formatDate(pc.endDate)} (starts immediately)`);
      } else {
        warnings.push(`Campaign is scheduled for ${formatDate(pc.startDate)} – ${formatDate(pc.endDate)}`);
      }
    }

    // 3. Timer text
    if (pc.showTimer) {
      const timerPlain = strip(pc.timerText || '').replace(/\{timer\}/gi, '').trim();
      if (!timerPlain) warnings.push('Timer has no prefix or suffix — you can add text like "Ends in" or "Hurry!" around the countdown');
    }

    // 4. CTA
    if (pc.showButton) {
      const btnText = strip(pc.buttonText || '');
      const ctaType = pc.ctaType || 'whatsapp';
      if (ctaType === 'text') {
        if (!btnText) warnings.push('Button text is empty');
      } else if (ctaType === 'whatsapp') {
        const num = pc.whatsappNumber?.trim() || '';
        const code = pc.whatsappCountryCode || '+44';
        if (!btnText && !num) {
          warnings.push('Button text and WhatsApp number are empty');
        } else if (!btnText) {
          warnings.push('Button text is empty');
        } else if (!num) {
          warnings.push('WhatsApp number is empty');
        } else if (whatsAppLooksShort(code, num)) {
          // The editor links any typed digit on purpose, so this is the last
          // place a half-typed number can be caught before it reaches the site.
          warnings.push(
            `WhatsApp number looks short for ${code}: ${code} ${num}`,
          );
        } else {
          warnings.push(`WhatsApp number: ${code} ${num}`);
        }
      } else {
        const url = pc.buttonUrl?.trim() || '';
        if (!btnText && !url) {
          warnings.push('Button text and URL are empty');
        } else if (!btnText) {
          warnings.push('Button text is empty');
        } else if (!url) {
          warnings.push('Button URL is empty');
        }
      }
    }

    return warnings;
  }

  function handlePublishPromoWithValidation() {
    if (blockPromoSaveIfInvalidRange()) return;
    const warnings = validatePromo();
    setPublishConfirm({ warnings, onConfirm: handlePublishPromo });
  }

  function handlePublishAnnouncementWithValidation() {
    setPublishConfirm({ warnings: [], onConfirm: handlePublishAnnouncement });
  }

  function dismissToast() {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = null;
    setShowToast(false);
    setToastAction(null);
  }

  /**
   * `action` turns the toast into a one-tap recovery offer ("Undo"). It gets a
   * longer life than a plain confirmation — long enough to read and reach, and
   * still short enough that the offer clearly expires with the toast.
   */
  /**
   * `durationMs` overrides the default dwell for a message that takes longer
   * to act on than to read — one that names a control the user then has to go
   * and find. Ignored when an action is present: that timer belongs to the
   * Undo countdown and the ring drawn from it, and the two must agree.
   */
  function toast(
    message: string,
    isError = false,
    action?: ToastAction,
    durationMs?: number,
  ) {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToastMessage(message);
    setToastIsError(isError);
    setToastAction(
      action
        ? {
            label: action.label,
            onClick: () => {
              dismissToast();
              action.onClick();
            },
          }
        : null,
    );
    setShowToast(true);
    toastTimerRef.current = setTimeout(
      dismissToast,
      action ? TOAST_ACTION_MS : durationMs ?? 3000,
    );
  }

  function toggleDarkMode() {
    const newMode = !isDarkMode;
    setIsDarkMode(newMode);
    localStorage.setItem('darkMode', newMode.toString());
  }

  function handleLogout() {
    /**
     * The same at-risk test the close prompt uses, rather than "differs from
     * the draft" — a card already sitting in My Published is not work about to
     * be lost, and stopping someone on the way out for it teaches them to
     * click through the one time it matters.
     */
    const promoAtRisk = promoWorkNotInDraftRef.current;
    const announcementAtRisk =
      hasAnnouncementChanges &&
      draftSignatureRef.current !== getConfigSignature(configRef.current);
    if (promoAtRisk || announcementAtRisk) {
      setPendingDraftAction({ type: 'logout' });
      return;
    }
    performLogout();
  }

  function performLogout() {
    /**
     * Signing out on purpose, so the local copy goes with the session — the
     * same rule as answering Leave to the close prompt. Anything worth keeping
     * was offered a draft slot before this ran.
     */
    exitReasonRef.current = 'logout';
    clearRecovery();
    if (reportedUnsavedRef.current) reportUnsaved(false);

    // The session is a signed cookie, so only the server can end it. Navigate
    // either way: a failed request must not strand someone on a page they have
    // asked to leave, and the cookie expires on its own.
    fetch('/api/auth/logout', { method: 'POST', keepalive: true })
      .catch(() => {})
      .finally(() => {
        window.location.href = '/login';
      });
  }

  async function discardDraft() {
    clearDraft();
    setHasAnnouncementChanges(false);
    setHasPromoChanges(false);
    setReadyToPublishAnnouncement(false);
    // Reload published config
    try {
      const response = await fetch('/api/config');
      if (response.ok) {
        const data = await response.json();
        const migrated = migrateConfig(data, data.version);
        setConfig(migrated);
        draftSignatureRef.current = getConfigSignature(migrated);
        savedPromoSignatureRef.current = getPromoSignature(migrated);
        publishedConfigRef.current = getConfigSignature(migrated);
        publishedConfigObjRef.current = migrated;
      }
    } catch (e) {
      console.error('Failed to reload config:', e);
    }
    toast('Saved draft deleted');
  }

  function markAnnouncementChanged() {
    // If config matches published state, no actual changes
    setTimeout(() => {
      if (publishedConfigRef.current && publishedConfigRef.current === getConfigSignature(configRef.current)) {
        setHasAnnouncementChanges(false);
        return;
      }
      setHasAnnouncementChanges(true);
      setReadyToPublishAnnouncement(false);
    }, 0);
  }

  function markPromoChanged() {
    // If config matches published state, no actual changes
    setTimeout(() => {
      if (publishedConfigRef.current && publishedConfigRef.current === getConfigSignature(configRef.current)) {
        setHasPromoChanges(false);
        return;
      }
      setHasPromoChanges(true);
    }, 0);
  }

  const selectedPendingVariant = getSelectedPendingVariant();

  // "Go on air" is a one-click reactivation, allowed only when the announcement
  // is off AND its content matches what's currently published (same content,
  // not new/edited). Otherwise the user must Save → Publish.
  const announcementCanReactivate = (() => {
    if (config.announcementBar.active) return false;
    if (!publishedConfigRef.current) return false;
    try {
      const pub = JSON.parse(publishedConfigRef.current) as CampaignConfig;
      const sig = (ab: CampaignConfig['announcementBar']) => {
        const clone: Record<string, unknown> = { ...ab };
        delete clone.active;
        return JSON.stringify(clone);
      };
      return sig(config.announcementBar) === sig(pub.announcementBar);
    } catch {
      return false;
    }
  })();

  // Same rule for the promo card (ignore active + stoppedByUser status flags).
  const promoCanReactivate = (() => {
    if (config.promoCard.active) return false;
    if (!publishedConfigRef.current) return false;
    try {
      const pub = JSON.parse(publishedConfigRef.current) as CampaignConfig;
      const sig = (pc: CampaignConfig['promoCard']) => {
        const clone: Record<string, unknown> = { ...pc };
        delete clone.active;
        delete clone.stoppedByUser;
        return JSON.stringify(clone);
      };
      return sig(config.promoCard) === sig(pub.promoCard);
    } catch {
      return false;
    }
  })();

  // Work worth protecting: the promo differs from what's live AND isn't the
  // thing already sitting in the draft.
  /**
   * Computed from the cards themselves rather than from `hasPromoChanges`.
   *
   * That flag is only recalculated when something calls markPromoChanged(), so
   * it survives events that make it untrue — deleting the saved draft being the
   * one that bit: the flag stayed true, the guard fired, and "Create new" asked
   * to save work into a draft the user had just deleted. A refresh "fixed" it
   * only because reloading recomputed everything from scratch.
   */
  promoWorkNotInDraftRef.current = (() => {
    // Normalised, like every other comparison: a raw stringify counts the
    // app's own rewrites (the injected default font-size span, zero-width
    // characters, the re-serialised timer, the auto cardWidth) as edits — so
    // simply opening the editor made "Create new" claim there was unsaved work.
    const sig = (card: CampaignConfig['promoCard']) =>
      JSON.stringify(
        normalizePromoForCompare(card as unknown as Record<string, unknown>),
      );
    const current = sig(config.promoCard);
    const differsFromLive = current !== sig(publishedConfig.promoCard);
    const differsFromDraft = !draftPromoCard || current !== sig(draftPromoCard);
    // My Published counts as saved. Matching any variant in there means the
    // card can be brought back, so there is nothing to protect.
    const differsFromSaved = !promoVariants.some((v) => sig(v.promoCard) === current);
    /**
     * Differing from everything stored is not the same as being worth saving.
     * A cleared canvas matches nothing, so the guard fired on the way to
     * "Create new" offering to preserve a blank card; a freshly picked
     * template did the same for words nobody wrote.
     */
    const worthProtecting = !cardIsNotUserWork(
      config.promoCard,
      sampleTemplates.map((t) => t.promoCard as CampaignConfig['promoCard']),
    );
    return worthProtecting && differsFromLive && differsFromDraft && differsFromSaved;
  })();

  return (
    <div className="campaign-page-bg flex h-screen text-on-surface">
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        <Header
          activeTab={activeTab}
          setActiveTab={handleTabSwitch}
          hasAnnouncementChanges={hasAnnouncementChanges}
          hasPromoChanges={hasPromoChanges}
          readyToPublishAnnouncement={readyToPublishAnnouncement}
          promoDateInvalid={promoDateRangeInvalid}
          isPublishing={isPublishing}
          isDarkMode={isDarkMode}
          toggleDarkMode={toggleDarkMode}
          handleSaveAnnouncement={handleSaveAnnouncement}
          handlePublishAnnouncement={handlePublishAnnouncementWithValidation}
          handlePublishPromo={handlePublishPromoWithValidation}
          handleLogout={handleLogout}
        />

        <main
          ref={mainScrollRef}
          className={`flex-1 overflow-y-auto bg-transparent px-6 pt-8 pb-6 ${
            activeTab === 'promo' || activeTab === 'announcement' ? 'campaign-custom-scrollbar' : ''
          }`}
        >
          <div className={`max-w-[1840px] mx-auto ${activeTab === 'promo' || activeTab === 'dashboard' ? '' : 'space-y-8 pb-12'}`}>
            {activeTab === 'dashboard' && (
              <Dashboard
                config={publishedConfig}
                setActiveTab={handleDashboardTabSwitch}
                onCreatePromo={handleCreatePromo}
                onEditLivePromo={handleOpenPublishedPromo}
                onStopPromo={stopPromoNow}
                onGoOnAirPromo={goOnAirPromoNow}
                onStopAnnouncement={stopAnnouncementNow}
                onGoOnAirAnnouncement={goOnAirAnnouncementNow}
                promoUnpublished={hasPromoChanges}
                announcementUnpublished={hasAnnouncementChanges || readyToPublishAnnouncement}
              />
            )}

            {activeTab === 'announcement' && (
              <AnnouncementSection
                key={`announcement-${editorResetKey}`}
                config={config}
                setConfig={setConfig}
                markChanged={markAnnouncementChanged}
                canReactivate={announcementCanReactivate}
                onStop={stopAnnouncementNow}
                onGoOnAir={goOnAirAnnouncementNow}
              />
            )}

            {activeTab === 'promo' && (
              <PromoFlow
                  key={`promo-${editorResetKey}`}
                  onAiApplied={handleAiApplied}
                  openBuildSignal={openBuildSignal}
                  configLoadedSignal={configLoadedSignal}
                  blankStart={promoBlankStart}
                  onBlankStartChange={setPromoBlankStart}
                  timerAutoArmed={promoTimerAutoArmed}
                  onTimerAutoArmedChange={setPromoTimerAutoArmed}
                  pendingPopup={pendingPromoPopup}
                  onPendingPopupHandled={() => setPendingPromoPopup(null)}
                  initialStep={promoEntryStep}
                  config={config}
                  setConfig={setConfig}
                  markChanged={markPromoChanged}
                  toast={toast}
                  onSelectedVersionChange={setSelectedPromoVersionId}
                  canReactivate={promoCanReactivate}
                  livePromoCard={publishedConfig.promoCard}
                  draftPromoCard={draftPromoCard}
                  onStop={stopPromoNow}
                  onGoOnAir={goOnAirPromoNow}
                  dateErrorPing={promoDateErrorPing}
                  hasUnsavedChanges={hasPromoChanges}
                  activeTab={activeTab}
                  setActiveTab={handleTabSwitch}
                  onSaveDraft={handleSaveAsDraft}
                  // Writes the draft with no replace-confirm of its own — the
                  // template dialogs already asked, and asking twice for one
                  // decision reads as a bug.
                  onSaveDraftDirect={writeDraftNow}
                  savingDraft={savingDraft}
                  onDeleteDraft={handleDeleteDraft}
                  draftUpToDate={
                    savedDraftSignature !== null &&
                    savedDraftSignature === getConfigSignature(config)
                  }
                  draftExists={savedDraftSignature !== null}
                onRemoveLive={removeLivePromo}
              />
            )}
          </div>
        </main>
      </div>

      {/* A draft outlived a publish and holds something else. Asked rather
          than assumed: it is the user's copy, and only they know whether the
          card they just put live replaced it or was never related to it. */}
      {postPublishDraft && (
        <div data-modal className="fixed inset-0 z-50 flex items-center justify-center bg-transparent p-4">
          <div className="absolute inset-0" onClick={() => setPostPublishDraft(false)} />
          {/* Wider than the other dialogs: this one carries a heading that
              runs long, an explanation and a caveat, and at max-w-md the
              heading wrapped onto three lines with the body pressed under it. */}
          <div className="relative z-10 w-full max-w-lg rounded-xl border border-white/10 bg-black/10 p-6 text-on-surface shadow-2xl backdrop-blur-md">
            <h2 className="text-base font-semibold">
              Your card is live — and we kept your draft
            </h2>
            <p className="mt-2 text-sm text-on-surface-variant">
              The one in{' '}
              <span className="font-semibold text-on-surface">My Draft</span>{' '}
              is different from the card you just published, so we&apos;ve kept
              it. Do you want to keep it, or clear the slot?
            </p>
            <p className="mt-3 text-xs text-on-surface-variant/80">
              There is only one draft slot, so keeping it means the next save
              replaces it.
            </p>
            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => {
                  clearDraft();
                  setPostPublishDraft(false);
                  toast('Saved draft cleared');
                }}
                className="rounded-md border border-white/10 bg-transparent px-4 py-2 text-sm font-medium text-on-surface-variant transition-colors hover:border-primary/70 hover:text-primary"
              >
                Discard it
              </button>
              <button
                type="button"
                onClick={() => setPostPublishDraft(false)}
                className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-on-primary shadow-sm transition-opacity hover:opacity-95"
              >
                Keep my draft
              </button>
            </div>
          </div>
        </div>
      )}

      {/* One dialog for one moment.
          Coming back to work in progress has three shapes — edits rescued from
          a session that ended, those edits alongside a parked draft, or a
          draft on its own — and they were being told by two different dialogs
          with two different voices. They describe the same situation from
          different angles, so they are one thing that reads its state.
          Held until the promo tab: it talks about the canvas and My Draft,
          which are that editor's. Announcement work is still restored, just
          not announced here — this message has nowhere to say it. */}
      {welcomeBack && (
        <div data-modal className="fixed inset-0 z-50 flex items-center justify-center bg-transparent p-4">
          {/* Blocks what is behind it, but does not dismiss.
              These arrive once, on the way in, and closing one is final — the
              draft offer does not come back until the next load. A click
              landing on the canvas is far more likely to be someone reaching
              for their work than a decision to dismiss, and the buttons are
              right there. */}
          <div className="absolute inset-0" />
          <div className="relative z-10 w-full max-w-lg rounded-xl border border-white/10 bg-black/10 p-6 text-on-surface shadow-2xl backdrop-blur-md">
            {welcomeBack.mode === 'restored' ? (
              <>
                {/* Told, not asked: the work is already on the canvas behind
                    this. The session ended without the user ending it, so
                    there was no decision to put to them. */}
                {/* One message, whatever is true.
                    With edits rescued here AND work stranded on another
                    device, this listed both with a timestamp each and left the
                    reader matching times to places. What someone needs on the
                    way in is smaller: their work was not saved, unsaved work
                    stays on the browser that made it, and here is what that
                    means for them right now. */}
                {/* Enough to explain itself, in one block of prose.
                    Trimmed to a bare heading it stopped saying what had
                    actually happened; opening with the rule — "unsaved work
                    stays on the browser that made it" — made the reader decode
                    policy first. This says what was done, then the one thing
                    left to do, as two sentences rather than two paragraphs so
                    it reads as a single message.

                    One timestamp, on the other device only. Three of them —
                    the rescued edits, the parked draft and the other machine —
                    was what made this unreadable: the reader ended up matching
                    times to places to work out what had happened. A single
                    time answers the one question worth asking here, which is
                    how recent that other work is. */}
                <h2 className="text-base font-semibold">
                  Your unsaved work is back
                </h2>
                <p className="mt-1.5 text-sm text-on-surface-variant">
                  We kept what you hadn&apos;t saved and put it back on the canvas.
                  {welcomeBack.elsewhere && (
                    <>
                      {' '}You were also editing on{' '}
                      <span className="font-medium text-on-surface">
                        {welcomeBack.elsewhere.deviceLabel}
                      </span>{' '}
                      {describeWhen(welcomeBack.elsewhere.at)} — open the tool
                      there to pick that up.
                    </>
                  )}
                </p>

                {welcomeBack.draftSavedAt && !welcomeBack.elsewhere && (
                  <p className="mt-2.5 text-sm text-on-surface-variant">
                    Your draft from{' '}
                    <span className="font-medium text-on-surface">
                      {describeWhen(welcomeBack.draftSavedAt)}
                    </span>{' '}
                    is untouched in My Draft.
                  </p>
                )}
              </>
            ) : welcomeBack.mode === 'elsewhere' ? (
              <>
                {/* Nothing rescued and nothing parked, so where the work is IS
                    the message. Not phrased as a failure to save: everywhere
                    else the tool treats not-saving as normal, because it
                    rescues work rather than asking about it. */}
                <h2 className="text-base font-semibold">
                  Your unsaved changes are on another device
                </h2>
                <p className="mt-1.5 text-sm text-on-surface-variant">
                  You were editing on{' '}
                  <span className="font-medium text-on-surface">
                    {welcomeBack.elsewhere.deviceLabel}
                  </span>{' '}
                  {describeWhen(welcomeBack.elsewhere.at)}. Those changes never
                  made it to a draft, so they&apos;re on that browser only.
                </p>
              </>
            ) : (
              <>
                {/* Asked, because here it is a question: nothing was rescued,
                    and the draft was parked on purpose. */}
                <h2 className="text-base font-semibold">
                  Welcome back — your draft is waiting
                </h2>
                <p className="mt-1.5 text-sm text-on-surface-variant">
                  Your promo card from {describeWhen(welcomeBack.draftSavedAt)} is
                  still in My Draft, just as you left it.
                </p>
              </>
            )}

            {/* The other places the work lives, in one sentence each.
                A bordered list of rows was tried here and read as a settings
                panel — boxes and right-aligned timestamps make facts look like
                controls, and none of these are. Prose keeps them as what they
                are: context, on the way to the canvas. */}
            {/* Only the draft offer needs this. The restored branch above
                carries its own lines, and duplicating them here was rendering
                the same situation twice in one dialog — the very thing the
                rewrite was meant to stop. */}
            {welcomeBack.mode === 'draft' && welcomeBack.elsewhere && (
              <p className="mt-2.5 text-sm text-on-surface-variant">
                You were also editing on{' '}
                <span className="font-medium text-on-surface">
                  {welcomeBack.elsewhere.deviceLabel}
                </span>
                . Those changes stay on that browser whatever you choose here.
              </p>
            )}

            {/* The one thing that cannot be found out any other way. */}
            {welcomeBack.mode === 'restored' && (
              <p className="mt-4 text-xs text-amber-600 dark:text-amber-500">
                Save it to My Draft so it opens anywhere.
              </p>
            )}
            {welcomeBack.mode === 'elsewhere' && (
              <p className="mt-4 text-xs text-on-surface-variant/80">
                Sign in there and save them to My Draft — then they&apos;ll open
                anywhere.
              </p>
            )}
            {welcomeBack.mode === 'draft' &&
              (hasChanges ? (
                <p className="mt-4 text-xs text-amber-600 dark:text-amber-500">
                  The editor has unsaved changes. Opening the draft replaces them.
                </p>
              ) : (
                <p className="mt-4 text-xs text-on-surface-variant/80">
                  Either way it stays saved — open it from My Draft whenever you like.
                </p>
              ))}

            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              {welcomeBack.mode === 'draft' ? (
                <>
                  <button
                    type="button"
                    onClick={dismissWelcomeBack}
                    className="rounded-md border border-white/10 bg-transparent px-4 py-2 text-sm font-medium text-on-surface-variant transition-colors hover:border-primary/70 hover:text-primary"
                  >
                    {hasChanges ? 'Keep my unsaved changes' : 'Start something new'}
                  </button>
                  <button
                    type="button"
                    onClick={() => draftOffer && acceptOfferedDraft(draftOffer)}
                    className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-on-primary shadow-sm transition-opacity hover:opacity-95"
                  >
                    Continue my draft
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={dismissWelcomeBack}
                  className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-on-primary shadow-sm transition-opacity hover:opacity-95"
                >
                  {welcomeBack.mode === 'restored' ? 'Continue editing' : 'Continue here'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* The countdown.
          Always a dialog in the page, because that is the only warning
          everyone gets — permission may never have been granted, and a desktop
          notification is suppressed while the tab is visible anyway. It blocks
          the editor on purpose: the point is to be answered. */}
      {idleSecondsLeft !== null && (
        <div data-modal className="fixed inset-0 z-[60] flex items-center justify-center bg-transparent p-4">
          <div className="absolute inset-0" />
          <div className="relative z-10 w-full max-w-sm rounded-xl border border-white/10 bg-black/10 p-6 text-center text-on-surface shadow-2xl backdrop-blur-md">
            {/* Centred, with the count as the largest thing on it. The question
                is rhetorical — what the reader needs is how long they have, so
                that is what the eye should land on first. */}
            <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-amber-500/15">
              <Clock className="h-5 w-5 text-amber-600 dark:text-amber-500" />
            </div>

            <h2 className="mt-3.5 text-base font-semibold">Are you still there?</h2>
            <p className="mt-1 text-sm text-on-surface-variant">
              No activity for {describeDuration(IDLE_LIMIT_MS - IDLE_WARNING_LEAD_MS)}.
            </p>

            <p className="mt-4 text-3xl font-semibold tabular-nums text-amber-600 dark:text-amber-500">
              {idleSecondsLeft}s
            </p>

            {/* Draining, not filling. Something running out is read without
                being read — the bar says how long is left before the number
                has been focused on. The transition is linear and matches the
                tick, so it slides smoothly rather than stepping. */}
            <div className="mt-2.5 h-1 w-full overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-amber-500 transition-[width] duration-1000 ease-linear"
                style={{
                  width: `${(idleSecondsLeft / Math.round(IDLE_WARNING_LEAD_MS / 1000)) * 100}%`,
                }}
              />
            </div>

            {/* Says the quiet part, because a countdown reads as a threat
                otherwise. Nothing is lost either way — which is the point of
                everything else in this file. */}
            <p className="mt-4 text-xs text-on-surface-variant/80">
              Your work is saved. It will be back on the canvas when you sign in again.
            </p>

            <button
              type="button"
              onClick={() => idleRestartRef.current?.()}
              className="mt-5 w-full rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-on-primary shadow-sm transition-opacity hover:opacity-95"
            >
              I&apos;m still here
            </button>
          </div>
        </div>
      )}

      {/* Our ask, in front of the browser's.
          The browser's own prompt is a one-shot: decline it and no code can
          raise it again. So "Not now" closes only this, and the real prompt is
          reached solely by someone who chose Allow.

          A corner card rather than a modal. This is an offer, not a decision
          the editor should be held up for — a full dialog gave a small
          convenience the same weight as losing work, and it was the first
          thing people met on the way in. */}
      {askNotifications && !welcomeBack && idleSecondsLeft === null && (
        <div className="animate-slide-in-corner fixed right-4 bottom-4 z-40 w-72 rounded-lg border border-white/10 bg-black/20 p-3.5 text-on-surface shadow-xl backdrop-blur-md">
          {askNotifications === 'ask' ? (
            <>
              {/* Two short lines. The second is the only thing that justifies
                  the permission at all — the in-page countdown already covers
                  the case where you are looking at the tab. */}
              {/* Warns about the third gate before consent, not after.
                  Someone who allows here and then sees nothing has no reason
                  to suspect their system is muting the browser — so the
                  clause goes in upfront, while the exact path waits for the
                  confirmation card, where it is actually actionable. */}
              <p className="text-sm font-medium">Notify you before signing out?</p>
              <p className="mt-1 text-xs text-on-surface-variant">
                Works even when this tab is hidden. Your system must allow
                browser notifications too.
              </p>
              <div className="mt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setAskNotifications(null)}
                  className="rounded-md px-2.5 py-1.5 text-xs font-medium text-on-surface-variant transition-colors hover:text-primary"
                >
                  Not now
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    // Inside the click on purpose: Chrome ignores a permission
                    // request that is not tied to a gesture.
                    const result = await askNotificationPermission();
                    // Blocked at the browser's prompt after accepting ours —
                    // switch to saying where the switch is rather than
                    // vanishing, since they did ask for this.
                    if (result === 'denied') return setAskNotifications('blocked');
                    // Granted: confirm it, and name the one gate left that
                    // nothing can check on their behalf.
                    if (result === 'granted') return setAskNotifications('enabled');
                    setAskNotifications(null);
                  }}
                  className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-on-primary shadow-sm transition-opacity hover:opacity-95"
                >
                  Allow
                </button>
              </div>
            </>
          ) : askNotifications === 'enabled' ? (
            <>
              {/* Shown once, straight after granting.
                  Two gates are now open and a third is not readable from here,
                  so this is the only chance to mention it before someone
                  concludes the feature is broken. Phrased as a condition, not
                  an instruction — for most people nothing more is needed. */}
              <p className="text-sm font-medium">Notifications are on</p>
              <p className="mt-1 text-xs text-on-surface-variant">
                Not seeing them? Your system may be muting the browser:{' '}
                {osNotificationHint() ?? 'check your notification settings.'}
              </p>
              <div className="mt-3 flex justify-end">
                <button
                  type="button"
                  onClick={() => setAskNotifications(null)}
                  className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-on-primary shadow-sm transition-opacity hover:opacity-95"
                >
                  Got it
                </button>
              </div>
            </>
          ) : (
            <>
              {/* No Allow button: only the user can undo a block, from browser
                  settings, so offering one here would be theatre. */}
              <p className="text-sm font-medium">Notifications are blocked</p>
              {/* The icon is drawn, not described. Someone scanning a toolbar
                  should be matching a shape, not decoding "padlock or sliders"
                  — and no single word for it is right across Chrome versions. */}
              <p className="mt-1 text-xs leading-relaxed text-on-surface-variant">
                {(() => {
                  const hint = unblockSteps();
                  if (hint.kind === 'menu') return hint.text;
                  return (
                    <>
                      {hint.before}{' '}
                      <SlidersHorizontal className="mx-0.5 inline-block h-3.5 w-3.5 -translate-y-px align-middle text-on-surface" />{' '}
                      {hint.after}
                    </>
                  );
                })()}
              </p>
              {/* A solid button, not the quiet text one the offer uses for
                  "Not now". There is no choice on this card — dismissing is
                  the only thing to do — so the single action should look like
                  one rather than like the lesser of two options. */}
              <div className="mt-3 flex justify-end">
                <button
                  type="button"
                  onClick={() => setAskNotifications(null)}
                  className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-on-primary shadow-sm transition-opacity hover:opacity-95"
                >
                  Got it
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {pendingDraftAction && (
        <div data-modal className="fixed inset-0 z-50 flex items-center justify-center bg-transparent p-4">
          <div
            className="absolute inset-0"
            onClick={() => setPendingDraftAction(null)}
          />
          <div className="relative z-10 w-full max-w-md rounded-xl border border-white/10 bg-black/10 p-5 text-on-surface shadow-2xl backdrop-blur-md">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-base font-semibold">Save before you sign out?</h2>
                {/* With a draft already parked, the two cards have to be named
                    separately — they are different work, and "save" silently
                    overwrote the one on disk without ever mentioning it. */}
                {savedDraftSignature !== null ? (
                  <>
                    {/* Says only what is known. Earlier wording called the
                        saved card "different" — but nothing here establishes
                        that. The signatures differ, which is as true of an
                        older version of the same card as it is of separate
                        work, and the user is left deciding what "different"
                        was supposed to mean. */}
                    <p className="mt-1 text-sm text-on-surface-variant">
                      One card is already saved in{' '}
                      <span className="font-semibold text-on-surface">My Draft</span>{' '}
                      and there is only one slot, so saving these edits
                      permanently replaces it.
                    </p>
                    <p className="mt-3 text-xs text-on-surface-variant/80">
                      Edits you don&apos;t save stay on this browser only.
                    </p>
                  </>
                ) : (
                  <>
                    <p className="mt-1 text-sm text-on-surface-variant">
                      These edits aren&apos;t in{' '}
                      <span className="font-semibold text-on-surface">My Draft</span>{' '}
                      yet. Saving keeps them with your account, so they are
                      waiting wherever you sign in next.
                    </p>
                    <p className="mt-3 text-xs text-on-surface-variant/80">
                      Until then they stay on this browser — sign in from
                      another browser or another device and they won&apos;t be
                      there.
                    </p>
                  </>
                )}
              </div>
              <button
                type="button"
                onClick={() => setPendingDraftAction(null)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md text-on-surface-variant transition-colors hover:bg-primary/10 hover:text-primary"
                aria-label="Close draft prompt"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Named for what each button does. Signing out is the one exit
                that still drops the local copy, so leaving without saving has
                to say so on the button rather than in small print. */}
            <div className="mt-1 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={continueWithoutDraft}
                className="rounded-md border border-white/10 bg-transparent px-4 py-2 text-sm font-medium text-on-surface-variant transition-colors hover:border-primary/70 hover:text-primary"
              >
                Sign out without saving
              </button>
              <button
                type="button"
                onClick={saveDraftAndContinue}
                className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-on-primary shadow-sm transition-opacity hover:opacity-95"
              >
                {savedDraftSignature !== null ? 'Replace draft & sign out' : 'Save & sign out'}
              </button>
            </div>
          </div>
        </div>
      )}

      {pendingVariantSave && (
        <div data-modal className="fixed inset-0 z-50 flex items-center justify-center bg-transparent p-4">
          <div
            className="absolute inset-0"
            onClick={cancelPendingVariantSave}
          />
          <div className="relative z-10 w-full max-w-md rounded-xl border border-white/10 bg-black/10 p-5 text-on-surface shadow-2xl backdrop-blur-md">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-base font-semibold">
                  Save promo variant?
                </h2>
                <p className="mt-1 text-sm text-on-surface-variant">
                  You already have {MAX_VERSIONS} variants. Update the selected variant or replace the oldest.
                </p>
              </div>
              <button
                type="button"
                onClick={cancelPendingVariantSave}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md text-on-surface-variant transition-colors hover:bg-primary/10 hover:text-primary"
                aria-label="Close variant prompt"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-2">
              {selectedPendingVariant && (
                <button
                  type="button"
                  onClick={() =>
                    updateExistingVariantAndClose(selectedPendingVariant.id)
                  }
                  className="flex w-full items-center justify-between gap-3 rounded-md border border-primary/40 bg-primary/10 px-4 py-2 text-left text-sm font-medium text-on-surface transition-colors hover:border-primary/70 hover:bg-primary/15"
                >
                  <span>Update Selected</span>
                  <span className="min-w-0 truncate text-xs text-on-surface-variant">
                    {selectedPendingVariant.label}
                  </span>
                </button>
              )}
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={cancelPendingVariantSave}
                  className="rounded-md border border-white/10 bg-transparent px-4 py-2 text-sm font-medium text-on-surface-variant transition-colors hover:border-primary/70 hover:text-primary"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={savePendingVariantAndClose}
                  className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-on-primary shadow-sm transition-opacity hover:opacity-95"
                >
                  Save and Replace Oldest
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* No "welcome back" popup. Saving a draft is a deliberate act, so
          announcing it back on every load interrupts the one moment someone
          wants to start working. The draft is restored into the editor
          silently and the My Draft chip carries a dot instead. */}

      {/* Publish Confirmation */}
      {publishConfirm && (
        <div data-modal className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0" onClick={() => { if (isConfirming) return; publishConfirm.onCancel?.(); setPublishConfirm(null); }} />
          <div className="relative z-10 w-full max-w-md rounded-xl border border-white/10 bg-black/10 p-5 text-on-surface shadow-2xl backdrop-blur-md">
            <h2 className="text-base font-semibold">{publishConfirm.title ?? 'Publish to website?'}</h2>
            <p className="mt-2 text-sm text-on-surface-variant">
              {publishConfirm.message ?? 'These changes will go live on your website immediately.'}
            </p>
            {publishConfirm.warnings.length > 0 && (
              <div className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
                <p className="text-xs font-semibold text-amber-600 dark:text-amber-400 mb-1.5">Heads up</p>
                <ul className="space-y-1">
                  {publishConfirm.warnings.map((w, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-on-surface-variant">
                      <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                      {w}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                disabled={isConfirming}
                onClick={() => { publishConfirm.onCancel?.(); setPublishConfirm(null); }}
                className="rounded-md border border-white/10 bg-transparent px-4 py-2 text-sm font-medium text-on-surface-variant transition-colors hover:border-primary/70 hover:text-primary disabled:opacity-50"
              >
                {publishConfirm.cancelLabel ?? 'Cancel'}
              </button>
              <button
                type="button"
                disabled={isConfirming}
                onClick={async () => {
                  const onConfirm = publishConfirm.onConfirm;
                  const defer = publishConfirm.deferPublish;
                  if (defer) {
                    // Chaining to a follow-up popup — don't show "Publishing…".
                    setPublishConfirm(null);
                    await onConfirm();
                    return;
                  }
                  // Keep the popup open with a loader on this button until the
                  // publish finishes, then close it.
                  setIsConfirming(true);
                  setIsPublishing(true);
                  await onConfirm();
                  await new Promise(r => setTimeout(r, 500));
                  setIsConfirming(false);
                  setIsPublishing(false);
                  setPublishConfirm(null);
                }}
                className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-semibold text-on-primary shadow-sm transition-opacity hover:opacity-95 disabled:opacity-80"
              >
                {isConfirming && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {isConfirming ? 'Publishing…' : (publishConfirm.confirmLabel ?? 'Publish Now')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* First-run campaign setup, opened from the dashboard's "Create promo
          card". Same dialog the guided flow uses, so the questions asked are
          identical wherever a campaign starts. */}
      {showCreateSetup && (
        <PromoSetupDialog
          sourceLabel="a blank card"
          scheduleOnly
          onContinue={startNewPromo}
          startDate={createStart}
          endDate={createEnd}
          onChangeStart={setCreateStart}
          onChangeEnd={setCreateEnd}
          onChoose={() => startNewPromo()}
          onClose={() => setShowCreateSetup(false)}
        />
      )}

      {/* Unsaved promo work, caught at the dashboard before an action that
          would replace the canvas. Saving is offered, never required — the
          same rule as Clear Canvas. */}
      {pendingDashboardAction && (
        <div data-modal className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0" onClick={() => setPendingDashboardAction(null)} />
          <div className="relative z-10 w-full max-w-xl rounded-xl border border-white/10 bg-black/10 p-5 text-on-surface shadow-2xl backdrop-blur-md">
            <h2 className="text-base font-semibold">You have unsaved changes</h2>
            <p className="mt-2 text-sm text-on-surface-variant">
              Your promo card has edits that aren&apos;t in{' '}
              <span className="font-semibold text-on-surface">My Draft</span>.{' '}
              {pendingDashboardAction === 'create'
                ? 'Starting a new campaign replaces them.'
                : 'Loading your live card replaces them.'}{' '}
              {savedDraftSignature !== null ? (
                <>
                  Saving now replaces the card currently in{' '}
                  <span className="font-semibold text-on-surface">My Draft</span>.
                </>
              ) : (
                <>
                  Save them to <span className="font-semibold text-on-surface">My Draft</span> to
                  keep a copy.
                </>
              )}
            </p>
            <div className="mt-5 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setPendingDashboardAction(null)}
                className="shrink-0 whitespace-nowrap rounded-md px-2 py-2 text-sm font-medium text-on-surface-variant transition-colors hover:text-primary"
              >
                Cancel
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const action = pendingDashboardAction;
                    setPendingDashboardAction(null);
                    if (action === 'create') startCreatePromo();
                    else openPublishedPicker();
                  }}
                  className="whitespace-nowrap rounded-md border border-white/15 bg-transparent px-4 py-2 text-sm font-medium text-on-surface-variant transition-colors hover:border-red-400/70 hover:text-red-500"
                >
                  Continue anyway
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const action = pendingDashboardAction;
                    setPendingDashboardAction(null);
                    writeDraftNow();
                    if (action === 'create') startCreatePromo();
                    else openPublishedPicker();
                  }}
                  className="whitespace-nowrap rounded-md bg-primary px-4 py-2 text-sm font-semibold text-on-primary shadow-sm transition-opacity hover:opacity-95"
                >
                  {savedDraftSignature !== null ? 'Replace draft & continue' : 'Save & continue'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Discard Draft consent — deleting a draft is destructive, so confirm first */}
      {confirmDiscardDraft && (
        <div data-modal className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0" onClick={() => setConfirmDiscardDraft(false)} />
          <div className="relative z-10 w-full max-w-md rounded-xl border border-white/10 bg-black/10 p-5 text-on-surface shadow-2xl backdrop-blur-md">
            <h2 className="text-base font-semibold">Delete your saved draft?</h2>
            <p className="mt-2 text-sm text-on-surface-variant">
              Your saved draft will be deleted and you&apos;ll start fresh from what&apos;s currently
              published. This can&apos;t be undone.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmDiscardDraft(false)}
                className="rounded-md border border-white/10 bg-transparent px-4 py-2 text-sm font-medium text-on-surface-variant transition-colors hover:border-primary/70 hover:text-primary"
              >
                Keep editing
              </button>
              <button
                type="button"
                onClick={() => {
                  setConfirmDiscardDraft(false);
                  discardDraft();
                }}
                className="rounded-md bg-red-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-95"
              >
                Delete saved draft
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Replace-draft consent — there's only one draft slot, so saving again
          overwrites whatever's already there. */}
      {confirmReplaceDraft && (
        <div data-modal className="fixed inset-0 z-50 flex items-center justify-center bg-transparent p-4">
          <div className="absolute inset-0" onClick={() => setConfirmReplaceDraft(false)} />
          <div className="relative z-10 w-full max-w-md rounded-xl border border-white/10 bg-black/10 p-5 text-on-surface shadow-2xl backdrop-blur-md">
            <h2 className="text-base font-semibold">Replace saved draft?</h2>
            <p className="mt-2 text-sm text-on-surface-variant">
              You already have a saved draft. Saving now will replace it with what&apos;s currently in the editor.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmReplaceDraft(false)}
                className="rounded-md border border-white/10 bg-transparent px-4 py-2 text-sm font-medium text-on-surface-variant transition-colors hover:border-primary/70 hover:text-primary"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setConfirmReplaceDraft(false);
                  writeDraftNow();
                }}
                className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-on-primary shadow-sm transition-opacity hover:opacity-95"
              >
                Replace saved draft
              </button>
            </div>
          </div>
        </div>
      )}

      <Toast
        show={showToast}
        message={toastMessage}
        isError={toastIsError}
        action={toastAction}
        actionDurationMs={TOAST_ACTION_MS}
      />
    </div>
  );
}
