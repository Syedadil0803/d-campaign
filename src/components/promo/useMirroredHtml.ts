'use client';

import { useEffect, type RefObject } from 'react';

/**
 * Keep an editor's DOM in step with the card without re-rendering it.
 *
 * Assigning innerHTML on every state change would reset the caret and drop any
 * selection the user is holding, so this writes only when the markup actually
 * differs. Written out once per field before this — four effects identical but
 * for the ref, the value and the dependency.
 *
 * @param remountKey extra dependency for fields whose element comes and goes
 *   with a toggle: the effect has to run again when it reappears, because the
 *   ref pointed at nothing the first time.
 */
export function useMirroredHtml(
  ref: RefObject<HTMLDivElement | null>,
  html: string | undefined,
  remountKey?: unknown,
) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const nextHtml = html || '';
    if (el.innerHTML !== nextHtml) {
      el.innerHTML = nextHtml;
    }
  }, [ref, html, remountKey]);
}

/**
 * Fills a panel editor from the stored HTML when it mounts. Switching to the
 * Video Story and back unmounts the Smart Card's editors, and usePromoEditorSync
 * only writes them when the card's content changes, so they came back empty.
 * Mount only, so it never writes over the user's typing.
 */
export function useFillOnMount(ref: RefObject<HTMLDivElement | null>, html: string | undefined) {
  useEffect(() => {
    const el = ref.current;
    if (el && el.innerHTML !== (html || '')) el.innerHTML = html || '';
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
