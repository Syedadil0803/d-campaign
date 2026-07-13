// Drop-in spelling + grammar checking for a contentEditable: <SpellCheck
// editorRef={ref} />. Set spellCheck={false} on the editor to avoid the
// browser's own squiggles doubling up.

'use client';

import type { RefObject } from 'react';
import { useSpellCheck } from '@/hooks/useSpellCheck';
import { SpellCheckOverlay } from './SpellCheckOverlay';

export function SpellCheck({
  editorRef,
  enabled = true,
}: {
  editorRef: RefObject<HTMLElement | null>;
  enabled?: boolean;
}): React.ReactElement {
  const { issues, rescan } = useSpellCheck(editorRef, enabled);
  return (
    <SpellCheckOverlay
      editorRef={editorRef}
      issues={issues}
      enabled={enabled}
      onAfterChange={rescan}
    />
  );
}
