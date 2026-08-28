'use client';

import { useEffect, type RefObject } from 'react';
import type { CampaignConfig } from '@/types/campaign';
import { useMirroredHtml } from '@/components/promo/useMirroredHtml';
import { getRequiredCardWidth } from '@/lib/promo/promoMeasure';
import {
  buildTimerDisplayHtml,
  refreshTimerValueSpans,
  syncTimerElement,
  calculateTimeRemaining as calcTimerRemaining,
} from '@/lib/editor/timerUtils';

type Editor = RefObject<HTMLDivElement | null>;

interface UsePromoEditorSyncArgs {
  config: CampaignConfig;
  /** The panel's four editors and the countdown. */
  titleRef: Editor;
  subtitleRef: Editor;
  descRef: Editor;
  buttonRef: Editor;
  timerRef: Editor;
  /** The preview's own copies of the same five. */
  previewTitleRef: Editor;
  previewSubtitleRef: Editor;
  previewDescriptionRef: Editor;
  previewButtonRef: Editor;
  previewTimerRef: Editor;
  activeEditorRef: Editor;
  lastValidHtmlRef: RefObject<Record<string, string>>;
  /**
   * The signature of what was last written into the editors.
   *
   * Passed in rather than owned: usePromoRichText writes it as well, after a
   * text edit, so that the seed effect below does not then fire on the user's
   * own typing and reset their caret.
   */
  lastSyncedPromoRef: RefObject<string | null>;
  setCardWidth: (width: number) => void;
  /** Ticks once a second; the countdown's numbers follow it. */
  currentTime: number;
}

/**
 * Keeping the contentEditable editors in step with the stored card.
 *
 * These cannot be rendered from state like ordinary inputs: writing to them on
 * every render would throw away the caret and any selection the user is
 * holding. So each is written to only when the value it shows has actually
 * changed, and never while it is the one being typed in.
 *
 * Owns the signature of what was last written, which is the whole mechanism —
 * without it the seed effect fires on its own output.
 */
export function usePromoEditorSync({
  config,
  titleRef,
  subtitleRef,
  descRef,
  buttonRef,
  timerRef,
  previewTitleRef,
  previewSubtitleRef,
  previewDescriptionRef,
  previewButtonRef,
  previewTimerRef,
  activeEditorRef,
  lastValidHtmlRef,
  lastSyncedPromoRef,
  setCardWidth,
  currentTime,
}: UsePromoEditorSyncArgs) {
  // Populate editors from config on mount
  useEffect(() => {
    const sig = JSON.stringify({
      t: config.promoCard.title,
      s: config.promoCard.subtitle,
      d: config.promoCard.description,
      b: config.promoCard.buttonText,
    });
    if (sig === lastSyncedPromoRef.current) return;
    lastSyncedPromoRef.current = sig;
    if (titleRef.current)
      titleRef.current.innerHTML = config.promoCard.title || "";
    if (subtitleRef.current)
      subtitleRef.current.innerHTML = config.promoCard.subtitle || "";
    if (descRef.current)
      descRef.current.innerHTML = config.promoCard.description || "";
    if (buttonRef.current)
      buttonRef.current.innerHTML = config.promoCard.buttonText || "";
    lastValidHtmlRef.current = {
      title: config.promoCard.title || '',
      subtitle: config.promoCard.subtitle || '',
      description: config.promoCard.description || '',
    };
    setCardWidth(config.promoCard.cardWidth || getRequiredCardWidth(
      [
        { html: config.promoCard.title || '', field: 'title' },
        { html: config.promoCard.subtitle || '', field: 'subtitle' },
        { html: config.promoCard.description || '', field: 'description' },
      ],
      config.promoCard.showTimer
        ? buildTimerDisplayHtml(
            config.promoCard.timerText ?? '',
            calcTimerRemaining(config.promoCard.endDate || ''),
          )
        : '',
    ));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.promoCard.title, config.promoCard.subtitle, config.promoCard.description, config.promoCard.buttonText, config.promoCard.cardWidth, config.promoCard.timerText, config.promoCard.showTimer, config.promoCard.endDate]);

  // Keep the preview's editors in step with the card without re-rendering
  // them, so a selection being held is not thrown away. See useMirroredHtml.
  useMirroredHtml(previewTitleRef, config.promoCard.title);
  useMirroredHtml(previewSubtitleRef, config.promoCard.subtitle);
  useMirroredHtml(previewDescriptionRef, config.promoCard.description);
  useMirroredHtml(
    previewButtonRef,
    config.promoCard.buttonText,
    config.promoCard.showButton,
  );

  // Structural sync: prefix/suffix HTML + the fixed countdown chip. Numbers are
  // refreshed separately (tick effect below) so typing never resets the caret.
  useEffect(() => {
    syncTimerElement(
      previewTimerRef.current,
      config.promoCard.timerText ?? "",
      config.promoCard.endDate || "",
      activeEditorRef.current,
    );
    // showTimer is a dep so the preview repopulates when the timer is toggled
    // back on (the element unmounts/remounts empty otherwise).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    config.promoCard.timerText,
    config.promoCard.endDate,
    config.promoCard.showTimer,
  ]);

  useEffect(() => {
    syncTimerElement(
      timerRef.current,
      config.promoCard.timerText ?? "",
      config.promoCard.endDate || "",
      activeEditorRef.current,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.promoCard.timerText, config.promoCard.endDate, config.promoCard.showTimer]);

  // Live tick: update only the fixed chip's text in-place (no innerHTML reset,
  // so the caret and any prefix/suffix styling are preserved while editing).
  useEffect(() => {
    const value = calcTimerRemaining(config.promoCard.endDate || "");
    [timerRef.current, previewTimerRef.current].forEach((el) => {
      if (!el) return;
      // Don't write into the editor being typed in — updating the number spans
      // resets the caret to the start (typing feels jumpy). It resumes ticking
      // once focus leaves.
      if (el === activeEditorRef.current || document.activeElement === el) return;
      refreshTimerValueSpans(el, value);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTime, config.promoCard.endDate]);
}
