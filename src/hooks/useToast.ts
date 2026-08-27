'use client';

import { useRef, useState } from 'react';
import { type ToastAction, TOAST_ACTION_MS } from '@/components/shared/Toast';

/**
 * The one toast the campaign screens share.
 *
 * Owns everything it needs and takes nothing, so it is a boundary rather than
 * a pile of arguments — the same test usePromoDropdowns and usePromoUndo pass.
 */
export function useToast() {
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastIsError, setToastIsError] = useState(false);
  const [toastAction, setToastAction] = useState<ToastAction | null>(null);
  // One timer owns the toast's life, so a second toast doesn't inherit the
  // first one's countdown and vanish early.
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function dismissToast() {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = null;
    setShowToast(false);
    setToastAction(null);
  }

  /**
   * `action` turns the toast into a one-tap recovery offer ("Undo"). It gets a
   * longer life than a plain message, because it has to be read AND acted on.
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

  return {
    showToast,
    toastMessage,
    toastIsError,
    toastAction,
    toast,
    dismissToast,
  };
}
