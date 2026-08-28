import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    // Same '@/' alias the app uses, so tests import exactly what ships.
    alias: { '@': new URL('./src/', import.meta.url).pathname },
  },
  test: {
    // node by default: only the countdown's markup suite needs a DOM, and it
    // says so with a @vitest-environment comment of its own. Keeping the
    // default here means the other suites stay fast and it stays obvious which
    // code genuinely needs a browser.
    environment: 'node',
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      // The decision logic these tests exist to hold still. Coverage of the
      // whole codebase is a separate, later question — a number that counts
      // JSX would say nothing about whether these rules are protected.
      include: [
        'src/lib/promo/promoAuthorship.ts',
        'src/lib/promo/cardReplaceConsent.ts',
        'src/lib/promo/promoCardIdentity.ts',
        'src/lib/promo/lookSignature.ts',
        'src/lib/announcement/announcementWindow.ts',
        'src/lib/dateRange.ts',
        'src/lib/editor/timerUtils.ts',
      ],
      /**
       * The number has to mean one thing, so this list is exactly the shared
       * decision logic and the countdown — the rules the defect register
       * blames for most of its entries, which now live in one place each.
       *
       * timerUtils is included now that its markup builders are covered too.
       * Its suite is the only one needing a DOM, and it declares that itself
       * with a @vitest-environment comment rather than making every suite pay
       * for jsdom.
       */
    },
  },
});
