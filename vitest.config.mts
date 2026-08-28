import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    // Same '@/' alias the app uses, so tests import exactly what ships.
    alias: { '@': new URL('./src/', import.meta.url).pathname },
  },
  test: {
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
      ],
      /**
       * The number has to mean one thing, so this list is exactly the shared
       * decision logic — the rules the defect register blames for most of its
       * entries, which now live in one place each and are pure.
       *
       * lib/editor/timerUtils.ts is deliberately NOT here, though one of its
       * functions is tested. The rest of it builds markup through DOMParser
       * and needs a browser environment to exercise at all; counting those
       * lines as untested would say the decision logic is thinly covered when
       * it is not, and counting them as out of scope without saying so would
       * be worse. They are a later phase, with jsdom.
       */
    },
  },
});
