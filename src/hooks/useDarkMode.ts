'use client';

import { useEffect, useState } from 'react';

const STORAGE_KEY = 'darkMode';

/**
 * Light or dark, remembered per browser.
 *
 * Three pieces that only make sense together: the state, the class on the root
 * element that the stylesheet keys off, and the stored choice. They were three
 * separate places in the page — the toggle wrote to storage, one effect read
 * it on mount alongside the config load, and another applied the class — so
 * the rule about how the theme is decided was never in one piece.
 *
 * The stored value is read in an effect rather than as the initial state
 * because the server renders this page too, and localStorage does not exist
 * there: seeding from it directly would make the first client render disagree
 * with the server's.
 */
export function useDarkMode() {
  const [isDarkMode, setIsDarkMode] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    setIsDarkMode(
      saved !== null
        ? saved === 'true'
        : window.matchMedia('(prefers-color-scheme: dark)').matches,
    );
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDarkMode);
  }, [isDarkMode]);

  function toggleDarkMode() {
    setIsDarkMode((previous) => {
      const next = !previous;
      localStorage.setItem(STORAGE_KEY, next.toString());
      return next;
    });
  }

  return { isDarkMode, toggleDarkMode };
}
