'use client';

import { messageLength } from '@/lib/announcement/messageLength';

/**
 * The character count under a text field, "22 chars", counted the way
 * Broadcasts counts its messages (messageLength: what a reader sees, an emoji
 * as one).
 *
 * Under every text box: the Smart Card's title, subtitle, description and
 * button, and the Video Story's title and button.
 */
export function CharCount({ html }: { html: string | undefined }) {
  return (
    <p className="mt-1 text-right text-[11px] tabular-nums text-on-surface-variant/50">{messageLength(html ?? '')} chars</p>
  );
}
