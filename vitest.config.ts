import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  resolve: {
    // Same '@/' alias the app uses, so tests import exactly what ships.
    alias: { '@': path.resolve(__dirname, 'src') },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text-summary', 'lcov'],
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
    },
  },
});
