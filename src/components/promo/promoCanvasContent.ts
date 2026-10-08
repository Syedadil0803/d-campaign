import type { PromoCard, PromoField } from '@/types/campaign';
import { timerWordingIsOurs } from '@/lib/promo/promoAuthorship';
import { isBlankLook } from '@/lib/promo/lookSignature';
import { hasVisibleContent } from '@/lib/promo/promoEditorSelection';

/**
 * Which fields of the card hold the user's own words, and whether the canvas
 * is empty as a whole.
 *
 * Plain derivation from the card, moved out of PromoSection unchanged. Not a
 * hook: it holds no state, so it can be called anywhere in render.
 */
export function getPromoCanvasContent(promoCard: PromoCard) {
  const hasTitle = hasVisibleContent(promoCard.title);
  const hasSubtitle = hasVisibleContent(promoCard.subtitle);
  const hasDescription = hasVisibleContent(promoCard.description);
  const hasButtonText = hasVisibleContent(promoCard.buttonText);
  /**
   * Words the user wrote around the countdown — "Ends in", "left", and so on.
   *
   * The countdown token itself is stripped before checking, so an untouched
   * timer does not count as work. The timer can also arm itself when dates are
   * set, which is why enabling it is not the test: only text someone typed is.
   */
  /**
   * Wording the user put on the countdown — not the wording we shipped.
   *
   * The default is "Ends In {timer}", which strips to "Ends In" and read as
   * writing, so Clear and Save as draft stayed enabled on a canvas nobody had
   * touched. timerWordingIsOurs is the same test cardIsBlank uses, so the two
   * cannot disagree about it again.
   */
  const hasTimerText =
    !timerWordingIsOurs(promoCard.timerText) &&
    hasVisibleContent((promoCard.timerText || '').replace(/\{timer\}/gi, ''));
  // Nothing to save, nothing to clear: no visible text in any field AND the
  // style is still the fresh default. Styling-only work counts as work, so it
  // must keep both actions enabled — same test as startFreshPromoCard's no-op
  // guard.
  const canvasIsEmpty =
    !hasTitle &&
    !hasSubtitle &&
    !hasDescription &&
    !hasButtonText &&
    // Timer wording is work too. Without this, typing "Ends in" and nothing
    // else left Clear disabled — the canvas plainly was not blank, and the one
    // button that undoes it refused.
    !hasTimerText &&
    // Any blank palette, not this visit's. The palettes rotate per visit, so
    // comparing against today's would say a canvas cleared last week is not
    // empty — leaving Clear enabled on an empty card and treating it as work.
    isBlankLook(promoCard.style);

  return { hasTitle, hasSubtitle, hasDescription, hasButtonText, hasTimerText, canvasIsEmpty };
}

interface PromoPreviewFlagsArgs {
  showPersistentScaffold: boolean;
  currentField: PromoField | null;
  hasTitle: boolean;
  hasSubtitle: boolean;
  hasDescription: boolean;
  showButton: PromoCard['showButton'];
}

/**
 * Which fields the preview shows, keyed for its field table.
 *
 * Moved out of PromoSection unchanged; plain derivation, so not a hook.
 */
export function getPromoPreviewFlags({
  showPersistentScaffold,
  currentField,
  hasTitle,
  hasSubtitle,
  hasDescription,
  showButton,
}: PromoPreviewFlagsArgs) {
  const showContentScaffold =
    showPersistentScaffold ||
    currentField === "title" ||
    currentField === "subtitle" ||
    currentField === "description" ||
    currentField === "timer" ||
    currentField === "button";
  const showTitleInPreview = hasTitle || showContentScaffold;
  const showSubtitleInPreview = hasSubtitle || showContentScaffold;
  const showDescriptionInPreview = hasDescription || showContentScaffold;
  /** Keyed forms of the three flags above, for the preview's field table. */
  const previewFieldVisible = {
    title: showTitleInPreview,
    subtitle: showSubtitleInPreview,
    description: showDescriptionInPreview,
  } as const;
  const previewFieldHasContent = {
    title: hasTitle,
    subtitle: hasSubtitle,
    description: hasDescription,
  } as const;
  // The timer is opt-in via "Enable Timer" — it must follow the toggle only,
  // NOT the editing scaffold, so disabling it hides the countdown immediately.
  const showButtonInPreview = showButton;

  return { showButtonInPreview, previewFieldVisible, previewFieldHasContent };
}
