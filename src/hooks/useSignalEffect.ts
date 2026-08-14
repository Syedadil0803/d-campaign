import { useEffect, useRef } from 'react';

/**
 * Runs `fn` when a counter prop is INCREMENTED — never on mount.
 *
 * These counters ask a child to do something once ("open My Published"). A
 * plain effect on the value re-fires on every remount, because the counter is
 * still whatever it was: leaving the promo tab and coming back re-opened the
 * panel that had been asked for minutes earlier.
 *
 * Seeding the ref with the incoming value on mount is the whole trick — the
 * first run compares equal and does nothing.
 */
export function useSignalEffect(signal: number | undefined, fn: () => void) {
  const previous = useRef(signal);
  const handler = useRef(fn);
  handler.current = fn;

  useEffect(() => {
    if (signal !== undefined && previous.current !== undefined && signal > previous.current) {
      handler.current();
    }
    previous.current = signal;
  }, [signal]);
}
