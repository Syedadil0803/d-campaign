import type { CampaignConfig, PromoCard } from '@/types/campaign';

/**
 * What the page hands the promo editor.
 *
 * Its own file because two places need it: the section, and the card-lifecycle
 * hook, which takes the whole object rather than eleven of its members.
 */
export interface PromoSectionProps {
  config: CampaignConfig;
  // Accepts a value OR a functional updater (React useState setter). The
  // functional form matters where two setConfig calls fire in one batch (timer
  // onChange + onStateJson) and must merge instead of clobber via a stale closure.
  setConfig: (config: CampaignConfig | ((prev: CampaignConfig) => CampaignConfig)) => void;
  markChanged: () => void;
  toast: (
    message: string,
    isError?: boolean,
    action?: { label: string; onClick: () => void },
    durationMs?: number,
  ) => void;
  onSelectedVersionChange?: (versionId: string | null) => void;
  /**
   * Bumped once the real card arrives from the DB. The editor mounts on
   * defaultConfig, so anything seeded from the card at mount time (the Themes
   * revert point) has to be re-seeded when the actual card lands.
   */
  configLoadedSignal?: number;
  // "Go on air" is a one-click reactivation, only when the current content
  // matches what's published (same content, not new/edited).
  canReactivate: boolean;
  /**
   * The promo card currently PUBLISHED to the website.
   *
   * "Live" in My Published is a fact about the site, not about the editor —
   * it was previously derived from whichever variant matched the canvas, so
   * editing anything made the Live marker vanish from a campaign that was
   * still serving to visitors.
   */
  livePromoCard?: PromoCard;
  /**
   * The promo card as saved in My Draft.
   *
   * Compared field-by-field rather than trusting `draftUpToDate`, which is a
   * whole-config signature and drifts on HTML the app re-normalises itself.
   */
  draftPromoCard?: PromoCard | null;
  /** A different card just landed on the canvas (template, variant, fresh). */
  /** A different card landed on the canvas. */
  onCardReplaced?: () => void;
  /** The user has actually edited the countdown — they know where it lives. */
  onTimerEdited?: () => void;
  /**
   * The timer just switched itself on because a schedule was entered. Lets the
   * flow point at the countdown, which has only now appeared and is the one
   * field edited on the card rather than on the left.
   */
  onTimerAutoEnabled?: () => void;
  /**
   * "The canvas was cleared and nothing has been chosen since" — owned above
   * this component.
   *
   * It lived here as local state until switching tabs unmounted the editor and
   * took it with it: coming back, a cleared card lost its countdown and button
   * outlines and appeared to shrink. The flag describes the card, which
   * outlives this component, so it belongs where the card does.
   */
  blankStart: boolean;
  onBlankStartChange: (value: boolean) => void;
  /**
   * May the countdown switch itself on once the schedule is complete?
   *
   * Separate from `blankStart` because the two answer different questions.
   * Clearing the canvas leaves the end date missing, so filling it in later is
   * the user supplying the one fact the countdown needs — switching it on
   * there is a convenience. Create new asks for both dates up front, before
   * the card has been seen, so the same rule would decide for them.
   *
   * Both flows produce a blank card, which is why one flag cannot serve both.
   */
  timerAutoArmed: boolean;
  onTimerAutoArmedChange: (value: boolean) => void;
  // Immediate on/off (no Save → Publish) — the page persists the status change.
  onStop: () => void;
  onGoOnAir: () => void;
  // Bumped by the page when the user attempts to save/publish while the date
  // range is invalid — triggers the scroll-to + flash fallback guard.
  dateErrorPing?: number;
  // True when there are unsaved edits or a saved-but-unpublished draft. Drives
  // whether card-replacing actions (Start Fresh / Variant / Template) ask for
  // consent — we only warn when there's pending work that would be lost.
  hasUnsavedChanges: boolean;
  // Which top-level tab is active, and how to switch — used by the tab strip
  // above the preview.
  // Explicit "Save as draft" — the only way a draft is written now. Saves the
  // FULL editor state (announcement + promo), not just this promo card.
  /**
   * Increment to open Template Hub from outside — used by the build panel's
   * "Write it myself", so a new card is designed in the same picker as every
   * other template change.
   */
  openTemplatesSignal?: number;
  /** Returns to the build panel from the templates popup, when it opened it. */
  onTemplatesBack?: () => void;
  /**
   * A picker to open as soon as the editor is on screen, from the dashboard.
   *
   * An intent rather than a counter: the dashboard sets it in the same batch
   * that switches tabs, so this component MOUNTS with the request already
   * pending. A counter can't say "act now" across a mount — on first render
   * there's no previous value to have incremented from.
   */
  pendingPopup?: 'published' | 'draft' | null;
  /** Called once the pending popup has been opened, so it fires only once. */
  onPendingPopupHandled?: () => void;
  onSaveDraft: () => void;
  /** Saves the draft immediately, skipping the replace-confirm dialog. */
  onSaveDraftDirect?: (options?: { keepEditor?: boolean }) => void;
  savingDraft: boolean;
  // Deletes the single saved draft slot (called from the My Draft popup).
  onDeleteDraft: () => void;
  /** Editor content already matches the stored draft — nothing new to save. */
  draftUpToDate: boolean;
  /** A draft is already stored, so saving overwrites it rather than creating one. */
  draftExists: boolean;
  /** Takes the live card off the site AND clears it from the published config. */
  onRemoveLive: () => void;
  /** Opens the AI step for the card being edited. Omitted = chip not shown. */
  onUseAi?: () => void;
}
